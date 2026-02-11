"""Unit tests for AsyncFunctionDispatcher.

Tests for:
- Core execute() method routing and error handling
- HTTP call handling (success, timeouts, errors)
- URL and ID validation (SSRF prevention)
- Representative handler implementations

Part of AMA-505: P0 Testing for Async Conversion
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from backend.services.async_function_dispatcher import (
    AsyncFunctionDispatcher,
    FunctionContext,
    FunctionExecutionError,
    YOUTUBE_ALLOWED_DOMAINS,
    TIKTOK_ALLOWED_DOMAINS,
    ID_PATTERN,
)


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def dispatcher():
    """Create an AsyncFunctionDispatcher with test URLs."""
    return AsyncFunctionDispatcher(
        mapper_api_url="http://mapper-api",
        calendar_api_url="http://calendar-api",
        ingestor_api_url="http://ingestor-api",
        timeout=5.0,
    )


@pytest.fixture
def context():
    """Create a test FunctionContext with auth token."""
    return FunctionContext(user_id="user-1", auth_token="Bearer test-token")


@pytest.fixture
def context_no_auth():
    """Create a test FunctionContext without auth token."""
    return FunctionContext(user_id="user-1", auth_token=None)


# =============================================================================
# Core Execute Method Tests
# =============================================================================


class TestAsyncFunctionDispatcherExecute:
    """Tests for the core execute() method."""

    @pytest.mark.asyncio
    async def test_unknown_function_returns_error(self, dispatcher, context):
        """execute() returns error for unknown function names."""
        result = await dispatcher.execute("unknown_function", {}, context)

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "unknown_function"
        assert "Unknown function" in parsed["message"]
        assert "unknown_function" in parsed["message"]

    @pytest.mark.asyncio
    async def test_handler_exception_returns_internal_error(self, dispatcher, context):
        """execute() catches exceptions and returns friendly error."""
        # Replace handler to throw exception
        dispatcher._handlers["search_workout_library"] = AsyncMock(
            side_effect=Exception("boom")
        )

        result = await dispatcher.execute("search_workout_library", {}, context)

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "internal_error"
        assert "unexpected error" in parsed["message"].lower()

    @pytest.mark.asyncio
    async def test_function_execution_error_returns_message(self, dispatcher, context):
        """execute() catches FunctionExecutionError and returns user message."""
        dispatcher._handlers["search_workout_library"] = AsyncMock(
            side_effect=FunctionExecutionError("custom user-facing error")
        )

        result = await dispatcher.execute("search_workout_library", {}, context)

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "execution_error"
        assert "custom user-facing error" in parsed["message"]

    @pytest.mark.asyncio
    async def test_routes_to_correct_handler(self, dispatcher, context):
        """execute() routes function names to correct handlers."""
        mock_handler = AsyncMock(return_value="handler_result")
        dispatcher._handlers["search_workout_library"] = mock_handler

        await dispatcher.execute(
            "search_workout_library", {"query": "test"}, context
        )

        mock_handler.assert_called_once_with({"query": "test"}, context)


# =============================================================================
# HTTP Call Tests
# =============================================================================


class TestAsyncCallApi:
    """Tests for _call_api HTTP handling."""

    @pytest.mark.asyncio
    async def test_success_returns_json(self, dispatcher, context):
        """_call_api returns parsed JSON on success."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"data": "test_value"}
        mock_response.raise_for_status = MagicMock()

        with patch.object(
            dispatcher._client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_response
            result = await dispatcher._call_api("GET", "http://test/api", context)

        assert result == {"data": "test_value"}

    @pytest.mark.asyncio
    async def test_forwards_auth_header(self, dispatcher, context):
        """_call_api includes Authorization header when token present."""
        mock_response = MagicMock()
        mock_response.json.return_value = {}
        mock_response.raise_for_status = MagicMock()

        with patch.object(
            dispatcher._client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_response
            await dispatcher._call_api("GET", "http://test/api", context)

        call_kwargs = mock_request.call_args.kwargs
        assert call_kwargs["headers"]["Authorization"] == "Bearer test-token"
        assert call_kwargs["headers"]["X-User-Id"] == "user-1"

    @pytest.mark.asyncio
    async def test_works_without_auth_token(self, dispatcher, context_no_auth):
        """_call_api works when no auth token provided."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"ok": True}
        mock_response.raise_for_status = MagicMock()

        with patch.object(
            dispatcher._client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_response
            result = await dispatcher._call_api(
                "GET", "http://test/api", context_no_auth
            )

        assert result == {"ok": True}
        call_kwargs = mock_request.call_args.kwargs
        assert "Authorization" not in call_kwargs["headers"]
        assert call_kwargs["headers"]["X-User-Id"] == "user-1"

    @pytest.mark.asyncio
    async def test_timeout_raises_friendly_error(self, dispatcher, context):
        """_call_api raises friendly error on timeout."""
        with patch.object(
            dispatcher._client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.side_effect = httpx.TimeoutException("timeout")

            with pytest.raises(FunctionExecutionError) as exc_info:
                await dispatcher._call_api("GET", "http://test/api", context)

        assert "taking too long" in exc_info.value.message.lower()

    @pytest.mark.asyncio
    async def test_401_raises_auth_error(self, dispatcher, context):
        """_call_api raises auth error on 401 response."""
        mock_response = MagicMock()
        mock_response.status_code = 401

        with patch.object(
            dispatcher._client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.side_effect = httpx.HTTPStatusError(
                "Unauthorized",
                request=MagicMock(),
                response=mock_response,
            )

            with pytest.raises(FunctionExecutionError) as exc_info:
                await dispatcher._call_api("GET", "http://test/api", context)

        assert "authentication" in exc_info.value.message.lower()

    @pytest.mark.asyncio
    async def test_404_raises_not_found_error(self, dispatcher, context):
        """_call_api raises not found error on 404 response."""
        mock_response = MagicMock()
        mock_response.status_code = 404

        with patch.object(
            dispatcher._client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.side_effect = httpx.HTTPStatusError(
                "Not Found",
                request=MagicMock(),
                response=mock_response,
            )

            with pytest.raises(FunctionExecutionError) as exc_info:
                await dispatcher._call_api("GET", "http://test/api", context)

        assert "not found" in exc_info.value.message.lower()

    @pytest.mark.asyncio
    async def test_other_http_error_raises_service_error(self, dispatcher, context):
        """_call_api raises service error on other HTTP errors."""
        mock_response = MagicMock()
        mock_response.status_code = 500

        with patch.object(
            dispatcher._client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.side_effect = httpx.HTTPStatusError(
                "Server Error",
                request=MagicMock(),
                response=mock_response,
            )

            with pytest.raises(FunctionExecutionError) as exc_info:
                await dispatcher._call_api("GET", "http://test/api", context)

        assert "Service error" in exc_info.value.message
        assert "500" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_connection_error_raises_friendly_error(self, dispatcher, context):
        """_call_api raises friendly error on connection failure."""
        with patch.object(
            dispatcher._client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.side_effect = httpx.RequestError("connection failed")

            with pytest.raises(FunctionExecutionError) as exc_info:
                await dispatcher._call_api("GET", "http://test/api", context)

        assert "unable to connect" in exc_info.value.message.lower()


# =============================================================================
# URL Validation Tests (SSRF Prevention)
# =============================================================================


class TestUrlValidation:
    """Tests for _validate_url SSRF prevention."""

    def test_empty_url_returns_error(self, dispatcher):
        """Empty URL returns validation error."""
        result = dispatcher._validate_url("", YOUTUBE_ALLOWED_DOMAINS, "YouTube")

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"
        assert "empty" in parsed["message"].lower()

    def test_none_url_returns_error(self, dispatcher):
        """None URL returns validation error."""
        result = dispatcher._validate_url(None, YOUTUBE_ALLOWED_DOMAINS, "YouTube")

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "empty" in parsed["message"].lower()

    def test_whitespace_url_returns_error(self, dispatcher):
        """Whitespace-only URL returns validation error."""
        result = dispatcher._validate_url("   ", YOUTUBE_ALLOWED_DOMAINS, "YouTube")

        parsed = json.loads(result)
        assert parsed["error"] is True

    def test_valid_youtube_url_passes(self, dispatcher):
        """Valid YouTube URL returns None (no error)."""
        result = dispatcher._validate_url(
            "https://www.youtube.com/watch?v=abc123",
            YOUTUBE_ALLOWED_DOMAINS,
            "YouTube",
        )
        assert result is None

    def test_valid_youtu_be_url_passes(self, dispatcher):
        """Short youtu.be URL returns None (no error)."""
        result = dispatcher._validate_url(
            "https://youtu.be/abc123", YOUTUBE_ALLOWED_DOMAINS, "YouTube"
        )
        assert result is None

    def test_invalid_domain_returns_error(self, dispatcher):
        """URL from non-allowed domain returns error."""
        result = dispatcher._validate_url(
            "https://evil.com/video", YOUTUBE_ALLOWED_DOMAINS, "YouTube"
        )

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "invalid youtube url" in parsed["message"].lower()

    def test_file_scheme_blocked(self, dispatcher):
        """File:// URLs are blocked."""
        result = dispatcher._validate_url(
            "file:///etc/passwd", YOUTUBE_ALLOWED_DOMAINS, "YouTube"
        )

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "http://" in parsed["message"] or "https://" in parsed["message"]

    def test_localhost_blocked(self, dispatcher):
        """Localhost URLs are blocked (SSRF prevention)."""
        result = dispatcher._validate_url(
            "http://localhost:8080/api", YOUTUBE_ALLOWED_DOMAINS, "YouTube"
        )

        parsed = json.loads(result)
        assert parsed["error"] is True

    def test_internal_ip_blocked(self, dispatcher):
        """Internal IP addresses are blocked (SSRF prevention)."""
        result = dispatcher._validate_url(
            "http://192.168.1.1/internal", YOUTUBE_ALLOWED_DOMAINS, "YouTube"
        )

        parsed = json.loads(result)
        assert parsed["error"] is True

    def test_valid_tiktok_url_passes(self, dispatcher):
        """Valid TikTok URL returns None."""
        result = dispatcher._validate_url(
            "https://www.tiktok.com/@user/video/123",
            TIKTOK_ALLOWED_DOMAINS,
            "TikTok",
        )
        assert result is None


# =============================================================================
# ID Validation Tests (Path Traversal Prevention)
# =============================================================================


class TestIdValidation:
    """Tests for _validate_id path traversal prevention."""

    def test_empty_id_returns_error(self, dispatcher):
        """Empty ID returns validation error."""
        result = dispatcher._validate_id("", "workout_id")

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "validation_error"
        assert "missing" in parsed["message"].lower()

    def test_none_id_returns_error(self, dispatcher):
        """None ID returns validation error."""
        result = dispatcher._validate_id(None, "workout_id")

        parsed = json.loads(result)
        assert parsed["error"] is True

    def test_valid_uuid_passes(self, dispatcher):
        """Valid UUID format passes."""
        result = dispatcher._validate_id(
            "550e8400-e29b-41d4-a716-446655440000", "workout_id"
        )
        assert result is None

    def test_valid_alphanumeric_id_passes(self, dispatcher):
        """Valid alphanumeric ID passes."""
        result = dispatcher._validate_id("workout_123_abc", "workout_id")
        assert result is None

    def test_path_traversal_blocked(self, dispatcher):
        """Path traversal attempts are blocked."""
        result = dispatcher._validate_id("../../../etc/passwd", "workout_id")

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "invalid" in parsed["message"].lower()

    def test_slash_in_id_blocked(self, dispatcher):
        """Slashes in IDs are blocked."""
        result = dispatcher._validate_id("path/to/file", "workout_id")

        parsed = json.loads(result)
        assert parsed["error"] is True

    def test_too_long_id_blocked(self, dispatcher):
        """IDs over 64 characters are blocked."""
        long_id = "a" * 65
        result = dispatcher._validate_id(long_id, "workout_id")

        parsed = json.loads(result)
        assert parsed["error"] is True


class TestIdListValidation:
    """Tests for _validate_id_list."""

    def test_empty_list_returns_error(self, dispatcher):
        """Empty list returns validation error."""
        result = dispatcher._validate_id_list([], "workout_ids")

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "missing" in parsed["message"].lower()

    def test_none_list_returns_error(self, dispatcher):
        """None list returns validation error."""
        result = dispatcher._validate_id_list(None, "workout_ids")

        parsed = json.loads(result)
        assert parsed["error"] is True

    def test_valid_ids_pass(self, dispatcher):
        """List of valid IDs passes."""
        result = dispatcher._validate_id_list(
            ["id-1", "id-2", "uuid-123-abc"], "workout_ids"
        )
        assert result is None

    def test_invalid_id_in_list_fails(self, dispatcher):
        """List with one invalid ID fails."""
        result = dispatcher._validate_id_list(
            ["valid-id", "../invalid", "another-valid"], "workout_ids"
        )

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert "invalid" in parsed["message"].lower()


# =============================================================================
# Handler Integration Tests
# =============================================================================


class TestSearchWorkoutLibraryHandler:
    """Tests for search_workout_library handler."""

    @pytest.mark.asyncio
    async def test_success_returns_formatted_results(self, dispatcher, context):
        """search_workout_library returns structured JSON with workout data."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "results": [
                {"workout_id": "w-1", "title": "Leg Day", "duration_minutes": 45},
                {"workout_id": "w-2", "title": "Upper Body", "duration_minutes": 60},
            ]
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(
            dispatcher._client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_response
            result = await dispatcher.execute(
                "search_workout_library", {"query": "strength"}, context
            )

        parsed = json.loads(result)
        assert parsed["type"] == "search_results"
        assert len(parsed["workouts"]) == 2
        assert parsed["workouts"][0]["title"] == "Leg Day"
        assert parsed["workouts"][0]["workout_id"] == "w-1"

    @pytest.mark.asyncio
    async def test_empty_results(self, dispatcher, context):
        """search_workout_library returns empty search_results JSON on no results."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"results": []}
        mock_response.raise_for_status = MagicMock()

        with patch.object(
            dispatcher._client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_response
            result = await dispatcher.execute(
                "search_workout_library", {"query": "nonexistent"}, context
            )

        parsed = json.loads(result)
        assert parsed["type"] == "search_results"
        assert parsed["workouts"] == []

    @pytest.mark.asyncio
    async def test_search_workout_library_returns_structured_results(self, dispatcher, context):
        """search_workout_library should return structured results with metadata."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "results": [
                {
                    "workout_id": "w-push-1",
                    "title": "Push Day",
                    "exercise_count": 6,
                    "duration_minutes": 50,
                    "difficulty": "intermediate",
                },
                {
                    "workout_id": "w-push-2",
                    "title": "Push Day Advanced",
                    "exercise_count": 8,
                    "duration_minutes": 65,
                    "difficulty": "advanced",
                },
            ]
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(
            dispatcher._client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_response
            result = await dispatcher.execute(
                "search_workout_library", {"query": "push day"}, context
            )

        parsed = json.loads(result)
        assert parsed["type"] == "search_results"
        assert len(parsed["workouts"]) == 2

        first = parsed["workouts"][0]
        assert first["title"] == "Push Day"
        assert first["workout_id"] == "w-push-1"
        assert first["exercise_count"] == 6
        assert first["duration_minutes"] == 50
        assert first["difficulty"] == "intermediate"

        second = parsed["workouts"][1]
        assert second["title"] == "Push Day Advanced"
        assert second["workout_id"] == "w-push-2"
        assert second["exercise_count"] == 8
        assert second["duration_minutes"] == 65
        assert second["difficulty"] == "advanced"

    @pytest.mark.asyncio
    async def test_search_workout_library_handles_missing_metadata(self, dispatcher, context):
        """search_workout_library handles workouts with missing optional metadata."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "results": [
                {
                    "workout_id": "w-minimal",
                    "title": "Basic Workout",
                },
            ]
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(
            dispatcher._client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_response
            result = await dispatcher.execute(
                "search_workout_library", {"query": "basic"}, context
            )

        parsed = json.loads(result)
        assert parsed["type"] == "search_results"
        assert len(parsed["workouts"]) == 1

        workout = parsed["workouts"][0]
        assert workout["workout_id"] == "w-minimal"
        assert workout["title"] == "Basic Workout"
        assert workout["exercise_count"] is None
        assert workout["duration_minutes"] is None
        assert workout["difficulty"] is None


class TestGenerateAiWorkoutHandler:
    """Tests for generate_ai_workout handler."""

    @pytest.mark.asyncio
    async def test_generates_workout(self, dispatcher, context):
        """generate_ai_workout returns workout data."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "workout": {
                "id": "gen-123",
                "name": "Generated HIIT",
                "exercises": [{"name": "Burpees"}, {"name": "Squats"}],
            },
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(
            dispatcher._client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_response
            result = await dispatcher.execute(
                "generate_ai_workout",
                {"description": "20 min HIIT"},
                context,
            )

        assert "Generated HIIT" in result or "gen-123" in result

    @pytest.mark.asyncio
    async def test_generate_ai_workout_returns_structured_json(self, dispatcher, context):
        """generate_ai_workout returns structured JSON with type, workout details, and exercises."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "workout": {
                "name": "Full Body Blast",
                "exercises": [
                    {
                        "name": "Push-ups",
                        "sets": 3,
                        "reps": 15,
                        "muscle_group": "chest",
                        "notes": "Keep core tight",
                    },
                    {
                        "name": "Squats",
                        "sets": 4,
                        "reps": 12,
                        "muscle_group": "legs",
                        "notes": None,
                    },
                ],
                "duration_minutes": 30,
                "difficulty": "intermediate",
            },
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(
            dispatcher._client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_response
            result = await dispatcher.execute(
                "generate_ai_workout",
                {"description": "30 min full body workout"},
                context,
            )

        parsed = json.loads(result)
        assert parsed["type"] == "workout_generated"

        workout = parsed["workout"]
        assert workout["name"] == "Full Body Blast"
        assert workout["duration_minutes"] == 30
        assert workout["difficulty"] == "intermediate"

        exercises = workout["exercises"]
        assert len(exercises) == 2

        assert exercises[0]["name"] == "Push-ups"
        assert exercises[0]["sets"] == 3
        assert exercises[0]["reps"] == 15
        assert exercises[0]["muscle_group"] == "chest"
        assert exercises[0]["notes"] == "Keep core tight"

        assert exercises[1]["name"] == "Squats"
        assert exercises[1]["sets"] == 4
        assert exercises[1]["reps"] == 12
        assert exercises[1]["muscle_group"] == "legs"

    @pytest.mark.asyncio
    async def test_generate_ai_workout_structured_with_missing_fields(self, dispatcher, context):
        """generate_ai_workout handles exercises with missing optional fields gracefully."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": True,
            "workout": {
                "name": "Quick Stretch",
                "exercises": [
                    {"name": "Hamstring Stretch"},
                ],
            },
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(
            dispatcher._client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_response
            result = await dispatcher.execute(
                "generate_ai_workout",
                {"description": "stretching routine"},
                context,
            )

        parsed = json.loads(result)
        assert parsed["type"] == "workout_generated"

        workout = parsed["workout"]
        assert workout["name"] == "Quick Stretch"
        assert workout["duration_minutes"] is None
        assert workout["difficulty"] is None

        exercises = workout["exercises"]
        assert len(exercises) == 1
        assert exercises[0]["name"] == "Hamstring Stretch"
        assert exercises[0]["sets"] is None
        assert exercises[0]["reps"] is None
        assert exercises[0]["muscle_group"] is None

    @pytest.mark.asyncio
    async def test_generate_ai_workout_failure_returns_error(self, dispatcher, context):
        """generate_ai_workout returns error JSON when ingestor reports failure."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "success": False,
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(
            dispatcher._client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_response
            result = await dispatcher.execute(
                "generate_ai_workout",
                {"description": "something vague"},
                context,
            )

        parsed = json.loads(result)
        assert parsed["error"] is True
        assert parsed["code"] == "generation_failed"


class TestAddWorkoutToCalendarHandler:
    """Tests for add_workout_to_calendar handler."""

    @pytest.mark.asyncio
    async def test_adds_workout(self, dispatcher, context):
        """add_workout_to_calendar schedules workout."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "event_id": "evt-123",
            "scheduled_date": "2026-01-30",
        }
        mock_response.raise_for_status = MagicMock()

        with patch.object(
            dispatcher._client, "request", new_callable=AsyncMock
        ) as mock_request:
            mock_request.return_value = mock_response
            result = await dispatcher.execute(
                "add_workout_to_calendar",
                {"workout_id": "w-1", "date": "2026-01-30"},
                context,
            )

        assert "scheduled" in result.lower() or "added" in result.lower()

    @pytest.mark.asyncio
    async def test_invalid_workout_id_fails(self, dispatcher, context):
        """add_workout_to_calendar validates workout_id."""
        result = await dispatcher.execute(
            "add_workout_to_calendar",
            {"workout_id": "../invalid", "date": "2026-01-30"},
            context,
        )

        parsed = json.loads(result)
        assert parsed["error"] is True


# =============================================================================
# Context Manager Tests
# =============================================================================


class TestContextManager:
    """Tests for async context manager support."""

    @pytest.mark.asyncio
    async def test_context_manager_closes_client(self):
        """Context manager properly closes HTTP client."""
        async with AsyncFunctionDispatcher(
            mapper_api_url="http://mapper-api",
            calendar_api_url="http://calendar-api",
            ingestor_api_url="http://ingestor-api",
        ) as dispatcher:
            # Dispatcher should be usable
            assert dispatcher._client is not None

        # After exit, client should be closed
        assert dispatcher._client.is_closed

    @pytest.mark.asyncio
    async def test_close_method(self):
        """close() method properly closes HTTP client."""
        dispatcher = AsyncFunctionDispatcher(
            mapper_api_url="http://mapper-api",
            calendar_api_url="http://calendar-api",
            ingestor_api_url="http://ingestor-api",
        )

        assert not dispatcher._client.is_closed
        await dispatcher.close()
        assert dispatcher._client.is_closed


# =============================================================================
# ID Pattern Tests
# =============================================================================


class TestIdPattern:
    """Tests for ID_PATTERN regex constant."""

    def test_valid_patterns(self):
        """ID_PATTERN accepts valid IDs."""
        valid_ids = [
            "abc123",
            "UUID-123-456",
            "work_out_1",
            "a" * 64,
            "A1b2C3",
            "123",
            "a",
        ]
        for id_val in valid_ids:
            assert ID_PATTERN.match(id_val), f"Should accept: {id_val}"

    def test_invalid_patterns(self):
        """ID_PATTERN rejects invalid IDs."""
        invalid_ids = [
            "",
            "../etc",
            "path/to/file",
            "id with spaces",
            "a" * 65,
            "id@email.com",
            "id;drop table",
        ]
        for id_val in invalid_ids:
            assert not ID_PATTERN.match(id_val), f"Should reject: {id_val}"


class TestFormatIngestionResultComputedFields:
    """Tests for _format_ingestion_result computed field passthrough."""

    def test_computed_fields_passthrough(self, dispatcher, context):
        """Ingestor computed fields are passed through without recomputation."""
        result = {
            "success": True,
            "workout": {
                "title": "Computed Fields Workout",
                "blocks": [
                    {"exercises": [{"name": "Squats"}, {"name": "Lunges"}]},
                ],
                "exercises": [{"name": "Squats"}, {"name": "Lunges"}],
                "exercise_count": 2,
                "exercise_names": ["Squats", "Lunges"],
            },
        }
        output = json.loads(dispatcher._format_ingestion_result(result, "YouTube video"))
        assert output["workout"]["exercise_count"] == 2
        assert output["workout"]["exercise_names"] == ["Squats", "Lunges"]

    def test_fallback_when_computed_fields_missing(self, dispatcher, context):
        """Older cached responses without computed fields still work."""
        result = {
            "success": True,
            "workout": {
                "title": "Legacy Workout",
                "blocks": [
                    {"exercises": [{"name": "Deadlifts"}, {"name": "Rows"}]},
                ],
            },
        }
        output = json.loads(dispatcher._format_ingestion_result(result, "YouTube video"))
        assert output["workout"]["exercise_count"] == 2
        assert output["workout"]["exercise_names"] == ["Deadlifts", "Rows"]
