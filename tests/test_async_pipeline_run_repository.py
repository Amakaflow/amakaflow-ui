"""Unit tests for AsyncPipelineRunRepository.

Tests Supabase query construction and response handling
using mocked AsyncClient.
"""

from unittest.mock import AsyncMock, MagicMock

import pytest

from infrastructure.db.async_pipeline_run_repository import AsyncPipelineRunRepository


@pytest.fixture
def mock_client():
    """Create a mock Supabase AsyncClient with chainable query builder.

    Note: client.table() is synchronous in the Supabase async client —
    only .execute() is async. So we use MagicMock for the client itself
    and only make .execute() an AsyncMock.
    """
    client = MagicMock()

    # Build a chainable mock for table().insert/update/select().eq().limit().execute()
    table_mock = MagicMock()
    client.table.return_value = table_mock

    return client, table_mock


@pytest.fixture
def repo(mock_client):
    client, _ = mock_client
    return AsyncPipelineRunRepository(client)


def _chain_mock(table_mock, terminal_data):
    """Set up a chainable query builder that returns terminal_data on .execute()."""
    result = MagicMock()
    result.data = terminal_data

    execute_mock = AsyncMock(return_value=result)

    # Every chained method returns a new mock that supports further chaining
    chain = MagicMock()
    chain.execute = execute_mock
    chain.eq.return_value = chain
    chain.limit.return_value = chain

    table_mock.insert.return_value = chain
    table_mock.update.return_value = chain
    table_mock.select.return_value = chain

    return chain


class TestCreate:
    @pytest.mark.asyncio
    async def test_creates_with_required_fields(self, mock_client, repo):
        _, table_mock = mock_client
        chain = _chain_mock(table_mock, [{"id": "run-1", "status": "pending"}])

        result = await repo.create(user_id="user-1", pipeline="generate")

        table_mock.insert.assert_called_once()
        insert_arg = table_mock.insert.call_args[0][0]
        assert insert_arg["user_id"] == "user-1"
        assert insert_arg["pipeline"] == "generate"
        assert insert_arg["status"] == "pending"
        assert "preview_id" not in insert_arg
        assert "input" not in insert_arg
        assert result == {"id": "run-1", "status": "pending"}

    @pytest.mark.asyncio
    async def test_creates_with_optional_fields(self, mock_client, repo):
        _, table_mock = mock_client
        _chain_mock(table_mock, [{"id": "run-2", "status": "pending"}])

        await repo.create(
            user_id="user-1",
            pipeline="save_and_push",
            preview_id="p-123",
            input_data={"description": "test"},
        )

        insert_arg = table_mock.insert.call_args[0][0]
        assert insert_arg["preview_id"] == "p-123"
        assert insert_arg["input"] == {"description": "test"}

    @pytest.mark.asyncio
    async def test_returns_first_row(self, mock_client, repo):
        _, table_mock = mock_client
        _chain_mock(table_mock, [
            {"id": "run-3", "status": "pending", "pipeline": "generate"},
        ])

        result = await repo.create(user_id="user-1", pipeline="generate")
        assert result["id"] == "run-3"


class TestUpdateStatus:
    @pytest.mark.asyncio
    async def test_updates_status_only(self, mock_client, repo):
        _, table_mock = mock_client
        chain = _chain_mock(table_mock, [])

        await repo.update_status("run-1", "running")

        table_mock.update.assert_called_once()
        update_arg = table_mock.update.call_args[0][0]
        assert update_arg["status"] == "running"
        assert "result" not in update_arg
        assert "error" not in update_arg
        chain.eq.assert_called_with("id", "run-1")

    @pytest.mark.asyncio
    async def test_updates_with_result_data(self, mock_client, repo):
        _, table_mock = mock_client
        _chain_mock(table_mock, [])

        await repo.update_status(
            "run-1", "completed", result_data={"preview_id": "p-1"}
        )

        update_arg = table_mock.update.call_args[0][0]
        assert update_arg["status"] == "completed"
        assert update_arg["result"] == {"preview_id": "p-1"}

    @pytest.mark.asyncio
    async def test_updates_with_error(self, mock_client, repo):
        _, table_mock = mock_client
        _chain_mock(table_mock, [])

        await repo.update_status("run-1", "failed", error="Connection refused")

        update_arg = table_mock.update.call_args[0][0]
        assert update_arg["status"] == "failed"
        assert update_arg["error"] == "Connection refused"


class TestGet:
    @pytest.mark.asyncio
    async def test_returns_row_when_found(self, mock_client, repo):
        _, table_mock = mock_client
        chain = _chain_mock(table_mock, [{
            "id": "run-1",
            "user_id": "user-1",
            "pipeline": "generate",
            "status": "completed",
        }])

        result = await repo.get("run-1", "user-1")

        assert result is not None
        assert result["id"] == "run-1"
        assert result["status"] == "completed"

        # Verify both eq() calls (id and user_id)
        eq_calls = chain.eq.call_args_list
        eq_args = [(c[0][0], c[0][1]) for c in eq_calls]
        assert ("id", "run-1") in eq_args
        assert ("user_id", "user-1") in eq_args

    @pytest.mark.asyncio
    async def test_returns_none_when_not_found(self, mock_client, repo):
        _, table_mock = mock_client
        _chain_mock(table_mock, [])

        result = await repo.get("nonexistent", "user-1")
        assert result is None

    @pytest.mark.asyncio
    async def test_scopes_to_user(self, mock_client, repo):
        _, table_mock = mock_client
        chain = _chain_mock(table_mock, [])

        await repo.get("run-1", "user-2")

        eq_calls = chain.eq.call_args_list
        eq_args = [(c[0][0], c[0][1]) for c in eq_calls]
        assert ("user_id", "user-2") in eq_args

    @pytest.mark.asyncio
    async def test_limits_to_one(self, mock_client, repo):
        _, table_mock = mock_client
        chain = _chain_mock(table_mock, [])

        await repo.get("run-1", "user-1")

        chain.limit.assert_called_with(1)


class TestTableName:
    def test_table_constant(self):
        assert AsyncPipelineRunRepository.TABLE == "pipeline_runs"
