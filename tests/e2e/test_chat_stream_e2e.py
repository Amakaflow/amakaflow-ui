"""
E2E tests for POST /chat/stream -- SSE streaming chat endpoint (AMA-439).

Coverage:
    SMOKE (PR gate):
        - Happy path: new session, SSE event sequence, content delivery
        - Auth rejection: missing credentials returns 401
        - Validation: empty/missing message returns 422
        - Rate limit: exceeded cap yields error SSE event
        - SSE content type header

    REGRESSION (nightly):
        - Existing session continuation (multi-turn)
        - Session not found yields error SSE event
        - Function call + function result events
        - AI client error propagation through SSE
        - Auto-title on new sessions
        - Message persistence (user + assistant)
        - Rate limit increment after success
        - Large message (boundary at 10000 chars)
        - Multiple content_delta reassembly
        - Session isolation between users
        - Concurrent sequential requests
"""

import json
from typing import Any, Dict, List

import pytest

from backend.services.ai_client import StreamEvent
from tests.e2e.conftest import (
    TEST_USER_ID,
    SECOND_USER_ID,
    FakeAIClient,
    FakeChatSessionRepository,
    FakeChatMessageRepository,
    FakeRateLimitRepository,
    parse_sse_events,
    extract_event_types,
    find_events,
)


# ============================================================================
# SMOKE SUITE -- run on every PR
# ============================================================================


@pytest.mark.integration
class TestChatStreamSmoke:
    """Critical-path tests that must pass on every PR."""

    def test_happy_path_new_session(self, client):
        """POST /chat/stream with valid auth creates session and streams response."""
        response = client.post(
            "/chat/stream",
            json={"message": "Suggest a leg workout"},
        )

        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

        events = parse_sse_events(response.text)
        types = extract_event_types(events)

        # Invariant: first event is message_start, last is message_end
        assert types[0] == "message_start"
        assert types[-1] == "message_end"
        assert "content_delta" in types

        # message_start must contain a session_id
        start = events[0]["data"]
        assert "session_id" in start
        assert isinstance(start["session_id"], str)
        assert len(start["session_id"]) > 0

    def test_auth_required(self, noauth_client):
        """Missing auth credentials returns 401."""
        response = noauth_client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )
        assert response.status_code == 401

    def test_empty_message_rejected(self, client):
        """Empty message string returns 422 validation error."""
        response = client.post(
            "/chat/stream",
            json={"message": ""},
        )
        assert response.status_code == 422

    def test_missing_message_field(self, client):
        """Missing message field returns 422."""
        response = client.post(
            "/chat/stream",
            json={},
        )
        assert response.status_code == 422

    def test_rate_limit_exceeded(self, client, rate_limit_repo):
        """When monthly usage >= limit, stream yields a rate_limit_exceeded error event."""
        rate_limit_repo.set_usage(TEST_USER_ID, 50)

        response = client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )

        assert response.status_code == 200  # SSE always returns 200
        events = parse_sse_events(response.text)
        assert len(events) >= 1
        assert events[0]["event"] == "error"
        assert events[0]["data"]["type"] == "rate_limit_exceeded"
        assert events[0]["data"]["usage"] == 50
        assert events[0]["data"]["limit"] == 50

    def test_sse_content_type(self, client):
        """Response content-type is text/event-stream."""
        response = client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )
        content_type = response.headers.get("content-type", "")
        assert "text/event-stream" in content_type


# ============================================================================
# REGRESSION SUITE -- nightly / full CI
# ============================================================================


@pytest.mark.integration
class TestChatStreamSessionManagement:
    """Session creation, continuation, and isolation."""

    def test_existing_session_continuation(self, client, session_repo):
        """Providing a valid session_id continues the conversation."""
        # Create a session first
        session = session_repo.create(TEST_USER_ID, title="Prior chat")
        sid = session["id"]

        response = client.post(
            "/chat/stream",
            json={"message": "Continue our chat", "session_id": sid},
        )

        events = parse_sse_events(response.text)
        start = events[0]["data"]
        assert start["session_id"] == sid

    def test_nonexistent_session_yields_error(self, client):
        """Referencing a session_id that does not exist yields a not_found error event."""
        response = client.post(
            "/chat/stream",
            json={"message": "Hello", "session_id": "sess-does-not-exist"},
        )

        events = parse_sse_events(response.text)
        assert len(events) == 1
        assert events[0]["event"] == "error"
        assert events[0]["data"]["type"] == "not_found"

    def test_session_isolation_between_users(self, client, session_repo):
        """A session owned by user A is not accessible by user B.

        The auth override always returns TEST_USER_ID, so creating a session
        for SECOND_USER_ID should make it invisible.
        """
        session = session_repo.create(SECOND_USER_ID, title="Other user")
        sid = session["id"]

        response = client.post(
            "/chat/stream",
            json={"message": "Hijack attempt", "session_id": sid},
        )

        events = parse_sse_events(response.text)
        assert events[0]["event"] == "error"
        assert events[0]["data"]["type"] == "not_found"

    def test_auto_title_on_new_session(self, client, session_repo):
        """New sessions get an auto-generated title from the first message."""
        response = client.post(
            "/chat/stream",
            json={"message": "Suggest a leg workout"},
        )

        events = parse_sse_events(response.text)
        sid = events[0]["data"]["session_id"]

        session = session_repo.get(sid, TEST_USER_ID)
        assert session is not None
        assert "Suggest a leg workout" in session["title"]

    def test_auto_title_truncated_for_long_message(self, client, session_repo):
        """Messages longer than 80 chars get truncated in the session title."""
        long_msg = "A" * 100
        response = client.post(
            "/chat/stream",
            json={"message": long_msg},
        )

        events = parse_sse_events(response.text)
        sid = events[0]["data"]["session_id"]
        session = session_repo.get(sid, TEST_USER_ID)
        assert session is not None
        assert len(session["title"]) <= 83  # 80 chars + "..."


@pytest.mark.integration
class TestChatStreamSSEContract:
    """SSE event structure and data contracts."""

    def test_message_end_contains_stats(self, client):
        """message_end event must have session_id, tokens_used, latency_ms."""
        response = client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )

        events = parse_sse_events(response.text)
        end_events = find_events(events, "message_end")
        assert len(end_events) == 1

        end_data = end_events[0]["data"]
        assert "session_id" in end_data
        assert "tokens_used" in end_data
        assert "latency_ms" in end_data
        assert isinstance(end_data["tokens_used"], int)
        assert isinstance(end_data["latency_ms"], int)

    def test_content_delta_reassembly(self, client):
        """Multiple content_delta events concatenate to the full response."""
        response = client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )

        events = parse_sse_events(response.text)
        deltas = find_events(events, "content_delta")

        full_text = "".join(d["data"]["text"] for d in deltas)
        assert full_text == "I can help with your workout!"

    def test_all_content_delta_events_have_text(self, client):
        """Every content_delta event must have a 'text' key."""
        response = client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )

        events = parse_sse_events(response.text)
        for evt in find_events(events, "content_delta"):
            assert "text" in evt["data"]
            assert isinstance(evt["data"]["text"], str)

    def test_event_data_is_valid_json(self, client):
        """All SSE event data payloads are valid JSON."""
        response = client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )

        events = parse_sse_events(response.text)
        for evt in events:
            # parse_sse_events already parses JSON; if data is a dict, it parsed
            assert isinstance(evt["data"], (dict, list, str, int, float, bool))


@pytest.mark.integration
class TestChatStreamFunctionCalls:
    """Tool/function call events in the SSE stream."""

    def test_function_call_and_result_events(self, client, ai_client):
        """When AI invokes a tool, both function_call and function_result appear."""
        ai_client.response_events = [
            StreamEvent(event="function_call", data={
                "id": "tool-abc", "name": "lookup_user_profile",
            }),
            StreamEvent(event="content_delta", data={"text": "Based on your profile..."}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 200,
                "output_tokens": 80,
                "latency_ms": 1200,
            }),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "What is my fitness profile?"},
        )

        events = parse_sse_events(response.text)
        types = extract_event_types(events)

        assert "function_call" in types
        assert "function_result" in types

        fc = find_events(events, "function_call")[0]["data"]
        assert fc["id"] == "tool-abc"
        assert fc["name"] == "lookup_user_profile"

        fr = find_events(events, "function_result")[0]["data"]
        assert fr["tool_use_id"] == "tool-abc"
        assert fr["name"] == "lookup_user_profile"
        assert "not yet connected" in fr["result"]

    def test_function_result_precedes_content(self, client, ai_client):
        """function_result should appear before subsequent content_delta events."""
        ai_client.response_events = [
            StreamEvent(event="function_call", data={
                "id": "tool-1", "name": "search_workouts",
            }),
            StreamEvent(event="content_delta", data={"text": "Found workouts!"}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 150,
                "output_tokens": 40,
                "latency_ms": 900,
            }),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Find chest workouts"},
        )

        events = parse_sse_events(response.text)
        types = extract_event_types(events)

        fr_idx = types.index("function_result")
        cd_idx = types.index("content_delta")
        assert fr_idx < cd_idx, "function_result must appear before content_delta"


@pytest.mark.integration
class TestChatStreamErrorPropagation:
    """AI client errors propagated through the SSE stream."""

    def test_ai_rate_limit_error(self, client, ai_client):
        """Anthropic rate limit error yields an SSE error event."""
        ai_client.response_events = [
            StreamEvent(event="error", data={
                "type": "rate_limit",
                "message": "AI service is busy. Please try again shortly.",
            }),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )

        events = parse_sse_events(response.text)
        # message_start is emitted before streaming begins, then error
        error_events = find_events(events, "error")
        assert len(error_events) == 1
        assert error_events[0]["data"]["type"] == "rate_limit"

    def test_ai_api_error(self, client, ai_client):
        """Generic Anthropic API error yields an SSE error event."""
        ai_client.response_events = [
            StreamEvent(event="error", data={
                "type": "api_error",
                "message": "AI service error. Please try again.",
            }),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )

        events = parse_sse_events(response.text)
        error_events = find_events(events, "error")
        assert len(error_events) == 1
        assert error_events[0]["data"]["type"] == "api_error"

    def test_error_terminates_stream(self, client, ai_client):
        """When the AI client yields an error, no further events follow."""
        ai_client.response_events = [
            StreamEvent(event="error", data={
                "type": "internal_error",
                "message": "An unexpected error occurred.",
            }),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )

        events = parse_sse_events(response.text)
        # Only message_start + error (stream terminates on error in use case)
        types = extract_event_types(events)
        assert "message_end" not in types


@pytest.mark.integration
class TestChatStreamPersistence:
    """Message and rate limit persistence."""

    def test_user_message_persisted(self, client, message_repo):
        """The user's message is saved to the message repository."""
        response = client.post(
            "/chat/stream",
            json={"message": "Help me with squats"},
        )
        events = parse_sse_events(response.text)
        sid = events[0]["data"]["session_id"]

        messages = message_repo.list_for_session(sid)
        user_msgs = [m for m in messages if m["role"] == "user"]
        assert len(user_msgs) == 1
        assert user_msgs[0]["content"] == "Help me with squats"

    def test_assistant_message_persisted(self, client, message_repo):
        """The assistant's full response is saved after streaming completes."""
        response = client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )
        events = parse_sse_events(response.text)
        sid = events[0]["data"]["session_id"]

        messages = message_repo.list_for_session(sid)
        assistant_msgs = [m for m in messages if m["role"] == "assistant"]
        assert len(assistant_msgs) == 1
        assert "I can help with your workout!" in assistant_msgs[0]["content"]

    def test_rate_limit_incremented(self, client, rate_limit_repo):
        """Successful chat increments the user's monthly usage counter."""
        assert rate_limit_repo.get_monthly_usage(TEST_USER_ID) == 0

        client.post("/chat/stream", json={"message": "Hello"})

        assert rate_limit_repo.get_monthly_usage(TEST_USER_ID) == 1

    def test_rate_limit_not_incremented_when_exceeded(self, client, rate_limit_repo):
        """When rate limit is already exceeded, usage is not further incremented."""
        rate_limit_repo.set_usage(TEST_USER_ID, 50)

        client.post("/chat/stream", json={"message": "Hello"})

        assert rate_limit_repo.get_monthly_usage(TEST_USER_ID) == 50


@pytest.mark.integration
class TestChatStreamRateLimitBoundary:
    """Boundary testing around the rate limit threshold."""

    def test_at_limit_minus_one(self, client, rate_limit_repo):
        """Usage at limit-1 still allows a request."""
        rate_limit_repo.set_usage(TEST_USER_ID, 49)

        response = client.post(
            "/chat/stream",
            json={"message": "Last message"},
        )

        events = parse_sse_events(response.text)
        types = extract_event_types(events)
        assert "message_start" in types
        assert "content_delta" in types

    def test_at_exact_limit(self, client, rate_limit_repo):
        """Usage exactly at the limit is rejected."""
        rate_limit_repo.set_usage(TEST_USER_ID, 50)

        response = client.post(
            "/chat/stream",
            json={"message": "One more"},
        )

        events = parse_sse_events(response.text)
        assert events[0]["event"] == "error"
        assert events[0]["data"]["type"] == "rate_limit_exceeded"

    def test_over_limit(self, client, rate_limit_repo):
        """Usage over the limit is also rejected."""
        rate_limit_repo.set_usage(TEST_USER_ID, 100)

        response = client.post(
            "/chat/stream",
            json={"message": "Way over"},
        )

        events = parse_sse_events(response.text)
        assert events[0]["event"] == "error"
        assert events[0]["data"]["type"] == "rate_limit_exceeded"


@pytest.mark.integration
class TestChatStreamValidation:
    """Request body validation edge cases."""

    def test_message_at_max_length(self, client):
        """A message of exactly 10000 characters is accepted."""
        response = client.post(
            "/chat/stream",
            json={"message": "A" * 10000},
        )
        assert response.status_code == 200

    def test_message_over_max_length(self, client):
        """A message exceeding 10000 characters is rejected."""
        response = client.post(
            "/chat/stream",
            json={"message": "A" * 10001},
        )
        assert response.status_code == 422

    def test_whitespace_only_message(self, client):
        """A message containing only whitespace should still be accepted
        (it passes min_length=1 since whitespace chars count)."""
        response = client.post(
            "/chat/stream",
            json={"message": " "},
        )
        # Single space is length 1, so passes min_length validation
        assert response.status_code == 200

    def test_no_json_body(self, client):
        """Request with no body returns 422."""
        response = client.post("/chat/stream")
        assert response.status_code == 422


@pytest.mark.integration
class TestChatStreamMultiTurn:
    """Multi-turn conversation continuity."""

    def test_second_message_includes_history(self, client, ai_client, session_repo):
        """Second message in a session sends conversation history to the AI."""
        # First message
        resp1 = client.post(
            "/chat/stream",
            json={"message": "I want to build muscle"},
        )
        events1 = parse_sse_events(resp1.text)
        sid = events1[0]["data"]["session_id"]

        # Reset AI client tracking (but keep fake repos populated)
        ai_client.call_count = 0
        ai_client.last_call_kwargs = None

        # Second message in same session
        resp2 = client.post(
            "/chat/stream",
            json={"message": "What about legs specifically?", "session_id": sid},
        )

        events2 = parse_sse_events(resp2.text)
        assert events2[0]["data"]["session_id"] == sid

        # The AI client should have received history with 3 messages:
        # user: "I want to build muscle", assistant: ..., user: "What about legs..."
        assert ai_client.last_call_kwargs is not None
        messages_sent = ai_client.last_call_kwargs["messages"]
        assert len(messages_sent) >= 2  # At least previous user + current user

    def test_three_turn_conversation(self, client, ai_client):
        """Three consecutive messages in the same session all use shared context."""
        # Turn 1
        resp1 = client.post("/chat/stream", json={"message": "Hello"})
        events1 = parse_sse_events(resp1.text)
        sid = events1[0]["data"]["session_id"]

        # Turn 2
        resp2 = client.post(
            "/chat/stream",
            json={"message": "Tell me about pushups", "session_id": sid},
        )
        parse_sse_events(resp2.text)  # consume

        # Turn 3
        ai_client.call_count = 0
        ai_client.last_call_kwargs = None
        resp3 = client.post(
            "/chat/stream",
            json={"message": "How many sets?", "session_id": sid},
        )
        events3 = parse_sse_events(resp3.text)
        assert events3[0]["data"]["session_id"] == sid

        # By turn 3, history should have at least 4 messages
        # (user, assistant, user, assistant from turns 1-2, plus current user)
        messages_sent = ai_client.last_call_kwargs["messages"]
        assert len(messages_sent) >= 4
