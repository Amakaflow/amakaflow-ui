"""Unit tests for StreamChatUseCase with mocked repos and AI client."""

import json
from unittest.mock import MagicMock

import pytest

from application.use_cases.stream_chat import StreamChatUseCase, SSEEvent
from backend.services.ai_client import StreamEvent
from backend.services.function_dispatcher import FunctionDispatcher


@pytest.fixture
def mock_session_repo():
    repo = MagicMock()
    repo.create.return_value = {"id": "sess-123", "title": "New Chat"}
    repo.get.return_value = {"id": "sess-123", "title": "Existing Chat"}
    return repo


@pytest.fixture
def mock_message_repo():
    repo = MagicMock()
    repo.create.return_value = {"id": "msg-1"}
    repo.list_for_session.return_value = [
        {"role": "user", "content": "Hello"},
    ]
    return repo


@pytest.fixture
def mock_rate_limit_repo():
    repo = MagicMock()
    repo.get_monthly_usage.return_value = 5
    return repo


@pytest.fixture
def mock_ai_client():
    client = MagicMock()
    client.stream_chat.return_value = iter([
        StreamEvent(event="content_delta", data={"text": "Hello! "}),
        StreamEvent(event="content_delta", data={"text": "How can I help?"}),
        StreamEvent(event="message_end", data={
            "model": "claude-sonnet-4-20250514",
            "input_tokens": 100,
            "output_tokens": 50,
            "latency_ms": 1500,
        }),
    ])
    return client


@pytest.fixture
def mock_function_dispatcher():
    dispatcher = MagicMock(spec=FunctionDispatcher)
    dispatcher.execute.return_value = "Mock result"
    return dispatcher


@pytest.fixture
def use_case(mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_ai_client, mock_function_dispatcher):
    return StreamChatUseCase(
        session_repo=mock_session_repo,
        message_repo=mock_message_repo,
        rate_limit_repo=mock_rate_limit_repo,
        ai_client=mock_ai_client,
        function_dispatcher=mock_function_dispatcher,
        monthly_limit=50,
    )


class TestStreamChat:
    def test_basic_flow(self, use_case):
        events = list(use_case.execute(user_id="user-1", message="Hello"))

        event_types = [e.event for e in events]
        assert event_types[0] == "message_start"
        assert "content_delta" in event_types
        assert event_types[-1] == "message_end"

    def test_new_session_created(self, use_case, mock_session_repo):
        events = list(use_case.execute(user_id="user-1", message="Hello"))

        mock_session_repo.create.assert_called_once_with("user-1")
        # message_start should contain session_id
        start_data = json.loads(events[0].data)
        assert start_data["session_id"] == "sess-123"

    def test_existing_session(self, use_case, mock_session_repo):
        events = list(use_case.execute(
            user_id="user-1",
            message="Hello",
            session_id="sess-123",
        ))

        mock_session_repo.get.assert_called_once_with("sess-123", "user-1")
        mock_session_repo.create.assert_not_called()

    def test_session_not_found(self, use_case, mock_session_repo):
        mock_session_repo.get.return_value = None

        events = list(use_case.execute(
            user_id="user-1",
            message="Hello",
            session_id="nonexistent",
        ))

        assert len(events) == 1
        assert events[0].event == "error"
        data = json.loads(events[0].data)
        assert data["type"] == "not_found"

    def test_rate_limit_exceeded(self, use_case, mock_rate_limit_repo):
        mock_rate_limit_repo.get_monthly_usage.return_value = 50

        events = list(use_case.execute(user_id="user-1", message="Hello"))

        assert len(events) == 1
        assert events[0].event == "error"
        data = json.loads(events[0].data)
        assert data["type"] == "rate_limit_exceeded"

    def test_user_message_persisted(self, use_case, mock_message_repo):
        list(use_case.execute(user_id="user-1", message="Hello"))

        # First call is user message, second is assistant message
        calls = mock_message_repo.create.call_args_list
        assert len(calls) == 2
        user_msg = calls[0][0][0]
        assert user_msg["role"] == "user"
        assert user_msg["content"] == "Hello"

    def test_assistant_message_persisted(self, use_case, mock_message_repo):
        list(use_case.execute(user_id="user-1", message="Hello"))

        calls = mock_message_repo.create.call_args_list
        assistant_msg = calls[1][0][0]
        assert assistant_msg["role"] == "assistant"
        assert "Hello! " in assistant_msg["content"]
        assert assistant_msg["model"] == "claude-sonnet-4-20250514"

    def test_rate_limit_incremented(self, use_case, mock_rate_limit_repo):
        list(use_case.execute(user_id="user-1", message="Hello"))

        mock_rate_limit_repo.increment.assert_called_once_with("user-1")

    def test_auto_title_new_session(self, use_case, mock_session_repo):
        list(use_case.execute(user_id="user-1", message="Suggest a leg workout"))

        mock_session_repo.update_title.assert_called_once_with(
            "sess-123", "Suggest a leg workout"
        )

    def test_auto_title_truncation(self, use_case, mock_session_repo):
        long_msg = "A" * 100
        list(use_case.execute(user_id="user-1", message=long_msg))

        call_args = mock_session_repo.update_title.call_args[0]
        assert len(call_args[1]) <= 83  # 80 + "..."

    def test_message_end_contains_stats(self, use_case):
        events = list(use_case.execute(user_id="user-1", message="Hello"))

        end_event = events[-1]
        assert end_event.event == "message_end"
        data = json.loads(end_event.data)
        assert data["session_id"] == "sess-123"
        assert data["tokens_used"] == 150  # 100 + 50
        assert data["latency_ms"] == 1500

    def test_content_deltas_streamed(self, use_case):
        events = list(use_case.execute(user_id="user-1", message="Hello"))

        deltas = [e for e in events if e.event == "content_delta"]
        assert len(deltas) == 2
        assert json.loads(deltas[0].data)["text"] == "Hello! "
        assert json.loads(deltas[1].data)["text"] == "How can I help?"


class TestStreamChatToolCalls:
    def test_function_call_and_result(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_function_dispatcher
    ):
        mock_ai_client = MagicMock()
        mock_ai_client.stream_chat.return_value = iter([
            StreamEvent(event="function_call", data={"id": "tool-1", "name": "search_workout_library"}),
            StreamEvent(event="content_delta", data={"partial_json": '{"query": "legs"}'}),
            StreamEvent(event="content_delta", data={"text": "Based on the search..."}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 200,
                "output_tokens": 100,
                "latency_ms": 2000,
            }),
        ])

        mock_function_dispatcher.execute.return_value = "Found these workouts:\n1. Leg Day (ID: w-1)"

        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        events = list(use_case.execute(user_id="user-1", message="Find me a leg workout"))
        event_types = [e.event for e in events]

        assert "function_call" in event_types
        assert "function_result" in event_types

        # Check function_result contains dispatcher result
        fr = next(e for e in events if e.event == "function_result")
        data = json.loads(fr.data)
        assert "Leg Day" in data["result"]

        # Verify dispatcher was called with accumulated args
        mock_function_dispatcher.execute.assert_called_once()
        call_args = mock_function_dispatcher.execute.call_args
        assert call_args[0][0] == "search_workout_library"
        assert call_args[0][1] == {"query": "legs"}

    def test_multiple_tool_calls_in_sequence(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_function_dispatcher
    ):
        """Verify multiple sequential tool calls are each executed."""
        mock_ai_client = MagicMock()
        mock_ai_client.stream_chat.return_value = iter([
            # First tool call
            StreamEvent(event="function_call", data={"id": "tool-1", "name": "search_workout_library"}),
            StreamEvent(event="content_delta", data={"partial_json": '{"query": "legs"}'}),
            # Second tool call (triggers execution of first)
            StreamEvent(event="function_call", data={"id": "tool-2", "name": "add_workout_to_calendar"}),
            StreamEvent(event="content_delta", data={"partial_json": '{"workout_id": "w-1", "date": "2024-01-15"}'}),
            # End triggers execution of second
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 300,
                "output_tokens": 150,
                "latency_ms": 3000,
            }),
        ])

        mock_function_dispatcher.execute.side_effect = [
            "Found: Leg Day (ID: w-1)",
            "Scheduled for 2024-01-15",
        ]

        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        events = list(use_case.execute(user_id="user-1", message="Schedule leg workout"))

        # Should have 2 function_call and 2 function_result events
        function_calls = [e for e in events if e.event == "function_call"]
        function_results = [e for e in events if e.event == "function_result"]

        assert len(function_calls) == 2
        assert len(function_results) == 2

        # Verify dispatcher was called twice with correct args
        assert mock_function_dispatcher.execute.call_count == 2
        calls = mock_function_dispatcher.execute.call_args_list

        assert calls[0][0][0] == "search_workout_library"
        assert calls[0][0][1] == {"query": "legs"}

        assert calls[1][0][0] == "add_workout_to_calendar"
        assert calls[1][0][1] == {"workout_id": "w-1", "date": "2024-01-15"}

    def test_tool_call_with_malformed_json(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_function_dispatcher
    ):
        """Verify malformed JSON in partial_json returns error to Claude."""
        mock_ai_client = MagicMock()
        mock_ai_client.stream_chat.return_value = iter([
            StreamEvent(event="function_call", data={"id": "tool-1", "name": "navigate_to_page"}),
            StreamEvent(event="content_delta", data={"partial_json": '{invalid json'}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 100,
                "output_tokens": 50,
                "latency_ms": 1000,
            }),
        ])

        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        events = list(use_case.execute(user_id="user-1", message="Go home"))

        # Should have function_result with error message
        function_results = [e for e in events if e.event == "function_result"]
        assert len(function_results) == 1

        # Error should be returned to Claude instead of calling dispatcher
        fr_data = json.loads(function_results[0].data)
        assert "Error" in fr_data["result"]
        assert "Invalid tool arguments" in fr_data["result"]

        # Dispatcher should NOT have been called (error returned early)
        mock_function_dispatcher.execute.assert_not_called()

    def test_auth_token_forwarded_to_context(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_function_dispatcher
    ):
        """Verify auth_token is passed through to FunctionContext."""
        from backend.services.function_dispatcher import FunctionContext

        mock_ai_client = MagicMock()
        mock_ai_client.stream_chat.return_value = iter([
            StreamEvent(event="function_call", data={"id": "tool-1", "name": "search_workout_library"}),
            StreamEvent(event="content_delta", data={"partial_json": '{"query": "test"}'}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 100,
                "output_tokens": 50,
                "latency_ms": 1000,
            }),
        ])

        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        list(use_case.execute(
            user_id="user-1",
            message="Search",
            auth_token="Bearer my-secret-token",
        ))

        # Verify the context passed to dispatcher has the auth token
        mock_function_dispatcher.execute.assert_called_once()
        call_args = mock_function_dispatcher.execute.call_args
        context = call_args[0][2]

        assert isinstance(context, FunctionContext)
        assert context.user_id == "user-1"
        assert context.auth_token == "Bearer my-secret-token"


class TestStreamChatErrorHandling:
    def test_session_creation_failure(
        self, mock_message_repo, mock_rate_limit_repo, mock_ai_client, mock_function_dispatcher
    ):
        """Verify session creation exception yields error SSE."""
        mock_session_repo = MagicMock()
        mock_session_repo.create.side_effect = Exception("Database connection failed")

        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        events = list(use_case.execute(user_id="user-1", message="Hello"))

        assert len(events) == 1
        assert events[0].event == "error"
        data = json.loads(events[0].data)
        assert data["type"] == "internal_error"
        assert "session" in data["message"].lower()
