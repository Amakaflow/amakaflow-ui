"""E2E tests for AMA-529: Two-phase workout import flow.

Tests the critical fix where:
1. import_from_* tools extract workouts but do NOT save (persisted=false)
2. User is asked for confirmation
3. save_imported_workout persists to library (persisted=true)
4. AI correctly reports success only after save

Usage:
    pytest tests/e2e/test_ama529_import_save_flow_e2e.py -v
    pytest -m smoke tests/e2e/test_ama529_import_save_flow_e2e.py -v  # PR gate
    pytest -m integration tests/e2e/test_ama529_import_save_flow_e2e.py -v  # Full
"""

import json

import pytest

from backend.services.ai_client import StreamEvent
from tests.e2e.conftest import (
    FakeAIClient,
    FakeFunctionDispatcher,
    parse_sse_events,
    find_events,
)


# ============================================================================
# SMOKE SUITE - Run on every PR
# ============================================================================


@pytest.mark.integration
@pytest.mark.smoke
class TestAMA529ImportSaveFlowSmoke:
    """Critical-path tests for two-phase import that must pass on every PR."""

    def test_youtube_import_returns_preview_not_persisted(
        self, client, ai_client: FakeAIClient, function_dispatcher: FakeFunctionDispatcher
    ):
        """CRITICAL: import_from_youtube must return persisted=false.

        This is the bug fix - previously AI claimed workout was saved after import.
        """
        # Configure: AI calls import_from_youtube
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_yt_1", "name": "import_from_youtube"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"url": "https://youtube.com/watch?v=abc123"}'},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 200,
                    "output_tokens": 100,
                    "latency_ms": 1500,
                    "stop_reason": "end_turn",
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Import this YouTube workout: https://youtube.com/watch?v=abc123"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        # Find function_result
        fr_events = find_events(events, "function_result")
        assert len(fr_events) >= 1

        result = json.loads(fr_events[0]["data"]["result"])

        # CRITICAL ASSERTIONS: These verify the bug fix
        assert result["success"] is True
        assert result["preview_mode"] is True, "Import should be in preview mode"
        assert result["persisted"] is False, "Import should NOT persist automatically"
        assert "next_step" in result, "Should include instructions for AI"
        assert "workout" in result
        assert "full_workout_data" in result["workout"], "Should include data for save step"

    def test_save_imported_workout_returns_persisted_true(
        self, client, ai_client: FakeAIClient, function_dispatcher: FakeFunctionDispatcher
    ):
        """Verify save_imported_workout returns persisted=true with workout_id."""
        # Configure: AI calls save_imported_workout
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_save_1", "name": "save_imported_workout"},
            ),
            StreamEvent(
                event="content_delta",
                data={
                    "partial_json": json.dumps({
                        "workout_data": {"title": "Test Workout", "exercises": []},
                        "source_url": "https://youtube.com/watch?v=abc123"
                    })
                },
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 250,
                    "output_tokens": 60,
                    "latency_ms": 800,
                    "stop_reason": "end_turn",
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Yes, save that workout to my library"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        fr_events = find_events(events, "function_result")
        assert len(fr_events) >= 1

        result = json.loads(fr_events[0]["data"]["result"])

        # CRITICAL: persisted=true only after save
        assert result["success"] is True
        assert result["persisted"] is True
        assert "workout_id" in result
        assert result["workout_id"].startswith("w-saved-")

    def test_save_missing_workout_data_returns_error(
        self, client, ai_client: FakeAIClient, function_dispatcher: FakeFunctionDispatcher
    ):
        """Save without workout_data returns validation error."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_save_err", "name": "save_imported_workout"},
            ),
            StreamEvent(
                event="content_delta",
                data={
                    "partial_json": json.dumps({
                        "source_url": "https://youtube.com/watch?v=test"
                        # Missing workout_data
                    })
                },
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 200,
                    "output_tokens": 50,
                    "latency_ms": 700,
                    "stop_reason": "end_turn",
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Save it"},
        )

        events = parse_sse_events(response.text)
        fr_events = find_events(events, "function_result")
        result = json.loads(fr_events[0]["data"]["result"])

        assert result["error"] is True
        assert result["code"] == "validation_error"
        assert "workout_data" in result["message"]

    def test_save_missing_source_url_returns_error(
        self, client, ai_client: FakeAIClient, function_dispatcher: FakeFunctionDispatcher
    ):
        """Save without source_url returns validation error."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_save_err2", "name": "save_imported_workout"},
            ),
            StreamEvent(
                event="content_delta",
                data={
                    "partial_json": json.dumps({
                        "workout_data": {"title": "Test"}
                        # Missing source_url
                    })
                },
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 200,
                    "output_tokens": 50,
                    "latency_ms": 700,
                    "stop_reason": "end_turn",
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Save it"},
        )

        events = parse_sse_events(response.text)
        fr_events = find_events(events, "function_result")
        result = json.loads(fr_events[0]["data"]["result"])

        assert result["error"] is True
        assert result["code"] == "validation_error"
        assert "source_url" in result["message"]

    def test_full_import_then_save_multi_turn_flow(
        self, client, ai_client: FakeAIClient, function_dispatcher: FakeFunctionDispatcher
    ):
        """CRITICAL: Full multi-turn flow - import -> preview -> confirm -> save.

        This test simulates the actual user journey:
        1. User asks to import a YouTube workout
        2. AI calls import_from_youtube, gets preview (persisted=false)
        3. AI presents workout to user, asks for confirmation
        4. User confirms
        5. AI calls save_imported_workout, gets success (persisted=true)
        6. Workout is now in user's library
        """
        # Turn 1: User asks to import, AI calls import_from_youtube
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_import", "name": "import_from_youtube"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"url": "https://youtube.com/watch?v=leg_day_123"}'},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 200,
                    "output_tokens": 100,
                    "latency_ms": 1500,
                    "stop_reason": "tool_use",
                },
            ),
        ]

        response1 = client.post(
            "/chat/stream",
            json={"message": "Import this YouTube workout: https://youtube.com/watch?v=leg_day_123"},
        )

        assert response1.status_code == 200
        events1 = parse_sse_events(response1.text)
        session_id = events1[0]["data"]["session_id"]

        # Verify import returned preview mode (NOT persisted)
        fr_events1 = find_events(events1, "function_result")
        assert len(fr_events1) >= 1
        import_result = json.loads(fr_events1[0]["data"]["result"])

        assert import_result["success"] is True
        assert import_result["preview_mode"] is True
        assert import_result["persisted"] is False, "Import should NOT persist automatically"
        assert "full_workout_data" in import_result["workout"]

        # Turn 2: User confirms, AI calls save_imported_workout
        ai_client.reset()
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_save", "name": "save_imported_workout"},
            ),
            StreamEvent(
                event="content_delta",
                data={
                    "partial_json": json.dumps({
                        "workout_data": import_result["workout"]["full_workout_data"],
                        "source_url": import_result["source_url"]
                    })
                },
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 300,
                    "output_tokens": 80,
                    "latency_ms": 800,
                    "stop_reason": "tool_use",
                },
            ),
        ]

        response2 = client.post(
            "/chat/stream",
            json={"message": "Yes, save it to my library!", "session_id": session_id},
        )

        assert response2.status_code == 200
        events2 = parse_sse_events(response2.text)

        # Verify save returned persisted=true
        fr_events2 = find_events(events2, "function_result")
        assert len(fr_events2) >= 1
        save_result = json.loads(fr_events2[0]["data"]["result"])

        assert save_result["success"] is True
        assert save_result["persisted"] is True, "Save should persist to library"
        assert "workout_id" in save_result
        assert save_result["workout_id"].startswith("w-saved-")

        # Verify the correct sequence of calls
        assert function_dispatcher.call_count >= 1
        assert function_dispatcher.last_call["function_name"] == "save_imported_workout"


# ============================================================================
# REGRESSION SUITE - Nightly / Full CI
# ============================================================================


@pytest.mark.integration
class TestAMA529ImportSaveFlowRegression:
    """Extended tests for all import sources and edge cases."""

    def test_tiktok_import_returns_preview_mode(
        self, client, ai_client: FakeAIClient, function_dispatcher: FakeFunctionDispatcher
    ):
        """TikTok import returns preview_mode=true, persisted=false."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_tt", "name": "import_from_tiktok"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"url": "https://tiktok.com/@user/video/123"}'},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 180,
                    "output_tokens": 90,
                    "latency_ms": 1800,
                    "stop_reason": "end_turn",
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Import https://tiktok.com/@user/video/123"},
        )

        events = parse_sse_events(response.text)
        fr_events = find_events(events, "function_result")
        result = json.loads(fr_events[0]["data"]["result"])

        assert result["preview_mode"] is True
        assert result["persisted"] is False

    def test_instagram_import_returns_preview_mode(
        self, client, ai_client: FakeAIClient, function_dispatcher: FakeFunctionDispatcher
    ):
        """Instagram import returns preview_mode=true, persisted=false."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_ig", "name": "import_from_instagram"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"url": "https://instagram.com/p/ABC123"}'},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 170,
                    "output_tokens": 85,
                    "latency_ms": 1400,
                    "stop_reason": "end_turn",
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Import https://instagram.com/p/ABC123"},
        )

        events = parse_sse_events(response.text)
        fr_events = find_events(events, "function_result")
        result = json.loads(fr_events[0]["data"]["result"])

        assert result["preview_mode"] is True
        assert result["persisted"] is False

    def test_pinterest_single_pin_returns_preview_mode(
        self, client, ai_client: FakeAIClient, function_dispatcher: FakeFunctionDispatcher
    ):
        """Pinterest single pin returns preview_mode=true, persisted=false."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_pin", "name": "import_from_pinterest"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"url": "https://pinterest.com/pin/123"}'},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 170,
                    "output_tokens": 85,
                    "latency_ms": 1400,
                    "stop_reason": "end_turn",
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Import https://pinterest.com/pin/123"},
        )

        events = parse_sse_events(response.text)
        fr_events = find_events(events, "function_result")
        result = json.loads(fr_events[0]["data"]["result"])

        assert result["preview_mode"] is True
        assert result["persisted"] is False

    def test_pinterest_board_returns_multiple_workouts_preview(
        self, client, ai_client: FakeAIClient, function_dispatcher: FakeFunctionDispatcher
    ):
        """Pinterest board returns multiple workouts with preview mode."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_pin_board", "name": "import_from_pinterest"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"url": "https://pinterest.com/user/board/fitness"}'},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 180,
                    "output_tokens": 95,
                    "latency_ms": 1600,
                    "stop_reason": "end_turn",
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Import from pinterest.com/user/board/fitness"},
        )

        events = parse_sse_events(response.text)
        fr_events = find_events(events, "function_result")
        result = json.loads(fr_events[0]["data"]["result"])

        assert result["success"] is True
        assert result["preview_mode"] is True
        assert result["persisted"] is False
        assert result["multiple_workouts"] is True
        assert len(result["workouts"]) == 3

    def test_image_import_returns_preview_mode(
        self, client, ai_client: FakeAIClient, function_dispatcher: FakeFunctionDispatcher
    ):
        """Image import returns preview_mode=true, persisted=false."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_img", "name": "import_from_image"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"image_data": "base64data", "filename": "workout.jpg"}'},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 500,
                    "output_tokens": 100,
                    "latency_ms": 2000,
                    "stop_reason": "end_turn",
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Import this workout image"},
        )

        events = parse_sse_events(response.text)
        fr_events = find_events(events, "function_result")
        result = json.loads(fr_events[0]["data"]["result"])

        assert result["preview_mode"] is True
        assert result["persisted"] is False

    def test_save_with_title_override(
        self, client, ai_client: FakeAIClient, function_dispatcher: FakeFunctionDispatcher
    ):
        """User can request custom title during save."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_save_custom", "name": "save_imported_workout"},
            ),
            StreamEvent(
                event="content_delta",
                data={
                    "partial_json": json.dumps({
                        "workout_data": {"title": "Original Title", "exercises": []},
                        "source_url": "https://youtube.com/watch?v=test",
                        "title_override": "My Custom Leg Day"
                    })
                },
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 250,
                    "output_tokens": 60,
                    "latency_ms": 800,
                    "stop_reason": "end_turn",
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Yes, save it as 'My Custom Leg Day'"},
        )

        events = parse_sse_events(response.text)
        fr_events = find_events(events, "function_result")
        result = json.loads(fr_events[0]["data"]["result"])

        assert result["success"] is True
        assert result["persisted"] is True
        assert result["title"] == "My Custom Leg Day"

    def test_function_dispatcher_tracks_save_calls(
        self, client, ai_client: FakeAIClient, function_dispatcher: FakeFunctionDispatcher
    ):
        """Verify function_dispatcher tracks save_imported_workout calls."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_track", "name": "save_imported_workout"},
            ),
            StreamEvent(
                event="content_delta",
                data={
                    "partial_json": json.dumps({
                        "workout_data": {"title": "Tracked Workout"},
                        "source_url": "https://youtube.com/watch?v=tracked"
                    })
                },
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 200,
                    "output_tokens": 50,
                    "latency_ms": 600,
                    "stop_reason": "end_turn",
                },
            ),
        ]

        client.post(
            "/chat/stream",
            json={"message": "Save that workout"},
        )

        # Verify dispatcher tracked the call
        assert function_dispatcher.call_count >= 1
        assert function_dispatcher.last_call["function_name"] == "save_imported_workout"
        assert function_dispatcher.last_call["arguments"]["workout_data"]["title"] == "Tracked Workout"
        assert function_dispatcher.last_call["arguments"]["source_url"] == "https://youtube.com/watch?v=tracked"
