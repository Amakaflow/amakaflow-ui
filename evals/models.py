"""Data models for the eval framework."""

import json
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class EvalCase:
    """A single eval prompt with expected behavior and rubric."""

    id: str
    prompt: str
    suite: str
    # Tool selection fields
    expected_tool: str | None = None
    not_tools: list[str] = field(default_factory=list)
    # Rubric fields (for LLM-as-judge)
    rubric: dict[str, str] | str | None = None
    expected_behavior: str | None = None
    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class CriterionScore:
    """Score for a single rubric criterion."""

    key: str
    score: float  # 0.0 to 1.0
    explanation: str = ""


@dataclass
class JudgeResult:
    """Result from judging a single eval case."""

    case_id: str
    score: float  # 0.0 to 1.0 (overall for this case)
    passed: bool
    criteria: list[CriterionScore] = field(default_factory=list)
    error: str | None = None
    response_text: str = ""
    tool_called: str | None = None
    latency_ms: float = 0.0


@dataclass
class SuiteResult:
    """Aggregated results for an eval suite."""

    suite_name: str
    total_cases: int
    passed_cases: int
    failed_cases: int
    average_score: float
    results: list[JudgeResult] = field(default_factory=list)

    @property
    def pass_rate(self) -> float:
        if self.total_cases == 0:
            return 0.0
        return (self.passed_cases / self.total_cases) * 100

    def to_dict(self) -> dict[str, Any]:
        return {
            "suite_name": self.suite_name,
            "total_cases": self.total_cases,
            "passed_cases": self.passed_cases,
            "failed_cases": self.failed_cases,
            "average_score": round(self.average_score, 4),
            "pass_rate": round(self.pass_rate, 2),
            "results": [asdict(r) for r in self.results],
        }


@dataclass
class EvalReport:
    """Full eval run report."""

    timestamp: str = field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%S"))
    overall_score: float = 0.0
    suites: list[SuiteResult] = field(default_factory=list)
    regressions: list[dict[str, Any]] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def passed(self) -> bool:
        """True if all suites have at least one passing case."""
        return all(s.passed_cases > 0 for s in self.suites)

    def above_threshold(self, threshold: float) -> bool:
        """Check if overall score meets threshold.

        Args:
            threshold: Threshold as a percentage (0-100).
        """
        return (self.overall_score * 100) >= threshold

    def to_dict(self) -> dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "overall_score": round(self.overall_score, 4),
            "suites": [s.to_dict() for s in self.suites],
            "regressions": self.regressions,
            "metadata": self.metadata,
        }

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_dict(), indent=2))

    @classmethod
    def load(cls, path: Path) -> "EvalReport":
        data = json.loads(path.read_text())
        report = cls(
            timestamp=data["timestamp"],
            overall_score=data["overall_score"],
            regressions=data.get("regressions", []),
            metadata=data.get("metadata", {}),
        )
        for suite_data in data.get("suites", []):
            results = []
            for r in suite_data.get("results", []):
                criteria = [
                    CriterionScore(**c) for c in r.get("criteria", [])
                ]
                results.append(JudgeResult(
                    case_id=r["case_id"],
                    score=r["score"],
                    passed=r["passed"],
                    criteria=criteria,
                    error=r.get("error"),
                    response_text=r.get("response_text", ""),
                    tool_called=r.get("tool_called"),
                    latency_ms=r.get("latency_ms", 0.0),
                ))
            report.suites.append(SuiteResult(
                suite_name=suite_data["suite_name"],
                total_cases=suite_data["total_cases"],
                passed_cases=suite_data["passed_cases"],
                failed_cases=suite_data["failed_cases"],
                average_score=suite_data["average_score"],
                results=results,
            ))
        return report
