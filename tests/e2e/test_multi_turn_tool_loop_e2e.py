"""
E2E tests for multi-turn tool loop (AMA-495).

Tests the Anthropic tool_use protocol where:
1. Claude calls a tool with stop_reason="tool_use"
2. Tool executes and result is fed back to Claude
3. Claude synthesizes result into natural language
4. Loop continues until stop_reason="end_turn"

Coverage:
    SMOKE (PR gate):
        - Single tool call with synthesis
        - No tool call (direct response)
        - Tool error propagation

    REGRESSION (nightly):
        - Multi-turn 2-iteration loop
        - Parallel tools in single turn
        - Token aggregation across iterations
        - Tool result persistence
        - Max iterations safety guard
"""

import json
from typing import Any, Dict, List

import pytest

from backend.services.ai_client import StreamEvent
from tests.e2e.conftest import (
    TEST_USER_ID,
    FakeAIClient,
    FakeFunctionDispatcher,
    FakeChatMessageRepository,
    parse_sse_events,
    extract_event_types,
    find_events,
)


# ============================================================================
# SMOKE SUITE -- run on every PR
# ============================================================================


@pytest.mark.integration
class TestMultiTurnToolLoopSmoke:
    """Critical-path tests for tool loop that must pass on every PR."""

    def test_single_tool_call_with_synthesis(
        self, client, ai_client: FakeAIClient, function_dispatcher: FakeFunctionDispatcher
    ):
        """Tool is called, result is fed back, Claude synthesizes response."""
        # Configure multi-turn response sequence
        ai_client.response_sequences = [
            # Turn 1: Claude calls search tool
            [
                StreamEvent(event="function_call", data={"id": "tool-1", "name": "search_workout_library"}),
                StreamEvent(event="content_delta", data={"partial_json": '{"query": "leg workouts"}'}),
                StreamEvent(event="message_end", data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 100,
                    "output_tokens": 25,
                    "latency_ms": 500,
                    "stop_reason": "tool_use",
                }),
            ],
            # Turn 2: Claude synthesizes result
            [
                StreamEvent(event="content_delta", data={"text": "I found great leg workouts! "}),
                StreamEvent(event="content_delta", data={"text": "Here's what's available."}),
                StreamEvent(event="message_end", data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 200,
                    "output_tokens": 40,
                    "latency_ms": 600,
                    "stop_reason": "end_turn",
                }),
            ],
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Find me leg workouts"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)
        types = extract_event_types(events)

        # Should have full sequence: start -> function_call -> function_result -> content -> end
        assert types[0] == "message_start"
        assert "function_call" in types
        assert "function_result" in types
        assert "content_delta" in types
        assert types[-1] == "message_end"

        # Verify function_result contains tool output
        fr = find_events(events, "function_result")[0]
        assert "tool_use_id" in fr["data"]
        assert fr["data"]["tool_use_id"] == "tool-1"
        assert "Found these workouts" in fr["data"]["result"]

        # Verify AI client was called twice (tool loop)
        assert ai_client.call_count == 2

        # Verify second call includes tool_result in messages
        second_call = ai_client.all_call_kwargs[1]
        messages = second_call["messages"]
        # Should have tool_result message
        has_tool_result = any(
            isinstance(m.get("content"), list) and
            any(c.get("type") == "tool_result" for c in m["content"])
            for m in messages if m["role"] == "user"
        )
        assert has_tool_result

    def test_no_tool_call_direct_response(self, client, ai_client: FakeAIClient):
        """Query that doesn't need tools gets direct response without looping."""
        # Configure single response (no tool call)
        ai_client.response_events = [
            StreamEvent(event="content_delta", data={"text": "HIIT stands for "}),
            StreamEvent(event="content_delta", data={"text": "High Intensity Interval Training."}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 80,
                "output_tokens": 30,
                "latency_ms": 400,
                "stop_reason": "end_turn",
            }),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "What is HIIT?"},
        )

        events = parse_sse_events(response.text)
        types = extract_event_types(events)

        # Should NOT have function_call or function_result
        assert "function_call" not in types
        assert "function_result" not in types
        assert "content_delta" in types

        # Only one AI client call
        assert ai_client.call_count == 1

    def test_tool_error_propagation(
        self, client, ai_client: FakeAIClient, function_dispatcher: FakeFunctionDispatcher
    ):
        """Tool error is captured and Claude can acknowledge it."""
        # Set up error for the tool
        function_dispatcher.set_error("search_workout_library", "Service unavailable")

        ai_client.response_sequences = [
            # Turn 1: Claude calls tool
            [
                StreamEvent(event="function_call", data={"id": "tool-1", "name": "search_workout_library"}),
                StreamEvent(event="content_delta", data={"partial_json": '{"query": "test"}'}),
                StreamEvent(event="message_end", data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 100,
                    "output_tokens": 20,
                    "latency_ms": 500,
                    "stop_reason": "tool_use",
                }),
            ],
            # Turn 2: Claude acknowledges error
            [
                StreamEvent(event="content_delta", data={"text": "I encountered an issue searching."}),
                StreamEvent(event="message_end", data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 150,
                    "output_tokens": 25,
                    "latency_ms": 400,
                    "stop_reason": "end_turn",
                }),
            ],
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Search for workouts"},
        )

        events = parse_sse_events(response.text)

        # Should have function_result with error message
        fr = find_events(events, "function_result")[0]
        assert "couldn't complete" in fr["data"]["result"]
        assert "Service unavailable" in fr["data"]["result"]

        # Stream should complete successfully
        assert events[-1]["event"] == "message_end"


# ============================================================================
# REGRESSION SUITE -- nightly / full CI
# ============================================================================


@pytest.mark.integration
class TestMultiTurnToolLoopRegression:
    """Full regression tests for multi-turn tool loop."""

    def test_two_iteration_tool_chain(
        self, client, ai_client: FakeAIClient, function_dispatcher: FakeFunctionDispatcher
    ):
        """Claude calls tool, gets result, calls another tool, then synthesizes both."""
        ai_client.response_sequences = [
            # Turn 1: search tool
            [
                StreamEvent(event="function_call", data={"id": "tool-1", "name": "search_workout_library"}),
                StreamEvent(event="content_delta", data={"partial_json": '{"query": "legs"}'}),
                StreamEvent(event="message_end", data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 100,
                    "output_tokens": 20,
                    "latency_ms": 500,
                    "stop_reason": "tool_use",
                }),
            ],
            # Turn 2: calendar tool
            [
                StreamEvent(event="function_call", data={"id": "tool-2", "name": "add_workout_to_calendar"}),
                StreamEvent(event="content_delta", data={"partial_json": '{"date": "2024-01-20", "time": "09:00"}'}),
                StreamEvent(event="message_end", data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 200,
                    "output_tokens": 25,
                    "latency_ms": 600,
                    "stop_reason": "tool_use",
                }),
            ],
            # Turn 3: synthesis
            [
                StreamEvent(event="content_delta", data={"text": "Done! I found leg workouts and scheduled one."}),
                StreamEvent(event="message_end", data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 300,
                    "output_tokens": 30,
                    "latency_ms": 400,
                    "stop_reason": "end_turn",
                }),
            ],
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Find leg workouts and schedule one for tomorrow at 9am"},
        )

        events = parse_sse_events(response.text)

        # Should have 2 function_calls and 2 function_results
        function_calls = find_events(events, "function_call")
        function_results = find_events(events, "function_result")
        assert len(function_calls) == 2
        assert len(function_results) == 2

        # Verify tool names
        assert function_calls[0]["data"]["name"] == "search_workout_library"
        assert function_calls[1]["data"]["name"] == "add_workout_to_calendar"

        # AI client called 3 times
        assert ai_client.call_count == 3

        # Dispatcher called twice
        assert function_dispatcher.call_count == 2

    def test_parallel_tools_single_turn(
        self, client, ai_client: FakeAIClient, function_dispatcher: FakeFunctionDispatcher
    ):
        """Claude calls multiple tools in a single turn, all executed and fed back."""
        ai_client.response_sequences = [
            # Turn 1: Two tools in parallel
            [
                StreamEvent(event="function_call", data={"id": "tool-1", "name": "search_workout_library"}),
                StreamEvent(event="content_delta", data={"partial_json": '{"query": "HIIT"}'}),
                StreamEvent(event="function_call", data={"id": "tool-2", "name": "get_workout_history"}),
                StreamEvent(event="content_delta", data={"partial_json": '{}'}),
                StreamEvent(event="message_end", data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 100,
                    "output_tokens": 40,
                    "latency_ms": 500,
                    "stop_reason": "tool_use",
                }),
            ],
            # Turn 2: synthesis
            [
                StreamEvent(event="content_delta", data={"text": "Based on your history and search..."}),
                StreamEvent(event="message_end", data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 250,
                    "output_tokens": 50,
                    "latency_ms": 600,
                    "stop_reason": "end_turn",
                }),
            ],
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Search HIIT and show my history"},
        )

        events = parse_sse_events(response.text)

        # Should have 2 function_calls and 2 function_results
        function_calls = find_events(events, "function_call")
        function_results = find_events(events, "function_result")
        assert len(function_calls) == 2
        assert len(function_results) == 2

        # Dispatcher called twice
        assert function_dispatcher.call_count == 2

        # Second AI call should have both tool_results
        second_call = ai_client.all_call_kwargs[1]
        messages = second_call["messages"]
        tool_result_msg = next(
            m for m in messages
            if m["role"] == "user" and isinstance(m.get("content"), list)
        )
        assert len(tool_result_msg["content"]) == 2
        tool_result_ids = {c["tool_use_id"] for c in tool_result_msg["content"]}
        assert tool_result_ids == {"tool-1", "tool-2"}

    def test_token_aggregation(self, client, ai_client: FakeAIClient):
        """message_end.tokens_used reflects sum of all iterations."""
        ai_client.response_sequences = [
            # Turn 1: 100 input + 25 output = 125
            [
                StreamEvent(event="function_call", data={"id": "tool-1", "name": "search_workout_library"}),
                StreamEvent(event="content_delta", data={"partial_json": '{"query": "x"}'}),
                StreamEvent(event="message_end", data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 100,
                    "output_tokens": 25,
                    "latency_ms": 500,
                    "stop_reason": "tool_use",
                }),
            ],
            # Turn 2: 150 input + 30 output = 180
            [
                StreamEvent(event="content_delta", data={"text": "Results"}),
                StreamEvent(event="message_end", data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 150,
                    "output_tokens": 30,
                    "latency_ms": 600,
                    "stop_reason": "end_turn",
                }),
            ],
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Search"},
        )

        events = parse_sse_events(response.text)
        end_event = find_events(events, "message_end")[0]

        # Total: (100+25) + (150+30) = 305
        assert end_event["data"]["tokens_used"] == 305

    def test_tool_persistence(
        self, client, ai_client: FakeAIClient, message_repo: FakeChatMessageRepository
    ):
        """All tool calls from all iterations are persisted in the message."""
        ai_client.response_sequences = [
            # Turn 1: first tool
            [
                StreamEvent(event="function_call", data={"id": "tool-1", "name": "search_workout_library"}),
                StreamEvent(event="content_delta", data={"partial_json": '{"query": "a"}'}),
                StreamEvent(event="message_end", data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 100,
                    "output_tokens": 20,
                    "latency_ms": 500,
                    "stop_reason": "tool_use",
                }),
            ],
            # Turn 2: second tool
            [
                StreamEvent(event="function_call", data={"id": "tool-2", "name": "get_workout_details"}),
                StreamEvent(event="content_delta", data={"partial_json": '{"workout_id": "w-1"}'}),
                StreamEvent(event="message_end", data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 150,
                    "output_tokens": 25,
                    "latency_ms": 600,
                    "stop_reason": "end_turn",
                }),
            ],
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Search and get details"},
        )

        # Get the session_id from response
        events = parse_sse_events(response.text)
        session_id = events[0]["data"]["session_id"]

        # Check persisted messages
        messages = message_repo.list_for_session(session_id)
        assistant_msg = next(m for m in messages if m["role"] == "assistant")

        # Should have both tool calls
        assert assistant_msg["tool_calls"] is not None
        assert len(assistant_msg["tool_calls"]) == 2

        tool_names = {tc["name"] for tc in assistant_msg["tool_calls"]}
        assert tool_names == {"search_workout_library", "get_workout_details"}

    def test_max_iterations_safety(self, client, ai_client: FakeAIClient):
        """Loop stops at MAX_TOOL_ITERATIONS (10) to prevent infinite loops."""
        # Create 15 responses that always request more tools
        def make_tool_response(idx):
            return [
                StreamEvent(event="function_call", data={"id": f"tool-{idx}", "name": "search_workout_library"}),
                StreamEvent(event="content_delta", data={"partial_json": '{}'}),
                StreamEvent(event="message_end", data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 50,
                    "output_tokens": 10,
                    "latency_ms": 200,
                    "stop_reason": "tool_use",  # Always request more
                }),
            ]

        ai_client.response_sequences = [make_tool_response(i) for i in range(15)]

        response = client.post(
            "/chat/stream",
            json={"message": "Do something"},
        )

        events = parse_sse_events(response.text)

        # Should cap at 10 iterations
        assert ai_client.call_count == 10

        # Should still complete with message_end
        assert events[-1]["event"] == "message_end"

        # Should have 10 function_calls and 10 function_results
        function_calls = find_events(events, "function_call")
        function_results = find_events(events, "function_result")
        assert len(function_calls) == 10
        assert len(function_results) == 10

    def test_empty_tool_uses_with_tool_use_stop_reason(self, client, ai_client: FakeAIClient):
        """Edge case: stop_reason=tool_use but no tools called should not loop."""
        ai_client.response_events = [
            StreamEvent(event="content_delta", data={"text": "Let me think..."}),
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 80,
                "output_tokens": 10,
                "latency_ms": 300,
                "stop_reason": "tool_use",  # Unusual but possible
            }),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )

        events = parse_sse_events(response.text)

        # Should complete without looping
        assert ai_client.call_count == 1
        assert events[-1]["event"] == "message_end"
        assert "error" not in extract_event_types(events)

    def test_auth_context_forwarded_to_tools(
        self, client, ai_client: FakeAIClient, function_dispatcher: FakeFunctionDispatcher
    ):
        """Auth token and user_id are passed through to tool execution."""
        ai_client.response_sequences = [
            [
                StreamEvent(event="function_call", data={"id": "tool-1", "name": "search_workout_library"}),
                StreamEvent(event="content_delta", data={"partial_json": '{"query": "test"}'}),
                StreamEvent(event="message_end", data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 100,
                    "output_tokens": 20,
                    "latency_ms": 500,
                    "stop_reason": "end_turn",
                }),
            ],
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Search"},
        )

        # Verify dispatcher received auth context
        assert function_dispatcher.call_count == 1
        assert function_dispatcher.last_call["user_id"] == TEST_USER_ID
        assert function_dispatcher.last_call["auth_token"] == "Bearer e2e-test-token"
