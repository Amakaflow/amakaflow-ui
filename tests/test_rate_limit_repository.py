"""Unit tests for SupabaseRateLimitRepository."""

from datetime import date
from unittest.mock import MagicMock

import pytest

from infrastructure.db.rate_limit_repository import SupabaseRateLimitRepository


@pytest.fixture
def mock_supabase_client():
    """Create a mock Supabase client."""
    return MagicMock()


@pytest.fixture
def repo(mock_supabase_client):
    """Create a SupabaseRateLimitRepository with mock client."""
    return SupabaseRateLimitRepository(mock_supabase_client)


class TestIncrement:
    """Tests for increment method using atomic RPC."""

    def test_calls_rpc_with_correct_params(self, repo, mock_supabase_client):
        """Verify increment() calls the atomic RPC with user_id and today's date."""
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value.data = [{"new_count": 5, "was_created": False}]
        mock_supabase_client.rpc.return_value = mock_rpc

        result = repo.increment("user-123")

        mock_supabase_client.rpc.assert_called_once_with(
            "increment_ai_request_limit",
            {"p_user_id": "user-123", "p_date": date.today().isoformat()},
        )
        assert result == 5

    def test_first_request_returns_1(self, repo, mock_supabase_client):
        """First request of the day returns count=1."""
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value.data = [{"new_count": 1, "was_created": True}]
        mock_supabase_client.rpc.return_value = mock_rpc

        result = repo.increment("user-456")

        assert result == 1

    def test_subsequent_requests_increment(self, repo, mock_supabase_client):
        """Subsequent requests return incremented count."""
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value.data = [{"new_count": 42, "was_created": False}]
        mock_supabase_client.rpc.return_value = mock_rpc

        result = repo.increment("user-789")

        assert result == 42

    def test_returns_fallback_on_empty_response(self, repo, mock_supabase_client):
        """Fallback to 1 if RPC returns empty data (defensive)."""
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value.data = []
        mock_supabase_client.rpc.return_value = mock_rpc

        result = repo.increment("user-empty")

        assert result == 1

    def test_returns_fallback_on_none_response(self, repo, mock_supabase_client):
        """Fallback to 1 if RPC returns None data."""
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value.data = None
        mock_supabase_client.rpc.return_value = mock_rpc

        result = repo.increment("user-none")

        assert result == 1

    def test_uses_today_date(self, repo, mock_supabase_client):
        """Should use today's date in ISO format."""
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value.data = [{"new_count": 1, "was_created": True}]
        mock_supabase_client.rpc.return_value = mock_rpc

        repo.increment("user-date")

        call_args = mock_supabase_client.rpc.call_args
        p_date = call_args[0][1]["p_date"]
        assert p_date == date.today().isoformat()

    def test_propagates_database_errors(self, repo, mock_supabase_client):
        """Database errors should propagate up."""
        mock_supabase_client.rpc.side_effect = Exception("DB connection lost")

        with pytest.raises(Exception) as exc_info:
            repo.increment("user-error")

        assert "DB connection" in str(exc_info.value)

    def test_return_type_is_int(self, repo, mock_supabase_client):
        """Return type should be int."""
        mock_rpc = MagicMock()
        mock_rpc.execute.return_value.data = [{"new_count": 10, "was_created": False}]
        mock_supabase_client.rpc.return_value = mock_rpc

        result = repo.increment("user-type")

        assert isinstance(result, int)


class TestGetMonthlyUsage:
    """Tests for get_monthly_usage method."""

    def _setup_select_mock(self, mock_client, data):
        """Helper to setup the chained select mock."""
        mock_execute = MagicMock()
        mock_execute.execute.return_value.data = data
        mock_client.table.return_value.select.return_value.eq.return_value.gte.return_value = mock_execute

    def test_sums_all_days_in_month(self, repo, mock_supabase_client):
        """Monthly usage sums request_count from all rows in the month."""
        self._setup_select_mock(mock_supabase_client, [
            {"request_count": 10},
            {"request_count": 15},
            {"request_count": 25},
        ])

        result = repo.get_monthly_usage("user-monthly")

        assert result == 50

    def test_returns_zero_for_no_usage(self, repo, mock_supabase_client):
        """Returns 0 when no rows exist for the user this month."""
        self._setup_select_mock(mock_supabase_client, [])

        result = repo.get_monthly_usage("user-new")

        assert result == 0

    def test_returns_zero_for_none_data(self, repo, mock_supabase_client):
        """Returns 0 when data is None."""
        self._setup_select_mock(mock_supabase_client, None)

        result = repo.get_monthly_usage("user-none")

        assert result == 0

    def test_single_day_returns_that_count(self, repo, mock_supabase_client):
        """Single day's count is returned directly."""
        self._setup_select_mock(mock_supabase_client, [{"request_count": 42}])

        result = repo.get_monthly_usage("user-single")

        assert result == 42

    def test_queries_from_first_of_month(self, repo, mock_supabase_client):
        """Query should filter from first day of current month."""
        mock_execute = MagicMock()
        mock_execute.execute.return_value.data = []
        mock_gte = MagicMock(return_value=mock_execute)
        mock_eq = MagicMock()
        mock_eq.gte = mock_gte
        mock_supabase_client.table.return_value.select.return_value.eq.return_value = mock_eq

        repo.get_monthly_usage("user-query")

        # Verify gte was called with first of month
        first_of_month = date.today().replace(day=1).isoformat()
        mock_gte.assert_called_once_with("request_date", first_of_month)

    def test_filters_by_user_id(self, repo, mock_supabase_client):
        """Query should filter by user_id."""
        mock_execute = MagicMock()
        mock_execute.execute.return_value.data = []
        mock_gte = MagicMock(return_value=mock_execute)
        mock_eq = MagicMock()
        mock_eq.gte = mock_gte
        mock_supabase_client.table.return_value.select.return_value.eq.return_value = mock_eq

        repo.get_monthly_usage("specific-user-id")

        # Verify eq was called with user_id
        mock_supabase_client.table.return_value.select.return_value.eq.assert_called_once_with(
            "user_id", "specific-user-id"
        )


class TestTableName:
    """Tests for table configuration."""

    def test_uses_correct_table_name(self, repo):
        """Should use ai_request_limits table."""
        assert repo.TABLE == "ai_request_limits"
