"""Unit tests for FunctionDispatcher."""

import json
from unittest.mock import MagicMock, patch

import httpx
import pytest

from backend.services.function_dispatcher import (
    FunctionContext,
    FunctionDispatcher,
    FunctionExecutionError,
)


@pytest.fixture
def dispatcher():
    """Create a FunctionDispatcher with test URLs."""
    return FunctionDispatcher(
        mapper_api_url="http://mapper-api",
        calendar_api_url="http://calendar-api",
        ingestor_api_url="http://ingestor-api",
        timeout=5.0,
    )


@pytest.fixture
def context():
    """Create a test FunctionContext."""
    return FunctionContext(user_id="user-1", auth_token="Bearer test-token")


@pytest.fixture
def context_no_auth():
    """Create a test FunctionContext without auth token."""
    return FunctionContext(user_id="user-1", auth_token=None)


class TestFunctionDispatcherExecute:
    def test_unknown_function(self, dispatcher, context):
        result = dispatcher.execute("unknown_function", {}, context)
        # Verify standardized JSON error format
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "unknown_function"
        assert "Unknown function" in parsed["message"]

    def test_handler_exception_returns_friendly_message(self, dispatcher, context):
        # Replace the handler in the registry to raise an exception
        dispatcher._handlers["search_workout_library"] = MagicMock(
            side_effect=Exception("boom")
        )
        result = dispatcher.execute("search_workout_library", {}, context)
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "internal_error"
        assert "unexpected error" in parsed["message"]

    def test_function_execution_error_returns_message(self, dispatcher, context):
        # Replace the handler in the registry to raise FunctionExecutionError
        dispatcher._handlers["search_workout_library"] = MagicMock(
            side_effect=FunctionExecutionError("custom error")
        )
        result = dispatcher.execute("search_workout_library", {}, context)
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "execution_error"
        assert "custom error" in parsed["message"]


class TestSearchWorkoutLibrary:
    def test_success(self, dispatcher, context):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "results": [
                {"workout_id": "w-1", "title": "Leg Day"},
                {"workout_id": "w-2", "title": "Upper Body"},
            ]
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "search_workout_library", {"query": "legs", "limit": 5}, context
            )

        assert "Found these workouts:" in result
        assert "Leg Day" in result
        assert "w-1" in result

    def test_no_results(self, dispatcher, context):
        mock_response = MagicMock()
        mock_response.json.return_value = {"results": []}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "search_workout_library", {"query": "nonexistent"}, context
            )

        assert "No workouts found" in result

    def test_auth_forwarded(self, dispatcher, context):
        mock_response = MagicMock()
        mock_response.json.return_value = {"results": []}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            dispatcher.execute("search_workout_library", {"query": "test"}, context)

        call_kwargs = mock_req.call_args
        assert call_kwargs[1]["headers"]["Authorization"] == "Bearer test-token"
        # X-User-Id should always be included for defense in depth
        assert call_kwargs[1]["headers"]["X-User-Id"] == "user-1"

    def test_no_auth_token(self, dispatcher, context_no_auth):
        """Verify requests work without auth token (no Authorization header)."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"results": []}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            dispatcher.execute("search_workout_library", {"query": "test"}, context_no_auth)

        call_kwargs = mock_req.call_args
        assert "Authorization" not in call_kwargs[1]["headers"]
        # X-User-Id should still be present even without auth token
        assert call_kwargs[1]["headers"]["X-User-Id"] == "user-1"

    def test_results_default_limit_is_five(self, dispatcher, context):
        """Verify default limit of 5 results when not specified."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "results": [
                {"workout_id": f"w-{i}", "title": f"Workout {i}"}
                for i in range(10)
            ]
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "search_workout_library", {"query": "all"}, context
            )

        # Should only contain workouts 0-4, not 5-9
        assert "Workout 0" in result
        assert "Workout 4" in result
        assert "Workout 5" not in result
        assert "Workout 9" not in result
        # Count the numbered lines (1. through 5.)
        assert "5." in result
        assert "6." not in result

    def test_results_respects_custom_limit(self, dispatcher, context):
        """Verify custom limit is respected."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "results": [
                {"workout_id": f"w-{i}", "title": f"Workout {i}"}
                for i in range(10)
            ]
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "search_workout_library", {"query": "all", "limit": 3}, context
            )

        # Should only contain workouts 0-2 when limit=3
        assert "Workout 0" in result
        assert "Workout 2" in result
        assert "Workout 3" not in result
        assert "3." in result
        assert "4." not in result

    def test_results_limit_capped_at_ten(self, dispatcher, context):
        """Verify limit is capped at 10 for safety."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "results": [
                {"workout_id": f"w-{i}", "title": f"Workout {i}"}
                for i in range(20)
            ]
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "search_workout_library", {"query": "all", "limit": 50}, context
            )

        # Even with limit=50, should only return max 10
        assert "Workout 9" in result
        assert "Workout 10" not in result
        assert "10." in result
        assert "11." not in result


class TestAddWorkoutToCalendar:
    def test_success_with_time(self, dispatcher, context):
        mock_response = MagicMock()
        mock_response.json.return_value = {"id": "cal-1"}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "add_workout_to_calendar",
                {"workout_id": "w-1", "date": "2024-01-15", "time": "09:00"},
                context,
            )

        assert "2024-01-15" in result
        assert "09:00" in result

    def test_success_without_time(self, dispatcher, context):
        mock_response = MagicMock()
        mock_response.json.return_value = {"id": "cal-1"}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "add_workout_to_calendar",
                {"workout_id": "w-1", "date": "2024-01-15"},
                context,
            )

        assert "2024-01-15" in result
        assert "at" not in result

    def test_missing_required_fields(self, dispatcher, context):
        result = dispatcher.execute("add_workout_to_calendar", {}, context)
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"
        assert "Missing required fields" in parsed["message"]

    def test_missing_date_only(self, dispatcher, context):
        """Verify error when workout_id is provided but date is missing."""
        result = dispatcher.execute(
            "add_workout_to_calendar", {"workout_id": "w-1"}, context
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "Missing required fields" in parsed["message"]

    def test_missing_workout_id_only(self, dispatcher, context):
        """Verify error when date is provided but workout_id is missing."""
        result = dispatcher.execute(
            "add_workout_to_calendar", {"date": "2024-01-15"}, context
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "Missing required fields" in parsed["message"]


class TestGenerateAiWorkout:
    def test_success(self, dispatcher, context):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "workout": {"name": "Quick HIIT Session"},
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "generate_ai_workout",
                {"description": "15 minute HIIT workout"},
                context,
            )

        assert "Quick HIIT Session" in result

    def test_optional_parameters_passed(self, dispatcher, context):
        """Verify optional parameters (difficulty, duration, equipment) are passed to API."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "workout": {"name": "Custom Workout"},
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            dispatcher.execute(
                "generate_ai_workout",
                {
                    "description": "Build muscle",
                    "difficulty": "intermediate",
                    "duration_minutes": 45,
                    "equipment": ["dumbbells", "bench"],
                },
                context,
            )

        # Verify the request body contains all optional parameters
        call_kwargs = mock_req.call_args
        body = call_kwargs[1]["json"]
        assert body["transcription"] == "Build muscle"
        assert body["difficulty"] == "intermediate"
        assert body["duration_minutes"] == 45
        assert body["equipment"] == ["dumbbells", "bench"]

    def test_generation_failed(self, dispatcher, context):
        mock_response = MagicMock()
        mock_response.json.return_value = {"success": False}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "generate_ai_workout",
                {"description": "vague"},
                context,
            )

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "generation_failed"
        assert "Couldn't generate" in parsed["message"]


class TestNavigateToPage:
    def test_valid_page(self, dispatcher, context):
        result = dispatcher.execute("navigate_to_page", {"page": "library"}, context)
        data = json.loads(result)
        assert data["action"] == "navigate"
        assert data["page"] == "library"

    def test_workout_page_with_id(self, dispatcher, context):
        result = dispatcher.execute(
            "navigate_to_page", {"page": "workout", "workout_id": "w-123"}, context
        )
        data = json.loads(result)
        assert data["page"] == "workout"
        assert data["workout_id"] == "w-123"

    def test_invalid_page(self, dispatcher, context):
        result = dispatcher.execute("navigate_to_page", {"page": "invalid"}, context)
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"
        assert "Unknown page" in parsed["message"]
        assert "Valid pages" in parsed["message"]

    def test_default_page_is_home(self, dispatcher, context):
        """Verify default page is 'home' when no page argument provided."""
        result = dispatcher.execute("navigate_to_page", {}, context)
        data = json.loads(result)
        assert data["action"] == "navigate"
        assert data["page"] == "home"


class TestCallApiErrorHandling:
    def test_timeout_error(self, dispatcher, context):
        with patch.object(
            dispatcher._client, "request", side_effect=httpx.TimeoutException("timeout")
        ):
            result = dispatcher.execute("search_workout_library", {"query": "test"}, context)
        assert "taking too long" in result

    def test_401_error(self, dispatcher, context):
        response = MagicMock()
        response.status_code = 401
        with patch.object(
            dispatcher._client,
            "request",
            side_effect=httpx.HTTPStatusError("", request=MagicMock(), response=response),
        ):
            result = dispatcher.execute("search_workout_library", {"query": "test"}, context)
        assert "Authentication error" in result

    def test_404_error(self, dispatcher, context):
        response = MagicMock()
        response.status_code = 404
        with patch.object(
            dispatcher._client,
            "request",
            side_effect=httpx.HTTPStatusError("", request=MagicMock(), response=response),
        ):
            result = dispatcher.execute("search_workout_library", {"query": "test"}, context)
        assert "not found" in result

    def test_500_error(self, dispatcher, context):
        response = MagicMock()
        response.status_code = 500
        with patch.object(
            dispatcher._client,
            "request",
            side_effect=httpx.HTTPStatusError("", request=MagicMock(), response=response),
        ):
            result = dispatcher.execute("search_workout_library", {"query": "test"}, context)
        assert "Service error (500)" in result

    def test_connection_error(self, dispatcher, context):
        with patch.object(
            dispatcher._client,
            "request",
            side_effect=httpx.RequestError("connection failed"),
        ):
            result = dispatcher.execute("search_workout_library", {"query": "test"}, context)
        assert "Unable to connect" in result


class TestFunctionDispatcherLifecycle:
    def test_close_method(self):
        """Verify close() properly closes the HTTP client."""
        dispatcher = FunctionDispatcher(
            mapper_api_url="http://mapper-api",
            calendar_api_url="http://calendar-api",
            ingestor_api_url="http://ingestor-api",
        )
        with patch.object(dispatcher._client, "close") as mock_close:
            dispatcher.close()
            mock_close.assert_called_once()

    def test_context_manager(self):
        """Verify context manager properly closes client on exit."""
        with patch("backend.services.function_dispatcher.httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client_class.return_value = mock_client

            with FunctionDispatcher(
                mapper_api_url="http://mapper-api",
                calendar_api_url="http://calendar-api",
                ingestor_api_url="http://ingestor-api",
            ) as dispatcher:
                assert dispatcher is not None

            mock_client.close.assert_called_once()

    def test_context_manager_closes_on_exception(self):
        """Verify context manager closes client even when exception occurs."""
        with patch("backend.services.function_dispatcher.httpx.Client") as mock_client_class:
            mock_client = MagicMock()
            mock_client_class.return_value = mock_client

            with pytest.raises(ValueError):
                with FunctionDispatcher(
                    mapper_api_url="http://mapper-api",
                    calendar_api_url="http://calendar-api",
                    ingestor_api_url="http://ingestor-api",
                ):
                    raise ValueError("test error")

            mock_client.close.assert_called_once()
