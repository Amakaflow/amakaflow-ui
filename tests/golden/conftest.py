"""Fixtures for golden function calling tests."""

import functools
from pathlib import Path
from typing import Any, Dict, List

import pytest
import yaml

from tests.golden.evaluator import FunctionCallEvaluator


@pytest.fixture(scope="session")
def golden_cases_path() -> Path:
    """Path to the golden test cases YAML file."""
    return Path(__file__).parent / "golden_cases.yaml"


@pytest.fixture(scope="session")
def all_golden_cases(golden_cases_path: Path) -> List[Dict[str, Any]]:
    """Load all golden test cases from YAML."""
    with open(golden_cases_path, "r") as f:
        data = yaml.safe_load(f)
    return data.get("cases", [])


@pytest.fixture(scope="session")
def golden_cases_by_category(
    all_golden_cases: List[Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    """Group golden cases by category."""
    by_category: Dict[str, List[Dict[str, Any]]] = {}
    for case in all_golden_cases:
        category = case.get("category", "unknown")
        if category not in by_category:
            by_category[category] = []
        by_category[category].append(case)
    return by_category


@pytest.fixture(scope="session")
def case_categories(all_golden_cases: List[Dict[str, Any]]) -> Dict[str, str]:
    """Mapping of case_id to category."""
    return {case["id"]: case.get("category", "unknown") for case in all_golden_cases}


@pytest.fixture
def evaluator() -> FunctionCallEvaluator:
    """Function call evaluator instance."""
    return FunctionCallEvaluator()


@functools.lru_cache(maxsize=1)
def _cached_golden_cases() -> tuple:
    """Load and cache golden test cases (tuple for hashability)."""
    cases_path = Path(__file__).parent / "golden_cases.yaml"
    with open(cases_path, "r") as f:
        data = yaml.safe_load(f)
    return tuple(data.get("cases", []))


def load_golden_cases() -> List[Dict[str, Any]]:
    """Load golden test cases for parametrization.

    This function is called at collection time, so it needs to load
    the YAML file directly rather than using fixtures. Results are
    cached to avoid repeated file I/O.
    """
    return list(_cached_golden_cases())


def case_id_func(case: Dict[str, Any]) -> str:
    """Generate test ID from case."""
    return case.get("id", "unknown")


# Category-specific case loaders for selective testing (use cached data)
def load_search_cases() -> List[Dict[str, Any]]:
    """Load only search_workout_library test cases."""
    return [c for c in _cached_golden_cases() if c.get("category") == "search"]


def load_calendar_cases() -> List[Dict[str, Any]]:
    """Load only add_workout_to_calendar test cases."""
    return [c for c in _cached_golden_cases() if c.get("category") == "calendar"]


def load_generation_cases() -> List[Dict[str, Any]]:
    """Load only generate_ai_workout test cases."""
    return [c for c in _cached_golden_cases() if c.get("category") == "generation"]


def load_navigation_cases() -> List[Dict[str, Any]]:
    """Load only navigate_to_page test cases."""
    return [c for c in _cached_golden_cases() if c.get("category") == "navigation"]


def load_negative_cases() -> List[Dict[str, Any]]:
    """Load only negative test cases (no function expected)."""
    return [c for c in _cached_golden_cases() if c.get("category") == "negative"]


def load_edge_cases() -> List[Dict[str, Any]]:
    """Load only edge case tests."""
    return [c for c in _cached_golden_cases() if c.get("category") == "edge_case"]


# Phase 2: Content Ingestion case loaders
def load_import_youtube_cases() -> List[Dict[str, Any]]:
    """Load only import_from_youtube test cases."""
    return [c for c in _cached_golden_cases() if c.get("category") == "import_youtube"]


def load_import_tiktok_cases() -> List[Dict[str, Any]]:
    """Load only import_from_tiktok test cases."""
    return [c for c in _cached_golden_cases() if c.get("category") == "import_tiktok"]


def load_import_instagram_cases() -> List[Dict[str, Any]]:
    """Load only import_from_instagram test cases."""
    return [c for c in _cached_golden_cases() if c.get("category") == "import_instagram"]


def load_import_pinterest_cases() -> List[Dict[str, Any]]:
    """Load only import_from_pinterest test cases."""
    return [c for c in _cached_golden_cases() if c.get("category") == "import_pinterest"]


def load_import_image_cases() -> List[Dict[str, Any]]:
    """Load only import_from_image test cases."""
    return [c for c in _cached_golden_cases() if c.get("category") == "import_image"]


def load_import_negative_cases() -> List[Dict[str, Any]]:
    """Load only import negative test cases (no function expected)."""
    return [c for c in _cached_golden_cases() if c.get("category") == "import_negative"]


def load_all_import_cases() -> List[Dict[str, Any]]:
    """Load all Phase 2 import test cases."""
    import_categories = {
        "import_youtube",
        "import_tiktok",
        "import_instagram",
        "import_pinterest",
        "import_image",
        "import_negative",
    }
    return [c for c in _cached_golden_cases() if c.get("category") in import_categories]
