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
    get_chat_message_repository,
    get_chat_session_repository,
    get_stream_chat_use_case,
    AuthContext,
)
from application.use_cases.stream_chat import StreamChatUseCase, SSEEvent
from infrastructure.db.chat_message_repository import SupabaseChatMessageRepository
from infrastructure.db.chat_session_repository import SupabaseChatSessionRepository


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


class TestListSessions:
    """Tests for GET /chat/sessions endpoint."""

    @pytest.fixture
    def mock_session_repo(self):
        repo = MagicMock(spec=SupabaseChatSessionRepository)
        repo.list_for_user.return_value = [
            {
                "id": "sess-1",
                "title": "First chat",
                "created_at": "2026-01-29T10:00:00+00:00",
                "updated_at": "2026-01-29T12:00:00+00:00",
            },
            {
                "id": "sess-2",
                "title": "Second chat",
                "created_at": "2026-01-28T10:00:00+00:00",
                "updated_at": "2026-01-29T11:00:00+00:00",
            },
        ]
        return repo

    @pytest.fixture
    def sessions_client(self, chat_app, mock_session_repo):
        chat_app.dependency_overrides[backend_get_current_user] = mock_auth
        chat_app.dependency_overrides[deps_get_current_user] = mock_auth
        chat_app.dependency_overrides[get_chat_session_repository] = lambda: mock_session_repo
        yield TestClient(chat_app)
        chat_app.dependency_overrides.clear()

    def test_unauthenticated_returns_401(self, chat_app):
        """No auth override → 401."""
        client = TestClient(chat_app)
        response = client.get("/chat/sessions")
        assert response.status_code == 401

    def test_authenticated_returns_sessions(self, sessions_client):
        response = sessions_client.get("/chat/sessions")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["id"] == "sess-1"
        assert data[0]["title"] == "First chat"

    def test_returns_correct_fields(self, sessions_client):
        response = sessions_client.get("/chat/sessions")
        assert response.status_code == 200
        session = response.json()[0]
        assert "id" in session
        assert "title" in session
        assert "created_at" in session
        assert "updated_at" in session

    def test_pagination_limit(self, sessions_client, mock_session_repo):
        sessions_client.get("/chat/sessions?limit=10")
        mock_session_repo.list_for_user.assert_called_once_with(
            TEST_USER_ID, limit=10, offset=0
        )

    def test_pagination_offset(self, sessions_client, mock_session_repo):
        sessions_client.get("/chat/sessions?limit=5&offset=10")
        mock_session_repo.list_for_user.assert_called_once_with(
            TEST_USER_ID, limit=5, offset=10
        )

    def test_limit_validation_min(self, sessions_client):
        response = sessions_client.get("/chat/sessions?limit=0")
        assert response.status_code == 422

    def test_limit_validation_max(self, sessions_client):
        response = sessions_client.get("/chat/sessions?limit=101")
        assert response.status_code == 422

    def test_offset_validation_negative(self, sessions_client):
        response = sessions_client.get("/chat/sessions?offset=-1")
        assert response.status_code == 422

    def test_empty_sessions_returns_empty_list(self, chat_app):
        mock_repo = MagicMock(spec=SupabaseChatSessionRepository)
        mock_repo.list_for_user.return_value = []

        chat_app.dependency_overrides[backend_get_current_user] = mock_auth
        chat_app.dependency_overrides[deps_get_current_user] = mock_auth
        chat_app.dependency_overrides[get_chat_session_repository] = lambda: mock_repo

        client = TestClient(chat_app)
        response = client.get("/chat/sessions")

        assert response.status_code == 200
        assert response.json() == []

        chat_app.dependency_overrides.clear()

    def test_null_title_returns_successfully(self, chat_app):
        """Session with null title should serialize correctly."""
        mock_repo = MagicMock(spec=SupabaseChatSessionRepository)
        mock_repo.list_for_user.return_value = [
            {
                "id": "sess-null-title",
                "title": None,
                "created_at": "2026-01-29T10:00:00+00:00",
                "updated_at": "2026-01-29T12:00:00+00:00",
            },
        ]

        chat_app.dependency_overrides[backend_get_current_user] = mock_auth
        chat_app.dependency_overrides[deps_get_current_user] = mock_auth
        chat_app.dependency_overrides[get_chat_session_repository] = lambda: mock_repo

        client = TestClient(chat_app)
        response = client.get("/chat/sessions")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] is None

        chat_app.dependency_overrides.clear()

    def test_default_pagination_values(self, chat_app):
        """Endpoint uses default limit=20, offset=0 when not specified."""
        mock_repo = MagicMock(spec=SupabaseChatSessionRepository)
        mock_repo.list_for_user.return_value = []

        chat_app.dependency_overrides[backend_get_current_user] = mock_auth
        chat_app.dependency_overrides[deps_get_current_user] = mock_auth
        chat_app.dependency_overrides[get_chat_session_repository] = lambda: mock_repo

        client = TestClient(chat_app)
        client.get("/chat/sessions")

        mock_repo.list_for_user.assert_called_once_with(
            TEST_USER_ID, limit=20, offset=0
        )

        chat_app.dependency_overrides.clear()


class TestGetSessionMessages:
    """Tests for GET /chat/sessions/{session_id}/messages endpoint."""

    @pytest.fixture
    def mock_session_repo(self):
        repo = MagicMock(spec=SupabaseChatSessionRepository)
        repo.get.return_value = {
            "id": "sess-1",
            "user_id": TEST_USER_ID,
            "title": "Test Session",
            "created_at": "2026-01-29T10:00:00+00:00",
            "updated_at": "2026-01-29T12:00:00+00:00",
        }
        return repo

    @pytest.fixture
    def mock_message_repo(self):
        repo = MagicMock(spec=SupabaseChatMessageRepository)
        repo.list_for_session.return_value = [
            {
                "id": "msg-1",
                "session_id": "sess-1",
                "user_id": TEST_USER_ID,
                "role": "user",
                "content": "Hello",
                "tool_calls": None,
                "tool_results": None,
                "created_at": "2026-01-29T10:00:00+00:00",
            },
            {
                "id": "msg-2",
                "session_id": "sess-1",
                "user_id": TEST_USER_ID,
                "role": "assistant",
                "content": "Hi there!",
                "tool_calls": None,
                "tool_results": None,
                "created_at": "2026-01-29T10:00:01+00:00",
            },
        ]
        return repo

    @pytest.fixture
    def messages_client(self, chat_app, mock_session_repo, mock_message_repo):
        chat_app.dependency_overrides[backend_get_current_user] = mock_auth
        chat_app.dependency_overrides[deps_get_current_user] = mock_auth
        chat_app.dependency_overrides[get_chat_session_repository] = lambda: mock_session_repo
        chat_app.dependency_overrides[get_chat_message_repository] = lambda: mock_message_repo
        yield TestClient(chat_app)
        chat_app.dependency_overrides.clear()

    def test_unauthenticated_returns_401(self, chat_app):
        """No auth override → 401."""
        client = TestClient(chat_app)
        response = client.get("/chat/sessions/sess-1/messages")
        assert response.status_code == 401

    def test_session_not_found_returns_404(self, chat_app, mock_message_repo):
        """Non-existent session → 404."""
        mock_session_repo = MagicMock(spec=SupabaseChatSessionRepository)
        mock_session_repo.get.return_value = None

        chat_app.dependency_overrides[backend_get_current_user] = mock_auth
        chat_app.dependency_overrides[deps_get_current_user] = mock_auth
        chat_app.dependency_overrides[get_chat_session_repository] = lambda: mock_session_repo
        chat_app.dependency_overrides[get_chat_message_repository] = lambda: mock_message_repo

        client = TestClient(chat_app)
        response = client.get("/chat/sessions/non-existent/messages")

        assert response.status_code == 404
        assert response.json()["detail"] == "Session not found"

        chat_app.dependency_overrides.clear()

    def test_returns_messages_in_order(self, messages_client):
        response = messages_client.get("/chat/sessions/sess-1/messages")
        assert response.status_code == 200
        data = response.json()
        assert len(data["messages"]) == 2
        assert data["messages"][0]["id"] == "msg-1"
        assert data["messages"][0]["role"] == "user"
        assert data["messages"][1]["id"] == "msg-2"
        assert data["messages"][1]["role"] == "assistant"

    def test_returns_correct_fields(self, messages_client):
        response = messages_client.get("/chat/sessions/sess-1/messages")
        assert response.status_code == 200
        msg = response.json()["messages"][0]
        assert "id" in msg
        assert "role" in msg
        assert "content" in msg
        assert "tool_calls" in msg
        assert "tool_results" in msg
        assert "created_at" in msg

    def test_has_more_true_when_at_limit(self, chat_app, mock_session_repo):
        """has_more=True when message count equals limit."""
        mock_message_repo = MagicMock(spec=SupabaseChatMessageRepository)
        # Return exactly 5 messages when limit is 5
        mock_message_repo.list_for_session.return_value = [
            {
                "id": f"msg-{i}",
                "session_id": "sess-1",
                "user_id": TEST_USER_ID,
                "role": "user",
                "content": f"Message {i}",
                "tool_calls": None,
                "tool_results": None,
                "created_at": f"2026-01-29T10:00:0{i}+00:00",
            }
            for i in range(5)
        ]

        chat_app.dependency_overrides[backend_get_current_user] = mock_auth
        chat_app.dependency_overrides[deps_get_current_user] = mock_auth
        chat_app.dependency_overrides[get_chat_session_repository] = lambda: mock_session_repo
        chat_app.dependency_overrides[get_chat_message_repository] = lambda: mock_message_repo

        client = TestClient(chat_app)
        response = client.get("/chat/sessions/sess-1/messages?limit=5")

        assert response.status_code == 200
        data = response.json()
        assert len(data["messages"]) == 5
        assert data["has_more"] is True

        chat_app.dependency_overrides.clear()

    def test_has_more_false_when_under_limit(self, messages_client):
        """has_more=False when message count is less than limit."""
        response = messages_client.get("/chat/sessions/sess-1/messages?limit=50")
        assert response.status_code == 200
        data = response.json()
        assert len(data["messages"]) == 2
        assert data["has_more"] is False

    def test_pagination_limit(self, messages_client, mock_message_repo):
        messages_client.get("/chat/sessions/sess-1/messages?limit=10")
        mock_message_repo.list_for_session.assert_called_once_with(
            "sess-1", limit=10, before=None
        )

    def test_pagination_cursor(self, messages_client, mock_message_repo):
        messages_client.get("/chat/sessions/sess-1/messages?before=msg-5")
        mock_message_repo.list_for_session.assert_called_once_with(
            "sess-1", limit=50, before="msg-5"
        )

    def test_limit_validation_min(self, messages_client):
        response = messages_client.get("/chat/sessions/sess-1/messages?limit=0")
        assert response.status_code == 422

    def test_limit_validation_max(self, messages_client):
        response = messages_client.get("/chat/sessions/sess-1/messages?limit=201")
        assert response.status_code == 422

    def test_empty_session_returns_empty_list(self, chat_app, mock_session_repo):
        """Session with no messages returns empty list."""
        mock_message_repo = MagicMock(spec=SupabaseChatMessageRepository)
        mock_message_repo.list_for_session.return_value = []

        chat_app.dependency_overrides[backend_get_current_user] = mock_auth
        chat_app.dependency_overrides[deps_get_current_user] = mock_auth
        chat_app.dependency_overrides[get_chat_session_repository] = lambda: mock_session_repo
        chat_app.dependency_overrides[get_chat_message_repository] = lambda: mock_message_repo

        client = TestClient(chat_app)
        response = client.get("/chat/sessions/sess-1/messages")

        assert response.status_code == 200
        data = response.json()
        assert data["messages"] == []
        assert data["has_more"] is False

        chat_app.dependency_overrides.clear()

    def test_verifies_session_ownership(self, chat_app, mock_message_repo):
        """Session belonging to different user returns 404."""
        mock_session_repo = MagicMock(spec=SupabaseChatSessionRepository)
        # get() returns None when session doesn't belong to user
        mock_session_repo.get.return_value = None

        chat_app.dependency_overrides[backend_get_current_user] = mock_auth
        chat_app.dependency_overrides[deps_get_current_user] = mock_auth
        chat_app.dependency_overrides[get_chat_session_repository] = lambda: mock_session_repo
        chat_app.dependency_overrides[get_chat_message_repository] = lambda: mock_message_repo

        client = TestClient(chat_app)
        response = client.get("/chat/sessions/other-user-session/messages")

        assert response.status_code == 404
        # Verify get was called with both session_id and user_id
        mock_session_repo.get.assert_called_once_with("other-user-session", TEST_USER_ID)

        chat_app.dependency_overrides.clear()

    def test_returns_tool_calls(self, chat_app, mock_session_repo):
        """Messages with tool_calls are serialized correctly."""
        mock_message_repo = MagicMock(spec=SupabaseChatMessageRepository)
        mock_message_repo.list_for_session.return_value = [
            {
                "id": "msg-1",
                "session_id": "sess-1",
                "user_id": TEST_USER_ID,
                "role": "assistant",
                "content": None,
                "tool_calls": [{"name": "get_weather", "arguments": {"city": "NYC"}}],
                "tool_results": None,
                "created_at": "2026-01-29T10:00:00+00:00",
            },
            {
                "id": "msg-2",
                "session_id": "sess-1",
                "user_id": TEST_USER_ID,
                "role": "tool",
                "content": None,
                "tool_calls": None,
                "tool_results": [{"name": "get_weather", "result": {"temp": 72}}],
                "created_at": "2026-01-29T10:00:01+00:00",
            },
        ]

        chat_app.dependency_overrides[backend_get_current_user] = mock_auth
        chat_app.dependency_overrides[deps_get_current_user] = mock_auth
        chat_app.dependency_overrides[get_chat_session_repository] = lambda: mock_session_repo
        chat_app.dependency_overrides[get_chat_message_repository] = lambda: mock_message_repo

        client = TestClient(chat_app)
        response = client.get("/chat/sessions/sess-1/messages")

        assert response.status_code == 200
        data = response.json()
        assert data["messages"][0]["tool_calls"] == [{"name": "get_weather", "arguments": {"city": "NYC"}}]
        assert data["messages"][1]["tool_results"] == [{"name": "get_weather", "result": {"temp": 72}}]

        chat_app.dependency_overrides.clear()


class TestDeleteSession:
    """Tests for DELETE /chat/sessions/{session_id} endpoint."""

    @pytest.fixture
    def mock_session_repo(self):
        repo = MagicMock(spec=SupabaseChatSessionRepository)
        repo.delete.return_value = True
        return repo

    @pytest.fixture
    def delete_client(self, chat_app, mock_session_repo):
        chat_app.dependency_overrides[backend_get_current_user] = mock_auth
        chat_app.dependency_overrides[deps_get_current_user] = mock_auth
        chat_app.dependency_overrides[get_chat_session_repository] = lambda: mock_session_repo
        yield TestClient(chat_app)
        chat_app.dependency_overrides.clear()

    def test_unauthenticated_returns_401(self, chat_app):
        """No auth override -> 401."""
        client = TestClient(chat_app)
        response = client.delete("/chat/sessions/sess-1")
        assert response.status_code == 401

    def test_delete_success_returns_204(self, delete_client, mock_session_repo):
        """Successful delete returns 204 No Content."""
        response = delete_client.delete("/chat/sessions/sess-1")
        assert response.status_code == 204
        mock_session_repo.delete.assert_called_once_with("sess-1", TEST_USER_ID)

    def test_session_not_found_returns_404(self, chat_app):
        """Non-existent session returns 404."""
        mock_repo = MagicMock(spec=SupabaseChatSessionRepository)
        mock_repo.delete.return_value = False

        chat_app.dependency_overrides[backend_get_current_user] = mock_auth
        chat_app.dependency_overrides[deps_get_current_user] = mock_auth
        chat_app.dependency_overrides[get_chat_session_repository] = lambda: mock_repo

        client = TestClient(chat_app)
        response = client.delete("/chat/sessions/nonexistent")

        assert response.status_code == 404
        assert response.json()["detail"] == "Session not found"

        chat_app.dependency_overrides.clear()

    def test_other_user_session_returns_404(self, chat_app):
        """Session belonging to different user returns 404."""
        mock_repo = MagicMock(spec=SupabaseChatSessionRepository)
        mock_repo.delete.return_value = False

        chat_app.dependency_overrides[backend_get_current_user] = mock_auth
        chat_app.dependency_overrides[deps_get_current_user] = mock_auth
        chat_app.dependency_overrides[get_chat_session_repository] = lambda: mock_repo

        client = TestClient(chat_app)
        response = client.delete("/chat/sessions/other-user-session")

        assert response.status_code == 404
        mock_repo.delete.assert_called_once_with("other-user-session", TEST_USER_ID)

        chat_app.dependency_overrides.clear()

    def test_delete_returns_no_body(self, delete_client):
        """204 response has no body."""
        response = delete_client.delete("/chat/sessions/sess-1")
        assert response.status_code == 204
        assert response.content == b""
