"""Contract tests for API schema validation.

These tests validate that API responses match their expected contracts,
ensuring backwards compatibility and correct serialization.

Usage:
    pytest -m contract -v
    pytest tests/contract/ --tb=short
"""

import json
from typing import Any, Dict, List

import pytest

from backend.services.ai_client import StreamEvent
from tests.e2e.conftest import (
    FakeAIClient,
    FakeChatSessionRepository,
    parse_sse_events,
    extract_event_types,
    find_events,
    TEST_USER_ID,
    _session_repo,
)

# Note: Fixtures (app, client, ai_client, _reset_fakes) are discovered
# automatically by pytest from tests/e2e/conftest.py - no import needed


# =============================================================================
# SSE Event Schema Contracts
# =============================================================================


SSE_MESSAGE_START_SCHEMA = {
    "type": "object",
    "properties": {
        "session_id": {"type": "string"},
        "message_id": {"type": "string"},
    },
    "required": ["session_id"],
}

SSE_CONTENT_DELTA_SCHEMA = {
    "type": "object",
    "properties": {
        "text": {"type": "string"},
        "partial_json": {"type": "string"},
    },
    # At least one of text or partial_json should be present
}

SSE_FUNCTION_CALL_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "name": {"type": "string"},
    },
    "required": ["id", "name"],
}

SSE_FUNCTION_RESULT_SCHEMA = {
    "type": "object",
    "properties": {
        "tool_use_id": {"type": "string"},
        "result": {"type": "string"},
    },
    "required": ["tool_use_id", "result"],
}

SSE_MESSAGE_END_SCHEMA = {
    "type": "object",
    "properties": {
        "session_id": {"type": "string"},
        "tokens_used": {"type": "integer"},
        "latency_ms": {"type": "integer"},
    },
    "required": ["session_id"],
}

SSE_ERROR_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"type": "string"},
        "message": {"type": "string"},
        "code": {"type": "string"},
    },
    "required": ["type", "message"],
}


def validate_schema(data: Dict[str, Any], schema: Dict[str, Any]) -> List[str]:
    """Simple schema validation without jsonschema dependency.

    Returns list of validation errors (empty if valid).
    """
    errors = []

    # Check required fields
    for field in schema.get("required", []):
        if field not in data:
            errors.append(f"Missing required field: {field}")

    # Check field types
    properties = schema.get("properties", {})
    for field, value in data.items():
        if field in properties:
            expected_type = properties[field].get("type")
            if expected_type:
                type_map = {
                    "string": str,
                    "integer": int,
                    "number": (int, float),
                    "boolean": bool,
                    "array": list,
                    "object": dict,
                }
                expected_python_type = type_map.get(expected_type)
                if expected_python_type and not isinstance(value, expected_python_type):
                    errors.append(
                        f"Field '{field}' has type {type(value).__name__}, "
                        f"expected {expected_type}"
                    )

    return errors


@pytest.mark.contract
class TestChatStreamContract:
    """Contract tests for /chat/stream SSE response format."""

    def test_message_start_schema(self, client, ai_client):
        """Validate message_start event matches contract."""
        # Configure AI to return simple response
        ai_client.response_events = [
            StreamEvent(event="content_delta", data={"text": "Hello!"}),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 50,
                    "output_tokens": 10,
                    "latency_ms": 500,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )

        assert response.status_code == 200

        events = parse_sse_events(response.text)
        message_starts = find_events(events, "message_start")

        assert len(message_starts) >= 1, "Expected at least one message_start event"

        for event in message_starts:
            errors = validate_schema(event["data"], SSE_MESSAGE_START_SCHEMA)
            assert not errors, f"Schema validation failed: {errors}"

    def test_content_delta_schema(self, client, ai_client):
        """Validate content_delta event matches contract."""
        ai_client.response_events = [
            StreamEvent(event="content_delta", data={"text": "Hello "}),
            StreamEvent(event="content_delta", data={"text": "world!"}),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 50,
                    "output_tokens": 10,
                    "latency_ms": 500,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )

        assert response.status_code == 200

        events = parse_sse_events(response.text)
        deltas = find_events(events, "content_delta")

        assert len(deltas) >= 1, "Expected at least one content_delta event"

        for event in deltas:
            data = event["data"]
            # Must have either text or partial_json
            assert "text" in data or "partial_json" in data, (
                "content_delta must have 'text' or 'partial_json'"
            )
            errors = validate_schema(data, SSE_CONTENT_DELTA_SCHEMA)
            assert not errors, f"Schema validation failed: {errors}"

    def test_function_call_schema(self, client, ai_client):
        """Validate function_call event matches contract."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_123", "name": "search_workout_library"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"query": "HIIT workout"}'},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 100,
                    "output_tokens": 30,
                    "latency_ms": 800,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Find HIIT workouts"},
        )

        assert response.status_code == 200

        events = parse_sse_events(response.text)
        function_calls = find_events(events, "function_call")

        assert len(function_calls) >= 1, "Expected at least one function_call event"

        for event in function_calls:
            errors = validate_schema(event["data"], SSE_FUNCTION_CALL_SCHEMA)
            assert not errors, f"Schema validation failed: {errors}"

    def test_message_end_schema(self, client, ai_client):
        """Validate message_end event matches contract."""
        ai_client.response_events = [
            StreamEvent(event="content_delta", data={"text": "Done!"}),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 50,
                    "output_tokens": 10,
                    "latency_ms": 500,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )

        assert response.status_code == 200

        events = parse_sse_events(response.text)
        message_ends = find_events(events, "message_end")

        assert len(message_ends) >= 1, "Expected at least one message_end event"

        for event in message_ends:
            errors = validate_schema(event["data"], SSE_MESSAGE_END_SCHEMA)
            assert not errors, f"Schema validation failed: {errors}"

    def test_event_sequence_order(self, client, ai_client):
        """Validate SSE events follow expected order."""
        ai_client.response_events = [
            StreamEvent(event="content_delta", data={"text": "Response"}),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 50,
                    "output_tokens": 10,
                    "latency_ms": 500,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )

        events = parse_sse_events(response.text)
        types = extract_event_types(events)

        # message_start should be first
        assert types[0] == "message_start", "First event should be message_start"

        # message_end should be last
        assert types[-1] == "message_end", "Last event should be message_end"


@pytest.mark.contract
class TestErrorResponseContract:
    """Contract tests for error response formats."""

    def test_rate_limit_error_schema(self, client, ai_client):
        """Validate rate limit error response format."""
        # Import rate limit repo from fixtures
        from tests.e2e.conftest import _rate_limit_repo

        # Set user over limit
        _rate_limit_repo.set_usage(TEST_USER_ID, 1000)

        response = client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )

        # Should return 429 or similar
        assert response.status_code in [429, 200]  # May stream error event

        if response.status_code == 200:
            events = parse_sse_events(response.text)
            error_events = find_events(events, "error")
            if error_events:
                for event in error_events:
                    errors = validate_schema(event["data"], SSE_ERROR_SCHEMA)
                    assert not errors, f"Error schema validation failed: {errors}"

    def test_validation_error_response(self, client):
        """Validate 422 validation error response format."""
        response = client.post(
            "/chat/stream",
            json={},  # Missing required 'message' field
        )

        assert response.status_code == 422

        data = response.json()
        assert "detail" in data
        assert isinstance(data["detail"], list)

        # Each validation error should have loc, msg, type
        for error in data["detail"]:
            assert "loc" in error
            assert "msg" in error
            assert "type" in error


@pytest.mark.contract
class TestChatRequestContract:
    """Contract tests for /chat/stream request format."""

    def test_minimal_request(self, client, ai_client):
        """Validate minimal request with only message."""
        ai_client.response_events = [
            StreamEvent(event="content_delta", data={"text": "OK"}),
            StreamEvent(
                event="message_end",
                data={"model": "claude-sonnet-4-20250514", "input_tokens": 10, "output_tokens": 5, "latency_ms": 100},
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )

        assert response.status_code == 200

    def test_full_request(self, client, ai_client):
        """Validate request with all optional fields."""
        ai_client.response_events = [
            StreamEvent(event="content_delta", data={"text": "OK"}),
            StreamEvent(
                event="message_end",
                data={"model": "claude-sonnet-4-20250514", "input_tokens": 10, "output_tokens": 5, "latency_ms": 100},
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={
                "message": "Hello",
                "session_id": "sess-test-123",
                "context": {"page": "library", "selected_workout_id": "w-123"},
            },
        )

        assert response.status_code == 200

    def test_empty_message_rejected(self, client):
        """Validate empty message is rejected."""
        response = client.post(
            "/chat/stream",
            json={"message": ""},
        )

        # Should be rejected by validation
        assert response.status_code in [400, 422]


@pytest.mark.contract
class TestHealthEndpointContract:
    """Contract tests for health check endpoints."""

    def test_health_response_schema(self, client):
        """Validate /health response format."""
        response = client.get("/health")

        assert response.status_code == 200

        data = response.json()
        assert "status" in data
        assert data["status"] in ["ok", "healthy", "degraded", "unhealthy"]

    def test_ready_response_schema(self, client):
        """Validate /ready response format if endpoint exists."""
        response = client.get("/ready")

        # /ready endpoint may not exist - that's acceptable
        if response.status_code == 404:
            pytest.skip("/ready endpoint not implemented")

        assert response.status_code == 200

        data = response.json()
        assert "status" in data


@pytest.mark.contract
class TestFunctionResultContract:
    """Contract tests for function execution results."""

    def test_search_result_format(self):
        """Validate search_workout_library result format."""
        from tests.e2e.conftest import FakeFunctionDispatcher
        from backend.services.function_dispatcher import FunctionContext

        dispatcher = FakeFunctionDispatcher()
        context = FunctionContext(user_id="test-user", auth_token="Bearer test")

        result = dispatcher.execute(
            function_name="search_workout_library",
            arguments={"query": "HIIT"},
            context=context,
        )

        # Result should be a formatted string
        assert isinstance(result, str)
        assert "Found" in result or "workout" in result.lower()

    def test_calendar_result_format(self):
        """Validate add_workout_to_calendar result format."""
        from tests.e2e.conftest import FakeFunctionDispatcher
        from backend.services.function_dispatcher import FunctionContext

        dispatcher = FakeFunctionDispatcher()
        context = FunctionContext(user_id="test-user", auth_token="Bearer test")

        result = dispatcher.execute(
            function_name="add_workout_to_calendar",
            arguments={"workout_id": "w-123", "date": "2024-01-15"},
            context=context,
        )

        assert isinstance(result, str)
        assert "calendar" in result.lower() or "added" in result.lower()

    def test_generate_result_format(self):
        """Validate generate_ai_workout result format."""
        from tests.e2e.conftest import FakeFunctionDispatcher
        from backend.services.function_dispatcher import FunctionContext

        dispatcher = FakeFunctionDispatcher()
        context = FunctionContext(user_id="test-user", auth_token="Bearer test")

        result = dispatcher.execute(
            function_name="generate_ai_workout",
            arguments={"description": "30 minute HIIT"},
            context=context,
        )

        assert isinstance(result, str)
        assert "generated" in result.lower() or "workout" in result.lower()

    def test_navigate_result_format(self):
        """Validate navigate_to_page result format."""
        from tests.e2e.conftest import FakeFunctionDispatcher
        from backend.services.function_dispatcher import FunctionContext

        dispatcher = FakeFunctionDispatcher()
        context = FunctionContext(user_id="test-user", auth_token="Bearer test")

        result = dispatcher.execute(
            function_name="navigate_to_page",
            arguments={"page": "calendar"},
            context=context,
        )

        # Should be valid JSON
        assert isinstance(result, str)
        data = json.loads(result)
        assert "action" in data
        assert data["action"] == "navigate"
        assert "page" in data


# =============================================================================
# Phase 2: Content Ingestion Response Contracts
# =============================================================================


# Response schemas for Phase 2
INGESTION_SUCCESS_SCHEMA = {
    "type": "object",
    "properties": {
        "success": {"type": "boolean"},
        "source": {"type": "string"},
        "workout": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "id": {"type": "string"},
                "exercise_count": {"type": "integer"},
            },
            "required": ["title"],
        },
    },
    "required": ["success"],
}

PINTEREST_MULTI_SCHEMA = {
    "type": "object",
    "properties": {
        "success": {"type": "boolean"},
        "multiple_workouts": {"type": "boolean"},
        "total": {"type": "integer"},
        "workouts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "id": {"type": "string"},
                },
                "required": ["title"],
            },
        },
    },
    "required": ["success", "multiple_workouts", "total", "workouts"],
}


@pytest.mark.contract
class TestPhase2ResponseContracts:
    """Contract tests for Phase 2 content ingestion response formats."""

    @pytest.mark.smoke
    def test_youtube_success_response_contract(self):
        """YouTube success response matches schema."""
        from tests.e2e.conftest import FakeFunctionDispatcher
        from backend.services.function_dispatcher import FunctionContext

        dispatcher = FakeFunctionDispatcher()
        context = FunctionContext(user_id="test-user", auth_token="Bearer test")

        result = dispatcher.execute(
            function_name="import_from_youtube",
            arguments={"url": "https://youtube.com/watch?v=test"},
            context=context,
        )

        data = json.loads(result)
        errors = validate_schema(data, INGESTION_SUCCESS_SCHEMA)
        assert not errors, f"Schema validation failed: {errors}"
        assert data["success"] is True
        assert data["source"] == "YouTube video"
        assert "workout" in data
        assert "title" in data["workout"]

    def test_tiktok_success_response_contract(self):
        """TikTok success response matches schema."""
        from tests.e2e.conftest import FakeFunctionDispatcher
        from backend.services.function_dispatcher import FunctionContext

        dispatcher = FakeFunctionDispatcher()
        context = FunctionContext(user_id="test-user", auth_token="Bearer test")

        result = dispatcher.execute(
            function_name="import_from_tiktok",
            arguments={"url": "https://tiktok.com/@user/video/123"},
            context=context,
        )

        data = json.loads(result)
        errors = validate_schema(data, INGESTION_SUCCESS_SCHEMA)
        assert not errors, f"Schema validation failed: {errors}"
        assert data["success"] is True
        assert data["source"] == "TikTok video"

    def test_instagram_success_response_contract(self):
        """Instagram success response matches schema."""
        from tests.e2e.conftest import FakeFunctionDispatcher
        from backend.services.function_dispatcher import FunctionContext

        dispatcher = FakeFunctionDispatcher()
        context = FunctionContext(user_id="test-user", auth_token="Bearer test")

        result = dispatcher.execute(
            function_name="import_from_instagram",
            arguments={"url": "https://instagram.com/p/ABC123"},
            context=context,
        )

        data = json.loads(result)
        errors = validate_schema(data, INGESTION_SUCCESS_SCHEMA)
        assert not errors, f"Schema validation failed: {errors}"
        assert data["success"] is True
        assert data["source"] == "Instagram post"

    def test_pinterest_single_response_contract(self):
        """Pinterest single pin response matches schema."""
        from tests.e2e.conftest import FakeFunctionDispatcher
        from backend.services.function_dispatcher import FunctionContext

        dispatcher = FakeFunctionDispatcher()
        context = FunctionContext(user_id="test-user", auth_token="Bearer test")

        result = dispatcher.execute(
            function_name="import_from_pinterest",
            arguments={"url": "https://pinterest.com/pin/123"},
            context=context,
        )

        data = json.loads(result)
        errors = validate_schema(data, INGESTION_SUCCESS_SCHEMA)
        assert not errors, f"Schema validation failed: {errors}"
        assert data["success"] is True

    @pytest.mark.smoke
    def test_pinterest_multi_response_contract(self):
        """Pinterest board response matches multi-workout schema."""
        from tests.e2e.conftest import FakeFunctionDispatcher
        from backend.services.function_dispatcher import FunctionContext

        dispatcher = FakeFunctionDispatcher()
        context = FunctionContext(user_id="test-user", auth_token="Bearer test")

        # Use board URL to trigger multi-workout response
        result = dispatcher.execute(
            function_name="import_from_pinterest",
            arguments={"url": "https://pinterest.com/user/board/fitness"},
            context=context,
        )

        data = json.loads(result)
        errors = validate_schema(data, PINTEREST_MULTI_SCHEMA)
        assert not errors, f"Schema validation failed: {errors}"
        assert data["success"] is True
        assert data["multiple_workouts"] is True
        assert data["total"] >= 1
        assert isinstance(data["workouts"], list)
        assert all("title" in w for w in data["workouts"])

    def test_image_success_response_contract(self):
        """Image import success response matches schema."""
        from tests.e2e.conftest import FakeFunctionDispatcher
        from backend.services.function_dispatcher import FunctionContext
        import base64

        dispatcher = FakeFunctionDispatcher()
        context = FunctionContext(user_id="test-user", auth_token="Bearer test")

        fake_image = base64.b64encode(b"test").decode()
        result = dispatcher.execute(
            function_name="import_from_image",
            arguments={"image_data": fake_image},
            context=context,
        )

        data = json.loads(result)
        errors = validate_schema(data, INGESTION_SUCCESS_SCHEMA)
        assert not errors, f"Schema validation failed: {errors}"
        assert data["success"] is True
        assert data["source"] == "image"

    def test_all_ingestion_responses_have_success_field(self):
        """All ingestion responses must have success boolean field."""
        from tests.e2e.conftest import FakeFunctionDispatcher
        from backend.services.function_dispatcher import FunctionContext
        import base64

        dispatcher = FakeFunctionDispatcher()
        context = FunctionContext(user_id="test-user", auth_token="Bearer test")

        ingestion_functions = [
            ("import_from_youtube", {"url": "https://youtube.com/watch?v=test"}),
            ("import_from_tiktok", {"url": "https://tiktok.com/@user/video/123"}),
            ("import_from_instagram", {"url": "https://instagram.com/p/ABC"}),
            ("import_from_pinterest", {"url": "https://pinterest.com/pin/123"}),
            ("import_from_image", {"image_data": base64.b64encode(b"test").decode()}),
        ]

        for func_name, args in ingestion_functions:
            result = dispatcher.execute(func_name, args, context)
            data = json.loads(result)
            assert "success" in data, f"{func_name} response missing 'success' field"
            assert isinstance(data["success"], bool), f"{func_name} 'success' must be boolean"


@pytest.mark.contract
class TestPhase2FunctionResultContracts:
    """Contract tests for Phase 2 function_result SSE events."""

    def test_ingestion_function_result_format(self, client, ai_client):
        """Verify ingestion function_result events have correct format."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_contract_1", "name": "import_from_youtube"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"url": "https://youtube.com/watch?v=test"}'},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 100,
                    "output_tokens": 50,
                    "latency_ms": 800,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Import YouTube video"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        # Find function_result event
        fr_events = find_events(events, "function_result")
        assert len(fr_events) >= 1

        fr = fr_events[0]["data"]
        # Validate function_result schema
        errors = validate_schema(fr, SSE_FUNCTION_RESULT_SCHEMA)
        assert not errors, f"function_result schema validation failed: {errors}"

        # The result should be valid JSON
        result = json.loads(fr["result"])
        assert "success" in result


# =============================================================================
# Chat Sessions Response Contracts
# =============================================================================


CHAT_SESSION_SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "title": {},  # Can be string or null, skip type check
        "created_at": {"type": "string"},
        "updated_at": {"type": "string"},
    },
    "required": ["id", "created_at", "updated_at"],
}


@pytest.mark.contract
class TestChatSessionsContract:
    """Contract tests for GET /chat/sessions response format."""

    def test_sessions_response_is_list(self, client, session_repo):
        """Response should be a JSON array."""
        # Create some sessions
        session_repo.create(TEST_USER_ID, "Chat 1")
        session_repo.create(TEST_USER_ID, "Chat 2")

        response = client.get("/chat/sessions")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_session_summary_schema(self, client, session_repo):
        """Each session in response should match ChatSessionSummary schema."""
        session_repo.create(TEST_USER_ID, "Test Chat")

        response = client.get("/chat/sessions")

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

        for session in data:
            errors = validate_schema(session, CHAT_SESSION_SUMMARY_SCHEMA)
            assert not errors, f"Schema validation failed: {errors}"

    def test_session_has_required_fields(self, client, session_repo):
        """Each session must have id, created_at, updated_at."""
        session_repo.create(TEST_USER_ID, "Required Fields Test")

        response = client.get("/chat/sessions")

        assert response.status_code == 200
        session = response.json()[0]

        assert "id" in session
        assert "created_at" in session
        assert "updated_at" in session
        assert isinstance(session["id"], str)
        assert isinstance(session["created_at"], str)
        assert isinstance(session["updated_at"], str)

    def test_session_title_can_be_null(self, client, session_repo):
        """Title field should accept null values."""
        # Create session then manually set title to None
        sess = session_repo.create(TEST_USER_ID, None)
        session_repo._sessions[sess["id"]]["title"] = None

        response = client.get("/chat/sessions")

        assert response.status_code == 200
        data = response.json()
        # Find our session
        our_session = next((s for s in data if s["id"] == sess["id"]), None)
        assert our_session is not None
        assert our_session["title"] is None

    def test_empty_sessions_returns_empty_list(self, client):
        """Empty session list should return empty array, not null."""
        response = client.get("/chat/sessions")

        assert response.status_code == 200
        data = response.json()
        assert data == []
        assert isinstance(data, list)

    def test_datetime_format_is_iso8601(self, client, session_repo):
        """Datetime fields should be in ISO 8601 format."""
        session_repo.create(TEST_USER_ID, "DateTime Test")

        response = client.get("/chat/sessions")

        assert response.status_code == 200
        session = response.json()[0]

        # ISO 8601 format check (should contain T separator)
        assert "T" in session["created_at"]
        assert "T" in session["updated_at"]

    def test_pagination_params_accepted(self, client, session_repo):
        """Endpoint should accept limit and offset query params."""
        for i in range(5):
            session_repo.create(TEST_USER_ID, f"Chat {i}")

        response = client.get("/chat/sessions?limit=2&offset=1")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_invalid_limit_returns_422(self, client):
        """Invalid limit should return validation error."""
        response = client.get("/chat/sessions?limit=0")
        assert response.status_code == 422

        response = client.get("/chat/sessions?limit=101")
        assert response.status_code == 422

    def test_invalid_offset_returns_422(self, client):
        """Negative offset should return validation error."""
        response = client.get("/chat/sessions?offset=-1")
        assert response.status_code == 422
