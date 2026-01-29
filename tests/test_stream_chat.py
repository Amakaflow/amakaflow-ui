"""Unit tests for StreamChatUseCase with mocked repos and AI client."""

import json
from unittest.mock import MagicMock

import pytest

from application.use_cases.stream_chat import StreamChatUseCase, SSEEvent
from backend.services.ai_client import StreamEvent
from backend.services.function_dispatcher import FunctionDispatcher
from backend.services.tts_service import TTSResult
from infrastructure.db.tts_settings_repository import TTSSettings


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

    def test_all_tool_phases_passed_to_claude(self, use_case, mock_ai_client):
        """Verify all tool phases (1-4) are passed to Claude."""
        list(use_case.execute(user_id="user-1", message="Hello"))

        call_kwargs = mock_ai_client.stream_chat.call_args[1]
        tools = call_kwargs["tools"]
        tool_names = [t["name"] for t in tools]

        # Phase 1 tools
        assert "search_workout_library" in tool_names
        assert "add_workout_to_calendar" in tool_names

        # Phase 2 tools (content ingestion)
        assert "import_from_youtube" in tool_names
        assert "import_from_tiktok" in tool_names

        # Phase 3 tools (edit, export, history)
        assert "edit_workout" in tool_names
        assert "get_workout_history" in tool_names

        # Phase 4 tools (calendar & sync)
        assert "get_calendar_events" in tool_names
        assert "reschedule_workout" in tool_names
        assert "cancel_scheduled_workout" in tool_names
        assert "sync_strava" in tool_names
        assert "sync_garmin" in tool_names
        assert "get_strava_activities" in tool_names

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

    def test_multi_turn_tool_loop_feeds_result_to_claude(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_function_dispatcher
    ):
        """Verify tool results are fed back to Claude when stop_reason is 'tool_use'.

        This is the key test for AMA-495: when Claude calls a tool with stop_reason='tool_use',
        the result must be fed back to Claude for synthesis into a natural language response.
        """
        mock_ai_client = MagicMock()

        # First call: Claude calls a tool and expects the result (stop_reason='tool_use')
        first_response = [
            StreamEvent(event="function_call", data={"id": "tool-1", "name": "search_workout_library"}),
            StreamEvent(event="content_delta", data={"partial_json": '{"query": "leg workouts"}'}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 100,
                "output_tokens": 20,
                "latency_ms": 500,
                "stop_reason": "tool_use",  # Claude expects tool result
            }),
        ]

        # Second call: Claude synthesizes the tool result into natural language
        second_response = [
            StreamEvent(event="content_delta", data={"text": "I found "}),
            StreamEvent(event="content_delta", data={"text": "3 great leg workouts for you!"}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 200,
                "output_tokens": 50,
                "latency_ms": 800,
                "stop_reason": "end_turn",  # Claude is done
            }),
        ]

        mock_ai_client.stream_chat.side_effect = [
            iter(first_response),
            iter(second_response),
        ]

        # Real dispatcher returns strings, not dicts
        mock_function_dispatcher.execute.return_value = json.dumps({
            "workouts": [
                {"id": "w-1", "name": "Leg Day Blast"},
                {"id": "w-2", "name": "Lower Body Strength"},
                {"id": "w-3", "name": "Quad Burner"},
            ]
        })

        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        events = list(use_case.execute(user_id="user-1", message="Find me leg workouts"))
        event_types = [e.event for e in events]

        # Should have: message_start, function_call, function_result, content_delta(s), message_end
        assert "message_start" in event_types
        assert "function_call" in event_types
        assert "function_result" in event_types
        assert "content_delta" in event_types
        assert "message_end" in event_types

        # stream_chat should be called TWICE - once for initial request, once with tool results
        assert mock_ai_client.stream_chat.call_count == 2

        # Second call should include tool result in messages
        second_call_args = mock_ai_client.stream_chat.call_args_list[1]
        messages = second_call_args[1]["messages"]

        # Should have: original user message, assistant tool_use, user tool_result
        assert len(messages) >= 3
        # Last message should be the tool_result
        assert messages[-1]["role"] == "user"
        assert messages[-1]["content"][0]["type"] == "tool_result"

        # Verify the final text response was streamed
        content_deltas = [e for e in events if e.event == "content_delta"]
        full_text = "".join(json.loads(e.data)["text"] for e in content_deltas)
        assert "leg workouts" in full_text.lower()

    def test_tool_loop_respects_max_iterations(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_function_dispatcher
    ):
        """Verify tool loop exits after MAX_TOOL_ITERATIONS to prevent infinite loops."""
        mock_ai_client = MagicMock()

        # Create a response that always requests another tool call
        def create_tool_response(idx):
            return iter([
                StreamEvent(event="function_call", data={"id": f"tool-{idx}", "name": "some_tool"}),
                StreamEvent(event="content_delta", data={"partial_json": '{}'}),
                StreamEvent(event="message_end", data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 100,
                    "output_tokens": 20,
                    "latency_ms": 500,
                    "stop_reason": "tool_use",  # Always request more
                }),
            ])

        # Return the same tool-requesting response many times
        mock_ai_client.stream_chat.side_effect = [create_tool_response(i) for i in range(15)]
        mock_function_dispatcher.execute.return_value = "result"

        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        events = list(use_case.execute(user_id="user-1", message="Do something"))

        # Should cap at MAX_TOOL_ITERATIONS (10) - so 10 calls to stream_chat
        assert mock_ai_client.stream_chat.call_count == 10

    def test_token_aggregation_across_iterations(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_function_dispatcher
    ):
        """Verify tokens are summed across all tool loop iterations."""
        mock_ai_client = MagicMock()

        # First turn: tool call
        first_response = [
            StreamEvent(event="function_call", data={"id": "tool-1", "name": "get_data"}),
            StreamEvent(event="content_delta", data={"partial_json": '{}'}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 100,
                "output_tokens": 25,
                "latency_ms": 500,
                "stop_reason": "tool_use",
            }),
        ]

        # Second turn: final response
        second_response = [
            StreamEvent(event="content_delta", data={"text": "Here is the data."}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 150,
                "output_tokens": 30,
                "latency_ms": 600,
                "stop_reason": "end_turn",
            }),
        ]

        mock_ai_client.stream_chat.side_effect = [iter(first_response), iter(second_response)]
        mock_function_dispatcher.execute.return_value = "data result"

        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        events = list(use_case.execute(user_id="user-1", message="Get data"))

        # Find message_end and verify aggregated tokens
        end_event = next(e for e in events if e.event == "message_end")
        data = json.loads(end_event.data)

        # Total should be: (100 + 25) + (150 + 30) = 305
        assert data["tokens_used"] == 305

    def test_multi_iteration_message_threading(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_function_dispatcher
    ):
        """Verify messages accumulate correctly across multiple iterations."""
        mock_ai_client = MagicMock()

        # First turn: tool call
        first_response = [
            StreamEvent(event="function_call", data={"id": "tool-1", "name": "search"}),
            StreamEvent(event="content_delta", data={"partial_json": '{"q": "test"}'}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 100,
                "output_tokens": 20,
                "latency_ms": 500,
                "stop_reason": "tool_use",
            }),
        ]

        # Second turn: another tool call
        second_response = [
            StreamEvent(event="function_call", data={"id": "tool-2", "name": "fetch"}),
            StreamEvent(event="content_delta", data={"partial_json": '{"id": "123"}'}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 200,
                "output_tokens": 25,
                "latency_ms": 600,
                "stop_reason": "tool_use",
            }),
        ]

        # Third turn: final response
        third_response = [
            StreamEvent(event="content_delta", data={"text": "Done!"}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 300,
                "output_tokens": 10,
                "latency_ms": 400,
                "stop_reason": "end_turn",
            }),
        ]

        mock_ai_client.stream_chat.side_effect = [
            iter(first_response),
            iter(second_response),
            iter(third_response),
        ]
        mock_function_dispatcher.execute.side_effect = ["search result", "fetch result"]

        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        events = list(use_case.execute(user_id="user-1", message="Search and fetch"))

        # Should have 3 calls to stream_chat
        assert mock_ai_client.stream_chat.call_count == 3

        # Verify third call has accumulated messages
        third_call_args = mock_ai_client.stream_chat.call_args_list[2]
        messages = third_call_args[1]["messages"]

        # Should have: user msg, assistant tool_use, user tool_result,
        #              assistant tool_use, user tool_result
        assert len(messages) >= 5

        # Verify message structure
        # First assistant message should have tool_use for "search"
        assistant_msgs = [m for m in messages if m["role"] == "assistant"]
        assert len(assistant_msgs) == 2
        assert assistant_msgs[0]["content"][0]["name"] == "search"
        assert assistant_msgs[1]["content"][0]["name"] == "fetch"

        # User messages after assistant should have tool_result
        user_msgs = [m for m in messages if m["role"] == "user"]
        # First is original message, rest are tool_results
        assert any(
            isinstance(m["content"], list) and m["content"][0]["type"] == "tool_result"
            for m in user_msgs
        )

    def test_error_during_second_iteration(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_function_dispatcher
    ):
        """Verify loop exits gracefully when error occurs in subsequent iteration."""
        mock_ai_client = MagicMock()

        # First turn: tool call succeeds
        first_response = [
            StreamEvent(event="function_call", data={"id": "tool-1", "name": "get_data"}),
            StreamEvent(event="content_delta", data={"partial_json": '{}'}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 100,
                "output_tokens": 20,
                "latency_ms": 500,
                "stop_reason": "tool_use",
            }),
        ]

        # Second turn: error
        second_response = [
            StreamEvent(event="error", data={
                "type": "api_error",
                "message": "Service unavailable",
            }),
        ]

        mock_ai_client.stream_chat.side_effect = [iter(first_response), iter(second_response)]
        mock_function_dispatcher.execute.return_value = "data"

        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        events = list(use_case.execute(user_id="user-1", message="Get data"))
        event_types = [e.event for e in events]

        # Should have function_result from first iteration, then error
        assert "function_result" in event_types
        assert "error" in event_types

        # Should NOT have message_end (error exits early)
        assert event_types[-1] == "error"

    def test_parallel_tools_in_single_turn(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_function_dispatcher
    ):
        """Verify multiple tools called in one turn are all executed and fed back."""
        mock_ai_client = MagicMock()

        # First turn: Claude calls TWO tools
        first_response = [
            StreamEvent(event="function_call", data={"id": "tool-1", "name": "get_weather"}),
            StreamEvent(event="content_delta", data={"partial_json": '{"city": "NYC"}'}),
            StreamEvent(event="function_call", data={"id": "tool-2", "name": "get_time"}),
            StreamEvent(event="content_delta", data={"partial_json": '{"tz": "EST"}'}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 100,
                "output_tokens": 40,
                "latency_ms": 500,
                "stop_reason": "tool_use",
            }),
        ]

        # Second turn: Claude synthesizes both results
        second_response = [
            StreamEvent(event="content_delta", data={"text": "NYC is 72F and it's 3pm EST."}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 200,
                "output_tokens": 30,
                "latency_ms": 600,
                "stop_reason": "end_turn",
            }),
        ]

        mock_ai_client.stream_chat.side_effect = [iter(first_response), iter(second_response)]
        mock_function_dispatcher.execute.side_effect = ["72F sunny", "3:00 PM"]

        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        events = list(use_case.execute(user_id="user-1", message="Weather and time in NYC"))

        # Should have 2 function_call and 2 function_result events
        function_calls = [e for e in events if e.event == "function_call"]
        function_results = [e for e in events if e.event == "function_result"]
        assert len(function_calls) == 2
        assert len(function_results) == 2

        # Dispatcher should be called twice
        assert mock_function_dispatcher.execute.call_count == 2

        # Second stream_chat call should have both tool_results
        second_call_args = mock_ai_client.stream_chat.call_args_list[1]
        messages = second_call_args[1]["messages"]
        tool_result_msg = next(
            m for m in messages
            if m["role"] == "user" and isinstance(m["content"], list)
        )
        assert len(tool_result_msg["content"]) == 2
        assert all(c["type"] == "tool_result" for c in tool_result_msg["content"])

    def test_empty_tool_uses_with_tool_use_stop_reason(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_function_dispatcher
    ):
        """Verify loop exits when stop_reason is tool_use but no tools were called."""
        mock_ai_client = MagicMock()

        # Malformed response: stop_reason=tool_use but no tool calls
        response = [
            StreamEvent(event="content_delta", data={"text": "Let me think..."}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 100,
                "output_tokens": 10,
                "latency_ms": 500,
                "stop_reason": "tool_use",  # Unusual: tool_use but no tools
            }),
        ]

        mock_ai_client.stream_chat.return_value = iter(response)

        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        events = list(use_case.execute(user_id="user-1", message="Hello"))

        # Should complete without error
        event_types = [e.event for e in events]
        assert "message_start" in event_types
        assert "message_end" in event_types
        assert "error" not in event_types

        # Should NOT loop (no tools to execute)
        assert mock_ai_client.stream_chat.call_count == 1

        # Dispatcher should not be called
        mock_function_dispatcher.execute.assert_not_called()

    def test_tool_persistence_across_iterations(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_function_dispatcher
    ):
        """Verify all tool calls from all iterations are persisted."""
        mock_ai_client = MagicMock()

        # First turn: tool call
        first_response = [
            StreamEvent(event="function_call", data={"id": "tool-1", "name": "search"}),
            StreamEvent(event="content_delta", data={"partial_json": '{"q": "a"}'}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 100,
                "output_tokens": 20,
                "latency_ms": 500,
                "stop_reason": "tool_use",
            }),
        ]

        # Second turn: another tool call
        second_response = [
            StreamEvent(event="function_call", data={"id": "tool-2", "name": "fetch"}),
            StreamEvent(event="content_delta", data={"partial_json": '{"id": "1"}'}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 150,
                "output_tokens": 25,
                "latency_ms": 600,
                "stop_reason": "end_turn",
            }),
        ]

        mock_ai_client.stream_chat.side_effect = [iter(first_response), iter(second_response)]
        mock_function_dispatcher.execute.side_effect = ["result1", "result2"]

        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        list(use_case.execute(user_id="user-1", message="Search and fetch"))

        # Check the assistant message was persisted with all tool calls
        create_calls = mock_message_repo.create.call_args_list
        assistant_msg = create_calls[1][0][0]  # Second call is assistant message

        assert assistant_msg["role"] == "assistant"
        assert assistant_msg["tool_calls"] is not None
        assert len(assistant_msg["tool_calls"]) == 2

        # Verify both tools are captured
        tool_names = [tc["name"] for tc in assistant_msg["tool_calls"]]
        assert "search" in tool_names
        assert "fetch" in tool_names

        # Verify results are captured
        tool_results = [tc["result"] for tc in assistant_msg["tool_calls"]]
        assert "result1" in tool_results
        assert "result2" in tool_results

    def test_rate_limit_incremented_per_ai_call(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_function_dispatcher
    ):
        """Verify rate limit is incremented once per AI call, not once per request."""
        mock_ai_client = MagicMock()

        # Two AI calls: tool call + synthesis
        mock_ai_client.stream_chat.side_effect = [
            iter([
                StreamEvent(event="function_call", data={"id": "tool-1", "name": "search"}),
                StreamEvent(event="content_delta", data={"partial_json": '{}'}),
                StreamEvent(event="message_end", data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 100,
                    "output_tokens": 20,
                    "latency_ms": 500,
                    "stop_reason": "tool_use",
                }),
            ]),
            iter([
                StreamEvent(event="content_delta", data={"text": "Done"}),
                StreamEvent(event="message_end", data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 150,
                    "output_tokens": 30,
                    "latency_ms": 600,
                    "stop_reason": "end_turn",
                }),
            ]),
        ]
        mock_function_dispatcher.execute.return_value = "result"

        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        list(use_case.execute(user_id="user-1", message="Search"))

        # Rate limit should be incremented twice (once per AI call)
        assert mock_rate_limit_repo.increment.call_count == 2

    def test_latency_aggregation_across_iterations(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_function_dispatcher
    ):
        """Verify latency_ms is summed across all iterations."""
        mock_ai_client = MagicMock()

        mock_ai_client.stream_chat.side_effect = [
            iter([
                StreamEvent(event="function_call", data={"id": "tool-1", "name": "search"}),
                StreamEvent(event="content_delta", data={"partial_json": '{}'}),
                StreamEvent(event="message_end", data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 100,
                    "output_tokens": 20,
                    "latency_ms": 500,  # First call: 500ms
                    "stop_reason": "tool_use",
                }),
            ]),
            iter([
                StreamEvent(event="content_delta", data={"text": "Done"}),
                StreamEvent(event="message_end", data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 150,
                    "output_tokens": 30,
                    "latency_ms": 700,  # Second call: 700ms
                    "stop_reason": "end_turn",
                }),
            ]),
        ]
        mock_function_dispatcher.execute.return_value = "result"

        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        events = list(use_case.execute(user_id="user-1", message="Search"))

        end_event = next(e for e in events if e.event == "message_end")
        data = json.loads(end_event.data)

        # Total latency: 500 + 700 = 1200ms
        assert data["latency_ms"] == 1200

    def test_session_continuation_with_tool_history(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_ai_client, mock_function_dispatcher
    ):
        """Verify tool call history is reconstructed when resuming a session."""
        # Set up existing session with tool call history
        mock_session_repo.get.return_value = {"id": "sess-existing", "title": "Prior chat"}

        # Message history includes a prior assistant message with tool_calls
        mock_message_repo.list_for_session.return_value = [
            {"role": "user", "content": "Find leg workouts"},
            {
                "role": "assistant",
                "content": "I found some workouts for you.",
                "tool_calls": [
                    {
                        "id": "prev-tool-1",
                        "name": "search_workout_library",
                        "input": {"query": "legs"},
                        "result": "Found: Leg Day (ID: w-1)",
                    }
                ],
            },
            {"role": "user", "content": "Schedule the first one"},
        ]

        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        list(use_case.execute(
            user_id="user-1",
            message="Schedule the first one",
            session_id="sess-existing",
        ))

        # Check that AI client received reconstructed tool history
        call_kwargs = mock_ai_client.stream_chat.call_args[1]
        messages = call_kwargs["messages"]

        # Should have: user msg, assistant with tool_use, user with tool_result, user msg
        assert len(messages) >= 4

        # Find the assistant message with tool_use
        assistant_with_tool = next(
            (m for m in messages if m["role"] == "assistant" and isinstance(m["content"], list)),
            None
        )
        assert assistant_with_tool is not None
        assert any(c.get("type") == "tool_use" for c in assistant_with_tool["content"])
        assert any(c.get("name") == "search_workout_library" for c in assistant_with_tool["content"])

        # Find the user message with tool_result
        user_with_result = next(
            (m for m in messages if m["role"] == "user" and isinstance(m["content"], list)),
            None
        )
        assert user_with_result is not None
        assert any(c.get("type") == "tool_result" for c in user_with_result["content"])


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


class TestStreamChatTTS:
    """Tests for TTS integration in StreamChatUseCase."""

    @pytest.fixture
    def mock_tts_service(self):
        """Mock TTS service that returns successful synthesis."""
        service = MagicMock()
        service.synthesize.return_value = TTSResult(
            success=True,
            audio_data=b"fake-audio-data-bytes",
            duration_ms=2500,
            chars_used=25,
            provider="elevenlabs",
            voice_id="test-voice-id",
        )
        service.check_daily_limit.return_value = (True, 40000)
        return service

    @pytest.fixture
    def mock_tts_settings_repo(self):
        """Mock TTS settings repository with TTS enabled."""
        repo = MagicMock()
        repo.get_settings.return_value = TTSSettings(
            tts_enabled=True,
            tts_voice_id="user-voice-id",
            tts_speed=1.25,
            tts_pitch=1.0,
            auto_play_responses=True,
            tts_daily_chars_used=5000,
        )
        repo.increment_daily_chars.return_value = 5025
        return repo

    @pytest.fixture
    def tts_use_case(
        self,
        mock_session_repo,
        mock_message_repo,
        mock_rate_limit_repo,
        mock_ai_client,
        mock_function_dispatcher,
        mock_tts_service,
        mock_tts_settings_repo,
    ):
        """StreamChatUseCase with TTS service and settings repo."""
        return StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
            monthly_limit=50,
            tts_service=mock_tts_service,
            tts_settings_repo=mock_tts_settings_repo,
        )

    def test_tts_synthesis_when_enabled(self, tts_use_case, mock_tts_service):
        """TTS audio is included in message_end when tts_enabled=True."""
        events = list(tts_use_case.execute(user_id="user-1", message="Hello"))

        # Find message_end event
        end_event = next(e for e in events if e.event == "message_end")
        data = json.loads(end_event.data)

        # Should have voice_response
        assert "voice_response" in data
        assert data["voice_response"] is not None
        assert "audio_base64" in data["voice_response"]
        assert "duration_ms" in data["voice_response"]
        assert "voice_id" in data["voice_response"]
        assert "chars_used" in data["voice_response"]

        # Verify TTS service was called
        mock_tts_service.synthesize.assert_called_once()

    def test_tts_skipped_when_disabled(
        self,
        mock_session_repo,
        mock_message_repo,
        mock_rate_limit_repo,
        mock_ai_client,
        mock_function_dispatcher,
        mock_tts_service,
    ):
        """No TTS synthesis when tts_enabled=False."""
        mock_tts_settings_repo = MagicMock()
        mock_tts_settings_repo.get_settings.return_value = TTSSettings(
            tts_enabled=False,  # Disabled
            tts_voice_id=None,
            tts_speed=1.0,
            tts_pitch=1.0,
            auto_play_responses=False,
            tts_daily_chars_used=0,
        )

        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
            tts_service=mock_tts_service,
            tts_settings_repo=mock_tts_settings_repo,
        )

        events = list(use_case.execute(user_id="user-1", message="Hello"))

        # Find message_end event
        end_event = next(e for e in events if e.event == "message_end")
        data = json.loads(end_event.data)

        # Should NOT have voice_response (TTS disabled)
        assert "voice_response" not in data or data.get("voice_response") is None

        # TTS service should NOT have been called
        mock_tts_service.synthesize.assert_not_called()

    def test_tts_daily_limit_exceeded_returns_voice_error(
        self,
        mock_session_repo,
        mock_message_repo,
        mock_rate_limit_repo,
        mock_ai_client,
        mock_function_dispatcher,
        mock_tts_settings_repo,
    ):
        """voice_error returned when daily TTS limit is reached."""
        mock_tts_service = MagicMock()
        mock_tts_service.check_daily_limit.return_value = (False, 100)  # Not allowed, 100 remaining

        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
            tts_service=mock_tts_service,
            tts_settings_repo=mock_tts_settings_repo,
        )

        events = list(use_case.execute(user_id="user-1", message="Hello"))

        end_event = next(e for e in events if e.event == "message_end")
        data = json.loads(end_event.data)

        # Should have voice_error
        assert data.get("voice_response") is None
        assert "voice_error" in data
        assert "limit" in data["voice_error"].lower()

        # TTS synthesis should NOT have been called
        mock_tts_service.synthesize.assert_not_called()

    def test_tts_synthesis_failure_returns_voice_error(
        self, tts_use_case, mock_tts_service
    ):
        """voice_error returned when TTS synthesis fails."""
        mock_tts_service.synthesize.return_value = TTSResult(
            success=False,
            audio_data=None,
            duration_ms=None,
            chars_used=0,
            provider="elevenlabs",
            voice_id="test-voice",
            error="ElevenLabs API rate limit exceeded",
        )

        events = list(tts_use_case.execute(user_id="user-1", message="Hello"))

        end_event = next(e for e in events if e.event == "message_end")
        data = json.loads(end_event.data)

        # Should have voice_error, not voice_response
        assert data.get("voice_response") is None
        assert "voice_error" in data
        assert data["voice_error"] == "ElevenLabs API rate limit exceeded"

    def test_tts_skipped_when_empty_response(
        self,
        mock_session_repo,
        mock_message_repo,
        mock_rate_limit_repo,
        mock_function_dispatcher,
        mock_tts_service,
        mock_tts_settings_repo,
    ):
        """No TTS synthesis when AI response is empty."""
        mock_ai_client = MagicMock()
        mock_ai_client.stream_chat.return_value = iter([
            # No content_delta events, just message_end
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 100,
                "output_tokens": 0,
                "latency_ms": 500,
            }),
        ])

        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
            tts_service=mock_tts_service,
            tts_settings_repo=mock_tts_settings_repo,
        )

        events = list(use_case.execute(user_id="user-1", message="Hello"))

        end_event = next(e for e in events if e.event == "message_end")
        data = json.loads(end_event.data)

        # No voice_response when there's no text
        assert "voice_response" not in data or data.get("voice_response") is None

        # TTS service should NOT have been called (no text to synthesize)
        mock_tts_service.synthesize.assert_not_called()

    def test_tts_uses_user_settings(self, tts_use_case, mock_tts_service, mock_tts_settings_repo):
        """TTS uses voice_id and speed from user settings."""
        list(tts_use_case.execute(user_id="user-1", message="Hello"))

        # Verify synthesize was called with user's settings
        mock_tts_service.synthesize.assert_called_once()
        call_kwargs = mock_tts_service.synthesize.call_args[1]

        assert call_kwargs["voice_id"] == "user-voice-id"
        assert call_kwargs["speed"] == 1.25

    def test_tts_tracks_daily_usage(self, tts_use_case, mock_tts_settings_repo):
        """TTS usage is tracked after successful synthesis."""
        list(tts_use_case.execute(user_id="user-1", message="Hello"))

        # Verify increment was called with chars_used from result
        mock_tts_settings_repo.increment_daily_chars.assert_called_once_with("user-1", 25)

    def test_tts_exception_handled_gracefully(
        self,
        mock_session_repo,
        mock_message_repo,
        mock_rate_limit_repo,
        mock_ai_client,
        mock_function_dispatcher,
        mock_tts_settings_repo,
    ):
        """Exception in TTS does not break chat response."""
        mock_tts_service = MagicMock()
        mock_tts_service.check_daily_limit.return_value = (True, 40000)
        mock_tts_service.synthesize.side_effect = Exception("Unexpected TTS error")

        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
            tts_service=mock_tts_service,
            tts_settings_repo=mock_tts_settings_repo,
        )

        events = list(use_case.execute(user_id="user-1", message="Hello"))

        # Should still complete successfully
        event_types = [e.event for e in events]
        assert "message_start" in event_types
        assert "message_end" in event_types
        assert "error" not in event_types  # Chat should NOT fail

        # message_end should have voice_error
        end_event = next(e for e in events if e.event == "message_end")
        data = json.loads(end_event.data)
        assert data.get("voice_response") is None
        assert "voice_error" in data

    def test_tts_not_called_when_service_is_none(
        self,
        mock_session_repo,
        mock_message_repo,
        mock_rate_limit_repo,
        mock_ai_client,
        mock_function_dispatcher,
    ):
        """Chat works normally when TTS service is None (not configured)."""
        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
            tts_service=None,  # Not configured
            tts_settings_repo=None,
        )

        events = list(use_case.execute(user_id="user-1", message="Hello"))

        # Should complete normally
        event_types = [e.event for e in events]
        assert "message_start" in event_types
        assert "message_end" in event_types

        # No voice_response in message_end
        end_event = next(e for e in events if e.event == "message_end")
        data = json.loads(end_event.data)
        assert "voice_response" not in data

    def test_tts_resets_daily_counter_if_needed(
        self, tts_use_case, mock_tts_settings_repo
    ):
        """Daily counter is reset before checking limits."""
        list(tts_use_case.execute(user_id="user-1", message="Hello"))

        # Verify reset was called
        mock_tts_settings_repo.reset_daily_chars_if_needed.assert_called_once_with("user-1")


class TestStreamChatContext:
    """Tests for context-aware system prompt injection."""

    def test_context_injected_into_system_prompt_workout_detail(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_ai_client, mock_function_dispatcher
    ):
        """Context about workout detail page is injected into system prompt."""
        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        list(use_case.execute(
            user_id="user-1",
            message="Tell me about this workout",
            context={
                "current_page": "workout_detail",
                "selected_workout_id": "workout-abc123",
            },
        ))

        # Check that AI client received system prompt with context
        call_kwargs = mock_ai_client.stream_chat.call_args[1]
        system_prompt = call_kwargs["system"]

        assert "workout ID: workout-abc123" in system_prompt
        assert "Current Context" in system_prompt

    def test_context_injected_into_system_prompt_calendar(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_ai_client, mock_function_dispatcher
    ):
        """Context about calendar page is injected into system prompt."""
        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        list(use_case.execute(
            user_id="user-1",
            message="Schedule something for this day",
            context={
                "current_page": "calendar",
                "selected_date": "2026-02-15",
            },
        ))

        call_kwargs = mock_ai_client.stream_chat.call_args[1]
        system_prompt = call_kwargs["system"]

        assert "2026-02-15" in system_prompt
        assert "calendar" in system_prompt.lower()

    def test_context_injected_into_system_prompt_library(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_ai_client, mock_function_dispatcher
    ):
        """Context about library page is injected into system prompt."""
        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        list(use_case.execute(
            user_id="user-1",
            message="What workouts do I have?",
            context={
                "current_page": "library",
            },
        ))

        call_kwargs = mock_ai_client.stream_chat.call_args[1]
        system_prompt = call_kwargs["system"]

        assert "library" in system_prompt.lower()

    def test_no_context_uses_base_system_prompt(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_ai_client, mock_function_dispatcher
    ):
        """No context results in base system prompt without context section."""
        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        list(use_case.execute(
            user_id="user-1",
            message="Hello",
            context=None,
        ))

        call_kwargs = mock_ai_client.stream_chat.call_args[1]
        system_prompt = call_kwargs["system"]

        # Should have base prompt but no context section
        assert "fitness coach" in system_prompt.lower()
        assert "Current Context" not in system_prompt

    def test_empty_context_uses_base_system_prompt(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_ai_client, mock_function_dispatcher
    ):
        """Empty context dict results in base system prompt."""
        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        list(use_case.execute(
            user_id="user-1",
            message="Hello",
            context={},
        ))

        call_kwargs = mock_ai_client.stream_chat.call_args[1]
        system_prompt = call_kwargs["system"]

        # Should have base prompt but no context section
        assert "fitness coach" in system_prompt.lower()
        assert "Current Context" not in system_prompt

    def test_backwards_compatible_without_context(self, use_case, mock_ai_client):
        """Execute works without context parameter (backwards compatible)."""
        events = list(use_case.execute(user_id="user-1", message="Hello"))

        # Should work normally
        event_types = [e.event for e in events]
        assert "message_start" in event_types
        assert "message_end" in event_types

    def test_workout_detail_without_workout_id_no_context_injection(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_ai_client, mock_function_dispatcher
    ):
        """workout_detail page without selected_workout_id does not inject partial context."""
        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        list(use_case.execute(
            user_id="user-1",
            message="Is this workout good for beginners?",
            context={
                "current_page": "workout_detail",
                # No selected_workout_id - incomplete context
            },
        ))

        call_kwargs = mock_ai_client.stream_chat.call_args[1]
        system_prompt = call_kwargs["system"]

        # Should NOT inject context without the workout ID
        assert "Current Context" not in system_prompt
        assert "workout ID" not in system_prompt

    def test_calendar_without_date_still_adds_context(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_ai_client, mock_function_dispatcher
    ):
        """Calendar page without selected_date still adds general calendar context."""
        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        list(use_case.execute(
            user_id="user-1",
            message="What should I do today?",
            context={
                "current_page": "calendar",
                # No selected_date
            },
        ))

        call_kwargs = mock_ai_client.stream_chat.call_args[1]
        system_prompt = call_kwargs["system"]

        # Should add general calendar context
        assert "Current Context" in system_prompt
        assert "calendar" in system_prompt.lower()

    def test_unknown_page_type_no_context_injection(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_ai_client, mock_function_dispatcher
    ):
        """Unknown current_page values are gracefully ignored (forward compatible)."""
        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        list(use_case.execute(
            user_id="user-1",
            message="Help me with something",
            context={
                "current_page": "future_unknown_page",
                "selected_workout_id": "some-id",
            },
        ))

        call_kwargs = mock_ai_client.stream_chat.call_args[1]
        system_prompt = call_kwargs["system"]

        # Unknown page should not inject any context
        assert "Current Context" not in system_prompt
        assert "future_unknown_page" not in system_prompt

    def test_context_with_all_fields_uses_current_page(
        self, mock_session_repo, mock_message_repo, mock_rate_limit_repo, mock_ai_client, mock_function_dispatcher
    ):
        """When all context fields are provided, current_page determines which is used."""
        use_case = StreamChatUseCase(
            session_repo=mock_session_repo,
            message_repo=mock_message_repo,
            rate_limit_repo=mock_rate_limit_repo,
            ai_client=mock_ai_client,
            function_dispatcher=mock_function_dispatcher,
        )

        list(use_case.execute(
            user_id="user-1",
            message="What is this?",
            context={
                "current_page": "workout_detail",
                "selected_workout_id": "workout-abc123",
                "selected_date": "2024-01-15",  # Also provided but should be ignored
            },
        ))

        call_kwargs = mock_ai_client.stream_chat.call_args[1]
        system_prompt = call_kwargs["system"]

        # Should use workout context based on current_page
        assert "workout ID: workout-abc123" in system_prompt
        # Should NOT include calendar date context
        assert "2024-01-15" not in system_prompt
