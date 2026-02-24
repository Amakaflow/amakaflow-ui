"""Unit tests for SupabaseChatMessageRepository."""

from unittest.mock import MagicMock, call

import pytest

from infrastructure.db.chat_message_repository import SupabaseChatMessageRepository


@pytest.fixture
def mock_supabase_client():
    """Create a mock Supabase client."""
    return MagicMock()


@pytest.fixture
def repo(mock_supabase_client):
    """Create a SupabaseChatMessageRepository with mock client."""
    return SupabaseChatMessageRepository(mock_supabase_client)


class TestListForSession:
    """Tests for list_for_session method."""

    def _setup_select_mock(self, mock_client, data):
        """Helper to setup the chained select mock for list queries."""
        mock_execute = MagicMock()
        mock_execute.execute.return_value.data = data
        mock_limit = MagicMock(return_value=mock_execute)
        mock_order = MagicMock()
        mock_order.limit = mock_limit
        mock_eq = MagicMock()
        mock_eq.order.return_value = mock_order
        mock_client.table.return_value.select.return_value.eq.return_value = mock_eq
        return mock_eq, mock_order, mock_limit

    def test_queries_correct_table(self, repo, mock_supabase_client):
        """Should query the chat_messages table."""
        self._setup_select_mock(mock_supabase_client, [])

        repo.list_for_session("sess-123")

        mock_supabase_client.table.assert_called_with("chat_messages")

    def test_selects_all_columns(self, repo, mock_supabase_client):
        """Should select all columns."""
        self._setup_select_mock(mock_supabase_client, [])

        repo.list_for_session("sess-123")

        mock_supabase_client.table.return_value.select.assert_called_with("*")

    def test_filters_by_session_id(self, repo, mock_supabase_client):
        """Should filter by session_id."""
        self._setup_select_mock(mock_supabase_client, [])

        repo.list_for_session("specific-session-id")

        mock_supabase_client.table.return_value.select.return_value.eq.assert_called_with(
            "session_id", "specific-session-id"
        )

    def test_orders_by_created_at_ascending(self, repo, mock_supabase_client):
        """Should order by created_at ascending (chronological)."""
        mock_eq, mock_order, _ = self._setup_select_mock(mock_supabase_client, [])

        repo.list_for_session("sess-123")

        mock_eq.order.assert_called_once_with("created_at", desc=False)

    def test_applies_limit(self, repo, mock_supabase_client):
        """Should apply the specified limit."""
        _, _, mock_limit = self._setup_select_mock(mock_supabase_client, [])

        repo.list_for_session("sess-123", limit=25)

        mock_limit.assert_called_once_with(25)

    def test_default_limit(self, repo, mock_supabase_client):
        """Should use default limit=100."""
        _, _, mock_limit = self._setup_select_mock(mock_supabase_client, [])

        repo.list_for_session("sess-123")

        mock_limit.assert_called_once_with(100)

    def test_returns_message_data(self, repo, mock_supabase_client):
        """Should return the message data from response."""
        messages = [
            {
                "id": "msg-1",
                "session_id": "sess-123",
                "user_id": "user-123",
                "role": "user",
                "content": "Hello",
                "tool_calls": None,
                "tool_results": None,
                "created_at": "2026-01-29T10:00:00+00:00",
            },
            {
                "id": "msg-2",
                "session_id": "sess-123",
                "user_id": "user-123",
                "role": "assistant",
                "content": "Hi there!",
                "tool_calls": None,
                "tool_results": None,
                "created_at": "2026-01-29T10:00:01+00:00",
            },
        ]
        self._setup_select_mock(mock_supabase_client, messages)

        result = repo.list_for_session("sess-123")

        assert result == messages
        assert len(result) == 2

    def test_returns_empty_list_on_no_results(self, repo, mock_supabase_client):
        """Should return empty list when no messages found."""
        self._setup_select_mock(mock_supabase_client, [])

        result = repo.list_for_session("sess-no-messages")

        assert result == []

    def test_returns_empty_list_on_none_data(self, repo, mock_supabase_client):
        """Should return empty list when data is None."""
        self._setup_select_mock(mock_supabase_client, None)

        result = repo.list_for_session("sess-none")

        assert result == []

    def test_propagates_database_errors(self, repo, mock_supabase_client):
        """Database errors should propagate up."""
        mock_supabase_client.table.side_effect = Exception("DB connection lost")

        with pytest.raises(Exception) as exc_info:
            repo.list_for_session("sess-error")

        assert "DB connection" in str(exc_info.value)


class TestListForSessionWithCursor:
    """Tests for list_for_session method with cursor-based pagination."""

    def _setup_cursor_lookup_mock(self, mock_client, cursor_data):
        """Helper to setup cursor lookup mock (first table call)."""
        mock_cursor_execute = MagicMock()
        mock_cursor_execute.execute.return_value.data = cursor_data
        mock_cursor_limit = MagicMock(return_value=mock_cursor_execute)
        mock_cursor_eq = MagicMock()
        mock_cursor_eq.limit = mock_cursor_limit
        return mock_cursor_eq

    def _setup_query_mock(self, mock_client, messages_data):
        """Helper to setup main query mock."""
        mock_execute = MagicMock()
        mock_execute.execute.return_value.data = messages_data
        mock_limit = MagicMock(return_value=mock_execute)
        mock_order = MagicMock()
        mock_order.limit = mock_limit
        mock_lt = MagicMock()
        mock_lt.order.return_value = mock_order
        mock_eq = MagicMock()
        mock_eq.order.return_value = mock_order
        mock_eq.lt.return_value = mock_lt
        return mock_eq, mock_lt, mock_order, mock_limit

    def test_looks_up_cursor_message_created_at(self, repo, mock_supabase_client):
        """Should look up the cursor message's created_at."""
        # Setup cursor lookup
        cursor_data = [{"created_at": "2026-01-29T10:00:05+00:00"}]
        mock_cursor_eq = self._setup_cursor_lookup_mock(mock_supabase_client, cursor_data)

        # Setup main query
        mock_eq, _, _, _ = self._setup_query_mock(mock_supabase_client, [])

        # Configure table to return different mocks for cursor lookup vs main query
        call_count = [0]
        def table_side_effect(table_name):
            call_count[0] += 1
            mock_table = MagicMock()
            if call_count[0] == 1:
                # First call: main query setup
                mock_table.select.return_value.eq.return_value = mock_eq
            elif call_count[0] == 2:
                # Second call: cursor lookup
                mock_table.select.return_value.eq.return_value = mock_cursor_eq
            return mock_table

        mock_supabase_client.table.side_effect = table_side_effect

        repo.list_for_session("sess-123", before="msg-cursor")

        # Verify cursor lookup was called with correct parameters
        assert call_count[0] >= 2

    def test_applies_lt_filter_when_cursor_found(self, repo, mock_supabase_client):
        """Should apply lt filter on created_at when cursor is found."""
        cursor_timestamp = "2026-01-29T10:00:05+00:00"

        # Create comprehensive mock chain for main query
        mock_execute = MagicMock()
        mock_execute.execute.return_value.data = []

        mock_limit = MagicMock(return_value=mock_execute)
        mock_order = MagicMock()
        mock_order.limit = mock_limit

        mock_lt = MagicMock()
        mock_lt.order.return_value = mock_order

        mock_main_eq = MagicMock()
        mock_main_eq.lt.return_value = mock_lt
        mock_main_eq.order.return_value = mock_order

        # Cursor lookup mock: .eq("id", before).eq("session_id", session_id).limit(1)
        mock_cursor_execute = MagicMock()
        mock_cursor_execute.execute.return_value.data = [{"created_at": cursor_timestamp}]
        mock_cursor_limit = MagicMock(return_value=mock_cursor_execute)
        mock_cursor_eq2 = MagicMock()
        mock_cursor_eq2.limit = mock_cursor_limit
        mock_cursor_eq1 = MagicMock()
        mock_cursor_eq1.eq.return_value = mock_cursor_eq2

        call_count = [0]
        def table_side_effect(table_name):
            call_count[0] += 1
            mock_table = MagicMock()
            if call_count[0] == 1:
                mock_table.select.return_value.eq.return_value = mock_main_eq
            else:
                mock_table.select.return_value.eq.return_value = mock_cursor_eq1
            return mock_table

        mock_supabase_client.table.side_effect = table_side_effect

        repo.list_for_session("sess-123", before="msg-cursor")

        # Verify lt was called with the cursor's created_at
        mock_main_eq.lt.assert_called_once_with("created_at", cursor_timestamp)

    def test_returns_empty_when_cursor_not_found(self, repo, mock_supabase_client):
        """Should return empty list when cursor message doesn't exist in session."""
        # Setup main query mock (won't be used due to early return)
        mock_main_eq = MagicMock()

        # Cursor lookup returns empty (not found in this session)
        mock_cursor_execute = MagicMock()
        mock_cursor_execute.execute.return_value.data = []
        mock_cursor_limit = MagicMock(return_value=mock_cursor_execute)
        mock_cursor_eq2 = MagicMock()
        mock_cursor_eq2.limit = mock_cursor_limit
        mock_cursor_eq1 = MagicMock()
        mock_cursor_eq1.eq.return_value = mock_cursor_eq2

        call_count = [0]
        def table_side_effect(table_name):
            call_count[0] += 1
            mock_table = MagicMock()
            if call_count[0] == 1:
                mock_table.select.return_value.eq.return_value = mock_main_eq
            else:
                mock_table.select.return_value.eq.return_value = mock_cursor_eq1
            return mock_table

        mock_supabase_client.table.side_effect = table_side_effect

        result = repo.list_for_session("sess-123", before="nonexistent-cursor")

        # Should return empty list when cursor not found
        assert result == []

    def test_returns_messages_before_cursor(self, repo, mock_supabase_client):
        """Should return only messages with created_at before cursor."""
        messages_before_cursor = [
            {"id": "msg-1", "content": "First", "created_at": "2026-01-29T10:00:00+00:00"},
            {"id": "msg-2", "content": "Second", "created_at": "2026-01-29T10:00:01+00:00"},
        ]
        cursor_timestamp = "2026-01-29T10:00:05+00:00"

        mock_execute = MagicMock()
        mock_execute.execute.return_value.data = messages_before_cursor

        mock_limit = MagicMock(return_value=mock_execute)
        mock_order = MagicMock()
        mock_order.limit = mock_limit

        mock_lt = MagicMock()
        mock_lt.order.return_value = mock_order

        mock_main_eq = MagicMock()
        mock_main_eq.lt.return_value = mock_lt

        # Cursor lookup: .eq("id", before).eq("session_id", session_id).limit(1)
        mock_cursor_execute = MagicMock()
        mock_cursor_execute.execute.return_value.data = [{"created_at": cursor_timestamp}]
        mock_cursor_limit = MagicMock(return_value=mock_cursor_execute)
        mock_cursor_eq2 = MagicMock()
        mock_cursor_eq2.limit = mock_cursor_limit
        mock_cursor_eq1 = MagicMock()
        mock_cursor_eq1.eq.return_value = mock_cursor_eq2

        call_count = [0]
        def table_side_effect(table_name):
            call_count[0] += 1
            mock_table = MagicMock()
            if call_count[0] == 1:
                mock_table.select.return_value.eq.return_value = mock_main_eq
            else:
                mock_table.select.return_value.eq.return_value = mock_cursor_eq1
            return mock_table

        mock_supabase_client.table.side_effect = table_side_effect

        result = repo.list_for_session("sess-123", limit=50, before="msg-cursor")

        assert result == messages_before_cursor
        assert len(result) == 2


class TestCreate:
    """Tests for create method."""

    def _setup_insert_mock(self, mock_client, data):
        """Helper to setup the chained insert mock."""
        mock_execute = MagicMock()
        mock_execute.execute.return_value.data = [data]
        mock_client.table.return_value.insert.return_value = mock_execute

    def test_creates_message(self, repo, mock_supabase_client):
        """Should create message and return data."""
        message_data = {
            "id": "msg-new",
            "session_id": "sess-123",
            "role": "user",
            "content": "Hello, AI!",
            "tool_calls": None,
            "tool_results": None,
            "created_at": "2026-01-29T10:00:00+00:00",
        }
        self._setup_insert_mock(mock_supabase_client, message_data)

        input_message = {
            "session_id": "sess-123",
            "role": "user",
            "content": "Hello, AI!",
        }
        result = repo.create(input_message)

        mock_supabase_client.table.return_value.insert.assert_called_once_with(input_message)
        assert result == message_data

    def test_queries_correct_table(self, repo, mock_supabase_client):
        """Should insert into chat_messages table."""
        self._setup_insert_mock(mock_supabase_client, {"id": "msg-1"})

        repo.create({"session_id": "sess-1", "role": "user", "content": "Hi"})

        mock_supabase_client.table.assert_called_with("chat_messages")

    def test_creates_message_with_tool_calls(self, repo, mock_supabase_client):
        """Should create message with tool_calls."""
        message_data = {
            "id": "msg-tool",
            "session_id": "sess-123",
            "role": "assistant",
            "content": None,
            "tool_calls": [{"name": "get_weather", "arguments": {"city": "NYC"}}],
            "tool_results": None,
            "created_at": "2026-01-29T10:00:00+00:00",
        }
        self._setup_insert_mock(mock_supabase_client, message_data)

        input_message = {
            "session_id": "sess-123",
            "role": "assistant",
            "content": None,
            "tool_calls": [{"name": "get_weather", "arguments": {"city": "NYC"}}],
        }
        result = repo.create(input_message)

        assert result["tool_calls"] == [{"name": "get_weather", "arguments": {"city": "NYC"}}]


class TestTableName:
    """Tests for table configuration."""

    def test_uses_correct_table_name(self, repo):
        """Should use chat_messages table."""
        assert repo.TABLE == "chat_messages"
