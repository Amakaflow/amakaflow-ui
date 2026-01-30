"""Unit tests for async Supabase repositories.

Tests for:
- AsyncSupabaseChatSessionRepository
- AsyncSupabaseChatMessageRepository
- AsyncSupabaseRateLimitRepository
- AsyncSupabaseFunctionRateLimitRepository
- AsyncSupabaseTTSSettingsRepository
"""

from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from infrastructure.db.async_chat_session_repository import AsyncSupabaseChatSessionRepository
from infrastructure.db.async_chat_message_repository import AsyncSupabaseChatMessageRepository
from infrastructure.db.async_rate_limit_repository import AsyncSupabaseRateLimitRepository
from infrastructure.db.async_function_rate_limit_repository import AsyncSupabaseFunctionRateLimitRepository
from infrastructure.db.async_tts_settings_repository import (
    AsyncSupabaseTTSSettingsRepository,
    TTSSettings,
    TTSSettingsUpdate,
)


# =============================================================================
# Async Mock Helpers
# =============================================================================


def create_mock_supabase_client():
    """Create a mock Supabase async client.

    In the Supabase async client:
    - table(name) is SYNC and returns a query builder
    - All chain methods (insert, select, eq, etc.) are SYNC and return self
    - Only execute() is ASYNC
    - rpc(name, params) is SYNC, returning something with async execute()

    This mock sets up that pattern correctly so tests can configure
    return values on the query builder's execute() method.
    """
    client = MagicMock()

    # Create a query builder that chains all methods and has async execute
    query_builder = MagicMock()
    # Make all chain methods return self (for chaining)
    for method in [
        "insert",
        "select",
        "update",
        "delete",
        "upsert",
        "eq",
        "neq",
        "gt",
        "gte",
        "lt",
        "lte",
        "limit",
        "order",
        "range",
        "single",
    ]:
        getattr(query_builder, method).return_value = query_builder
    # execute is the only async method
    query_builder.execute = AsyncMock()

    client.table.return_value = query_builder

    # RPC also follows the same pattern
    rpc_builder = MagicMock()
    rpc_builder.execute = AsyncMock()
    client.rpc.return_value = rpc_builder

    return client


def setup_execute_response(mock_client, data):
    """Configure the query builder's execute() to return data.

    Args:
        mock_client: Mock client from create_mock_supabase_client()
        data: Data to return from execute().data
    """
    mock_client.table.return_value.execute.return_value = MagicMock(data=data)


# =============================================================================
# AsyncSupabaseChatSessionRepository Tests
# =============================================================================


class TestAsyncChatSessionRepository:
    """Tests for AsyncSupabaseChatSessionRepository."""

    @pytest.fixture
    def mock_client(self):
        return create_mock_supabase_client()

    @pytest.fixture
    def repo(self, mock_client):
        return AsyncSupabaseChatSessionRepository(mock_client)

    @pytest.mark.asyncio
    async def test_create_returns_session_data(self, repo, mock_client):
        """create() should return the created session."""
        session_data = {
            "id": "sess-123",
            "user_id": "user-1",
            "title": "Test Chat",
            "created_at": "2026-01-29T10:00:00+00:00",
        }
        mock_client.table.return_value.execute.return_value = MagicMock(data=[session_data])

        result = await repo.create("user-1", title="Test Chat")

        assert result == session_data
        mock_client.table.assert_called_with("chat_sessions")
        mock_client.table.return_value.insert.assert_called_with(
            {"user_id": "user-1", "title": "Test Chat"}
        )

    @pytest.mark.asyncio
    async def test_create_uses_default_title(self, repo, mock_client):
        """create() with no title uses 'New Chat' default."""
        session_data = {"id": "sess-456", "user_id": "user-1", "title": "New Chat"}
        mock_client.table.return_value.execute.return_value = MagicMock(data=[session_data])

        result = await repo.create("user-1")

        mock_client.table.return_value.insert.assert_called_with(
            {"user_id": "user-1", "title": "New Chat"}
        )
        assert result["title"] == "New Chat"

    @pytest.mark.asyncio
    async def test_get_returns_session_when_found(self, repo, mock_client):
        """get() returns session when it exists."""
        session = {"id": "sess-123", "user_id": "user-1", "title": "My Chat"}
        mock_client.table.return_value.execute.return_value = MagicMock(data=[session])

        result = await repo.get("sess-123", "user-1")

        assert result == session

    @pytest.mark.asyncio
    async def test_get_returns_none_when_not_found(self, repo, mock_client):
        """get() returns None when session doesn't exist."""
        mock_client.table.return_value.execute.return_value = MagicMock(data=[])

        result = await repo.get("sess-nonexistent", "user-1")

        assert result is None

    @pytest.mark.asyncio
    async def test_get_returns_none_for_wrong_user(self, repo, mock_client):
        """get() returns None if session belongs to different user."""
        mock_client.table.return_value.execute.return_value = MagicMock(data=[])

        result = await repo.get("sess-123", "wrong-user")

        assert result is None

    @pytest.mark.asyncio
    async def test_update_title_succeeds(self, repo, mock_client):
        """update_title() updates the session title."""
        mock_client.table.return_value.execute.return_value = MagicMock(data=[])

        await repo.update_title("sess-123", "New Title")

        mock_client.table.return_value.update.assert_called_with({"title": "New Title"})

    @pytest.mark.asyncio
    async def test_list_for_user_returns_sessions(self, repo, mock_client):
        """list_for_user() returns paginated sessions."""
        sessions = [
            {"id": "sess-1", "title": "Chat 1"},
            {"id": "sess-2", "title": "Chat 2"},
        ]
        mock_client.table.return_value.execute.return_value = MagicMock(data=sessions)

        result = await repo.list_for_user("user-1", limit=10, offset=0)

        assert result == sessions
        mock_client.table.return_value.order.assert_called_with("updated_at", desc=True)

    @pytest.mark.asyncio
    async def test_list_for_user_respects_pagination(self, repo, mock_client):
        """list_for_user() applies correct offset and limit."""
        mock_client.table.return_value.execute.return_value = MagicMock(data=[])

        await repo.list_for_user("user-1", limit=10, offset=20)

        # range(offset, offset + limit - 1)
        mock_client.table.return_value.range.assert_called_with(20, 29)

    @pytest.mark.asyncio
    async def test_list_for_user_returns_empty_on_none(self, repo, mock_client):
        """list_for_user() returns [] when data is None."""
        mock_client.table.return_value.execute.return_value = MagicMock(data=None)

        result = await repo.list_for_user("user-1")

        assert result == []

    @pytest.mark.asyncio
    async def test_delete_returns_true_when_found(self, repo, mock_client):
        """delete() returns True when session was deleted."""
        mock_client.table.return_value.execute.return_value = MagicMock(data=[{"id": "sess-123"}])

        result = await repo.delete("sess-123", "user-1")

        assert result is True

    @pytest.mark.asyncio
    async def test_delete_returns_false_when_not_found(self, repo, mock_client):
        """delete() returns False when session doesn't exist."""
        mock_client.table.return_value.execute.return_value = MagicMock(data=[])

        result = await repo.delete("sess-nonexistent", "user-1")

        assert result is False

    @pytest.mark.asyncio
    async def test_delete_returns_false_on_none_data(self, repo, mock_client):
        """delete() returns False when data is None."""
        mock_client.table.return_value.execute.return_value = MagicMock(data=None)

        result = await repo.delete("sess-123", "user-1")

        assert result is False

    def test_table_name(self, repo):
        """Should use correct table name."""
        assert repo.TABLE == "chat_sessions"


# =============================================================================
# AsyncSupabaseChatMessageRepository Tests
# =============================================================================


class TestAsyncChatMessageRepository:
    """Tests for AsyncSupabaseChatMessageRepository."""

    @pytest.fixture
    def mock_client(self):
        return create_mock_supabase_client()

    @pytest.fixture
    def repo(self, mock_client):
        return AsyncSupabaseChatMessageRepository(mock_client)

    @pytest.mark.asyncio
    async def test_create_returns_message(self, repo, mock_client):
        """create() returns the created message."""
        message_data = {
            "id": "msg-123",
            "session_id": "sess-1",
            "role": "user",
            "content": "Hello",
        }
        mock_client.table.return_value.execute.return_value = MagicMock(data=[message_data])

        result = await repo.create(message_data)

        assert result == message_data

    @pytest.mark.asyncio
    async def test_list_for_session_returns_messages(self, repo, mock_client):
        """list_for_session() returns messages in chronological order."""
        messages = [
            {"id": "msg-1", "role": "user", "content": "Hi"},
            {"id": "msg-2", "role": "assistant", "content": "Hello!"},
        ]
        mock_client.table.return_value.execute.return_value = MagicMock(data=messages)

        result = await repo.list_for_session("sess-1", limit=100)

        assert result == messages

    @pytest.mark.asyncio
    async def test_list_for_session_respects_limit(self, repo, mock_client):
        """list_for_session() applies limit correctly."""
        mock_client.table.return_value.execute.return_value = MagicMock(data=[])

        await repo.list_for_session("sess-1", limit=50)

        mock_client.table.return_value.limit.assert_called_with(50)

    @pytest.mark.asyncio
    async def test_list_for_session_with_cursor(self, repo, mock_client):
        """list_for_session() with before cursor filters correctly."""
        # First call returns cursor message, second returns actual messages
        mock_client.table.return_value.execute.side_effect = [
            MagicMock(data=[{"created_at": "2026-01-29T10:00:00+00:00"}]),
            MagicMock(data=[]),
        ]

        await repo.list_for_session("sess-1", limit=50, before="msg-cursor")

        # Verify cursor lookup was performed with correct message ID
        mock_client.table.return_value.eq.assert_any_call("id", "msg-cursor")

    @pytest.mark.asyncio
    async def test_list_for_session_invalid_cursor_returns_empty(self, repo, mock_client):
        """list_for_session() with invalid cursor returns empty list."""
        mock_client.table.return_value.execute.return_value = MagicMock(data=[])

        result = await repo.list_for_session("sess-1", before="invalid-cursor")

        assert result == []

    @pytest.mark.asyncio
    async def test_list_for_session_returns_empty_on_none(self, repo, mock_client):
        """list_for_session() returns [] when data is None."""
        mock_client.table.return_value.execute.return_value = MagicMock(data=None)

        result = await repo.list_for_session("sess-1")

        assert result == []

    def test_table_name(self, repo):
        """Should use correct table name."""
        assert repo.TABLE == "chat_messages"


# =============================================================================
# AsyncSupabaseRateLimitRepository Tests
# =============================================================================


class TestAsyncRateLimitRepository:
    """Tests for AsyncSupabaseRateLimitRepository."""

    @pytest.fixture
    def mock_client(self):
        return create_mock_supabase_client()

    @pytest.fixture
    def repo(self, mock_client):
        return AsyncSupabaseRateLimitRepository(mock_client)

    @pytest.mark.asyncio
    async def test_get_monthly_usage_sums_correctly(self, repo, mock_client):
        """get_monthly_usage() sums all request_count values."""
        mock_client.table.return_value.execute.return_value = MagicMock(
            data=[
                {"request_count": 10},
                {"request_count": 15},
                {"request_count": 25},
            ]
        )

        result = await repo.get_monthly_usage("user-1")

        assert result == 50

    @pytest.mark.asyncio
    async def test_get_monthly_usage_returns_zero_for_no_usage(self, repo, mock_client):
        """get_monthly_usage() returns 0 when no rows exist."""
        mock_client.table.return_value.execute.return_value = MagicMock(data=[])

        result = await repo.get_monthly_usage("user-new")

        assert result == 0

    @pytest.mark.asyncio
    async def test_get_monthly_usage_returns_zero_on_none(self, repo, mock_client):
        """get_monthly_usage() returns 0 when data is None."""
        mock_client.table.return_value.execute.return_value = MagicMock(data=None)

        result = await repo.get_monthly_usage("user-none")

        assert result == 0

    @pytest.mark.asyncio
    async def test_get_monthly_usage_queries_from_first_of_month(self, repo, mock_client):
        """get_monthly_usage() filters from first day of current month."""
        mock_client.table.return_value.execute.return_value = MagicMock(data=[])

        # Use a fixed date to avoid flakiness at month boundaries
        fixed_date = date(2026, 1, 15)
        with patch("infrastructure.db.async_rate_limit_repository.date") as mock_date:
            mock_date.today.return_value = fixed_date
            await repo.get_monthly_usage("user-1")

        mock_client.table.return_value.gte.assert_called_with("request_date", "2026-01-01")

    @pytest.mark.asyncio
    async def test_increment_uses_atomic_rpc(self, repo, mock_client):
        """increment() calls atomic RPC with correct params."""
        mock_client.rpc.return_value.execute.return_value = MagicMock(data=[{"new_count": 5}])

        result = await repo.increment("user-1")

        mock_client.rpc.assert_called_with(
            "increment_ai_request_limit",
            {"p_user_id": "user-1", "p_date": date.today().isoformat()},
        )
        assert result == 5

    @pytest.mark.asyncio
    async def test_increment_returns_new_count(self, repo, mock_client):
        """increment() returns the new count from RPC."""
        mock_client.rpc.return_value.execute.return_value = MagicMock(data=[{"new_count": 42}])

        result = await repo.increment("user-1")

        assert result == 42

    @pytest.mark.asyncio
    async def test_increment_returns_fallback_on_empty(self, repo, mock_client):
        """increment() returns 1 on empty response."""
        mock_client.rpc.return_value.execute.return_value = MagicMock(data=[])

        result = await repo.increment("user-empty")

        assert result == 1

    @pytest.mark.asyncio
    async def test_increment_returns_fallback_on_none(self, repo, mock_client):
        """increment() returns 1 on None response."""
        mock_client.rpc.return_value.execute.return_value = MagicMock(data=None)

        result = await repo.increment("user-none")

        assert result == 1

    def test_table_name(self, repo):
        """Should use correct table name."""
        assert repo.TABLE == "ai_request_limits"


# =============================================================================
# AsyncSupabaseFunctionRateLimitRepository Tests
# =============================================================================


class TestAsyncFunctionRateLimitRepository:
    """Tests for AsyncSupabaseFunctionRateLimitRepository."""

    @pytest.fixture
    def mock_client(self):
        return create_mock_supabase_client()

    @pytest.fixture
    def repo(self, mock_client):
        return AsyncSupabaseFunctionRateLimitRepository(mock_client)

    @pytest.mark.asyncio
    async def test_check_and_increment_allows_under_limit(self, repo, mock_client):
        """check_and_increment() allows when under limit."""
        mock_client.rpc.return_value.execute.return_value = MagicMock(
            data=[{"allowed": True, "call_count": 2, "rate_limit": 3}]
        )

        allowed, count, limit = await repo.check_and_increment("user-1", "sync_strava", 3)

        assert allowed is True
        assert count == 2
        assert limit == 3

    @pytest.mark.asyncio
    async def test_check_and_increment_blocks_at_limit(self, repo, mock_client):
        """check_and_increment() blocks when at limit."""
        mock_client.rpc.return_value.execute.return_value = MagicMock(
            data=[{"allowed": False, "call_count": 3, "rate_limit": 3}]
        )

        allowed, count, limit = await repo.check_and_increment("user-1", "sync_strava", 3)

        assert allowed is False
        assert count == 3

    @pytest.mark.asyncio
    async def test_check_and_increment_uses_correct_rpc(self, repo, mock_client):
        """check_and_increment() calls correct RPC with params."""
        mock_client.rpc.return_value.execute.return_value = MagicMock(
            data=[{"allowed": True, "call_count": 1, "rate_limit": 5}]
        )

        await repo.check_and_increment("user-1", "sync_garmin", 5, window_hours=1)

        mock_client.rpc.assert_called_with(
            "check_and_increment_rate_limit",
            {
                "p_user_id": "user-1",
                "p_function_name": "sync_garmin",
                "p_limit": 5,
                "p_window_start": repo._get_window_start(1).isoformat(),
            },
        )

    @pytest.mark.asyncio
    async def test_check_and_increment_returns_fallback_on_empty(self, repo, mock_client):
        """check_and_increment() returns (False, 0, limit) on empty response."""
        mock_client.rpc.return_value.execute.return_value = MagicMock(data=[])

        allowed, count, limit = await repo.check_and_increment("user-1", "func", 5)

        assert allowed is False
        assert count == 0
        assert limit == 5

    @pytest.mark.asyncio
    async def test_get_remaining_calculates_correctly(self, repo, mock_client):
        """get_remaining() returns correct remaining calls."""
        mock_client.table.return_value.execute.return_value = MagicMock(data=[{"call_count": 2}])

        remaining = await repo.get_remaining("user-1", "sync_strava", 5)

        assert remaining == 3

    @pytest.mark.asyncio
    async def test_get_remaining_returns_full_limit_when_no_calls(self, repo, mock_client):
        """get_remaining() returns full limit when no calls made."""
        mock_client.table.return_value.execute.return_value = MagicMock(data=[])

        remaining = await repo.get_remaining("user-1", "sync_strava", 5)

        assert remaining == 5

    def test_window_alignment_hourly(self, repo):
        """_get_window_start() truncates to current hour."""
        window = repo._get_window_start(1)
        assert window.minute == 0
        assert window.second == 0
        assert window.microsecond == 0

    def test_window_alignment_multi_hour(self, repo):
        """_get_window_start() aligns to multi-hour boundaries."""
        window = repo._get_window_start(4)
        assert window.hour % 4 == 0
        assert window.minute == 0

    def test_table_name(self, repo):
        """Should use correct table name."""
        assert repo.TABLE == "function_rate_limits"


# =============================================================================
# AsyncSupabaseTTSSettingsRepository Tests
# =============================================================================


class TestAsyncTTSSettingsRepository:
    """Tests for AsyncSupabaseTTSSettingsRepository."""

    @pytest.fixture
    def mock_client(self):
        return create_mock_supabase_client()

    @pytest.fixture
    def repo(self, mock_client):
        return AsyncSupabaseTTSSettingsRepository(mock_client, daily_char_limit=50_000)

    @pytest.mark.asyncio
    async def test_get_settings_returns_defaults_for_new_user(self, repo, mock_client):
        """get_settings() returns defaults when user has no record."""
        mock_client.table.return_value.execute.return_value = MagicMock(data=[])

        settings = await repo.get_settings("user-new")

        assert settings.tts_enabled is True
        assert settings.tts_voice_id is None
        assert settings.tts_speed == 1.0
        assert settings.daily_char_limit == 50_000

    @pytest.mark.asyncio
    async def test_get_settings_returns_stored_values(self, repo, mock_client):
        """get_settings() returns stored user preferences."""
        mock_client.table.return_value.execute.return_value = MagicMock(
            data=[
                {
                    "tts_enabled": False,
                    "tts_voice_id": "voice-rachel",
                    "tts_speed": 1.5,
                    "tts_pitch": 0.9,
                    "auto_play_responses": False,
                    "tts_daily_chars_used": 1000,
                    "tts_daily_reset_date": "2026-01-29",
                }
            ]
        )

        settings = await repo.get_settings("user-1")

        assert settings.tts_enabled is False
        assert settings.tts_voice_id == "voice-rachel"
        assert settings.tts_speed == 1.5
        assert settings.tts_daily_chars_used == 1000

    @pytest.mark.asyncio
    async def test_update_settings_upserts_correctly(self, repo, mock_client):
        """update_settings() upserts user settings."""
        mock_client.table.return_value.execute.side_effect = [
            MagicMock(data=[]),  # upsert result (not used)
            MagicMock(data=[{"tts_enabled": True, "tts_speed": 1.2}]),  # get_settings after
        ]

        update = TTSSettingsUpdate(tts_enabled=True, tts_speed=1.2)
        await repo.update_settings("user-1", update)

        mock_client.table.return_value.upsert.assert_called_once()
        call_args = mock_client.table.return_value.upsert.call_args
        assert call_args[0][0]["user_id"] == "user-1"
        assert call_args[0][0]["tts_enabled"] is True
        assert call_args[0][0]["tts_speed"] == 1.2

    @pytest.mark.asyncio
    async def test_increment_daily_chars_uses_atomic_rpc(self, repo, mock_client):
        """increment_daily_chars() uses atomic RPC."""
        mock_client.rpc.return_value.execute.return_value = MagicMock(data=1500)

        result = await repo.increment_daily_chars("user-1", 500)

        mock_client.rpc.assert_called_with(
            "increment_tts_daily_chars",
            {"p_user_id": "user-1", "p_chars": 500},
        )
        assert result == 1500

    @pytest.mark.asyncio
    async def test_increment_daily_chars_returns_zero_on_non_int(self, repo, mock_client):
        """increment_daily_chars() returns 0 for non-int response."""
        mock_client.rpc.return_value.execute.return_value = MagicMock(data=None)

        result = await repo.increment_daily_chars("user-1", 100)

        assert result == 0

    @pytest.mark.asyncio
    async def test_reset_daily_chars_if_needed_creates_record(self, repo, mock_client):
        """reset_daily_chars_if_needed() creates record if missing."""
        today = date.today().isoformat()
        # Call sequence:
        # 1. _ensure_record_exists: select (empty) → create record
        # 2. _ensure_record_exists: insert
        # 3. _reset_daily_chars_if_needed: select (returns new record with today's date)
        mock_client.table.return_value.execute.side_effect = [
            MagicMock(data=[]),  # _ensure_record_exists check: no record
            MagicMock(data=[]),  # insert result
            MagicMock(data=[{"tts_daily_reset_date": today}]),  # _reset check: record exists with today
        ]

        await repo.reset_daily_chars_if_needed("user-new")

        mock_client.table.return_value.insert.assert_called_once()

    @pytest.mark.asyncio
    async def test_reset_daily_chars_resets_on_new_day(self, repo, mock_client):
        """reset_daily_chars_if_needed() resets counter on new day."""
        yesterday = (date.today() - timedelta(days=1)).isoformat()

        # Record exists with yesterday's date
        mock_client.table.return_value.execute.side_effect = [
            MagicMock(data=[{"user_id": "user-1"}]),  # _ensure_record_exists
            MagicMock(data=[{"tts_daily_reset_date": yesterday}]),  # _reset check
            MagicMock(data=[]),  # update result
        ]

        await repo.reset_daily_chars_if_needed("user-1")

        # Should have called update to reset
        mock_client.table.return_value.update.assert_called()

    def test_parse_date_handles_none(self, repo):
        """_parse_date() returns None for None input."""
        assert repo._parse_date(None) is None

    def test_parse_date_handles_string(self, repo):
        """_parse_date() parses ISO date string."""
        result = repo._parse_date("2026-01-29")
        assert result == date(2026, 1, 29)

    def test_parse_date_handles_date_object(self, repo):
        """_parse_date() returns date object as-is."""
        d = date(2026, 1, 29)
        assert repo._parse_date(d) == d

    def test_parse_date_handles_invalid_string(self, repo):
        """_parse_date() returns None for invalid string."""
        assert repo._parse_date("not-a-date") is None

    def test_daily_chars_remaining_property(self):
        """TTSSettings.daily_chars_remaining calculates correctly."""
        settings = TTSSettings(
            tts_daily_chars_used=30_000,
            daily_char_limit=50_000,
        )
        assert settings.daily_chars_remaining == 20_000

    def test_daily_chars_remaining_never_negative(self):
        """TTSSettings.daily_chars_remaining is never negative."""
        settings = TTSSettings(
            tts_daily_chars_used=60_000,
            daily_char_limit=50_000,
        )
        assert settings.daily_chars_remaining == 0

    def test_table_name(self, repo):
        """Should use correct table name."""
        assert repo.TABLE == "user_voice_settings"
