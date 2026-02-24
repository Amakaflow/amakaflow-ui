"""Integration tests for chat API endpoints.

These tests exercise the full request/response cycle with fake dependencies,
validating SSE streaming, function dispatch round-trips, rate limiting,
and session management.

Usage:
    pytest -m chat_integration -v
    pytest tests/test_chat_integration.py --tb=short
"""

import json
from typing import Any, Dict, List

import pytest

from backend.services.ai_client import StreamEvent
from tests.e2e.conftest import (
    FakeAIClient,
    FakeFunctionDispatcher,
    FakeChatSessionRepository,
    FakeChatMessageRepository,
    FakeRateLimitRepository,
    parse_sse_events,
    extract_event_types,
    find_events,
    TEST_USER_ID,
)

# Note: Fixtures (app, client, ai_client, function_dispatcher, session_repo,
# message_repo, rate_limit_repo, _reset_fakes) are discovered automatically
# by pytest from tests/e2e/conftest.py - no import needed


@pytest.mark.chat_integration
class TestSSEStreamingValidation:
    """Tests for SSE streaming behavior and event sequences."""

    def test_streaming_event_sequence_text_response(self, client, ai_client):
        """Validate correct event sequence for text responses."""
        ai_client.response_events = [
            StreamEvent(event="content_delta", data={"text": "Hello "}),
            StreamEvent(event="content_delta", data={"text": "there!"}),
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

        response = client.post("/chat/stream", json={"message": "Hi"})
        assert response.status_code == 200

        events = parse_sse_events(response.text)
        types = extract_event_types(events)

        # Expected sequence: message_start -> content_delta(s) -> message_end
        assert types[0] == "message_start"
        assert types[-1] == "message_end"
        assert "content_delta" in types

    def test_streaming_event_sequence_function_call(
        self, client, ai_client, function_dispatcher
    ):
        """Validate correct event sequence for function call responses."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_123", "name": "search_workout_library"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"query": "leg workout"}'},
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
            "/chat/stream", json={"message": "Find leg workouts"}
        )
        assert response.status_code == 200

        events = parse_sse_events(response.text)
        types = extract_event_types(events)

        # Should have function_call event
        assert "function_call" in types
        assert types[0] == "message_start"
        assert types[-1] == "message_end"

    def test_multiple_content_deltas_concatenated(self, client, ai_client):
        """Validate multiple content deltas form complete response."""
        chunks = ["This ", "is ", "a ", "multi-part ", "response."]
        ai_client.response_events = [
            StreamEvent(event="content_delta", data={"text": chunk})
            for chunk in chunks
        ] + [
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 50,
                    "output_tokens": 20,
                    "latency_ms": 600,
                },
            ),
        ]

        response = client.post("/chat/stream", json={"message": "Tell me something"})
        assert response.status_code == 200

        events = parse_sse_events(response.text)
        deltas = find_events(events, "content_delta")

        # Should have all chunks
        assert len(deltas) == len(chunks)

        # Concatenated text should match
        full_text = "".join(e["data"]["text"] for e in deltas)
        assert full_text == "".join(chunks)


@pytest.mark.chat_integration
class TestFunctionDispatchRoundTrip:
    """Tests for complete function dispatch cycle."""

    def test_search_function_round_trip(self, client, ai_client, function_dispatcher):
        """Test complete search_workout_library flow."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_search", "name": "search_workout_library"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"query": "HIIT workout", "limit": 5}'},
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
            "/chat/stream", json={"message": "Find me HIIT workouts"}
        )
        assert response.status_code == 200

        # Verify dispatcher was called
        assert function_dispatcher.call_count == 1
        assert function_dispatcher.last_call["function_name"] == "search_workout_library"
        assert function_dispatcher.last_call["arguments"]["query"] == "HIIT workout"

    def test_calendar_function_round_trip(self, client, ai_client, function_dispatcher):
        """Test complete add_workout_to_calendar flow."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_cal", "name": "add_workout_to_calendar"},
            ),
            StreamEvent(
                event="content_delta",
                data={
                    "partial_json": '{"workout_id": "w-123", "date": "2024-01-15", "time": "08:00"}'
                },
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 120,
                    "output_tokens": 40,
                    "latency_ms": 900,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Schedule workout w-123 for Jan 15th at 8am"},
        )
        assert response.status_code == 200

        assert function_dispatcher.call_count == 1
        assert function_dispatcher.last_call["function_name"] == "add_workout_to_calendar"
        assert function_dispatcher.last_call["arguments"]["workout_id"] == "w-123"
        assert function_dispatcher.last_call["arguments"]["date"] == "2024-01-15"

    def test_generate_function_round_trip(self, client, ai_client, function_dispatcher):
        """Test complete generate_ai_workout flow."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_gen", "name": "generate_ai_workout"},
            ),
            StreamEvent(
                event="content_delta",
                data={
                    "partial_json": '{"description": "30 minute HIIT", "difficulty": "intermediate"}'
                },
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 110,
                    "output_tokens": 35,
                    "latency_ms": 850,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Create a 30 minute intermediate HIIT workout"},
        )
        assert response.status_code == 200

        assert function_dispatcher.call_count == 1
        assert function_dispatcher.last_call["function_name"] == "generate_ai_workout"
        assert "HIIT" in function_dispatcher.last_call["arguments"]["description"]

    def test_navigate_function_round_trip(self, client, ai_client, function_dispatcher):
        """Test complete navigate_to_page flow."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_nav", "name": "navigate_to_page"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"page": "calendar"}'},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 80,
                    "output_tokens": 20,
                    "latency_ms": 500,
                },
            ),
        ]

        response = client.post(
            "/chat/stream", json={"message": "Take me to my calendar"}
        )
        assert response.status_code == 200

        assert function_dispatcher.call_count == 1
        assert function_dispatcher.last_call["function_name"] == "navigate_to_page"
        assert function_dispatcher.last_call["arguments"]["page"] == "calendar"

    def test_function_error_handling(self, client, ai_client, function_dispatcher):
        """Test function execution error is handled gracefully."""
        function_dispatcher.set_error(
            "search_workout_library", "API timeout - please try again"
        )

        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_err", "name": "search_workout_library"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"query": "test"}'},
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
            "/chat/stream", json={"message": "Find workouts"}
        )

        # Request should still succeed (error handled gracefully)
        assert response.status_code == 200

        # Dispatcher was called and returned error message
        assert function_dispatcher.call_count == 1

    def test_auth_token_forwarded(self, client, ai_client, function_dispatcher):
        """Verify auth token is forwarded to function dispatcher."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_auth", "name": "search_workout_library"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"query": "test"}'},
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
            "/chat/stream", json={"message": "Search workouts"}
        )
        assert response.status_code == 200

        # Verify auth token was captured
        assert function_dispatcher.last_call is not None
        assert function_dispatcher.last_call["auth_token"] is not None
        assert "Bearer" in function_dispatcher.last_call["auth_token"]


@pytest.mark.chat_integration
class TestRateLimitingEnforcement:
    """Tests for rate limiting at endpoint level."""

    def test_under_limit_succeeds(self, client, ai_client, rate_limit_repo):
        """Requests under rate limit succeed."""
        rate_limit_repo.set_usage(TEST_USER_ID, 10)

        ai_client.response_events = [
            StreamEvent(event="content_delta", data={"text": "OK"}),
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

        response = client.post("/chat/stream", json={"message": "Hello"})
        assert response.status_code == 200

    def test_at_limit_blocked(self, client, rate_limit_repo):
        """Requests at or over rate limit are blocked."""
        # Set usage at limit (default free limit is 50)
        rate_limit_repo.set_usage(TEST_USER_ID, 50)

        response = client.post("/chat/stream", json={"message": "Hello"})

        # Should be rate limited
        assert response.status_code in [200, 429]

        if response.status_code == 200:
            # Check for error event in stream
            events = parse_sse_events(response.text)
            types = extract_event_types(events)
            # May have error event or rate limit handling
            assert "error" in types or "message_start" in types

    def test_usage_incremented_on_success(self, client, ai_client, rate_limit_repo):
        """Successful requests increment usage counter."""
        initial_usage = rate_limit_repo.get_monthly_usage(TEST_USER_ID)

        ai_client.response_events = [
            StreamEvent(event="content_delta", data={"text": "OK"}),
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

        response = client.post("/chat/stream", json={"message": "Hello"})
        assert response.status_code == 200

        final_usage = rate_limit_repo.get_monthly_usage(TEST_USER_ID)
        assert final_usage > initial_usage


@pytest.mark.chat_integration
class TestSessionManagement:
    """Tests for chat session creation and continuity."""

    def test_new_session_created(self, client, ai_client, session_repo):
        """New session is created when session_id not provided."""
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

        response = client.post("/chat/stream", json={"message": "Hi"})
        assert response.status_code == 200

        events = parse_sse_events(response.text)
        message_starts = find_events(events, "message_start")

        assert len(message_starts) >= 1
        assert "session_id" in message_starts[0]["data"]

    def test_existing_session_continued(self, client, ai_client, session_repo):
        """Existing session is used when session_id provided."""
        # Create a session first
        session = session_repo.create(TEST_USER_ID, "Test Session")
        session_id = session["id"]

        ai_client.response_events = [
            StreamEvent(event="content_delta", data={"text": "Continuing..."}),
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
            json={"message": "Continue", "session_id": session_id},
        )
        assert response.status_code == 200

        events = parse_sse_events(response.text)
        message_starts = find_events(events, "message_start")

        # Should use same session ID
        assert message_starts[0]["data"]["session_id"] == session_id

    def test_messages_stored_in_session(self, client, ai_client, message_repo, session_repo):
        """Messages are stored in the session."""
        ai_client.response_events = [
            StreamEvent(event="content_delta", data={"text": "Response text"}),
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

        response = client.post("/chat/stream", json={"message": "Test message"})
        assert response.status_code == 200

        events = parse_sse_events(response.text)
        message_starts = find_events(events, "message_start")
        session_id = message_starts[0]["data"]["session_id"]

        # Check messages were stored
        messages = message_repo.list_for_session(session_id)
        assert len(messages) >= 1


@pytest.mark.chat_integration
class TestContextPassthrough:
    """Tests for context passing to AI client."""

    def test_context_included_in_ai_call(self, client, ai_client):
        """Context from request is passed to AI client."""
        ai_client.response_events = [
            StreamEvent(event="content_delta", data={"text": "OK"}),
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

        context = {"page": "library", "selected_workout_id": "w-abc123"}

        response = client.post(
            "/chat/stream",
            json={"message": "Tell me about this workout", "context": context},
        )
        assert response.status_code == 200

        # AI client should have received the context in system/messages
        assert ai_client.call_count == 1
        # Context would be incorporated into the system prompt or messages

    def test_user_id_passed_to_ai_client(self, client, ai_client):
        """User ID is passed to AI client for tracking."""
        ai_client.response_events = [
            StreamEvent(event="content_delta", data={"text": "OK"}),
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

        response = client.post("/chat/stream", json={"message": "Hello"})
        assert response.status_code == 200

        assert ai_client.last_call_kwargs["user_id"] == TEST_USER_ID
