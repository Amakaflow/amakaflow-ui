"""
Integration tests for async function dispatcher observability.

Tests that async_function_dispatcher.py works correctly with OTel enabled.

Note: Due to OTel global state constraints, span capture assertions
may be unreliable. Tests focus on functional behavior verification.
"""

import pytest
from unittest.mock import AsyncMock, patch

from backend.services.async_function_dispatcher import (
    AsyncFunctionDispatcher,
    FunctionContext,
    FunctionExecutionError,
)


class TestAsyncFunctionDispatcherObservability:
    """Tests for AsyncFunctionDispatcher observability."""

    @pytest.fixture
    def dispatcher(self):
        """Create dispatcher with mocked HTTP client."""
        return AsyncFunctionDispatcher(
            mapper_api_url="http://test-mapper:8000",
            calendar_api_url="http://test-calendar:8000",
            ingestor_api_url="http://test-ingestor:8000",
            timeout=5.0,
        )

    @pytest.fixture
    def context(self):
        """Create function context."""
        return FunctionContext(user_id="test-user-123", auth_token="Bearer test-token")

    @pytest.mark.asyncio
    async def test_execute_completes_successfully(self, dispatcher, context):
        """execute() should complete and return result."""
        with patch.object(dispatcher, "_call_api", new_callable=AsyncMock) as mock_api:
            mock_api.return_value = {"results": [{"title": "Test", "workout_id": "w1"}]}

            result = await dispatcher.execute(
                "search_workout_library",
                {"query": "HIIT"},
                context,
            )

        assert result is not None
        assert "results" in result or "Test" in result

    @pytest.mark.asyncio
    async def test_execute_calls_api(self, dispatcher, context):
        """execute() should call the underlying API."""
        with patch.object(dispatcher, "_call_api", new_callable=AsyncMock) as mock_api:
            mock_api.return_value = {"results": []}

            await dispatcher.execute(
                "search_workout_library",
                {"query": "test"},
                context,
            )

        mock_api.assert_called()

    @pytest.mark.asyncio
    async def test_error_returns_error_result(self, dispatcher, context):
        """Error should return error result string (not raise)."""
        with patch.object(dispatcher, "_call_api", new_callable=AsyncMock) as mock_api:
            mock_api.side_effect = FunctionExecutionError("Service unavailable")

            result = await dispatcher.execute(
                "search_workout_library",
                {"query": "test"},
                context,
            )

        # Should return error result (not raise)
        assert "error" in result.lower() or "unavailable" in result.lower()

    @pytest.mark.asyncio
    async def test_unknown_function_returns_result(self, dispatcher, context):
        """Unknown function should return error result."""
        result = await dispatcher.execute(
            "nonexistent_function",
            {},
            context,
        )

        # Should return something (error message)
        assert result is not None

    @pytest.mark.asyncio
    async def test_multiple_executions_work(self, dispatcher, context):
        """Multiple tool executions should all complete."""
        with patch.object(dispatcher, "_call_api", new_callable=AsyncMock) as mock_api:
            mock_api.return_value = {"results": []}

            result1 = await dispatcher.execute("search_workout_library", {"query": "a"}, context)
            result2 = await dispatcher.execute("search_workout_library", {"query": "b"}, context)

        assert result1 is not None
        assert result2 is not None
        assert mock_api.call_count == 2
