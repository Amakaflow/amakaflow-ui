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
