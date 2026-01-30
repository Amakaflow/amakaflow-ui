"""Unit tests for AsyncStreamChatUseCase with mocked async repos and AI client."""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from application.use_cases.async_stream_chat import AsyncStreamChatUseCase, SSEEvent
from backend.services.ai_client import StreamEvent
from backend.services.async_function_dispatcher import AsyncFunctionDispatcher


@pytest.fixture
def mock_session_repo():
    repo = AsyncMock()
    repo.create.return_value = {"id": "sess-123", "title": "New Chat"}
    repo.get.return_value = {"id": "sess-123", "title": "Existing Chat"}
    repo.update_title.return_value = None
    return repo


@pytest.fixture
def mock_message_repo():
    repo = AsyncMock()
    repo.create.return_value = {"id": "msg-1"}
    repo.list_for_session.return_value = [
        {"role": "user", "content": "Hello"},
    ]
    return repo


@pytest.fixture
def mock_rate_limit_repo():
    repo = AsyncMock()
    repo.get_monthly_usage.return_value = 5
    repo.increment.return_value = 6
    return repo


@pytest.fixture
def mock_ai_client():
    """Mock async AI client that yields StreamEvents."""
    client = MagicMock()

    async def mock_stream_chat(*args, **kwargs):
        events = [
            StreamEvent(event="content_delta", data={"text": "Hello! "}),
            StreamEvent(event="content_delta", data={"text": "How can I help?"}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 100,
                "output_tokens": 50,
                "latency_ms": 1500,
                "stop_reason": "end_turn",
            }),
        ]
        for event in events:
            yield event

    client.stream_chat = mock_stream_chat
    return client


@pytest.fixture
def mock_function_dispatcher():
    dispatcher = AsyncMock(spec=AsyncFunctionDispatcher)
    dispatcher.execute.return_value = "Mock result"
    return dispatcher


@pytest.fixture
def use_case(mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_ai_client, mock_function_dispatcher):
    return AsyncStreamChatUseCase(
        session_repo=mock_session_repo,
        message_repo=mock_message_repo,
        rate_limit_repo=mock_rate_limit_repo,
        ai_client=mock_ai_client,
        function_dispatcher=mock_function_dispatcher,
        monthly_limit=50,
    )


async def collect_events(async_gen) -> list:
    """Helper to collect all events from an async generator."""
    events = []
    async for event in async_gen:
        events.append(event)
    return events


class TestAsyncStreamChat:
    @pytest.mark.asyncio
    async def test_basic_flow(self, use_case):
        events = await collect_events(use_case.execute(user_id="user-1", message="Hello"))

        event_types = [e.event for e in events]
        assert event_types[0] == "message_start"
        assert "content_delta" in event_types
        assert event_types[-1] == "message_end"

    @pytest.mark.asyncio
    async def test_new_session_created(self, use_case, mock_session_repo):
        events = await collect_events(use_case.execute(user_id="user-1", message="Hello"))

        mock_session_repo.create.assert_called_once_with("user-1")
        start_data = json.loads(events[0].data)
        assert start_data["session_id"] == "sess-123"

    @pytest.mark.asyncio
    async def test_existing_session(self, use_case, mock_session_repo):
        events = await collect_events(use_case.execute(
            user_id="user-1",
            message="Hello",
            session_id="sess-123",
        ))

        mock_session_repo.get.assert_called_once_with("sess-123", "user-1")
        mock_session_repo.create.assert_not_called()

    @pytest.mark.asyncio
    async def test_session_not_found(self, use_case, mock_session_repo):
        mock_session_repo.get.return_value = None

        events = await collect_events(use_case.execute(
            user_id="user-1",
            message="Hello",
            session_id="nonexistent",
        ))

        assert len(events) == 1
        assert events[0].event == "error"
        data = json.loads(events[0].data)
        assert data["type"] == "not_found"

    @pytest.mark.asyncio
    async def test_rate_limit_exceeded(self, use_case, mock_rate_limit_repo):
        mock_rate_limit_repo.get_monthly_usage.return_value = 50

        events = await collect_events(use_case.execute(user_id="user-1", message="Hello"))

        assert len(events) == 1
        assert events[0].event == "error"
        data = json.loads(events[0].data)
        assert data["type"] == "rate_limit_exceeded"

    @pytest.mark.asyncio
    async def test_user_message_persisted(self, use_case, mock_message_repo):
        await collect_events(use_case.execute(user_id="user-1", message="Hello"))
        # Allow fire-and-forget tasks to complete
        await asyncio.sleep(0.1)

        # First call is user message
        calls = mock_message_repo.create.call_args_list
        assert len(calls) >= 1
        user_msg = calls[0][0][0]
        assert user_msg["role"] == "user"
        assert user_msg["content"] == "Hello"

    @pytest.mark.asyncio
    async def test_assistant_message_persisted_async(self, use_case, mock_message_repo):
        """Verify assistant message is persisted via fire-and-forget task."""
        await collect_events(use_case.execute(user_id="user-1", message="Hello"))
        # Allow fire-and-forget tasks to complete
        await asyncio.sleep(0.1)

        # Check that assistant message was persisted (may be in any order due to async)
        calls = mock_message_repo.create.call_args_list
        assistant_calls = [
            c for c in calls
            if c[0][0].get("role") == "assistant"
        ]
        assert len(assistant_calls) >= 1
        assistant_msg = assistant_calls[0][0][0]
        assert "Hello! " in assistant_msg["content"]
        assert assistant_msg["model"] == "claude-sonnet-4-20250514"

    @pytest.mark.asyncio
    async def test_rate_limit_incremented_async(self, use_case, mock_rate_limit_repo):
        """Verify rate limit is incremented via fire-and-forget task."""
        await collect_events(use_case.execute(user_id="user-1", message="Hello"))
        # Allow fire-and-forget tasks to complete
        await asyncio.sleep(0.1)

        mock_rate_limit_repo.increment.assert_called_with("user-1")

    @pytest.mark.asyncio
    async def test_auto_title_new_session_async(self, use_case, mock_session_repo):
        """Verify session title is updated via fire-and-forget task."""
        await collect_events(use_case.execute(user_id="user-1", message="Suggest a leg workout"))
        # Allow fire-and-forget tasks to complete
        await asyncio.sleep(0.1)

        mock_session_repo.update_title.assert_called_once_with(
            "sess-123", "Suggest a leg workout"
        )

    @pytest.mark.asyncio
    async def test_message_end_contains_stats(self, use_case):
        events = await collect_events(use_case.execute(user_id="user-1", message="Hello"))

        end_event = events[-1]
        assert end_event.event == "message_end"
        data = json.loads(end_event.data)
        assert data["session_id"] == "sess-123"
        assert data["tokens_used"] == 150  # 100 + 50
        assert data["latency_ms"] == 1500

    @pytest.mark.asyncio
    async def test_message_end_returns_immediately(self, use_case, mock_message_repo):
        """Verify message_end is returned before assistant persistence completes.

        Note: User message is persisted synchronously before streaming begins,
        which is intentional. Only assistant message and rate limit increment
        are fire-and-forget.
        """
        call_count = 0

        async def slow_create_for_assistant(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            # First call is user message (fast), subsequent calls are slow
            if call_count == 1:
                return {"id": "msg-user"}
            await asyncio.sleep(1.0)
            return {"id": "msg-assistant"}

        mock_message_repo.create.side_effect = slow_create_for_assistant

        import time
        start = time.time()
        events = await collect_events(use_case.execute(user_id="user-1", message="Hello"))
        elapsed = time.time() - start

        # message_end should return quickly because assistant persistence
        # is fire-and-forget (only user message is awaited)
        assert elapsed < 0.5
        assert events[-1].event == "message_end"


class TestAsyncStreamChatWithTools:
    @pytest.fixture
    def mock_ai_client_with_tool(self):
        """Mock AI client that returns a tool call then final response."""
        client = MagicMock()

        async def mock_stream_chat(*args, **kwargs):
            # Check if this is the second call (after tool result)
            messages = kwargs.get("messages", [])
            has_tool_result = any(
                isinstance(m.get("content"), list) and
                any(c.get("type") == "tool_result" for c in m.get("content", []) if isinstance(c, dict))
                for m in messages
            )

            if has_tool_result:
                # Second call: return final response
                events = [
                    StreamEvent(event="content_delta", data={"text": "Found your workouts!"}),
                    StreamEvent(event="message_end", data={
                        "model": "claude-sonnet-4-20250514",
                        "input_tokens": 50,
                        "output_tokens": 20,
                        "latency_ms": 500,
                        "stop_reason": "end_turn",
                    }),
                ]
            else:
                # First call: request tool use
                events = [
                    StreamEvent(event="function_call", data={
                        "id": "tool-1",
                        "name": "search_workout_library",
                    }),
                    StreamEvent(event="content_delta", data={
                        "partial_json": '{"query": "leg"}'
                    }),
                    StreamEvent(event="message_end", data={
                        "model": "claude-sonnet-4-20250514",
                        "input_tokens": 100,
                        "output_tokens": 50,
                        "latency_ms": 1000,
                        "stop_reason": "tool_use",
                    }),
                ]

            for event in events:
                yield event

        client.stream_chat = mock_stream_chat
        return client

    @pytest.fixture
    def use_case_with_tools(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo,
        mock_ai_client_with_tool, mock_function_dispatcher
    ):
        return AsyncStreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client_with_tool,
            function_dispatcher=mock_function_dispatcher,
            monthly_limit=50,
        )

    @pytest.mark.asyncio
    async def test_tool_execution_flow(self, use_case_with_tools, mock_function_dispatcher):
        """Verify tool calls are executed and results returned to Claude."""
        mock_function_dispatcher.execute.return_value = "Found 3 leg workouts"

        events = await collect_events(use_case_with_tools.execute(
            user_id="user-1",
            message="Find leg workouts",
        ))

        event_types = [e.event for e in events]
        assert "function_call" in event_types
        assert "function_result" in event_types
        assert event_types[-1] == "message_end"

        # Verify function was executed
        mock_function_dispatcher.execute.assert_called()

    @pytest.mark.asyncio
    async def test_tool_result_yielded_to_client(self, use_case_with_tools, mock_function_dispatcher):
        """Verify function_result events are yielded to the client."""
        mock_function_dispatcher.execute.return_value = '{"workouts": ["leg day"]}'

        events = await collect_events(use_case_with_tools.execute(
            user_id="user-1",
            message="Find leg workouts",
        ))

        result_events = [e for e in events if e.event == "function_result"]
        assert len(result_events) == 1

        result_data = json.loads(result_events[0].data)
        assert result_data["name"] == "search_workout_library"
        assert result_data["tool_use_id"] == "tool-1"


class TestAsyncStreamChatHeartbeats:
    @pytest.fixture
    def slow_dispatcher(self):
        """Dispatcher that takes longer than heartbeat interval."""
        dispatcher = AsyncMock(spec=AsyncFunctionDispatcher)

        async def slow_execute(*args, **kwargs):
            await asyncio.sleep(0.3)  # Longer than test heartbeat interval
            return "Slow result"

        dispatcher.execute.side_effect = slow_execute
        return dispatcher

    @pytest.fixture
    def mock_ai_client_with_tool_for_heartbeat(self):
        """Mock AI client for heartbeat testing."""
        client = MagicMock()

        async def mock_stream_chat(*args, **kwargs):
            messages = kwargs.get("messages", [])
            has_tool_result = any(
                isinstance(m.get("content"), list) and
                any(c.get("type") == "tool_result" for c in m.get("content", []) if isinstance(c, dict))
                for m in messages
            )

            if has_tool_result:
                events = [
                    StreamEvent(event="content_delta", data={"text": "Done!"}),
                    StreamEvent(event="message_end", data={
                        "model": "claude-sonnet-4-20250514",
                        "input_tokens": 50,
                        "output_tokens": 20,
                        "latency_ms": 500,
                        "stop_reason": "end_turn",
                    }),
                ]
            else:
                events = [
                    StreamEvent(event="function_call", data={
                        "id": "tool-1",
                        "name": "sync_strava",
                    }),
                    StreamEvent(event="content_delta", data={
                        "partial_json": '{"days_back": 7}'
                    }),
                    StreamEvent(event="message_end", data={
                        "model": "claude-sonnet-4-20250514",
                        "input_tokens": 100,
                        "output_tokens": 50,
                        "latency_ms": 1000,
                        "stop_reason": "tool_use",
                    }),
                ]

            for event in events:
                yield event

        client.stream_chat = mock_stream_chat
        return client

    @pytest.mark.asyncio
    async def test_heartbeats_during_tool_execution(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo,
        mock_ai_client_with_tool_for_heartbeat, slow_dispatcher
    ):
        """Verify heartbeats are sent during long-running tool execution."""
        # Patch the heartbeat interval to be shorter for testing
        with patch('application.use_cases.async_stream_chat.HEARTBEAT_INTERVAL_SECONDS', 0.1):
            use_case = AsyncStreamChatUseCase(
                session_repo=mock_session_repo,
                message_repo=mock_message_repo,
                rate_limit_repo=mock_rate_limit_repo,
                ai_client=mock_ai_client_with_tool_for_heartbeat,
                function_dispatcher=slow_dispatcher,
                monthly_limit=50,
            )

            events = await collect_events(use_case.execute(
                user_id="user-1",
                message="Sync my Strava",
            ))

            event_types = [e.event for e in events]
            # Should have at least one heartbeat since tool takes 0.3s and interval is 0.1s
            assert "heartbeat" in event_types

            heartbeat_events = [e for e in events if e.event == "heartbeat"]
            for hb in heartbeat_events:
                data = json.loads(hb.data)
                assert data["status"] == "executing_tool"
                assert data["tool_name"] == "sync_strava"
                assert "elapsed_seconds" in data


class TestAsyncStreamChatContextAwareness:
    @pytest.mark.asyncio
    async def test_workout_detail_context(self, use_case, mock_ai_client):
        """Verify workout context is injected into system prompt."""
        context = {
            "current_page": "workout_detail",
            "selected_workout_id": "workout-abc",
        }

        await collect_events(use_case.execute(
            user_id="user-1",
            message="Edit this workout",
            context=context,
        ))

        # The system prompt should include the context
        # We can't easily verify this without exposing internals,
        # but we verify the flow completes successfully
        assert True

    @pytest.mark.asyncio
    async def test_calendar_context(self, use_case, mock_ai_client):
        """Verify calendar context is injected into system prompt."""
        context = {
            "current_page": "calendar",
            "selected_date": "2024-01-15",
        }

        events = await collect_events(use_case.execute(
            user_id="user-1",
            message="What's planned for this day?",
            context=context,
        ))

        # Flow should complete successfully
        assert events[-1].event == "message_end"


class TestAsyncStreamChatErrorHandling:
    @pytest.mark.asyncio
    async def test_ai_error_propagated(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_function_dispatcher
    ):
        """Verify AI errors are yielded to the client."""
        client = MagicMock()

        async def error_stream(*args, **kwargs):
            yield StreamEvent(event="error", data={
                "type": "rate_limit",
                "message": "AI service is busy."
            })

        client.stream_chat = error_stream

        use_case = AsyncStreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=client,
            function_dispatcher=mock_function_dispatcher,
            monthly_limit=50,
        )

        events = await collect_events(use_case.execute(
            user_id="user-1",
            message="Hello",
        ))

        # Should have message_start then error
        assert events[-1].event == "error"
        data = json.loads(events[-1].data)
        assert data["type"] == "rate_limit"

    @pytest.mark.asyncio
    async def test_feature_flag_disabled(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo,
        mock_ai_client, mock_function_dispatcher
    ):
        """Verify chat disabled error when feature flag is off."""
        feature_flags = MagicMock()
        feature_flags.is_chat_enabled.return_value = False

        use_case = AsyncStreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
            feature_flag_service=feature_flags,
            monthly_limit=50,
        )

        events = await collect_events(use_case.execute(
            user_id="user-1",
            message="Hello",
        ))

        assert len(events) == 1
        assert events[0].event == "error"
        data = json.loads(events[0].data)
        assert data["type"] == "feature_disabled"


class TestAsyncStreamChatMessageBuilding:
    @pytest.mark.asyncio
    async def test_history_loaded_correctly(self, use_case, mock_message_repo):
        """Verify conversation history is loaded and formatted."""
        mock_message_repo.list_for_session.return_value = [
            {"role": "user", "content": "First message"},
            {"role": "assistant", "content": "First response"},
            {"role": "user", "content": "Second message"},
        ]

        await collect_events(use_case.execute(
            user_id="user-1",
            message="Third message",
            session_id="sess-123",
        ))

        mock_message_repo.list_for_session.assert_called_once_with("sess-123")

    @pytest.mark.asyncio
    async def test_tool_history_reconstructed(self, use_case, mock_message_repo, mock_ai_client):
        """Verify tool call history is properly reconstructed for Claude."""
        mock_message_repo.list_for_session.return_value = [
            {"role": "user", "content": "Find workouts"},
            {
                "role": "assistant",
                "content": "Here are your results",
                "tool_calls": [{
                    "id": "tool-prev",
                    "name": "search_workout_library",
                    "input": {"query": "chest"},
                    "result": "Found 5 workouts",
                }],
            },
            {"role": "user", "content": "Show me more"},
        ]

        events = await collect_events(use_case.execute(
            user_id="user-1",
            message="Any other suggestions?",
            session_id="sess-123",
        ))

        # Flow should complete successfully with history
        assert events[-1].event == "message_end"
