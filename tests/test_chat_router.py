"""Integration tests for chat router: SSE event sequence, auth, rate limit."""

import json
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app
from backend.settings import Settings
from backend.auth import get_current_user as backend_get_current_user
from api.deps import (
    get_current_user as deps_get_current_user,
    get_auth_context,
    get_stream_chat_use_case,
    AuthContext,
)
from application.use_cases.stream_chat import StreamChatUseCase, SSEEvent


TEST_USER_ID = "test-user-456"


async def mock_auth():
    return TEST_USER_ID


async def mock_auth_context():
    return AuthContext(user_id=TEST_USER_ID, auth_token="Bearer test-token")


@pytest.fixture
def chat_app():
    settings = Settings(
        environment="test",
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="test-key",
        _env_file=None,
    )
    return create_app(settings=settings)


@pytest.fixture
def mock_stream_use_case():
    uc = MagicMock(spec=StreamChatUseCase)
    uc.execute.return_value = iter([
        SSEEvent(event="message_start", data=json.dumps({"session_id": "sess-1"})),
        SSEEvent(event="content_delta", data=json.dumps({"text": "Hello!"})),
        SSEEvent(event="message_end", data=json.dumps({
            "session_id": "sess-1",
            "tokens_used": 150,
            "latency_ms": 1000,
        })),
    ])
    return uc


@pytest.fixture
def chat_client(chat_app, mock_stream_use_case):
    chat_app.dependency_overrides[backend_get_current_user] = mock_auth
    chat_app.dependency_overrides[deps_get_current_user] = mock_auth
    chat_app.dependency_overrides[get_auth_context] = mock_auth_context
    chat_app.dependency_overrides[get_stream_chat_use_case] = lambda: mock_stream_use_case
    yield TestClient(chat_app)
    chat_app.dependency_overrides.clear()


def _parse_sse_events(response_text: str) -> list:
    """Parse SSE response text into list of (event, data) tuples."""
    events = []
    current_event = None
    current_data = None

    for line in response_text.strip().split("\n"):
        line = line.strip()
        if line.startswith("event:"):
            current_event = line[len("event:"):].strip()
        elif line.startswith("data:"):
            current_data = line[len("data:"):].strip()
        elif line == "" and current_event and current_data:
            events.append((current_event, json.loads(current_data)))
            current_event = None
            current_data = None

    # Handle last event if no trailing newline
    if current_event and current_data:
        events.append((current_event, json.loads(current_data)))

    return events


class TestChatAuth:
    def test_unauthenticated_returns_401(self, chat_app):
        """No auth override → 401."""
        # Create client WITHOUT auth overrides
        client = TestClient(chat_app)
        response = client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )
        assert response.status_code == 401

    def test_authenticated_succeeds(self, chat_client):
        response = chat_client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )
        assert response.status_code == 200


class TestChatStream:
    def test_sse_event_sequence(self, chat_client):
        response = chat_client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")

        events = _parse_sse_events(response.text)
        event_types = [e[0] for e in events]

        assert event_types[0] == "message_start"
        assert "content_delta" in event_types
        assert event_types[-1] == "message_end"

    def test_message_start_has_session_id(self, chat_client):
        response = chat_client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )
        events = _parse_sse_events(response.text)
        start_data = events[0][1]
        assert "session_id" in start_data

    def test_message_end_has_stats(self, chat_client):
        response = chat_client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )
        events = _parse_sse_events(response.text)
        end_data = events[-1][1]
        assert "tokens_used" in end_data
        assert "latency_ms" in end_data

    def test_with_session_id(self, chat_client, mock_stream_use_case):
        response = chat_client.post(
            "/chat/stream",
            json={"message": "Hello", "session_id": "sess-existing"},
        )
        assert response.status_code == 200
        mock_stream_use_case.execute.assert_called_once_with(
            user_id=TEST_USER_ID,
            message="Hello",
            session_id="sess-existing",
            auth_token="Bearer test-token",
        )

    def test_empty_message_returns_422(self, chat_client):
        response = chat_client.post(
            "/chat/stream",
            json={"message": ""},
        )
        assert response.status_code == 422

    def test_missing_message_returns_422(self, chat_client):
        response = chat_client.post(
            "/chat/stream",
            json={},
        )
        assert response.status_code == 422


class TestChatRateLimit:
    def test_rate_limit_error_event(self, chat_app):
        """Rate limit exceeded yields error SSE event."""
        mock_uc = MagicMock(spec=StreamChatUseCase)
        mock_uc.execute.return_value = iter([
            SSEEvent(
                event="error",
                data=json.dumps({
                    "type": "rate_limit_exceeded",
                    "message": "Monthly limit reached.",
                    "usage": 50,
                    "limit": 50,
                }),
            ),
        ])

        chat_app.dependency_overrides[backend_get_current_user] = mock_auth
        chat_app.dependency_overrides[deps_get_current_user] = mock_auth
        chat_app.dependency_overrides[get_auth_context] = mock_auth_context
        chat_app.dependency_overrides[get_stream_chat_use_case] = lambda: mock_uc

        test_client = TestClient(chat_app)
        response = test_client.post("/chat/stream", json={"message": "Hello"})

        assert response.status_code == 200  # SSE always 200; error is in stream
        events = _parse_sse_events(response.text)
        assert events[0][0] == "error"
        assert events[0][1]["type"] == "rate_limit_exceeded"

        chat_app.dependency_overrides.clear()
