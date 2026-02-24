"""Function call evaluation logic for golden tests.

This module provides utilities for comparing expected vs actual function calls
and generating accuracy reports.
"""

import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class EvaluationResult:
    """Result of evaluating a single test case."""

    case_id: str
    passed: bool
    expected_function: Optional[str]
    actual_function: Optional[str]
    param_matches: Dict[str, bool] = field(default_factory=dict)
    error_message: Optional[str] = None

    @property
    def function_match(self) -> bool:
        """Check if function names match."""
        return self.expected_function == self.actual_function

    @property
    def all_params_match(self) -> bool:
        """Check if all expected params were found."""
        if not self.param_matches:
            return True
        return all(self.param_matches.values())


@dataclass
class AccuracyReport:
    """Aggregated accuracy metrics across all test cases."""

    total_cases: int
    passed_cases: int
    failed_cases: int
    results_by_category: Dict[str, Dict[str, int]] = field(default_factory=dict)
    failed_results: List[EvaluationResult] = field(default_factory=list)

    @property
    def accuracy(self) -> float:
        """Overall accuracy as a percentage."""
        if self.total_cases == 0:
            return 0.0
        return (self.passed_cases / self.total_cases) * 100

    def category_accuracy(self, category: str) -> float:
        """Accuracy for a specific category."""
        if category not in self.results_by_category:
            return 0.0
        stats = self.results_by_category[category]
        total = stats.get("total", 0)
        if total == 0:
            return 0.0
        return (stats.get("passed", 0) / total) * 100


class FunctionCallEvaluator:
    """Evaluates function calls against expected golden cases."""

    def evaluate(
        self,
        case_id: str,
        expected_function: Optional[str],
        expected_params: Optional[Dict[str, Any]],
        actual_function: Optional[str],
        actual_params: Optional[Dict[str, Any]],
    ) -> EvaluationResult:
        """Evaluate a single function call against expectations.

        Args:
            case_id: Unique identifier for the test case
            expected_function: Expected function name (None = no function expected)
            expected_params: Expected parameters (subset match)
            actual_function: Actual function called (None = no function called)
            actual_params: Actual parameters passed

        Returns:
            EvaluationResult with match details
        """
        result = EvaluationResult(
            case_id=case_id,
            passed=False,
            expected_function=expected_function,
            actual_function=actual_function,
        )

        # Check function name match
        if expected_function != actual_function:
            result.error_message = (
                f"Function mismatch: expected '{expected_function}', "
                f"got '{actual_function}'"
            )
            return result

        # If no function expected and none called, it's a pass
        if expected_function is None and actual_function is None:
            result.passed = True
            return result

        # Check parameter matches (subset match - expected params must be present)
        if expected_params:
            actual_params = actual_params or {}
            for param_name, expected_value in expected_params.items():
                actual_value = actual_params.get(param_name)
                matches = self._param_matches(expected_value, actual_value)
                result.param_matches[param_name] = matches

            if not result.all_params_match:
                mismatched = [k for k, v in result.param_matches.items() if not v]
                result.error_message = f"Parameter mismatch for: {mismatched}"
                return result

        result.passed = True
        return result

    def _param_matches(self, expected: Any, actual: Any) -> bool:
        """Check if actual parameter matches expected.

        Performs flexible matching:
        - Exact match for strings/numbers
        - Subset match for lists (expected items must be in actual)
        - Substring match for query-like strings
        """
        if expected is None:
            return True

        if actual is None:
            return False

        # List matching - expected items should be subset of actual
        if isinstance(expected, list):
            if not isinstance(actual, list):
                return False
            return all(item in actual for item in expected)

        # String matching - allow substring/flexible matching for queries
        if isinstance(expected, str) and isinstance(actual, str):
            # Normalize for comparison
            expected_lower = expected.lower().strip()
            actual_lower = actual.lower().strip()
            # Allow substring match or close match
            return (
                expected_lower == actual_lower
                or expected_lower in actual_lower
                or actual_lower in expected_lower
            )

        # Numeric matching
        if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
            return expected == actual

        # Fallback to exact match
        return expected == actual

    def generate_report(
        self, results: List[EvaluationResult], categories: Dict[str, str]
    ) -> AccuracyReport:
        """Generate an accuracy report from evaluation results.

        Args:
            results: List of EvaluationResult objects
            categories: Mapping of case_id to category

        Returns:
            AccuracyReport with aggregated metrics
        """
        report = AccuracyReport(
            total_cases=len(results),
            passed_cases=sum(1 for r in results if r.passed),
            failed_cases=sum(1 for r in results if not r.passed),
        )

        # Aggregate by category
        for result in results:
            category = categories.get(result.case_id, "unknown")
            if category not in report.results_by_category:
                report.results_by_category[category] = {"total": 0, "passed": 0}

            report.results_by_category[category]["total"] += 1
            if result.passed:
                report.results_by_category[category]["passed"] += 1
            else:
                report.failed_results.append(result)

        return report


def extract_function_call_from_events(events: List[Dict[str, Any]]) -> tuple:
    """Extract function call info from SSE events.

    Args:
        events: List of SSE event dictionaries

    Returns:
        Tuple of (function_name, arguments) or (None, None)
    """
    function_name = None
    arguments = None
    partial_json = ""

    for event in events:
        event_type = event.get("event")
        data = event.get("data", {})

        if event_type == "function_call":
            function_name = data.get("name")

        if event_type == "content_delta":
            # Accumulate partial JSON for tool arguments
            if "partial_json" in data:
                partial_json += data["partial_json"]

    # Parse accumulated JSON arguments
    if partial_json:
        try:
            arguments = json.loads(partial_json)
        except json.JSONDecodeError:
            arguments = None

    return function_name, arguments


def format_report_markdown(report: AccuracyReport) -> str:
    """Format an accuracy report as markdown.

    Args:
        report: AccuracyReport to format

    Returns:
        Markdown-formatted string
    """
    lines = [
        "# Function Calling Golden Test Report",
        "",
        "## Summary",
        "",
        f"- **Total Cases**: {report.total_cases}",
        f"- **Passed**: {report.passed_cases}",
        f"- **Failed**: {report.failed_cases}",
        f"- **Overall Accuracy**: {report.accuracy:.1f}%",
        "",
        "## Results by Category",
        "",
        "| Category | Total | Passed | Accuracy |",
        "|----------|-------|--------|----------|",
    ]

    for category, stats in sorted(report.results_by_category.items()):
        total = stats["total"]
        passed = stats["passed"]
        accuracy = (passed / total * 100) if total > 0 else 0
        lines.append(f"| {category} | {total} | {passed} | {accuracy:.1f}% |")

    if report.failed_results:
        lines.extend(
            [
                "",
                "## Failed Cases",
                "",
            ]
        )
        for result in report.failed_results:
            lines.extend(
                [
                    f"### {result.case_id}",
                    f"- Expected: `{result.expected_function}`",
                    f"- Actual: `{result.actual_function}`",
                    f"- Error: {result.error_message}",
                    "",
                ]
            )

    return "\n".join(lines)
