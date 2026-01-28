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
    parse_sse_events,
    extract_event_types,
    find_events,
    TEST_USER_ID,
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
