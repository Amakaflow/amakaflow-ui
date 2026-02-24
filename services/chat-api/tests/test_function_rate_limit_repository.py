"""Unit tests for SupabaseFunctionRateLimitRepository."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from infrastructure.db.function_rate_limit_repository import SupabaseFunctionRateLimitRepository


@pytest.fixture
def mock_supabase_client():
    """Create a mock Supabase client."""
    client = MagicMock()
    return client


@pytest.fixture
def repo(mock_supabase_client):
    """Create a SupabaseFunctionRateLimitRepository with mock client."""
    return SupabaseFunctionRateLimitRepository(mock_supabase_client)


class TestCheckAndIncrement:
    """Tests for check_and_increment method using atomic RPC."""

    def test_first_call_allowed_returns_count_1(self, repo, mock_supabase_client):
        """First call in window should return allowed=True with count=1."""
        # Setup: RPC returns allowed with count=1
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value.data = [
            {"allowed": True, "call_count": 1, "rate_limit": 3}
        ]
        mock_supabase_client.rpc.return_value = mock_rpc

        allowed, count, limit = repo.check_and_increment("user-1", "sync_strava", 3)

        assert allowed is True
        assert count == 1
        assert limit == 3
        # Verify RPC was called with correct params
        mock_supabase_client.rpc.assert_called_once()
        call_args = mock_supabase_client.rpc.call_args
        assert call_args[0][0] == "check_and_increment_rate_limit"
        assert call_args[0][1]["p_user_id"] == "user-1"
        assert call_args[0][1]["p_function_name"] == "sync_strava"
        assert call_args[0][1]["p_limit"] == 3

    def test_subsequent_call_increments(self, repo, mock_supabase_client):
        """Subsequent call should return incremented count."""
        # Setup: RPC returns allowed with count=2
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value.data = [
            {"allowed": True, "call_count": 2, "rate_limit": 3}
        ]
        mock_supabase_client.rpc.return_value = mock_rpc

        allowed, count, limit = repo.check_and_increment("user-1", "sync_strava", 3)

        assert allowed is True
        assert count == 2
        assert limit == 3

    def test_at_limit_returns_false(self, repo, mock_supabase_client):
        """When at limit, RPC should return allowed=False."""
        # Setup: RPC returns not allowed
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value.data = [
            {"allowed": False, "call_count": 3, "rate_limit": 3}
        ]
        mock_supabase_client.rpc.return_value = mock_rpc

        allowed, count, limit = repo.check_and_increment("user-1", "sync_strava", 3)

        assert allowed is False
        assert count == 3
        assert limit == 3

    def test_respects_custom_limit(self, repo, mock_supabase_client):
        """Custom limit should be passed to RPC."""
        # Setup: RPC returns allowed with count=6 (limit=10)
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value.data = [
            {"allowed": True, "call_count": 6, "rate_limit": 10}
        ]
        mock_supabase_client.rpc.return_value = mock_rpc

        allowed, count, limit = repo.check_and_increment("user-1", "sync_strava", 10)

        assert allowed is True
        assert count == 6
        assert limit == 10
        # Verify limit passed to RPC
        call_args = mock_supabase_client.rpc.call_args
        assert call_args[0][1]["p_limit"] == 10

    def test_function_name_passed_to_rpc(self, repo, mock_supabase_client):
        """Function name should be passed to RPC for per-function tracking."""
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value.data = [
            {"allowed": True, "call_count": 1, "rate_limit": 3}
        ]
        mock_supabase_client.rpc.return_value = mock_rpc

        repo.check_and_increment("user-1", "sync_garmin", 3)

        call_args = mock_supabase_client.rpc.call_args
        assert call_args[0][1]["p_function_name"] == "sync_garmin"

    def test_fallback_on_empty_rpc_response(self, repo, mock_supabase_client):
        """If RPC returns empty, should return safe fallback."""
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value.data = []
        mock_supabase_client.rpc.return_value = mock_rpc

        allowed, count, limit = repo.check_and_increment("user-1", "sync_strava", 3)

        # Fallback: deny the call
        assert allowed is False
        assert count == 0
        assert limit == 3


class TestGetRemaining:
    """Tests for get_remaining method."""

    def _setup_select_mock(self, mock_client, data):
        """Helper to setup the chained select mock."""
        mock_select = MagicMock()
        mock_select.execute.return_value.data = data
        mock_chain = mock_client.table.return_value.select.return_value
        mock_chain.eq.return_value.eq.return_value.eq.return_value.limit.return_value = mock_select

    def test_no_calls_returns_full_limit(self, repo, mock_supabase_client):
        """When no calls made, should return full limit."""
        self._setup_select_mock(mock_supabase_client, [])

        remaining = repo.get_remaining("user-1", "sync_strava", 3)

        assert remaining == 3

    def test_partial_usage_returns_correct_remaining(self, repo, mock_supabase_client):
        """Should return limit - count."""
        self._setup_select_mock(mock_supabase_client, [{"call_count": 2}])

        remaining = repo.get_remaining("user-1", "sync_strava", 3)

        assert remaining == 1

    def test_at_limit_returns_zero(self, repo, mock_supabase_client):
        """When at limit, should return 0."""
        self._setup_select_mock(mock_supabase_client, [{"call_count": 3}])

        remaining = repo.get_remaining("user-1", "sync_strava", 3)

        assert remaining == 0

    def test_over_limit_returns_zero_not_negative(self, repo, mock_supabase_client):
        """If count somehow exceeds limit, should return 0 not negative."""
        self._setup_select_mock(mock_supabase_client, [{"call_count": 5}])

        remaining = repo.get_remaining("user-1", "sync_strava", 3)

        assert remaining == 0


class TestWindowCalculation:
    """Tests for _get_window_start method."""

    def test_hourly_window_truncates_to_hour(self, repo):
        """Hourly window should truncate minutes/seconds to 0."""
        with patch("infrastructure.db.function_rate_limit_repository.datetime") as mock_datetime:
            # Mock current time as 14:37:45
            mock_now = datetime(2024, 2, 15, 14, 37, 45, tzinfo=timezone.utc)
            mock_datetime.now.return_value = mock_now
            mock_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)

            window_start = repo._get_window_start(window_hours=1)

            assert window_start.hour == 14
            assert window_start.minute == 0
            assert window_start.second == 0
            assert window_start.microsecond == 0

    def test_2_hour_window_aligns_to_even_hours(self, repo):
        """2-hour window should align to 0, 2, 4, etc."""
        with patch("infrastructure.db.function_rate_limit_repository.datetime") as mock_datetime:
            # Mock current time as 15:37:45 (hour 15)
            mock_now = datetime(2024, 2, 15, 15, 37, 45, tzinfo=timezone.utc)
            mock_datetime.now.return_value = mock_now
            mock_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)

            window_start = repo._get_window_start(window_hours=2)

            # 15 // 2 * 2 = 14
            assert window_start.hour == 14

    def test_4_hour_window_aligns_to_quarter_day(self, repo):
        """4-hour window should align to 0, 4, 8, 12, 16, 20."""
        with patch("infrastructure.db.function_rate_limit_repository.datetime") as mock_datetime:
            # Mock current time as 10:37:45 (hour 10)
            mock_now = datetime(2024, 2, 15, 10, 37, 45, tzinfo=timezone.utc)
            mock_datetime.now.return_value = mock_now
            mock_datetime.side_effect = lambda *args, **kw: datetime(*args, **kw)

            window_start = repo._get_window_start(window_hours=4)

            # 10 // 4 * 4 = 8
            assert window_start.hour == 8


class TestTableName:
    """Tests for table configuration."""

    def test_uses_correct_table_name(self, repo):
        """Should use function_rate_limits table."""
        assert repo.TABLE == "function_rate_limits"
