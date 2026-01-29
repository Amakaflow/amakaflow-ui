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


# =============================================================================
# Phase 2: Content Ingestion Handler Tests
# =============================================================================


class TestImportFromYouTube:
    def test_success(self, dispatcher, context):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "workout": {
                "id": "w-yt-1",
                "title": "30 Min Full Body HIIT",
                "exercises": [{"name": "Burpees"}, {"name": "Squats"}],
            },
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            result = dispatcher.execute(
                "import_from_youtube",
                {"url": "https://youtube.com/watch?v=abc123"},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True
        assert data["source"] == "YouTube video"
        assert data["workout"]["title"] == "30 Min Full Body HIIT"
        assert data["workout"]["exercise_count"] == 2

        # Verify correct endpoint called
        call_args = mock_req.call_args
        assert "ingest/youtube" in call_args[0][1]
        assert call_args[1]["json"]["url"] == "https://youtube.com/watch?v=abc123"

    def test_skip_cache(self, dispatcher, context):
        mock_response = MagicMock()
        mock_response.json.return_value = {"success": True, "workout": {"title": "Test"}}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            dispatcher.execute(
                "import_from_youtube",
                {"url": "https://youtube.com/watch?v=abc", "skip_cache": True},
                context,
            )

        call_args = mock_req.call_args
        assert call_args[1]["json"]["skip_cache"] is True

    def test_missing_url(self, dispatcher, context):
        result = dispatcher.execute("import_from_youtube", {}, context)
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"
        assert "empty" in parsed["message"].lower() or "url" in parsed["message"].lower()

    def test_ingestion_failed(self, dispatcher, context):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": False,
            "error": "Video not accessible",
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "import_from_youtube",
                {"url": "https://youtube.com/watch?v=private"},
                context,
            )

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "ingestion_failed"
        assert "Video not accessible" in parsed["message"]


class TestImportFromTikTok:
    def test_success_auto_mode(self, dispatcher, context):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "workout": {"id": "w-tt-1", "title": "Quick Ab Routine"},
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            result = dispatcher.execute(
                "import_from_tiktok",
                {"url": "https://tiktok.com/@user/video/123"},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True
        assert data["source"] == "TikTok video"

        # Verify default mode is "auto"
        call_args = mock_req.call_args
        assert call_args[1]["json"]["mode"] == "auto"

    def test_custom_mode(self, dispatcher, context):
        mock_response = MagicMock()
        mock_response.json.return_value = {"success": True, "workout": {"title": "Test"}}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            dispatcher.execute(
                "import_from_tiktok",
                {"url": "https://tiktok.com/@user/video/123", "mode": "hybrid"},
                context,
            )

        call_args = mock_req.call_args
        assert call_args[1]["json"]["mode"] == "hybrid"

    def test_missing_url(self, dispatcher, context):
        result = dispatcher.execute("import_from_tiktok", {}, context)
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "empty" in parsed["message"].lower() or "url" in parsed["message"].lower()


class TestImportFromInstagram:
    def test_success(self, dispatcher, context):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "workout": {
                "id": "w-ig-1",
                "title": "Glute Workout",
                "exercises": [{"name": "Hip Thrusts"}],
            },
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            result = dispatcher.execute(
                "import_from_instagram",
                {"url": "https://instagram.com/p/ABC123"},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True
        assert data["source"] == "Instagram post"

        # Verify correct endpoint called
        call_args = mock_req.call_args
        assert "ingest/instagram_test" in call_args[0][1]

    def test_missing_url(self, dispatcher, context):
        result = dispatcher.execute("import_from_instagram", {}, context)
        parsed = json.loads(result)
        assert parsed["error"] is True


class TestImportFromPinterest:
    def test_single_workout(self, dispatcher, context):
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "workout": {"id": "w-pin-1", "title": "Yoga Flow"},
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "import_from_pinterest",
                {"url": "https://pinterest.com/pin/123"},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True
        assert data["source"] == "Pinterest"

    def test_multiple_workouts_from_board(self, dispatcher, context):
        """Verify Pinterest board returns multiple workouts."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "total": 3,
            "workouts": [
                {"id": "w-1", "title": "Workout 1"},
                {"id": "w-2", "title": "Workout 2"},
                {"id": "w-3", "title": "Workout 3"},
            ],
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "import_from_pinterest",
                {"url": "https://pinterest.com/user/board"},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True
        assert data["multiple_workouts"] is True
        assert data["total"] == 3
        assert len(data["workouts"]) == 3
        assert data["workouts"][0]["title"] == "Workout 1"
        assert data["workouts"][0]["id"] == "w-1"

    def test_missing_url(self, dispatcher, context):
        result = dispatcher.execute("import_from_pinterest", {}, context)
        parsed = json.loads(result)
        assert parsed["error"] is True


# =============================================================================
# Phase 2: URL Edge Cases and Validation
# =============================================================================


class TestPhase2URLEdgeCases:
    """Test URL handling edge cases for content ingestion."""

    def test_youtube_short_url(self, dispatcher, context):
        """Verify youtu.be short URLs are accepted."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "workout": {"id": "w-1", "title": "Short URL Workout"},
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            result = dispatcher.execute(
                "import_from_youtube",
                {"url": "https://youtu.be/abc123"},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True

        # Verify URL was passed through correctly
        call_args = mock_req.call_args
        assert call_args[1]["json"]["url"] == "https://youtu.be/abc123"

    def test_youtube_www_url(self, dispatcher, context):
        """Verify www.youtube.com URLs are accepted."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "workout": {"id": "w-1", "title": "WWW URL Workout"},
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "import_from_youtube",
                {"url": "https://www.youtube.com/watch?v=test123"},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True

    def test_tiktok_vm_url(self, dispatcher, context):
        """Verify vm.tiktok.com redirect URLs are accepted."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "workout": {"id": "w-1", "title": "VM URL Workout"},
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            result = dispatcher.execute(
                "import_from_tiktok",
                {"url": "https://vm.tiktok.com/ZMRxyz123/"},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True

        # Verify URL was passed through
        call_args = mock_req.call_args
        assert "vm.tiktok.com" in call_args[1]["json"]["url"]

    def test_instagram_reel_url(self, dispatcher, context):
        """Verify Instagram Reel URLs are accepted."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "workout": {"id": "w-1", "title": "Reel Workout"},
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "import_from_instagram",
                {"url": "https://instagram.com/reel/ABC123XYZ"},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True

    def test_pinterest_www_url(self, dispatcher, context):
        """Verify www.pinterest.com URLs are accepted."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "workout": {"id": "w-1", "title": "Pinterest Workout"},
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "import_from_pinterest",
                {"url": "https://www.pinterest.com/pin/123456789"},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True

    def test_url_with_query_params(self, dispatcher, context):
        """Verify URLs with query parameters are handled."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "workout": {"id": "w-1", "title": "Workout with Params"},
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            result = dispatcher.execute(
                "import_from_youtube",
                {"url": "https://youtube.com/watch?v=test&t=120&feature=share"},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True

        # Verify full URL was passed
        call_args = mock_req.call_args
        assert "feature=share" in call_args[1]["json"]["url"]


class TestPhase2SecurityValidation:
    """Test security validations for content ingestion (SSRF prevention)."""

    def test_youtube_rejects_invalid_domain(self, dispatcher, context):
        """Verify YouTube handler rejects non-YouTube URLs (SSRF prevention)."""
        result = dispatcher.execute(
            "import_from_youtube",
            {"url": "https://evil.com/watch?v=abc123"},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"
        assert "YouTube" in parsed["message"]

    def test_youtube_rejects_internal_url(self, dispatcher, context):
        """Verify YouTube handler rejects internal network URLs."""
        result = dispatcher.execute(
            "import_from_youtube",
            {"url": "http://169.254.169.254/metadata"},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"

    def test_youtube_rejects_localhost(self, dispatcher, context):
        """Verify YouTube handler rejects localhost URLs."""
        result = dispatcher.execute(
            "import_from_youtube",
            {"url": "http://localhost:8000/admin"},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True

    def test_tiktok_rejects_invalid_domain(self, dispatcher, context):
        """Verify TikTok handler rejects non-TikTok URLs."""
        result = dispatcher.execute(
            "import_from_tiktok",
            {"url": "https://malicious-site.com/video/123"},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "TikTok" in parsed["message"]

    def test_instagram_rejects_invalid_domain(self, dispatcher, context):
        """Verify Instagram handler rejects non-Instagram URLs."""
        result = dispatcher.execute(
            "import_from_instagram",
            {"url": "https://notinstagram.com/p/ABC123"},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "Instagram" in parsed["message"]

    def test_pinterest_rejects_invalid_domain(self, dispatcher, context):
        """Verify Pinterest handler rejects non-Pinterest URLs."""
        result = dispatcher.execute(
            "import_from_pinterest",
            {"url": "https://fakepinterest.com/pin/123"},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "Pinterest" in parsed["message"]

    def test_rejects_ftp_protocol(self, dispatcher, context):
        """Verify handlers reject non-HTTP protocols."""
        result = dispatcher.execute(
            "import_from_youtube",
            {"url": "ftp://youtube.com/video"},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "http" in parsed["message"].lower()

    def test_rejects_javascript_protocol(self, dispatcher, context):
        """Verify handlers reject javascript: URLs."""
        result = dispatcher.execute(
            "import_from_youtube",
            {"url": "javascript:alert('xss')"},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True

    def test_image_size_limit_encoded(self, dispatcher, context):
        """Verify image handler rejects oversized base64 data."""
        import base64

        # Create data larger than 10MB limit (base64 encoded)
        # 15MB * 1.4 = ~21MB encoded, definitely over limit
        oversized_data = "x" * (15 * 1024 * 1024)

        result = dispatcher.execute(
            "import_from_image",
            {"image_data": oversized_data},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "10MB" in parsed["message"] or "too large" in parsed["message"].lower()


class TestPhase2PayloadEdgeCases:
    """Test payload handling edge cases."""

    def test_empty_url_returns_error(self, dispatcher, context):
        """Verify empty URL returns validation error."""
        result = dispatcher.execute(
            "import_from_youtube",
            {"url": ""},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "empty" in parsed["message"].lower()

    def test_whitespace_url_returns_error(self, dispatcher, context):
        """Verify whitespace-only URL returns validation error."""
        result = dispatcher.execute(
            "import_from_youtube",
            {"url": "   "},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "empty" in parsed["message"].lower()

    def test_large_base64_image(self, dispatcher, context):
        """Verify large base64 images don't crash."""
        import base64

        # Create 1MB of fake image data
        large_data = b"x" * (1024 * 1024)
        large_base64 = base64.b64encode(large_data).decode()

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "workout": {"id": "w-1", "title": "Large Image Workout"},
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "post", return_value=mock_response):
            result = dispatcher.execute(
                "import_from_image",
                {"image_data": large_base64},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True

    def test_webp_content_type_detection(self, dispatcher, context):
        """Verify .webp file extension is detected correctly."""
        import base64

        mock_response = MagicMock()
        mock_response.json.return_value = {"success": True, "workout": {"title": "Test"}}
        mock_response.raise_for_status = MagicMock()

        fake_image = base64.b64encode(b"webp data").decode()

        with patch.object(dispatcher._client, "post", return_value=mock_response) as mock_post:
            dispatcher.execute(
                "import_from_image",
                {"image_data": fake_image, "filename": "workout.webp"},
                context,
            )

        call_args = mock_post.call_args
        files = call_args[1]["files"]
        # files["file"] is tuple of (filename, BytesIO, content_type)
        assert files["file"][2] == "image/webp"

    def test_gif_content_type_detection(self, dispatcher, context):
        """Verify .gif file extension is detected correctly."""
        import base64

        mock_response = MagicMock()
        mock_response.json.return_value = {"success": True, "workout": {"title": "Test"}}
        mock_response.raise_for_status = MagicMock()

        fake_image = base64.b64encode(b"gif data").decode()

        with patch.object(dispatcher._client, "post", return_value=mock_response) as mock_post:
            dispatcher.execute(
                "import_from_image",
                {"image_data": fake_image, "filename": "workout.gif"},
                context,
            )

        call_args = mock_post.call_args
        files = call_args[1]["files"]
        assert files["file"][2] == "image/gif"

    def test_uppercase_extension_detection(self, dispatcher, context):
        """Verify uppercase file extensions are handled."""
        import base64

        mock_response = MagicMock()
        mock_response.json.return_value = {"success": True, "workout": {"title": "Test"}}
        mock_response.raise_for_status = MagicMock()

        fake_image = base64.b64encode(b"png data").decode()

        with patch.object(dispatcher._client, "post", return_value=mock_response) as mock_post:
            dispatcher.execute(
                "import_from_image",
                {"image_data": fake_image, "filename": "WORKOUT.PNG"},
                context,
            )

        call_args = mock_post.call_args
        files = call_args[1]["files"]
        assert files["file"][2] == "image/png"


class TestImportFromImage:
    def test_success(self, dispatcher, context):
        import base64

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "workout": {
                "id": "w-img-1",
                "title": "Screenshot Workout",
                "exercises": [{"name": "Push-ups"}, {"name": "Sit-ups"}],
            },
        }
        mock_response.raise_for_status = MagicMock()

        # Create fake base64 image data
        fake_image = base64.b64encode(b"fake image bytes").decode()

        with patch.object(dispatcher._client, "post", return_value=mock_response) as mock_post:
            result = dispatcher.execute(
                "import_from_image",
                {"image_data": fake_image, "filename": "workout.jpg"},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True
        assert data["source"] == "image"
        assert data["workout"]["exercise_count"] == 2

        # Verify multipart request
        call_args = mock_post.call_args
        assert "ingest/image_vision" in call_args[0][0]
        assert "files" in call_args[1]
        assert "data" in call_args[1]
        assert call_args[1]["data"]["vision_provider"] == "openai"

    def test_missing_image_data(self, dispatcher, context):
        result = dispatcher.execute("import_from_image", {}, context)
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "image_data" in parsed["message"]

    def test_invalid_base64(self, dispatcher, context):
        result = dispatcher.execute(
            "import_from_image",
            {"image_data": "not-valid-base64!!!"},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "Invalid base64" in parsed["message"]

    def test_content_type_from_filename(self, dispatcher, context):
        """Verify content type is derived from filename extension."""
        import base64

        mock_response = MagicMock()
        mock_response.json.return_value = {"success": True, "workout": {"title": "Test"}}
        mock_response.raise_for_status = MagicMock()

        fake_image = base64.b64encode(b"fake").decode()

        with patch.object(dispatcher._client, "post", return_value=mock_response) as mock_post:
            dispatcher.execute(
                "import_from_image",
                {"image_data": fake_image, "filename": "workout.png"},
                context,
            )

        call_args = mock_post.call_args
        files = call_args[1]["files"]
        # files["file"] is a tuple of (filename, BytesIO, content_type)
        assert files["file"][2] == "image/png"

    def test_timeout_error(self, dispatcher, context):
        import base64

        fake_image = base64.b64encode(b"fake").decode()

        with patch.object(
            dispatcher._client, "post", side_effect=httpx.TimeoutException("timeout")
        ):
            result = dispatcher.execute(
                "import_from_image",
                {"image_data": fake_image},
                context,
            )

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "taking too long" in parsed["message"]


# =============================================================================
# Phase 3: Workout Management Handler Tests
# =============================================================================


class TestEditWorkout:
    """Unit tests for edit_workout handler."""

    def test_success(self, dispatcher, context):
        """Verify successful workout edit."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"id": "w-123", "title": "Updated Title"}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            result = dispatcher.execute(
                "edit_workout",
                {
                    "workout_id": "w-123",
                    "operations": [
                        {"op": "replace", "path": "/title", "value": "Updated Title"}
                    ],
                },
                context,
            )

        data = json.loads(result)
        assert data["success"] is True
        assert data["workout_id"] == "w-123"
        assert "updated successfully" in data["message"].lower()

        # Verify PATCH method and endpoint
        call_args = mock_req.call_args
        assert call_args[0][0] == "PATCH"
        assert "/workouts/w-123" in call_args[0][1]

    def test_missing_workout_id(self, dispatcher, context):
        """Verify error when workout_id is missing."""
        result = dispatcher.execute(
            "edit_workout",
            {"operations": [{"op": "replace", "path": "/title", "value": "New"}]},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"
        assert "workout_id" in parsed["message"]

    def test_missing_operations(self, dispatcher, context):
        """Verify error when operations array is missing."""
        result = dispatcher.execute(
            "edit_workout",
            {"workout_id": "w-123"},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"
        assert "operations" in parsed["message"]

    def test_empty_operations_array(self, dispatcher, context):
        """Verify error when operations array is empty."""
        result = dispatcher.execute(
            "edit_workout",
            {"workout_id": "w-123", "operations": []},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"
        assert "operations" in parsed["message"]

    def test_invalid_operation_type(self, dispatcher, context):
        """Verify error when operation type is invalid."""
        result = dispatcher.execute(
            "edit_workout",
            {
                "workout_id": "w-123",
                "operations": [{"op": "delete", "path": "/exercises/0"}],
            },
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"
        assert "Invalid operation" in parsed["message"]

    def test_missing_path_in_operation(self, dispatcher, context):
        """Verify error when operation is missing path."""
        result = dispatcher.execute(
            "edit_workout",
            {
                "workout_id": "w-123",
                "operations": [{"op": "replace", "value": "New Title"}],
            },
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"
        assert "path" in parsed["message"]

    def test_multiple_operations(self, dispatcher, context):
        """Verify multiple operations are sent correctly."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"id": "w-123"}
        mock_response.raise_for_status = MagicMock()

        operations = [
            {"op": "replace", "path": "/title", "value": "New Title"},
            {"op": "add", "path": "/tags/-", "value": "strength"},
            {"op": "remove", "path": "/exercises/0"},
        ]

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            dispatcher.execute(
                "edit_workout",
                {"workout_id": "w-123", "operations": operations},
                context,
            )

        call_args = mock_req.call_args
        body = call_args[1]["json"]
        assert len(body["operations"]) == 3

    def test_auth_forwarded(self, dispatcher, context):
        """Verify auth token is forwarded in request."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"id": "w-123"}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            dispatcher.execute(
                "edit_workout",
                {
                    "workout_id": "w-123",
                    "operations": [{"op": "replace", "path": "/title", "value": "X"}],
                },
                context,
            )

        call_kwargs = mock_req.call_args
        assert call_kwargs[1]["headers"]["Authorization"] == "Bearer test-token"
        assert call_kwargs[1]["headers"]["X-User-Id"] == "user-1"

    def test_404_workout_not_found(self, dispatcher, context):
        """Verify 404 error is handled gracefully."""
        response = MagicMock()
        response.status_code = 404
        with patch.object(
            dispatcher._client,
            "request",
            side_effect=httpx.HTTPStatusError("", request=MagicMock(), response=response),
        ):
            result = dispatcher.execute(
                "edit_workout",
                {
                    "workout_id": "w-nonexistent",
                    "operations": [{"op": "replace", "path": "/title", "value": "X"}],
                },
                context,
            )
        assert "not found" in result.lower()

    def test_timeout_error(self, dispatcher, context):
        """Verify timeout is handled gracefully."""
        with patch.object(
            dispatcher._client, "request", side_effect=httpx.TimeoutException("timeout")
        ):
            result = dispatcher.execute(
                "edit_workout",
                {
                    "workout_id": "w-123",
                    "operations": [{"op": "replace", "path": "/title", "value": "X"}],
                },
                context,
            )
        assert "taking too long" in result


class TestExportWorkout:
    """Unit tests for export_workout handler."""

    def test_success_yaml(self, dispatcher, context):
        """Verify successful YAML export."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "content": "steps:\n  - warmup: 5min",
            "download_url": "https://api.example.com/export/w-123.yaml",
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            result = dispatcher.execute(
                "export_workout",
                {"workout_id": "w-123", "format": "yaml"},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True
        assert data["format"] == "yaml"
        assert data["format_name"] == "Garmin YAML"
        assert data["workout_id"] == "w-123"
        assert "content" in data

        # Verify GET method and query param
        call_args = mock_req.call_args
        assert call_args[0][0] == "GET"
        assert "/export/w-123" in call_args[0][1]
        assert call_args[1]["params"]["export_format"] == "yaml"

    def test_success_zwo(self, dispatcher, context):
        """Verify successful Zwift ZWO export."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"content": "<workout_file>..."}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "export_workout",
                {"workout_id": "w-123", "format": "zwo"},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True
        assert data["format"] == "zwo"
        assert data["format_name"] == "Zwift ZWO"

    def test_success_workoutkit(self, dispatcher, context):
        """Verify successful Apple WorkoutKit export."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"content": "{...}"}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "export_workout",
                {"workout_id": "w-123", "format": "workoutkit"},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True
        assert data["format"] == "workoutkit"
        assert data["format_name"] == "Apple WorkoutKit"

    def test_success_fit_metadata(self, dispatcher, context):
        """Verify successful FIT metadata export."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"content": "..."}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "export_workout",
                {"workout_id": "w-123", "format": "fit_metadata"},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True
        assert data["format"] == "fit_metadata"
        assert data["format_name"] == "FIT metadata"

    def test_missing_workout_id(self, dispatcher, context):
        """Verify error when workout_id is missing."""
        result = dispatcher.execute(
            "export_workout",
            {"format": "yaml"},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"
        assert "workout_id" in parsed["message"]

    def test_missing_format(self, dispatcher, context):
        """Verify error when format is missing."""
        result = dispatcher.execute(
            "export_workout",
            {"workout_id": "w-123"},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"
        assert "format" in parsed["message"]

    def test_invalid_format(self, dispatcher, context):
        """Verify error when format is invalid."""
        result = dispatcher.execute(
            "export_workout",
            {"workout_id": "w-123", "format": "pdf"},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"
        assert "Invalid format" in parsed["message"]
        assert "pdf" in parsed["message"]

    def test_404_workout_not_found(self, dispatcher, context):
        """Verify 404 error is handled gracefully."""
        response = MagicMock()
        response.status_code = 404
        with patch.object(
            dispatcher._client,
            "request",
            side_effect=httpx.HTTPStatusError("", request=MagicMock(), response=response),
        ):
            result = dispatcher.execute(
                "export_workout",
                {"workout_id": "w-nonexistent", "format": "yaml"},
                context,
            )
        assert "not found" in result.lower()


class TestDuplicateWorkout:
    """Unit tests for duplicate_workout handler."""

    def test_success_basic(self, dispatcher, context):
        """Verify basic workout duplication."""
        # Mock GET for original workout
        get_response = MagicMock()
        get_response.json.return_value = {
            "id": "w-original",
            "title": "Original Workout",
            "exercises": [{"name": "Squats"}],
        }
        get_response.raise_for_status = MagicMock()

        # Mock POST for saving duplicate
        post_response = MagicMock()
        post_response.json.return_value = {
            "workout": {"id": "w-new", "title": "Original Workout (Copy)"}
        }
        post_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request") as mock_req:
            mock_req.side_effect = [get_response, post_response]
            result = dispatcher.execute(
                "duplicate_workout",
                {"workout_id": "w-original"},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True
        assert data["original_id"] == "w-original"
        assert "new_workout" in data
        assert data["new_workout"]["id"] == "w-new"

    def test_success_with_new_title(self, dispatcher, context):
        """Verify duplication with custom title."""
        get_response = MagicMock()
        get_response.json.return_value = {"id": "w-1", "title": "Original"}
        get_response.raise_for_status = MagicMock()

        post_response = MagicMock()
        post_response.json.return_value = {
            "workout": {"id": "w-new", "title": "Custom Title"}
        }
        post_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request") as mock_req:
            mock_req.side_effect = [get_response, post_response]
            result = dispatcher.execute(
                "duplicate_workout",
                {"workout_id": "w-1", "new_title": "Custom Title"},
                context,
            )

        # Verify the POST request used the custom title
        post_call = mock_req.call_args_list[1]
        body = post_call[1]["json"]
        assert body["title"] == "Custom Title"

    def test_default_title_is_copy_suffix(self, dispatcher, context):
        """Verify default title has ' (Copy)' suffix when no new_title provided."""
        get_response = MagicMock()
        get_response.json.return_value = {"id": "w-1", "title": "My Workout"}
        get_response.raise_for_status = MagicMock()

        post_response = MagicMock()
        post_response.json.return_value = {"workout": {"id": "w-new", "title": "My Workout (Copy)"}}
        post_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request") as mock_req:
            mock_req.side_effect = [get_response, post_response]
            dispatcher.execute(
                "duplicate_workout",
                {"workout_id": "w-1"},
                context,
            )

        post_call = mock_req.call_args_list[1]
        body = post_call[1]["json"]
        assert body["title"] == "My Workout (Copy)"

    def test_success_with_modifications(self, dispatcher, context):
        """Verify duplication with modifications applied."""
        get_response = MagicMock()
        get_response.json.return_value = {
            "id": "w-1",
            "title": "Original",
            "difficulty": "beginner",
        }
        get_response.raise_for_status = MagicMock()

        post_response = MagicMock()
        post_response.json.return_value = {"workout": {"id": "w-new"}}
        post_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request") as mock_req:
            mock_req.side_effect = [get_response, post_response]
            dispatcher.execute(
                "duplicate_workout",
                {
                    "workout_id": "w-1",
                    "modifications": {"difficulty": "advanced", "tags": ["modified"]},
                },
                context,
            )

        post_call = mock_req.call_args_list[1]
        body = post_call[1]["json"]
        assert body["difficulty"] == "advanced"
        assert body["tags"] == ["modified"]

    def test_removes_id_fields_from_copy(self, dispatcher, context):
        """Verify id, workout_id, created_at, updated_at are removed from copy."""
        get_response = MagicMock()
        get_response.json.return_value = {
            "id": "w-1",
            "workout_id": "w-1",
            "title": "Original",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-15T00:00:00Z",
        }
        get_response.raise_for_status = MagicMock()

        post_response = MagicMock()
        post_response.json.return_value = {"workout": {"id": "w-new"}}
        post_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request") as mock_req:
            mock_req.side_effect = [get_response, post_response]
            dispatcher.execute(
                "duplicate_workout",
                {"workout_id": "w-1"},
                context,
            )

        post_call = mock_req.call_args_list[1]
        body = post_call[1]["json"]
        assert "id" not in body
        assert "workout_id" not in body
        assert "created_at" not in body
        assert "updated_at" not in body

    def test_missing_workout_id(self, dispatcher, context):
        """Verify error when workout_id is missing."""
        result = dispatcher.execute(
            "duplicate_workout",
            {},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"
        assert "workout_id" in parsed["message"]

    def test_original_not_found(self, dispatcher, context):
        """Verify 404 when original workout doesn't exist."""
        response = MagicMock()
        response.status_code = 404
        with patch.object(
            dispatcher._client,
            "request",
            side_effect=httpx.HTTPStatusError("", request=MagicMock(), response=response),
        ):
            result = dispatcher.execute(
                "duplicate_workout",
                {"workout_id": "w-nonexistent"},
                context,
            )
        assert "not found" in result.lower()

    def test_modifications_filtered_to_safe_fields(self, dispatcher, context):
        """Verify dangerous fields in modifications are filtered out."""
        get_response = MagicMock()
        get_response.json.return_value = {
            "id": "w-1",
            "user_id": "original-user",
            "title": "Original",
        }
        get_response.raise_for_status = MagicMock()

        post_response = MagicMock()
        post_response.json.return_value = {"workout": {"id": "w-new"}}
        post_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request") as mock_req:
            mock_req.side_effect = [get_response, post_response]
            dispatcher.execute(
                "duplicate_workout",
                {
                    "workout_id": "w-1",
                    "modifications": {
                        "user_id": "attacker-user",  # Should be filtered
                        "id": "custom-id",  # Should be filtered
                        "created_at": "2020-01-01",  # Should be filtered
                        "title": "Safe Title",  # Should be allowed
                        "description": "Safe description",  # Should be allowed
                        "tags": ["allowed"],  # Should be allowed
                    },
                },
                context,
            )

        # Verify the POST request body
        post_call = mock_req.call_args_list[1]
        body = post_call[1]["json"]

        # Safe fields should be present
        assert body["title"] == "Safe Title"
        assert body["description"] == "Safe description"
        assert body["tags"] == ["allowed"]

        # Dangerous fields should NOT be present (filtered out or removed earlier)
        assert body.get("user_id") != "attacker-user"
        assert body.get("id") != "custom-id"
        assert "created_at" not in body

    def test_modifications_allows_expected_fields(self, dispatcher, context):
        """Verify all expected safe modification fields are allowed."""
        get_response = MagicMock()
        get_response.json.return_value = {"id": "w-1", "title": "Original"}
        get_response.raise_for_status = MagicMock()

        post_response = MagicMock()
        post_response.json.return_value = {"workout": {"id": "w-new"}}
        post_response.raise_for_status = MagicMock()

        allowed_modifications = {
            "title": "New Title",
            "description": "New description",
            "tags": ["tag1", "tag2"],
            "difficulty": "advanced",
            "exercises": [{"name": "Squats"}],
            "estimated_duration_minutes": 60,
            "equipment": ["dumbbells"],
            "notes": "Some notes",
            "category": "strength",
        }

        with patch.object(dispatcher._client, "request") as mock_req:
            mock_req.side_effect = [get_response, post_response]
            dispatcher.execute(
                "duplicate_workout",
                {"workout_id": "w-1", "modifications": allowed_modifications},
                context,
            )

        post_call = mock_req.call_args_list[1]
        body = post_call[1]["json"]

        # All allowed fields should be present
        for key, value in allowed_modifications.items():
            assert body[key] == value, f"Expected {key}={value} in body"


class TestLogWorkoutCompletion:
    """Unit tests for log_workout_completion handler."""

    def test_success_minimal(self, dispatcher, context):
        """Verify successful completion logging with only workout_id."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"id": "comp-1", "workout_id": "w-123"}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            result = dispatcher.execute(
                "log_workout_completion",
                {"workout_id": "w-123"},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True
        assert data["workout_id"] == "w-123"
        assert "completion_id" in data

        # Verify POST method and endpoint
        call_args = mock_req.call_args
        assert call_args[0][0] == "POST"
        assert "/workouts/complete" in call_args[0][1]

    def test_success_with_all_fields(self, dispatcher, context):
        """Verify successful completion logging with all optional fields."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"id": "comp-1"}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            result = dispatcher.execute(
                "log_workout_completion",
                {
                    "workout_id": "w-123",
                    "duration_minutes": 45,
                    "notes": "Felt great, increased weights",
                    "rating": 5,
                },
                context,
            )

        data = json.loads(result)
        assert data["success"] is True

        # Verify all fields were sent in request
        call_args = mock_req.call_args
        body = call_args[1]["json"]
        assert body["workout_id"] == "w-123"
        assert body["duration_minutes"] == 45
        assert body["notes"] == "Felt great, increased weights"
        assert body["rating"] == 5

    def test_missing_workout_id(self, dispatcher, context):
        """Verify error when workout_id is missing."""
        result = dispatcher.execute(
            "log_workout_completion",
            {"duration_minutes": 30},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"
        assert "workout_id" in parsed["message"]

    def test_rating_boundary_min_valid(self, dispatcher, context):
        """Verify rating=1 is accepted."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"id": "comp-1"}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "log_workout_completion",
                {"workout_id": "w-123", "rating": 1},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True

    def test_rating_boundary_max_valid(self, dispatcher, context):
        """Verify rating=5 is accepted."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"id": "comp-1"}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "log_workout_completion",
                {"workout_id": "w-123", "rating": 5},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True

    def test_rating_below_min_rejected(self, dispatcher, context):
        """Verify rating=0 is rejected."""
        result = dispatcher.execute(
            "log_workout_completion",
            {"workout_id": "w-123", "rating": 0},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"
        assert "Rating" in parsed["message"] or "rating" in parsed["message"]

    def test_rating_above_max_rejected(self, dispatcher, context):
        """Verify rating=6 is rejected."""
        result = dispatcher.execute(
            "log_workout_completion",
            {"workout_id": "w-123", "rating": 6},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"

    def test_negative_rating_rejected(self, dispatcher, context):
        """Verify negative rating is rejected."""
        result = dispatcher.execute(
            "log_workout_completion",
            {"workout_id": "w-123", "rating": -1},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"

    def test_float_rating_rejected(self, dispatcher, context):
        """Verify float rating is rejected (must be integer)."""
        result = dispatcher.execute(
            "log_workout_completion",
            {"workout_id": "w-123", "rating": 3.5},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"
        assert "integer" in parsed["message"].lower()

    def test_string_rating_rejected(self, dispatcher, context):
        """Verify string rating is rejected (must be integer)."""
        result = dispatcher.execute(
            "log_workout_completion",
            {"workout_id": "w-123", "rating": "five"},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"
        assert "integer" in parsed["message"].lower()

    def test_404_workout_not_found(self, dispatcher, context):
        """Verify 404 when workout doesn't exist."""
        response = MagicMock()
        response.status_code = 404
        with patch.object(
            dispatcher._client,
            "request",
            side_effect=httpx.HTTPStatusError("", request=MagicMock(), response=response),
        ):
            result = dispatcher.execute(
                "log_workout_completion",
                {"workout_id": "w-nonexistent"},
                context,
            )
        assert "not found" in result.lower()


class TestGetWorkoutHistory:
    """Unit tests for get_workout_history handler."""

    def test_success_with_completions(self, dispatcher, context):
        """Verify successful history retrieval with results."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "completions": [
                {
                    "workout_title": "Morning HIIT",
                    "completed_at": "2024-01-15T08:30:00Z",
                    "duration_minutes": 30,
                    "rating": 4,
                },
                {
                    "workout_title": "Leg Day",
                    "completed_at": "2024-01-14T17:00:00Z",
                    "duration_minutes": 45,
                    "rating": 5,
                },
            ]
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            result = dispatcher.execute(
                "get_workout_history",
                {},
                context,
            )

        assert "2 workout completion" in result
        assert "Morning HIIT" in result
        assert "Leg Day" in result
        assert "30 min" in result
        assert "4/5" in result

        # Verify GET method and endpoint
        call_args = mock_req.call_args
        assert call_args[0][0] == "GET"
        assert "/workouts/completions" in call_args[0][1]

    def test_no_completions_found(self, dispatcher, context):
        """Verify empty response message when no completions."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"completions": []}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "get_workout_history",
                {},
                context,
            )

        assert "No workout completions found" in result

    def test_default_limit_is_10(self, dispatcher, context):
        """Verify default limit is 10 when not specified."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"completions": []}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            dispatcher.execute(
                "get_workout_history",
                {},
                context,
            )

        call_args = mock_req.call_args
        assert call_args[1]["params"]["limit"] == 10

    def test_limit_capped_at_50(self, dispatcher, context):
        """Verify limit is capped at 50 for safety."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"completions": []}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            dispatcher.execute(
                "get_workout_history",
                {"limit": 100},  # Request 100
                context,
            )

        call_args = mock_req.call_args
        assert call_args[1]["params"]["limit"] == 50  # Should be capped at 50

    def test_date_filters_passed(self, dispatcher, context):
        """Verify date filters are passed to API."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"completions": []}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            dispatcher.execute(
                "get_workout_history",
                {
                    "start_date": "2024-01-01",
                    "end_date": "2024-01-31",
                },
                context,
            )

        call_args = mock_req.call_args
        params = call_args[1]["params"]
        assert params["start_date"] == "2024-01-01"
        assert params["end_date"] == "2024-01-31"

    def test_response_formatting_without_optional_fields(self, dispatcher, context):
        """Verify response formatting when optional fields are missing."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "completions": [
                {
                    "workout_title": "Basic Workout",
                    "completed_at": "2024-01-10",
                    # No duration_minutes or rating
                },
            ]
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "get_workout_history",
                {},
                context,
            )

        assert "Basic Workout" in result
        assert "2024-01-10" in result
        # Should not crash when optional fields are missing

    def test_alternative_response_structure(self, dispatcher, context):
        """Verify handler handles 'results' key as alternative to 'completions'."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "results": [  # Some APIs use 'results' instead of 'completions'
                {"title": "Workout 1", "date": "2024-01-10"},
            ]
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "get_workout_history",
                {},
                context,
            )

        assert "1 workout completion" in result


class TestGetWorkoutDetails:
    """Unit tests for get_workout_details handler."""

    def test_success(self, dispatcher, context):
        """Verify successful workout details retrieval."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "id": "w-123",
            "title": "Full Body Workout",
            "description": "A comprehensive full body routine",
            "tags": ["strength", "full-body"],
            "estimated_duration_minutes": 45,
            "exercises": [
                {"name": "Squats", "sets": 3, "reps": 10},
                {"name": "Push-ups", "sets": 3, "reps": 15},
                {"name": "Rows", "sets": 3, "reps": 12},
            ],
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            result = dispatcher.execute(
                "get_workout_details",
                {"workout_id": "w-123"},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True
        assert data["workout"]["id"] == "w-123"
        assert data["workout"]["title"] == "Full Body Workout"
        assert data["workout"]["exercise_count"] == 3
        assert data["workout"]["tags"] == ["strength", "full-body"]
        assert data["workout"]["estimated_duration_minutes"] == 45
        assert len(data["workout"]["exercises"]) == 3
        assert data["workout"]["exercises"][0]["name"] == "Squats"

        # Verify GET method and endpoint
        call_args = mock_req.call_args
        assert call_args[0][0] == "GET"
        assert "/workouts/w-123" in call_args[0][1]

    def test_missing_workout_id(self, dispatcher, context):
        """Verify error when workout_id is missing."""
        result = dispatcher.execute(
            "get_workout_details",
            {},
            context,
        )
        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"
        assert "workout_id" in parsed["message"]

    def test_404_not_found(self, dispatcher, context):
        """Verify 404 error is handled gracefully."""
        response = MagicMock()
        response.status_code = 404
        with patch.object(
            dispatcher._client,
            "request",
            side_effect=httpx.HTTPStatusError("", request=MagicMock(), response=response),
        ):
            result = dispatcher.execute(
                "get_workout_details",
                {"workout_id": "w-nonexistent"},
                context,
            )
        assert "not found" in result.lower()

    def test_exercise_list_capped_at_20(self, dispatcher, context):
        """Verify exercise list is truncated to 20 items."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "id": "w-123",
            "title": "Long Workout",
            "description": "",
            "tags": [],
            "exercises": [{"name": f"Exercise {i}"} for i in range(30)],
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "get_workout_details",
                {"workout_id": "w-123"},
                context,
            )

        data = json.loads(result)
        assert data["workout"]["exercise_count"] == 30  # Total count should be accurate
        assert len(data["workout"]["exercises"]) == 20  # But list is capped

    def test_optional_fields_handling(self, dispatcher, context):
        """Verify handling when optional fields are missing."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "id": "w-123",
            "title": "Minimal Workout",
            # No description, tags, duration, or exercises
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response):
            result = dispatcher.execute(
                "get_workout_details",
                {"workout_id": "w-123"},
                context,
            )

        data = json.loads(result)
        assert data["success"] is True
        assert data["workout"]["id"] == "w-123"
        assert data["workout"]["description"] == ""
        assert data["workout"]["tags"] == []
        assert data["workout"]["exercise_count"] == 0
        assert "estimated_duration_minutes" not in data["workout"]  # Optional

    def test_auth_forwarded(self, dispatcher, context):
        """Verify auth token is forwarded."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"id": "w-123", "title": "Test"}
        mock_response.raise_for_status = MagicMock()

        with patch.object(dispatcher._client, "request", return_value=mock_response) as mock_req:
            dispatcher.execute(
                "get_workout_details",
                {"workout_id": "w-123"},
                context,
            )

        call_kwargs = mock_req.call_args
        assert call_kwargs[1]["headers"]["Authorization"] == "Bearer test-token"
        assert call_kwargs[1]["headers"]["X-User-Id"] == "user-1"
