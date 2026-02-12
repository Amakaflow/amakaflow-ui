"""Golden tests for workout quality evaluation.

Validates the WorkoutQualityEvaluator against 25 human-scored test cases.
Run with: pytest tests/golden/test_golden_workout_quality.py -v

Part of AMA-567 Phase F.
"""

from pathlib import Path
from typing import Any, Dict, List

import pytest
import yaml

from backend.services.workout_quality_evaluator import WorkoutQualityEvaluator


def _load_cases() -> List[Dict[str, Any]]:
    path = Path(__file__).parent / "workout_quality_cases.yaml"
    with open(path) as f:
        data = yaml.safe_load(f)
    return data.get("cases", [])


def _case_id(case: Dict[str, Any]) -> str:
    return case.get("id", "unknown")


CASES = _load_cases()
EVALUATOR = WorkoutQualityEvaluator()


@pytest.mark.golden
@pytest.mark.parametrize("case", CASES, ids=_case_id)
def test_quality_score(case: Dict[str, Any]):
    """Validate quality score for a golden test case."""
    workout = case["input"]
    equipment = case.get("equipment")
    score = EVALUATOR.evaluate(workout, requested_equipment=equipment)

    # Check minimum score bound
    if "expected_min_score" in case:
        assert score.overall >= case["expected_min_score"], (
            f"Score {score.overall:.2f} below minimum {case['expected_min_score']} "
            f"for {case['id']}. Issues: {score.issues}"
        )

    # Check maximum score bound
    if "expected_max_score" in case:
        assert score.overall <= case["expected_max_score"], (
            f"Score {score.overall:.2f} above maximum {case['expected_max_score']} "
            f"for {case['id']}. Issues: {score.issues}"
        )

    # Check expected issues
    for expected_issue in case.get("expected_issues", []):
        found = any(expected_issue.lower() in issue.lower() for issue in score.issues)
        assert found, (
            f"Expected issue '{expected_issue}' not found in {score.issues} "
            f"for {case['id']}"
        )
