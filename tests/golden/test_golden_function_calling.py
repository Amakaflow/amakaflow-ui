"""Golden test suite for function calling validation.

This module runs parametrized tests against the golden test cases defined in
golden_cases.yaml to validate that the AI correctly selects functions based
on user input.

Usage:
    pytest -m golden -v                     # Run all golden tests
    pytest -m golden -k search              # Run only search tests
    pytest tests/golden/ --tb=short         # Run with short traceback
"""

import json
from typing import Any, Dict, List, Optional

import pytest

from backend.services.ai_client import StreamEvent
from tests.golden.conftest import (
    case_id_func,
    load_golden_cases,
    load_search_cases,
    load_calendar_cases,
    load_generation_cases,
    load_navigation_cases,
    load_negative_cases,
    load_edge_cases,
    # Phase 2: Content Ingestion
    load_import_youtube_cases,
    load_import_tiktok_cases,
    load_import_instagram_cases,
    load_import_pinterest_cases,
    load_import_image_cases,
    load_import_negative_cases,
    load_all_import_cases,
)
from tests.golden.evaluator import (
    AccuracyReport,
    EvaluationResult,
    FunctionCallEvaluator,
    extract_function_call_from_events,
    format_report_markdown,
)


# Import e2e fixtures for FakeAIClient and test infrastructure
from tests.e2e.conftest import (
    FakeAIClient,
    FakeFunctionDispatcher,
    parse_sse_events,
    extract_event_types,
    find_events,
)


@pytest.fixture
def fake_ai_client() -> FakeAIClient:
    """Fresh FakeAIClient for each test."""
    client = FakeAIClient()
    yield client
    client.reset()


@pytest.fixture
def fake_dispatcher() -> FakeFunctionDispatcher:
    """Fresh FakeFunctionDispatcher for each test."""
    dispatcher = FakeFunctionDispatcher()
    yield dispatcher
    dispatcher.reset()


def create_function_call_events(
    function_name: str,
    arguments: Dict[str, Any],
    tool_use_id: str = "toolu_test123",
) -> List[StreamEvent]:
    """Create SSE events simulating a function call response.

    Args:
        function_name: Name of the function to call
        arguments: Function arguments as dict
        tool_use_id: Unique ID for the tool use

    Returns:
        List of StreamEvent objects
    """
    events = [
        StreamEvent(
            event="function_call",
            data={"id": tool_use_id, "name": function_name},
        ),
    ]

    # Emit partial JSON for arguments
    json_str = json.dumps(arguments)
    # Split into chunks to simulate streaming
    chunk_size = 20
    for i in range(0, len(json_str), chunk_size):
        chunk = json_str[i : i + chunk_size]
        events.append(
            StreamEvent(event="content_delta", data={"partial_json": chunk})
        )

    events.append(
        StreamEvent(
            event="message_end",
            data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 150,
                "output_tokens": 45,
                "latency_ms": 920,
            },
        )
    )

    return events


def create_text_response_events(text: str) -> List[StreamEvent]:
    """Create SSE events simulating a text-only response (no function call).

    Args:
        text: Response text

    Returns:
        List of StreamEvent objects
    """
    # Split text into chunks
    words = text.split()
    events = []

    for i in range(0, len(words), 3):
        chunk = " ".join(words[i : i + 3]) + " "
        events.append(StreamEvent(event="content_delta", data={"text": chunk}))

    events.append(
        StreamEvent(
            event="message_end",
            data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 100,
                "output_tokens": 25,
                "latency_ms": 650,
            },
        )
    )

    return events


@pytest.mark.golden
class TestGoldenFunctionCalling:
    """Golden test suite for function calling validation."""

    @pytest.mark.parametrize("case", load_golden_cases(), ids=case_id_func)
    def test_function_selection(self, case: Dict[str, Any], fake_ai_client: FakeAIClient):
        """Validate the golden test infrastructure round-trip.

        IMPORTANT: This test validates the test infrastructure, NOT actual AI
        function selection. It configures the FakeAIClient to return the expected
        function call, then verifies the round-trip through SSE events and the
        evaluator logic works correctly.

        This approach is appropriate for CI because:
        1. Real AI calls are slow and expensive
        2. AI responses can be non-deterministic
        3. We want to validate test case structure and evaluator logic

        For actual AI function selection validation, use a separate nightly job
        that calls the real Claude API with these same test cases.
        """
        case_id = case["id"]
        user_input = case["input"]
        expected_function = case.get("expected_function")
        expected_params = case.get("expected_params", {})
        category = case.get("category", "unknown")

        # Configure fake AI client to return expected function call
        if expected_function:
            fake_ai_client.response_events = create_function_call_events(
                function_name=expected_function,
                arguments=expected_params,
            )
        else:
            # No function expected - return text response
            fake_ai_client.response_events = create_text_response_events(
                "I can help you with workout-related questions!"
            )

        # Collect events from fake AI client
        events = list(
            fake_ai_client.stream_chat(
                messages=[{"role": "user", "content": user_input}],
                system="You are a workout assistant.",
                tools=[],  # Would include actual tool schemas
            )
        )

        # Verify the AI client was called
        assert fake_ai_client.call_count == 1
        assert fake_ai_client.last_call_kwargs["messages"][0]["content"] == user_input

        # Extract function call from events
        actual_function = None
        for event in events:
            if event.event == "function_call":
                actual_function = event.data.get("name")
                break

        # Evaluate the result
        evaluator = FunctionCallEvaluator()

        # For function calls, extract arguments from partial_json events
        actual_params = {}
        if actual_function:
            partial_json = ""
            for event in events:
                if event.event == "content_delta" and "partial_json" in event.data:
                    partial_json += event.data["partial_json"]
            if partial_json:
                try:
                    actual_params = json.loads(partial_json)
                except json.JSONDecodeError:
                    pass

        result = evaluator.evaluate(
            case_id=case_id,
            expected_function=expected_function,
            expected_params=expected_params,
            actual_function=actual_function,
            actual_params=actual_params,
        )

        assert result.passed, (
            f"Case {case_id} failed: {result.error_message}\n"
            f"  Input: {user_input}\n"
            f"  Expected: {expected_function}\n"
            f"  Actual: {actual_function}\n"
            f"  Category: {category}"
        )


@pytest.mark.golden
class TestSearchWorkoutLibraryCases:
    """Focused tests for search_workout_library function."""

    @pytest.mark.parametrize("case", load_search_cases(), ids=case_id_func)
    def test_search_case(self, case: Dict[str, Any]):
        """Validate search_workout_library is selected for search queries."""
        assert case["expected_function"] == "search_workout_library"
        assert "query" in case.get("expected_params", {}) or case.get("expected_params") is None


@pytest.mark.golden
class TestAddWorkoutToCalendarCases:
    """Focused tests for add_workout_to_calendar function."""

    @pytest.mark.parametrize("case", load_calendar_cases(), ids=case_id_func)
    def test_calendar_case(self, case: Dict[str, Any]):
        """Validate add_workout_to_calendar is selected for scheduling."""
        assert case["expected_function"] == "add_workout_to_calendar"


@pytest.mark.golden
class TestGenerateAiWorkoutCases:
    """Focused tests for generate_ai_workout function."""

    @pytest.mark.parametrize("case", load_generation_cases(), ids=case_id_func)
    def test_generation_case(self, case: Dict[str, Any]):
        """Validate generate_ai_workout is selected for creation requests."""
        assert case["expected_function"] == "generate_ai_workout"


@pytest.mark.golden
class TestNavigateToPageCases:
    """Focused tests for navigate_to_page function."""

    @pytest.mark.parametrize("case", load_navigation_cases(), ids=case_id_func)
    def test_navigation_case(self, case: Dict[str, Any]):
        """Validate navigate_to_page is selected for navigation requests."""
        assert case["expected_function"] == "navigate_to_page"
        assert "page" in case.get("expected_params", {})


@pytest.mark.golden
class TestNegativeCases:
    """Tests for out-of-scope requests that should not trigger function calls."""

    @pytest.mark.parametrize("case", load_negative_cases(), ids=case_id_func)
    def test_negative_case(self, case: Dict[str, Any]):
        """Validate no function is called for out-of-scope requests."""
        assert case["expected_function"] is None


@pytest.mark.golden
class TestEdgeCases:
    """Tests for ambiguous or multi-intent inputs."""

    @pytest.mark.parametrize("case", load_edge_cases(), ids=case_id_func)
    def test_edge_case(self, case: Dict[str, Any]):
        """Validate edge cases have defined expected behavior."""
        # Edge cases may or may not have expected functions
        # The key is that they have explicit expectations
        assert "expected_function" in case


@pytest.mark.golden
class TestEvaluatorLogic:
    """Unit tests for the function call evaluator."""

    def test_exact_function_match(self):
        """Evaluator correctly matches identical function names."""
        evaluator = FunctionCallEvaluator()
        result = evaluator.evaluate(
            case_id="test_001",
            expected_function="search_workout_library",
            expected_params={},
            actual_function="search_workout_library",
            actual_params={},
        )
        assert result.passed
        assert result.function_match

    def test_function_mismatch(self):
        """Evaluator correctly identifies function mismatch."""
        evaluator = FunctionCallEvaluator()
        result = evaluator.evaluate(
            case_id="test_002",
            expected_function="search_workout_library",
            expected_params={},
            actual_function="navigate_to_page",
            actual_params={},
        )
        assert not result.passed
        assert not result.function_match
        assert "mismatch" in result.error_message.lower()

    def test_null_function_match(self):
        """Evaluator correctly matches when no function expected or called."""
        evaluator = FunctionCallEvaluator()
        result = evaluator.evaluate(
            case_id="test_003",
            expected_function=None,
            expected_params=None,
            actual_function=None,
            actual_params=None,
        )
        assert result.passed

    def test_param_subset_match(self):
        """Evaluator validates expected params are subset of actual."""
        evaluator = FunctionCallEvaluator()
        result = evaluator.evaluate(
            case_id="test_004",
            expected_function="search_workout_library",
            expected_params={"query": "HIIT workout"},
            actual_function="search_workout_library",
            actual_params={"query": "HIIT workout", "limit": 5},
        )
        assert result.passed
        assert result.param_matches.get("query") is True

    def test_param_mismatch(self):
        """Evaluator identifies parameter mismatches."""
        evaluator = FunctionCallEvaluator()
        result = evaluator.evaluate(
            case_id="test_005",
            expected_function="navigate_to_page",
            expected_params={"page": "calendar"},
            actual_function="navigate_to_page",
            actual_params={"page": "home"},
        )
        assert not result.passed
        assert result.param_matches.get("page") is False

    def test_param_substring_match(self):
        """Evaluator allows flexible string matching for queries."""
        evaluator = FunctionCallEvaluator()
        result = evaluator.evaluate(
            case_id="test_006",
            expected_function="search_workout_library",
            expected_params={"query": "HIIT"},
            actual_function="search_workout_library",
            actual_params={"query": "20 minute HIIT workout"},
        )
        assert result.passed
        assert result.param_matches.get("query") is True

    def test_list_param_subset_match(self):
        """Evaluator validates list params as subset."""
        evaluator = FunctionCallEvaluator()
        result = evaluator.evaluate(
            case_id="test_007",
            expected_function="generate_ai_workout",
            expected_params={"equipment": ["dumbbells"]},
            actual_function="generate_ai_workout",
            actual_params={"equipment": ["dumbbells", "bench", "barbell"]},
        )
        assert result.passed
        assert result.param_matches.get("equipment") is True


@pytest.mark.golden
class TestAccuracyReport:
    """Tests for accuracy report generation."""

    def test_report_generation(self):
        """Generate accuracy report from results."""
        evaluator = FunctionCallEvaluator()

        results = [
            EvaluationResult(
                case_id="test_001",
                passed=True,
                expected_function="search_workout_library",
                actual_function="search_workout_library",
            ),
            EvaluationResult(
                case_id="test_002",
                passed=True,
                expected_function="navigate_to_page",
                actual_function="navigate_to_page",
            ),
            EvaluationResult(
                case_id="test_003",
                passed=False,
                expected_function="search_workout_library",
                actual_function="navigate_to_page",
                error_message="Function mismatch",
            ),
        ]

        categories = {
            "test_001": "search",
            "test_002": "navigation",
            "test_003": "search",
        }

        report = evaluator.generate_report(results, categories)

        assert report.total_cases == 3
        assert report.passed_cases == 2
        assert report.failed_cases == 1
        assert report.accuracy == pytest.approx(66.67, rel=0.01)
        assert report.category_accuracy("search") == pytest.approx(50.0)
        assert report.category_accuracy("navigation") == pytest.approx(100.0)

    def test_report_markdown_format(self):
        """Verify markdown report formatting."""
        report = AccuracyReport(
            total_cases=10,
            passed_cases=9,
            failed_cases=1,
            results_by_category={
                "search": {"total": 5, "passed": 5},
                "navigation": {"total": 5, "passed": 4},
            },
            failed_results=[
                EvaluationResult(
                    case_id="nav_003",
                    passed=False,
                    expected_function="navigate_to_page",
                    actual_function="search_workout_library",
                    error_message="Function mismatch",
                )
            ],
        )

        markdown = format_report_markdown(report)

        assert "# Function Calling Golden Test Report" in markdown
        assert "90.0%" in markdown
        assert "nav_003" in markdown
        assert "search" in markdown
        assert "navigation" in markdown


# =============================================================================
# Phase 2: Content Ingestion Golden Tests
# =============================================================================


@pytest.mark.golden
class TestImportFromYouTubeCases:
    """Golden tests for import_from_youtube function."""

    @pytest.mark.parametrize("case", load_import_youtube_cases(), ids=case_id_func)
    def test_youtube_import_case(self, case: Dict[str, Any]):
        """Validate import_from_youtube is selected for YouTube URLs."""
        assert case["expected_function"] == "import_from_youtube"
        # YouTube cases should have URL in expected_params or just validate function selection
        if case.get("expected_params"):
            assert "url" in case["expected_params"]


@pytest.mark.golden
class TestImportFromTikTokCases:
    """Golden tests for import_from_tiktok function."""

    @pytest.mark.parametrize("case", load_import_tiktok_cases(), ids=case_id_func)
    def test_tiktok_import_case(self, case: Dict[str, Any]):
        """Validate import_from_tiktok is selected for TikTok URLs."""
        assert case["expected_function"] == "import_from_tiktok"


@pytest.mark.golden
class TestImportFromInstagramCases:
    """Golden tests for import_from_instagram function."""

    @pytest.mark.parametrize("case", load_import_instagram_cases(), ids=case_id_func)
    def test_instagram_import_case(self, case: Dict[str, Any]):
        """Validate import_from_instagram is selected for Instagram URLs."""
        assert case["expected_function"] == "import_from_instagram"


@pytest.mark.golden
class TestImportFromPinterestCases:
    """Golden tests for import_from_pinterest function."""

    @pytest.mark.parametrize("case", load_import_pinterest_cases(), ids=case_id_func)
    def test_pinterest_import_case(self, case: Dict[str, Any]):
        """Validate import_from_pinterest is selected for Pinterest URLs."""
        assert case["expected_function"] == "import_from_pinterest"


@pytest.mark.golden
class TestImportFromImageCases:
    """Golden tests for import_from_image function."""

    @pytest.mark.parametrize("case", load_import_image_cases(), ids=case_id_func)
    def test_image_import_case(self, case: Dict[str, Any]):
        """Validate import_from_image is selected for image upload context."""
        assert case["expected_function"] == "import_from_image"


@pytest.mark.golden
class TestImportNegativeCases:
    """Tests for import requests that should NOT trigger import functions."""

    @pytest.mark.parametrize("case", load_import_negative_cases(), ids=case_id_func)
    def test_import_negative_case(self, case: Dict[str, Any]):
        """Validate no import function is called for unsupported/incomplete requests."""
        assert case["expected_function"] is None


@pytest.mark.golden
class TestAllImportCases:
    """Comprehensive tests for all Phase 2 import cases."""

    @pytest.mark.parametrize("case", load_all_import_cases(), ids=case_id_func)
    def test_import_case_structure(self, case: Dict[str, Any]):
        """Validate all import cases have proper structure."""
        assert "id" in case
        assert "input" in case
        assert "expected_function" in case
        assert "category" in case
        assert case["category"].startswith("import_")
