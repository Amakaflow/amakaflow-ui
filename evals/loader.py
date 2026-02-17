"""Dataset loader for eval suites."""

import json
from pathlib import Path

from evals.config import DATASETS_DIR, SUITE_REGISTRY
from evals.models import EvalCase


class DatasetError(Exception):
    """Raised when a dataset file is invalid."""


def load_dataset(suite_name: str, datasets_dir: Path | None = None) -> list[EvalCase]:
    """Load eval cases from a JSONL dataset file.

    Args:
        suite_name: Name of the suite (must be in SUITE_REGISTRY).
        datasets_dir: Override datasets directory (for testing).

    Returns:
        List of EvalCase objects.

    Raises:
        DatasetError: If the dataset is missing or malformed.
    """
    if suite_name not in SUITE_REGISTRY:
        raise DatasetError(
            f"Unknown suite: {suite_name!r}. "
            f"Available: {', '.join(SUITE_REGISTRY.keys())}"
        )

    config = SUITE_REGISTRY[suite_name]
    base_dir = datasets_dir or DATASETS_DIR
    dataset_path = base_dir / config.dataset_file

    if not dataset_path.exists():
        raise DatasetError(f"Dataset file not found: {dataset_path}")

    cases = []
    for line_num, line in enumerate(dataset_path.read_text().splitlines(), start=1):
        line = line.strip()
        if not line:
            continue

        try:
            data = json.loads(line)
        except json.JSONDecodeError as e:
            raise DatasetError(
                f"{dataset_path.name}:{line_num}: Invalid JSON: {e}"
            ) from e

        case = _parse_case(data, suite_name, dataset_path.name, line_num)
        cases.append(case)

    if not cases:
        raise DatasetError(f"Dataset {dataset_path.name} is empty")

    return cases


def _parse_case(
    data: dict, suite_name: str, filename: str, line_num: int
) -> EvalCase:
    """Parse a single JSON line into an EvalCase."""
    if "prompt" not in data:
        raise DatasetError(
            f"{filename}:{line_num}: Missing required field 'prompt'"
        )

    case_id = data.get("id", f"{suite_name}_{line_num:03d}")
    metadata = data.get("metadata", {})
    # Track which fields were present in the raw data for validation
    metadata["_raw_fields"] = list(data.keys())

    return EvalCase(
        id=case_id,
        prompt=data["prompt"],
        suite=suite_name,
        expected_tool=data.get("expected_tool"),
        not_tools=data.get("not_tools", []),
        rubric=data.get("rubric"),
        expected_behavior=data.get("expected_behavior"),
        metadata=metadata,
    )


def list_available_suites() -> list[str]:
    """Return names of all registered eval suites."""
    return list(SUITE_REGISTRY.keys())


def validate_dataset(suite_name: str, datasets_dir: Path | None = None) -> list[str]:
    """Validate a dataset without loading it for eval.

    Returns a list of validation errors (empty if valid).
    """
    errors = []
    try:
        cases = load_dataset(suite_name, datasets_dir)
    except DatasetError as e:
        return [str(e)]

    config = SUITE_REGISTRY[suite_name]

    for case in cases:
        if config.judge_type == "deterministic":
            # expected_tool must be present in the raw data (can be null/None)
            raw_fields = case.metadata.get("_raw_fields", [])
            if "expected_tool" not in raw_fields:
                errors.append(
                    f"Case {case.id}: deterministic suite requires 'expected_tool'"
                )
        elif config.judge_type == "llm":
            if case.rubric is None and case.expected_behavior is None:
                errors.append(
                    f"Case {case.id}: LLM suite requires 'rubric' or 'expected_behavior'"
                )

    return errors
