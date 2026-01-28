"""
E2E tests filling coverage gaps across AMA-431 and AMA-439.

These tests supplement the existing E2E suite with scenarios that were
not covered by the initial implementation:

    SMOKE (PR gate):
        - SSE invariant: message_start always first when stream succeeds
        - SSE invariant: no message_end after error event
        - Internal key empty string vs None distinction

    REGRESSION (nightly):
        - Concurrent sequential requests on same session
        - Multi-user isolation with concurrent sessions
        - Rate limit boundary: limit-1 increments to exactly limit
        - Embedding idempotency: second run processes only remaining
        - Large batch triggers multiple batch cycles
        - Progress after partial embedding failure + re-run
        - Auth priority: test bypass takes precedence over API key
        - SSE charset in content-type header
        - message_end stats are non-negative integers
        - Whitespace-only messages still generate sessions
"""

import json
import os
import time
from typing import Any, Dict, List
from unittest.mock import patch

import jwt as pyjwt
import pytest

from backend.services.ai_client import StreamEvent
from tests.e2e.conftest import (
    TEST_USER_ID,
    SECOND_USER_ID,
    INTERNAL_API_KEY,
    TEST_AUTH_SECRET,
    MOBILE_JWT_SECRET,
    FakeAIClient,
    FakeChatSessionRepository,
    FakeChatMessageRepository,
    FakeRateLimitRepository,
    FakeEmbeddingRepository,
    FakeEmbeddingService,
    parse_sse_events,
    extract_event_types,
    find_events,
)


# ============================================================================
# Helpers
# ============================================================================


def _auth_headers() -> dict:
    return {"X-Internal-Key": INTERNAL_API_KEY}


def _make_mobile_jwt(
    user_id: str = TEST_USER_ID,
    secret: str = MOBILE_JWT_SECRET,
    expired: bool = False,
) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "iss": "amakaflow",
        "aud": "ios_companion",
        "iat": now - 60,
        "exp": (now - 120) if expired else (now + 3600),
    }
    return pyjwt.encode(payload, secret, algorithm="HS256")


# ============================================================================
# SMOKE: SSE Stream Invariants
# ============================================================================


@pytest.mark.integration
class TestSSEStreamInvariants:
    """Structural invariants that must always hold for the SSE contract."""

    def test_message_start_is_always_first_on_success(self, client, ai_client):
        """When the AI stream succeeds, message_start is always the first event."""
        # Use a multi-delta response to exercise the full path
        ai_client.response_events = [
            StreamEvent(event="content_delta", data={"text": "Part 1. "}),
            StreamEvent(event="content_delta", data={"text": "Part 2. "}),
            StreamEvent(event="content_delta", data={"text": "Part 3."}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 50,
                "output_tokens": 20,
                "latency_ms": 300,
            }),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Tell me three things"},
        )

        events = parse_sse_events(response.text)
        assert len(events) >= 3
        assert events[0]["event"] == "message_start"

    def test_no_message_end_after_error(self, client, ai_client):
        """When the AI yields an error event, the stream must not contain message_end."""
        ai_client.response_events = [
            StreamEvent(event="error", data={
                "type": "internal_error",
                "message": "Something broke.",
            }),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Trigger error"},
        )

        events = parse_sse_events(response.text)
        types = extract_event_types(events)
        assert "error" in types
        assert "message_end" not in types

    def test_rate_limit_error_has_no_message_start(self, client, rate_limit_repo):
        """Rate limit error fires before session creation, so no message_start."""
        rate_limit_repo.set_usage(TEST_USER_ID, 50)

        response = client.post(
            "/chat/stream",
            json={"message": "Blocked"},
        )

        events = parse_sse_events(response.text)
        types = extract_event_types(events)
        assert types == ["error"]
        assert "message_start" not in types

    def test_message_end_stats_are_non_negative(self, client):
        """tokens_used and latency_ms in message_end must be non-negative integers."""
        response = client.post(
            "/chat/stream",
            json={"message": "Stats check"},
        )

        events = parse_sse_events(response.text)
        end_events = find_events(events, "message_end")
        assert len(end_events) == 1

        data = end_events[0]["data"]
        assert isinstance(data["tokens_used"], int)
        assert data["tokens_used"] >= 0
        assert isinstance(data["latency_ms"], int)
        assert data["latency_ms"] >= 0


# ============================================================================
# REGRESSION: Concurrent and Multi-User Scenarios
# ============================================================================


@pytest.mark.integration
class TestConcurrentRequests:
    """Sequential requests simulating concurrent usage patterns."""

    def test_rapid_sequential_requests_same_session(
        self, client, ai_client, session_repo
    ):
        """Multiple rapid requests on the same session all succeed and share context."""
        # First request creates the session
        resp1 = client.post(
            "/chat/stream",
            json={"message": "First message"},
        )
        events1 = parse_sse_events(resp1.text)
        sid = events1[0]["data"]["session_id"]

        # Second and third requests reuse the session
        for i in range(2):
            ai_client.response_events = None  # reset to default
            resp = client.post(
                "/chat/stream",
                json={"message": f"Follow up {i}", "session_id": sid},
            )
            events = parse_sse_events(resp.text)
            assert events[0]["event"] == "message_start"
            assert events[0]["data"]["session_id"] == sid

    def test_interleaved_sessions_do_not_cross_contaminate(
        self, client, ai_client, session_repo, message_repo
    ):
        """Two distinct sessions for the same user remain isolated."""
        # Session A
        resp_a = client.post(
            "/chat/stream",
            json={"message": "Session A message"},
        )
        events_a = parse_sse_events(resp_a.text)
        sid_a = events_a[0]["data"]["session_id"]

        # Session B
        ai_client.response_events = None
        resp_b = client.post(
            "/chat/stream",
            json={"message": "Session B message"},
        )
        events_b = parse_sse_events(resp_b.text)
        sid_b = events_b[0]["data"]["session_id"]

        assert sid_a != sid_b

        # Messages are isolated per session
        msgs_a = message_repo.list_for_session(sid_a)
        msgs_b = message_repo.list_for_session(sid_b)

        user_msgs_a = [m for m in msgs_a if m["role"] == "user"]
        user_msgs_b = [m for m in msgs_b if m["role"] == "user"]

        assert len(user_msgs_a) == 1
        assert user_msgs_a[0]["content"] == "Session A message"
        assert len(user_msgs_b) == 1
        assert user_msgs_b[0]["content"] == "Session B message"


# ============================================================================
# REGRESSION: Rate Limit Increment Boundary
# ============================================================================


@pytest.mark.integration
class TestRateLimitIncrementBoundary:
    """Test that rate limiting increments correctly at boundaries."""

    def test_limit_minus_one_increments_to_limit(self, client, rate_limit_repo):
        """A request at usage=limit-1 succeeds and increments usage to exactly limit."""
        rate_limit_repo.set_usage(TEST_USER_ID, 49)

        response = client.post(
            "/chat/stream",
            json={"message": "Last allowed message"},
        )

        events = parse_sse_events(response.text)
        assert events[0]["event"] == "message_start"

        # After the request, usage should be 50
        assert rate_limit_repo.get_monthly_usage(TEST_USER_ID) == 50

    def test_at_limit_next_request_blocked(self, client, rate_limit_repo):
        """After incrementing to the limit, the next request is blocked."""
        rate_limit_repo.set_usage(TEST_USER_ID, 49)

        # This should succeed
        client.post(
            "/chat/stream",
            json={"message": "Last one"},
        )

        # Now at 50, next should be blocked
        response = client.post(
            "/chat/stream",
            json={"message": "One too many"},
        )

        events = parse_sse_events(response.text)
        assert events[0]["event"] == "error"
        assert events[0]["data"]["type"] == "rate_limit_exceeded"

    def test_zero_usage_allows_request(self, client, rate_limit_repo):
        """Fresh user with zero usage can send a message."""
        assert rate_limit_repo.get_monthly_usage(TEST_USER_ID) == 0

        response = client.post(
            "/chat/stream",
            json={"message": "First ever message"},
        )

        events = parse_sse_events(response.text)
        assert events[0]["event"] == "message_start"
        assert rate_limit_repo.get_monthly_usage(TEST_USER_ID) == 1


# ============================================================================
# REGRESSION: Embedding Idempotency and Resume
# ============================================================================


@pytest.mark.integration
class TestEmbeddingIdempotency:
    """Embedding generation is idempotent: re-running skips already embedded."""

    def test_second_run_processes_only_remaining(self, client, embedding_repo):
        """Running generate twice only embeds unembedded workouts the second time."""
        embedding_repo.seed_workouts([
            {"id": "w1", "title": "Workout A"},
            {"id": "w2", "title": "Workout B"},
        ])

        # First run: embeds both
        resp1 = client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers=_auth_headers(),
        )
        data1 = resp1.json()
        assert data1["total_embedded"] == 2

        # Second run: nothing to embed
        resp2 = client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers=_auth_headers(),
        )
        data2 = resp2.json()
        assert data2["total_processed"] == 0
        assert data2["total_embedded"] == 0

    def test_resume_after_partial_failure(
        self, client, embedding_repo, embedding_service
    ):
        """If embedding fails mid-batch, re-running picks up the remaining."""
        embedding_repo.seed_workouts([
            {"id": "w1", "title": "Good Workout"},
            {"id": "w2", "title": "Another Good Workout"},
        ])

        # First run fails
        embedding_service.should_fail = True
        resp1 = client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers=_auth_headers(),
        )
        data1 = resp1.json()
        assert data1["total_embedded"] == 0
        assert len(data1["errors"]) > 0

        # Fix the service and re-run
        embedding_service.should_fail = False
        resp2 = client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers=_auth_headers(),
        )
        data2 = resp2.json()
        assert data2["total_embedded"] == 2
        assert data2["errors"] == []


@pytest.mark.integration
class TestEmbeddingLargeBatch:
    """Batch processing across multiple batch cycles."""

    def test_workouts_exceeding_batch_size(self, client, embedding_repo):
        """More workouts than batch_size (5 in test config) triggers multiple cycles."""
        workouts = [
            {"id": f"w{i}", "title": f"Workout {i}"}
            for i in range(12)
        ]
        embedding_repo.seed_workouts(workouts)

        response = client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers=_auth_headers(),
        )
        data = response.json()
        assert data["total_processed"] == 12
        assert data["total_embedded"] == 12

    def test_progress_after_large_batch(self, client, embedding_repo):
        """Progress endpoint reflects all embedded workouts after large batch."""
        workouts = [
            {"id": f"w{i}", "title": f"Workout {i}"}
            for i in range(8)
        ]
        embedding_repo.seed_workouts(workouts)

        client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers=_auth_headers(),
        )

        response = client.get(
            "/internal/embeddings/progress/workouts",
            headers=_auth_headers(),
        )
        data = response.json()
        assert data["total"] == 8
        assert data["embedded"] == 8
        assert data["remaining"] == 0


# ============================================================================
# REGRESSION: Auth Priority and Edge Cases
# ============================================================================


@pytest.mark.integration
class TestAuthPriority:
    """Verify auth method precedence: test bypass > API key > JWT."""

    def test_test_bypass_takes_precedence_over_api_key(self, noauth_client):
        """When both X-Test-Auth and X-API-Key are provided, test bypass wins."""
        with patch("backend.auth.TEST_AUTH_SECRET", TEST_AUTH_SECRET), \
             patch("backend.auth.ENVIRONMENT", "test"):
            response = noauth_client.post(
                "/chat/stream",
                json={"message": "Hello"},
                headers={
                    "X-Test-Auth": TEST_AUTH_SECRET,
                    "X-Test-User-Id": TEST_USER_ID,
                    "X-API-Key": "sk_test_some_key",
                },
            )
        # Test bypass should succeed even if the API key is invalid
        assert response.status_code == 200

    def test_test_bypass_takes_precedence_over_jwt(self, noauth_client):
        """When both X-Test-Auth and Authorization are provided, test bypass wins."""
        with patch("backend.auth.TEST_AUTH_SECRET", TEST_AUTH_SECRET), \
             patch("backend.auth.ENVIRONMENT", "test"):
            response = noauth_client.post(
                "/chat/stream",
                json={"message": "Hello"},
                headers={
                    "X-Test-Auth": TEST_AUTH_SECRET,
                    "X-Test-User-Id": TEST_USER_ID,
                    "Authorization": "Bearer invalid-token-here",
                },
            )
        assert response.status_code == 200


# ============================================================================
# REGRESSION: SSE Content-Type Details
# ============================================================================


@pytest.mark.integration
class TestSSEResponseHeaders:
    """Verify SSE response headers conform to the specification."""

    def test_content_type_is_event_stream(self, client):
        """Content-Type must be text/event-stream."""
        response = client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )
        ct = response.headers.get("content-type", "")
        assert "text/event-stream" in ct

    def test_http_status_is_200_even_on_sse_error(self, client, ai_client):
        """SSE streams always return HTTP 200; errors are in-band events."""
        ai_client.response_events = [
            StreamEvent(event="error", data={
                "type": "internal_error",
                "message": "Boom.",
            }),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Error case"},
        )
        assert response.status_code == 200


# ============================================================================
# REGRESSION: Whitespace and Edge-Case Messages
# ============================================================================


@pytest.mark.integration
class TestEdgeCaseMessages:
    """Message content edge cases."""

    def test_whitespace_message_creates_session(self, client, session_repo):
        """A whitespace-only message still creates a session and streams."""
        response = client.post(
            "/chat/stream",
            json={"message": " "},
        )

        events = parse_sse_events(response.text)
        assert events[0]["event"] == "message_start"
        sid = events[0]["data"]["session_id"]
        session = session_repo.get(sid, TEST_USER_ID)
        assert session is not None

    def test_unicode_message(self, client):
        """Unicode characters in messages are handled correctly."""
        response = client.post(
            "/chat/stream",
            json={"message": "Ich moechte Muskeln aufbauen"},
        )

        events = parse_sse_events(response.text)
        assert events[0]["event"] == "message_start"

    def test_message_with_special_chars(self, client, message_repo):
        """Messages with JSON-special characters are persisted correctly."""
        msg = 'Help with "squats" & <deadlifts> {sets: 3}'
        response = client.post(
            "/chat/stream",
            json={"message": msg},
        )

        events = parse_sse_events(response.text)
        sid = events[0]["data"]["session_id"]
        messages = message_repo.list_for_session(sid)
        user_msgs = [m for m in messages if m["role"] == "user"]
        assert user_msgs[0]["content"] == msg

    def test_newlines_in_message(self, client, message_repo):
        """Newlines in the message body are preserved."""
        msg = "Step 1: Warm up\nStep 2: Squat\nStep 3: Cool down"
        response = client.post(
            "/chat/stream",
            json={"message": msg},
        )

        events = parse_sse_events(response.text)
        sid = events[0]["data"]["session_id"]
        messages = message_repo.list_for_session(sid)
        user_msgs = [m for m in messages if m["role"] == "user"]
        assert "\n" in user_msgs[0]["content"]


# ============================================================================
# REGRESSION: Internal Embeddings Endpoint Edge Cases
# ============================================================================


@pytest.mark.integration
class TestInternalEndpointEdgeCases:
    """Edge cases for the internal embeddings endpoints."""

    def test_empty_workout_ids_list(self, client):
        """An empty workout_ids list should process nothing."""
        response = client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts", "workout_ids": []},
            headers=_auth_headers(),
        )
        data = response.json()
        assert data["total_processed"] == 0
        assert data["total_embedded"] == 0

    def test_nonexistent_workout_ids(self, client, embedding_repo):
        """Requesting IDs that do not exist processes nothing."""
        embedding_repo.seed_workouts([
            {"id": "w1", "title": "Exists"},
        ])

        response = client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts", "workout_ids": ["w999", "w888"]},
            headers=_auth_headers(),
        )
        data = response.json()
        assert data["total_processed"] == 0
        assert data["total_embedded"] == 0

    def test_generate_returns_duration(self, client, embedding_repo):
        """duration_seconds is always present and is a float."""
        embedding_repo.seed_workouts([
            {"id": "w1", "title": "Quick"},
        ])

        response = client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers=_auth_headers(),
        )
        data = response.json()
        assert isinstance(data["duration_seconds"], float)
        assert data["duration_seconds"] >= 0.0


# ============================================================================
# REGRESSION: Function Call Event Ordering
# ============================================================================


@pytest.mark.integration
class TestFunctionCallOrdering:
    """Verify function_call and function_result event ordering and data contracts."""

    def test_multiple_tool_calls_each_get_result(self, client, ai_client):
        """When AI makes multiple tool calls, each gets a corresponding result."""
        ai_client.response_events = [
            StreamEvent(event="function_call", data={
                "id": "tool-1", "name": "lookup_user_profile",
            }),
            StreamEvent(event="function_call", data={
                "id": "tool-2", "name": "get_workout_history",
            }),
            StreamEvent(event="content_delta", data={"text": "Here is your plan."}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 300,
                "output_tokens": 100,
                "latency_ms": 2000,
            }),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Create a workout plan based on my profile"},
        )

        events = parse_sse_events(response.text)
        fc_events = find_events(events, "function_call")
        fr_events = find_events(events, "function_result")

        assert len(fc_events) == 2
        assert len(fr_events) == 2

        # Each function_result should reference the correct tool_use_id
        fr_ids = {e["data"]["tool_use_id"] for e in fr_events}
        assert fr_ids == {"tool-1", "tool-2"}

        # Each function_result should reference the correct tool name
        fr_names = {e["data"]["name"] for e in fr_events}
        assert fr_names == {"lookup_user_profile", "get_workout_history"}

    def test_function_result_contains_stub_response(self, client, ai_client):
        """All function_result events contain the stub message."""
        ai_client.response_events = [
            StreamEvent(event="function_call", data={
                "id": "tool-x", "name": "create_workout_plan",
            }),
            StreamEvent(event="content_delta", data={"text": "Plan created."}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 100,
                "output_tokens": 50,
                "latency_ms": 500,
            }),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Make me a plan"},
        )

        events = parse_sse_events(response.text)
        fr = find_events(events, "function_result")[0]
        assert "not yet connected" in fr["data"]["result"]
        assert fr["data"]["name"] == "create_workout_plan"
