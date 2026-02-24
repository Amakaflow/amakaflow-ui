"""
Integration tests for async stream chat observability.

Tests that async_stream_chat.py works correctly with OTel enabled.

The key observable behavior tested is that trace_id is included in SSE events,
enabling client-side correlation with backend traces.
"""

import json
import pytest
from unittest.mock import AsyncMock, Mock, MagicMock
from typing import AsyncGenerator

from backend.services.ai_client import StreamEvent
from application.use_cases.async_stream_chat import AsyncStreamChatUseCase


class FakeAsyncSessionRepo:
    """Fake async session repository for testing."""

    async def get(self, session_id: str, user_id: str):
        return {"id": session_id, "user_id": user_id}

    async def create(self, user_id: str):
        return {"id": "new-session-id", "user_id": user_id}

    async def update_title(self, session_id: str, title: str):
        pass


class FakeAsyncMessageRepo:
    """Fake async message repository for testing."""

    async def create(self, data):
        return {"id": "msg-id", **data}

    async def list_for_session(self, session_id: str):
        return []


class FakeAsyncRateLimitRepo:
    """Fake async rate limit repository for testing."""

    def __init__(self, usage: int = 0):
        self._usage = usage

    async def get_monthly_usage(self, user_id: str):
        return self._usage

    async def increment(self, user_id: str):
        self._usage += 1


class TestAsyncStreamChatObservability:
    """Tests for AsyncStreamChatUseCase observability."""

    @pytest.fixture
    def mock_ai_client(self):
        """Create mock AI client that yields simple events."""
        client = AsyncMock()

        async def fake_stream_chat(**kwargs):
            yield StreamEvent(event="content_delta", data={"text": "Hello"})
            yield StreamEvent(
                event="message_end",
                data={
                    "stop_reason": "end_turn",
                    "input_tokens": 50,
                    "output_tokens": 20,
                    "latency_ms": 100,
                },
            )

        client.stream_chat = fake_stream_chat
        return client

    @pytest.fixture
    def mock_dispatcher(self):
        """Create mock function dispatcher."""
        dispatcher = AsyncMock()
        dispatcher.execute = AsyncMock(return_value='{"results": []}')
        return dispatcher

    @pytest.fixture
    def use_case(self, mock_ai_client, mock_dispatcher):
        """Create AsyncStreamChatUseCase with mocks."""
        return AsyncStreamChatUseCase(
            session_repo=FakeAsyncSessionRepo(),
            message_repo=FakeAsyncMessageRepo(),
            rate_limit_repo=FakeAsyncRateLimitRepo(),
            ai_client=mock_ai_client,
            function_dispatcher=mock_dispatcher,
        )

    @pytest.mark.asyncio
    async def test_execute_yields_message_start(self, use_case):
        """execute() should yield message_start event."""
        events = []
        async for event in use_case.execute(
            user_id="test-user",
            message="Hello",
        ):
            events.append(event)

        message_start_events = [e for e in events if e.event == "message_start"]
        assert len(message_start_events) == 1

    @pytest.mark.asyncio
    async def test_message_start_includes_trace_id(self, use_case):
        """message_start event should include trace_id for client correlation."""
        events = []
        async for event in use_case.execute(
            user_id="test-user",
            message="Hello",
        ):
            events.append(event)

        # Find message_start event
        message_start_events = [e for e in events if e.event == "message_start"]
        assert len(message_start_events) == 1

        data = json.loads(message_start_events[0].data)
        assert "trace_id" in data
        assert len(data["trace_id"]) == 32  # 32-char hex trace ID

    @pytest.mark.asyncio
    async def test_message_start_includes_session_id(self, use_case):
        """message_start should include session_id."""
        events = []
        async for event in use_case.execute(
            user_id="test-user",
            message="Hello",
        ):
            events.append(event)

        message_start = next(e for e in events if e.event == "message_start")
        data = json.loads(message_start.data)
        assert "session_id" in data
        assert data["session_id"] == "new-session-id"

    @pytest.mark.asyncio
    async def test_successful_request_yields_message_end(self, use_case):
        """Successful chat should yield message_end."""
        events = []
        async for event in use_case.execute(
            user_id="test-user",
            message="Hello",
        ):
            events.append(event)

        message_end_events = [e for e in events if e.event == "message_end"]
        assert len(message_end_events) >= 1

    @pytest.mark.asyncio
    async def test_rate_limited_request_yields_error(self):
        """Rate limited chat should yield error event."""
        use_case = AsyncStreamChatUseCase(
            session_repo=FakeAsyncSessionRepo(),
            message_repo=FakeAsyncMessageRepo(),
            rate_limit_repo=FakeAsyncRateLimitRepo(usage=100),
            ai_client=AsyncMock(),
            function_dispatcher=AsyncMock(),
            monthly_limit=50,
        )

        events = []
        async for event in use_case.execute(
            user_id="test-user",
            message="Hello",
        ):
            events.append(event)

        error_events = [e for e in events if e.event == "error"]
        assert len(error_events) >= 1
        error_data = json.loads(error_events[0].data)
        assert error_data["type"] == "rate_limit_exceeded"

    @pytest.mark.asyncio
    async def test_tool_execution_calls_dispatcher(self, mock_dispatcher):
        """Tool execution should call dispatcher."""
        mock_ai_client = AsyncMock()

        async def fake_stream_with_tool(**kwargs):
            yield StreamEvent(
                event="function_call",
                data={"id": "tool-1", "name": "search_workout_library"},
            )
            yield StreamEvent(
                event="message_end",
                data={
                    "stop_reason": "end_turn",
                    "input_tokens": 50,
                    "output_tokens": 20,
                },
            )

        mock_ai_client.stream_chat = fake_stream_with_tool

        use_case = AsyncStreamChatUseCase(
            session_repo=FakeAsyncSessionRepo(),
            message_repo=FakeAsyncMessageRepo(),
            rate_limit_repo=FakeAsyncRateLimitRepo(),
            ai_client=mock_ai_client,
            function_dispatcher=mock_dispatcher,
        )

        events = []
        async for event in use_case.execute(
            user_id="test-user",
            message="Search for HIIT workouts",
        ):
            events.append(event)

        # Verify dispatcher was called
        mock_dispatcher.execute.assert_called()

    @pytest.mark.asyncio
    async def test_multiple_requests_have_different_trace_ids(self, use_case):
        """Each request should have a unique trace ID."""
        # First request
        events1 = []
        async for event in use_case.execute(
            user_id="test-user",
            message="Hello",
        ):
            events1.append(event)

        trace_id_1 = json.loads(
            next(e for e in events1 if e.event == "message_start").data
        )["trace_id"]

        # Second request
        events2 = []
        async for event in use_case.execute(
            user_id="test-user",
            message="Hi again",
        ):
            events2.append(event)

        trace_id_2 = json.loads(
            next(e for e in events2 if e.event == "message_start").data
        )["trace_id"]

        # Trace IDs should be different
        assert trace_id_1 != trace_id_2
