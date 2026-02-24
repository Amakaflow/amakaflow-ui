"""Unit tests for SupabaseChatSessionRepository."""

from unittest.mock import MagicMock

import pytest

from infrastructure.db.chat_session_repository import SupabaseChatSessionRepository


@pytest.fixture
def mock_supabase_client():
    """Create a mock Supabase client."""
    return MagicMock()


@pytest.fixture
def repo(mock_supabase_client):
    """Create a SupabaseChatSessionRepository with mock client."""
    return SupabaseChatSessionRepository(mock_supabase_client)


class TestListForUser:
    """Tests for list_for_user method."""

    def _setup_select_mock(self, mock_client, data):
        """Helper to setup the chained select mock."""
        mock_execute = MagicMock()
        mock_execute.execute.return_value.data = data
        mock_range = MagicMock(return_value=mock_execute)
        mock_order = MagicMock()
        mock_order.range = mock_range
        mock_eq = MagicMock()
        mock_eq.order.return_value = mock_order
        mock_client.table.return_value.select.return_value.eq.return_value = mock_eq
        return mock_order, mock_range

    def test_queries_correct_table(self, repo, mock_supabase_client):
        """Should query the chat_sessions table."""
        self._setup_select_mock(mock_supabase_client, [])

        repo.list_for_user("user-123")

        mock_supabase_client.table.assert_called_once_with("chat_sessions")

    def test_selects_all_columns(self, repo, mock_supabase_client):
        """Should select all columns."""
        self._setup_select_mock(mock_supabase_client, [])

        repo.list_for_user("user-123")

        mock_supabase_client.table.return_value.select.assert_called_once_with("*")

    def test_filters_by_user_id(self, repo, mock_supabase_client):
        """Should filter by user_id."""
        self._setup_select_mock(mock_supabase_client, [])

        repo.list_for_user("specific-user-id")

        mock_supabase_client.table.return_value.select.return_value.eq.assert_called_once_with(
            "user_id", "specific-user-id"
        )

    def test_orders_by_updated_at_desc(self, repo, mock_supabase_client):
        """Should order by updated_at descending."""
        mock_order, _ = self._setup_select_mock(mock_supabase_client, [])

        repo.list_for_user("user-123")

        mock_supabase_client.table.return_value.select.return_value.eq.return_value.order.assert_called_once_with(
            "updated_at", desc=True
        )

    def test_applies_range_correctly(self, repo, mock_supabase_client):
        """Should apply range with correct offset and limit."""
        _, mock_range = self._setup_select_mock(mock_supabase_client, [])

        repo.list_for_user("user-123", limit=10, offset=20)

        # range(offset, offset + limit - 1)
        mock_range.assert_called_once_with(20, 29)

    def test_default_limit_and_offset(self, repo, mock_supabase_client):
        """Should use default limit=20 and offset=0."""
        _, mock_range = self._setup_select_mock(mock_supabase_client, [])

        repo.list_for_user("user-123")

        # Default: range(0, 19)
        mock_range.assert_called_once_with(0, 19)

    def test_returns_session_data(self, repo, mock_supabase_client):
        """Should return the session data from response."""
        sessions = [
            {
                "id": "sess-1",
                "user_id": "user-123",
                "title": "First Chat",
                "created_at": "2026-01-29T10:00:00+00:00",
                "updated_at": "2026-01-29T12:00:00+00:00",
            },
            {
                "id": "sess-2",
                "user_id": "user-123",
                "title": "Second Chat",
                "created_at": "2026-01-28T10:00:00+00:00",
                "updated_at": "2026-01-29T11:00:00+00:00",
            },
        ]
        self._setup_select_mock(mock_supabase_client, sessions)

        result = repo.list_for_user("user-123")

        assert result == sessions
        assert len(result) == 2

    def test_returns_empty_list_on_no_results(self, repo, mock_supabase_client):
        """Should return empty list when no sessions found."""
        self._setup_select_mock(mock_supabase_client, [])

        result = repo.list_for_user("user-no-sessions")

        assert result == []

    def test_returns_empty_list_on_none_data(self, repo, mock_supabase_client):
        """Should return empty list when data is None."""
        self._setup_select_mock(mock_supabase_client, None)

        result = repo.list_for_user("user-none")

        assert result == []

    def test_propagates_database_errors(self, repo, mock_supabase_client):
        """Database errors should propagate up."""
        mock_supabase_client.table.side_effect = Exception("DB connection lost")

        with pytest.raises(Exception) as exc_info:
            repo.list_for_user("user-error")

        assert "DB connection" in str(exc_info.value)


class TestCreate:
    """Tests for create method."""

    def _setup_insert_mock(self, mock_client, data):
        """Helper to setup the chained insert mock."""
        mock_execute = MagicMock()
        mock_execute.execute.return_value.data = [data]
        mock_client.table.return_value.insert.return_value = mock_execute

    def test_creates_session_with_title(self, repo, mock_supabase_client):
        """Should create session with provided title."""
        session_data = {
            "id": "sess-new",
            "user_id": "user-123",
            "title": "My Workout Chat",
            "created_at": "2026-01-29T10:00:00+00:00",
            "updated_at": "2026-01-29T10:00:00+00:00",
        }
        self._setup_insert_mock(mock_supabase_client, session_data)

        result = repo.create("user-123", title="My Workout Chat")

        mock_supabase_client.table.return_value.insert.assert_called_once_with(
            {"user_id": "user-123", "title": "My Workout Chat"}
        )
        assert result == session_data

    def test_creates_session_with_default_title(self, repo, mock_supabase_client):
        """Should use 'New Chat' as default title."""
        session_data = {
            "id": "sess-default",
            "user_id": "user-123",
            "title": "New Chat",
            "created_at": "2026-01-29T10:00:00+00:00",
            "updated_at": "2026-01-29T10:00:00+00:00",
        }
        self._setup_insert_mock(mock_supabase_client, session_data)

        result = repo.create("user-123")

        mock_supabase_client.table.return_value.insert.assert_called_once_with(
            {"user_id": "user-123", "title": "New Chat"}
        )
        assert result["title"] == "New Chat"


class TestGet:
    """Tests for get method."""

    def _setup_select_mock(self, mock_client, data):
        """Helper to setup the chained select mock."""
        mock_execute = MagicMock()
        mock_execute.execute.return_value.data = data
        mock_limit = MagicMock(return_value=mock_execute)
        mock_eq2 = MagicMock()
        mock_eq2.limit = mock_limit
        mock_eq1 = MagicMock()
        mock_eq1.eq.return_value = mock_eq2
        mock_client.table.return_value.select.return_value.eq.return_value = mock_eq1

    def test_returns_session_when_found(self, repo, mock_supabase_client):
        """Should return session when found."""
        session = {
            "id": "sess-123",
            "user_id": "user-123",
            "title": "My Chat",
            "created_at": "2026-01-29T10:00:00+00:00",
            "updated_at": "2026-01-29T10:00:00+00:00",
        }
        self._setup_select_mock(mock_supabase_client, [session])

        result = repo.get("sess-123", "user-123")

        assert result == session

    def test_returns_none_when_not_found(self, repo, mock_supabase_client):
        """Should return None when session not found."""
        self._setup_select_mock(mock_supabase_client, [])

        result = repo.get("sess-nonexistent", "user-123")

        assert result is None


class TestUpdateTitle:
    """Tests for update_title method."""

    def test_updates_title(self, repo, mock_supabase_client):
        """Should update session title."""
        mock_execute = MagicMock()
        mock_eq = MagicMock(return_value=mock_execute)
        mock_supabase_client.table.return_value.update.return_value.eq = mock_eq

        repo.update_title("sess-123", "New Title")

        mock_supabase_client.table.return_value.update.assert_called_once_with(
            {"title": "New Title"}
        )
        mock_eq.assert_called_once_with("id", "sess-123")


class TestDelete:
    """Tests for delete method."""

    def _setup_delete_mock(self, mock_client, data):
        """Helper to setup the chained delete mock."""
        mock_execute = MagicMock()
        mock_execute.execute.return_value.data = data
        mock_eq2 = MagicMock(return_value=mock_execute)
        mock_eq1 = MagicMock()
        mock_eq1.eq = mock_eq2
        mock_client.table.return_value.delete.return_value.eq.return_value = mock_eq1

    def test_deletes_session_returns_true(self, repo, mock_supabase_client):
        """Should delete session and return True when found."""
        self._setup_delete_mock(mock_supabase_client, [{"id": "sess-123"}])

        result = repo.delete("sess-123", "user-123")

        assert result is True
        mock_supabase_client.table.assert_called_with("chat_sessions")

    def test_returns_false_when_not_found(self, repo, mock_supabase_client):
        """Should return False when session not found."""
        self._setup_delete_mock(mock_supabase_client, [])

        result = repo.delete("sess-nonexistent", "user-123")

        assert result is False

    def test_filters_by_session_id_and_user_id(self, repo, mock_supabase_client):
        """Should filter by both session_id and user_id."""
        self._setup_delete_mock(mock_supabase_client, [{"id": "sess-123"}])

        repo.delete("sess-123", "user-456")

        # Verify chained eq calls
        mock_supabase_client.table.return_value.delete.return_value.eq.assert_called_with(
            "id", "sess-123"
        )

    def test_returns_false_on_none_data(self, repo, mock_supabase_client):
        """Should return False when data is None."""
        self._setup_delete_mock(mock_supabase_client, None)

        result = repo.delete("sess-123", "user-123")

        assert result is False


class TestTableName:
    """Tests for table configuration."""

    def test_uses_correct_table_name(self, repo):
        """Should use chat_sessions table."""
        assert repo.TABLE == "chat_sessions"
