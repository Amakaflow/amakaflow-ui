"""Eval runner — orchestrates eval runs and produces scored reports.

Usage:
    python -m evals.runner                              # Run all suites
    python -m evals.runner --suite tool-selection        # Run specific suite
    python -m evals.runner --suite tool-selection,safety # Run multiple suites
    python -m evals.runner --threshold 80                # Fail if score < 80%
    python -m evals.runner --compare reports/last.json   # Compare against baseline
    python -m evals.runner --output eval-results.json    # Write report to file
    python -m evals.runner --dry-run                     # Validate datasets only
"""

import argparse
import json
import logging
import sys
import time
from pathlib import Path

import httpx

from evals.config import (
    DEFAULT_CHAT_API_URL,
    REGRESSION_THRESHOLD_PCT,
    REPORTS_DIR,
    SUITE_REGISTRY,
)
from evals.loader import DatasetError, list_available_suites, load_dataset, validate_dataset
from evals.models import EvalReport, JudgeResult, SuiteResult

logger = logging.getLogger(__name__)


def _send_prompt(client: httpx.Client, prompt: str) -> tuple[str, str | None]:
    """Send a prompt to chat-api and extract response text and tool called.

    Returns:
        (response_text, tool_called) tuple.
    """
    resp = client.post(
        "/chat/stream",
        json={
            "message": prompt,
            "session_id": "eval-session",
        },
        headers={"X-Test-Auth": "true", "X-Test-User-Id": "eval-user"},
        timeout=60.0,
    )
    resp.raise_for_status()

    response_text = ""
    tool_called = None

    for line in resp.text.splitlines():
        if not line.startswith("data: "):
            continue
        data_str = line[6:]
        if data_str == "[DONE]":
            break
        try:
            event = json.loads(data_str)
        except json.JSONDecodeError:
            continue

        event_type = event.get("event", event.get("type", ""))
        data = event.get("data", event)

        if event_type == "function_call":
            tool_called = data.get("name")
        elif event_type == "content_delta":
            response_text += data.get("text", "")

    return response_text, tool_called


def _get_judge(suite_name: str):
    """Get the appropriate judge for a suite."""
    config = SUITE_REGISTRY[suite_name]
    return config.create_judge()


def run_suite(
    suite_name: str,
    client: httpx.Client,
    dry_run: bool = False,
) -> SuiteResult:
    """Run a single eval suite and return results."""
    cases = load_dataset(suite_name)
    judge = _get_judge(suite_name)

    results: list[JudgeResult] = []

    for case in cases:
        if dry_run:
            results.append(JudgeResult(
                case_id=case.id,
                score=1.0,
                passed=True,
            ))
            continue

        start = time.monotonic()
        try:
            response_text, tool_called = _send_prompt(client, case.prompt)
        except httpx.HTTPError as e:
            logger.error("HTTP error for case %s: %s", case.id, e)
            results.append(JudgeResult(
                case_id=case.id,
                score=0.0,
                passed=False,
                error=f"HTTP error: {e}",
            ))
            continue

        elapsed_ms = (time.monotonic() - start) * 1000

        result = judge.judge(case, response_text, tool_called)
        result.latency_ms = elapsed_ms
        results.append(result)

    passed = sum(1 for r in results if r.passed)
    failed = len(results) - passed
    avg_score = sum(r.score for r in results) / len(results) if results else 0.0

    return SuiteResult(
        suite_name=suite_name,
        total_cases=len(results),
        passed_cases=passed,
        failed_cases=failed,
        average_score=avg_score,
        results=results,
    )


def detect_regressions(
    current: EvalReport, baseline: EvalReport
) -> list[dict]:
    """Compare current report against baseline, flag regressions."""
    regressions = []

    baseline_scores = {s.suite_name: s.average_score for s in baseline.suites}

    for suite in current.suites:
        baseline_score = baseline_scores.get(suite.suite_name)
        if baseline_score is None:
            continue

        drop = (baseline_score - suite.average_score) * 100
        if drop > REGRESSION_THRESHOLD_PCT:
            regressions.append({
                "suite": suite.suite_name,
                "baseline_score": round(baseline_score * 100, 2),
                "current_score": round(suite.average_score * 100, 2),
                "drop_pct": round(drop, 2),
            })

    return regressions


def run_evals(
    suites: list[str] | None = None,
    chat_api_url: str = DEFAULT_CHAT_API_URL,
    threshold: float | None = None,
    compare_path: Path | None = None,
    output_path: Path | None = None,
    dry_run: bool = False,
) -> EvalReport:
    """Run eval suites and produce a report.

    Args:
        suites: Suite names to run (None = all).
        chat_api_url: Base URL of the chat-api to test.
        threshold: Minimum overall score (0-100). Exit non-zero if below.
        compare_path: Path to baseline report JSON for regression detection.
        output_path: Path to write the report JSON.
        dry_run: Validate datasets without calling APIs.

    Returns:
        EvalReport with all results.
    """
    suite_names = suites or list_available_suites()

    # Validate all datasets first
    all_errors = []
    for name in suite_names:
        errors = validate_dataset(name)
        all_errors.extend(errors)

    if all_errors:
        raise DatasetError(
            "Dataset validation failed:\n" + "\n".join(f"  - {e}" for e in all_errors)
        )

    report = EvalReport(
        metadata={
            "chat_api_url": chat_api_url,
            "dry_run": dry_run,
            "suites_requested": suite_names,
        },
    )

    with httpx.Client(base_url=chat_api_url) as client:
        for name in suite_names:
            logger.info("Running suite: %s", name)
            result = run_suite(name, client, dry_run=dry_run)
            report.suites.append(result)
            logger.info(
                "  %s: %.1f%% (%d/%d passed)",
                name,
                result.pass_rate,
                result.passed_cases,
                result.total_cases,
            )

    # Calculate overall score
    if report.suites:
        report.overall_score = (
            sum(s.average_score for s in report.suites) / len(report.suites)
        )

    # Regression detection
    if compare_path and compare_path.exists():
        baseline = EvalReport.load(compare_path)
        report.regressions = detect_regressions(report, baseline)

    # Save report
    if output_path:
        report.save(output_path)
    else:
        # Save to reports/ with timestamp
        report_path = REPORTS_DIR / f"{report.timestamp.replace(':', '-')}.json"
        report.save(report_path)

    return report


def format_summary(report: EvalReport) -> str:
    """Format a human-readable summary of the eval report."""
    lines = [
        f"Eval Report — {report.timestamp}",
        f"Overall Score: {report.overall_score * 100:.1f}%",
        "",
    ]

    for suite in report.suites:
        status = "PASS" if suite.pass_rate >= 80 else "WARN" if suite.pass_rate >= 60 else "FAIL"
        lines.append(
            f"  [{status}] {suite.suite_name}: "
            f"{suite.average_score * 100:.1f}% "
            f"({suite.passed_cases}/{suite.total_cases} passed)"
        )

        # Show failed cases
        for r in suite.results:
            if not r.passed:
                error_info = r.error or "; ".join(
                    f"{c.key}: {c.explanation}" for c in r.criteria if c.score < 1.0
                )
                lines.append(f"    FAIL {r.case_id}: {error_info}")

    if report.regressions:
        lines.extend(["", "REGRESSIONS DETECTED:"])
        for reg in report.regressions:
            lines.append(
                f"  {reg['suite']}: {reg['baseline_score']}% -> "
                f"{reg['current_score']}% (dropped {reg['drop_pct']}%)"
            )

    return "\n".join(lines)


def main() -> int:
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="AmakaFlow chat-api eval runner",
    )
    parser.add_argument(
        "--suite",
        type=str,
        default=None,
        help="Comma-separated suite names (default: all)",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=None,
        help="Minimum overall score (0-100). Exit 1 if below.",
    )
    parser.add_argument(
        "--compare",
        type=Path,
        default=None,
        help="Baseline report JSON for regression detection",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Write report JSON to this path",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate datasets without calling APIs",
    )
    parser.add_argument(
        "--api-url",
        type=str,
        default=DEFAULT_CHAT_API_URL,
        help=f"Chat API URL (default: {DEFAULT_CHAT_API_URL})",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose logging",
    )

    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s %(name)s: %(message)s",
    )

    suites = args.suite.split(",") if args.suite else None

    try:
        report = run_evals(
            suites=suites,
            chat_api_url=args.api_url,
            threshold=args.threshold,
            compare_path=args.compare,
            output_path=args.output,
            dry_run=args.dry_run,
        )
    except DatasetError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    print(format_summary(report))

    # Threshold check
    if args.threshold is not None:
        score_pct = report.overall_score * 100
        if score_pct < args.threshold:
            print(
                f"\nFAILED: Overall score {score_pct:.1f}% "
                f"is below threshold {args.threshold}%",
                file=sys.stderr,
            )
            return 1

    # Regression check
    if report.regressions:
        print("\nWARNING: Regressions detected (see above)", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
