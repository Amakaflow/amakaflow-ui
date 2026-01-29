"""E2E tests for Phase 2 content ingestion tools.

These tests verify the full SSE streaming flow for content import functions:
- YouTube import
- TikTok import
- Instagram import
- Pinterest import (single + multi-workout boards)
- Image import with base64

Usage:
    pytest tests/e2e/test_phase2_ingestion_e2e.py -v
    pytest -m integration -k phase2 -v
"""

import base64
import json

import pytest

from backend.services.ai_client import StreamEvent
from tests.e2e.conftest import (
    FakeAIClient,
    FakeFunctionDispatcher,
    parse_sse_events,
    find_events,
)


@pytest.mark.integration
class TestYouTubeIngestionE2E:
    """Full-stack tests for YouTube import flow."""

    @pytest.mark.smoke
    def test_youtube_import_sse_flow(self, client, ai_client, function_dispatcher):
        """Verify YouTube import triggers function_call and function_result SSE events."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_yt_1", "name": "import_from_youtube"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"url": "https://youtube.com/watch?v=test123"}'},
            ),
            StreamEvent(
                event="content_delta",
                data={"text": "I imported the workout from that YouTube video!"},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 200,
                    "output_tokens": 100,
                    "latency_ms": 1500,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Import https://youtube.com/watch?v=test123"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        # Verify function_call event
        fc_events = find_events(events, "function_call")
        assert len(fc_events) >= 1
        assert fc_events[0]["data"]["name"] == "import_from_youtube"

        # Verify function_result event
        fr_events = find_events(events, "function_result")
        assert len(fr_events) >= 1
        result = json.loads(fr_events[0]["data"]["result"])
        assert result["success"] is True
        assert result["source"] == "YouTube video"
        assert "workout" in result

    def test_youtube_skip_cache_param(self, client, ai_client, function_dispatcher):
        """Verify skip_cache parameter is passed through."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_yt_2", "name": "import_from_youtube"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"url": "https://youtube.com/watch?v=abc", "skip_cache": true}'},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 150,
                    "output_tokens": 80,
                    "latency_ms": 1200,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Import this YouTube video fresh: https://youtube.com/watch?v=abc"},
        )

        assert response.status_code == 200

        # Verify dispatcher was called with skip_cache
        assert function_dispatcher.call_count >= 1
        last_call = function_dispatcher.last_call
        assert last_call["function_name"] == "import_from_youtube"
        assert last_call["arguments"].get("skip_cache") is True


@pytest.mark.integration
class TestTikTokIngestionE2E:
    """Full-stack tests for TikTok import flow."""

    def test_tiktok_import_default_mode(self, client, ai_client, function_dispatcher):
        """Verify TikTok import with default auto mode."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_tt_1", "name": "import_from_tiktok"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"url": "https://tiktok.com/@user/video/123"}'},
            ),
            StreamEvent(
                event="content_delta",
                data={"text": "Got the workout from TikTok!"},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 180,
                    "output_tokens": 90,
                    "latency_ms": 1800,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Import this TikTok: https://tiktok.com/@user/video/123"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        fr_events = find_events(events, "function_result")
        assert len(fr_events) >= 1
        result = json.loads(fr_events[0]["data"]["result"])
        assert result["success"] is True
        assert result["source"] == "TikTok video"

    def test_tiktok_hybrid_mode(self, client, ai_client, function_dispatcher):
        """Verify TikTok import with explicit hybrid mode."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_tt_2", "name": "import_from_tiktok"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"url": "https://tiktok.com/@user/video/456", "mode": "hybrid"}'},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 160,
                    "output_tokens": 70,
                    "latency_ms": 2000,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Use both audio and vision to import this TikTok"},
        )

        assert response.status_code == 200

        # Verify mode was passed
        last_call = function_dispatcher.last_call
        assert last_call["arguments"].get("mode") == "hybrid"


@pytest.mark.integration
class TestInstagramIngestionE2E:
    """Full-stack tests for Instagram import flow."""

    def test_instagram_import(self, client, ai_client, function_dispatcher):
        """Verify Instagram post import flow."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_ig_1", "name": "import_from_instagram"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"url": "https://instagram.com/p/ABC123"}'},
            ),
            StreamEvent(
                event="content_delta",
                data={"text": "Imported the workout from Instagram!"},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 170,
                    "output_tokens": 85,
                    "latency_ms": 1400,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Import from https://instagram.com/p/ABC123"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        fr_events = find_events(events, "function_result")
        assert len(fr_events) >= 1
        result = json.loads(fr_events[0]["data"]["result"])
        assert result["success"] is True
        assert result["source"] == "Instagram post"


@pytest.mark.integration
class TestPinterestIngestionE2E:
    """Full-stack tests for Pinterest import flow."""

    def test_pinterest_single_pin(self, client, ai_client, function_dispatcher):
        """Verify Pinterest single pin import."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_pin_1", "name": "import_from_pinterest"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"url": "https://pinterest.com/pin/123"}'},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 150,
                    "output_tokens": 70,
                    "latency_ms": 1100,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Import this pin: https://pinterest.com/pin/123"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        fr_events = find_events(events, "function_result")
        assert len(fr_events) >= 1
        result = json.loads(fr_events[0]["data"]["result"])
        assert result["success"] is True
        # Single pin should not have multiple_workouts flag
        assert "multiple_workouts" not in result or result.get("multiple_workouts") is False

    def test_pinterest_board_multiple_workouts(self, client, ai_client, function_dispatcher):
        """Verify Pinterest board returns multiple workouts."""
        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_pin_2", "name": "import_from_pinterest"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"url": "https://pinterest.com/user/board/fitness-ideas"}'},
            ),
            StreamEvent(
                event="content_delta",
                data={"text": "I found 3 workouts on that board!"},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 180,
                    "output_tokens": 95,
                    "latency_ms": 1600,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Import all workouts from pinterest.com/user/board/fitness-ideas"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        fr_events = find_events(events, "function_result")
        assert len(fr_events) >= 1
        result = json.loads(fr_events[0]["data"]["result"])

        assert result["success"] is True
        assert result["multiple_workouts"] is True
        assert result["total"] == 3
        assert len(result["workouts"]) == 3
        assert all("title" in w and "id" in w for w in result["workouts"])


@pytest.mark.integration
class TestImageIngestionE2E:
    """Full-stack tests for image import flow."""

    @pytest.mark.smoke
    def test_image_import_with_base64(self, client, ai_client, function_dispatcher):
        """Verify image import handles base64 through full stack."""
        fake_image = base64.b64encode(b"fake png image data for testing").decode()

        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_img_1", "name": "import_from_image"},
            ),
            StreamEvent(
                event="content_delta",
                data={
                    "partial_json": json.dumps({
                        "image_data": fake_image,
                        "filename": "workout_screenshot.png",
                    })
                },
            ),
            StreamEvent(
                event="content_delta",
                data={"text": "I imported the workout from your screenshot!"},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 250,
                    "output_tokens": 60,
                    "latency_ms": 2000,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Import this workout screenshot"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        fr_events = find_events(events, "function_result")
        assert len(fr_events) >= 1
        result = json.loads(fr_events[0]["data"]["result"])

        assert result["success"] is True
        assert result["source"] == "image"
        assert "workout" in result
        assert result["workout"]["exercise_count"] == 10

    def test_image_import_default_filename(self, client, ai_client, function_dispatcher):
        """Verify image import works without explicit filename."""
        fake_image = base64.b64encode(b"test image bytes").decode()

        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_img_2", "name": "import_from_image"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": json.dumps({"image_data": fake_image})},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 200,
                    "output_tokens": 50,
                    "latency_ms": 1800,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Here's an image of my workout plan"},
        )

        assert response.status_code == 200

        # Verify dispatcher received the call (filename should default)
        last_call = function_dispatcher.last_call
        assert last_call["function_name"] == "import_from_image"
        assert "image_data" in last_call["arguments"]


@pytest.mark.integration
class TestIngestionErrorHandling:
    """Test error scenarios for content ingestion."""

    @pytest.mark.smoke
    def test_dispatcher_error_returned_to_client(
        self, client, ai_client, function_dispatcher
    ):
        """Verify dispatcher errors are properly returned via SSE."""
        # Configure dispatcher to return error
        function_dispatcher.set_error("import_from_youtube", "Video not accessible")

        ai_client.response_events = [
            StreamEvent(
                event="function_call",
                data={"id": "toolu_err_1", "name": "import_from_youtube"},
            ),
            StreamEvent(
                event="content_delta",
                data={"partial_json": '{"url": "https://youtube.com/watch?v=private"}'},
            ),
            StreamEvent(
                event="message_end",
                data={
                    "model": "claude-sonnet-4-20250514",
                    "input_tokens": 150,
                    "output_tokens": 40,
                    "latency_ms": 800,
                },
            ),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "Import https://youtube.com/watch?v=private"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        fr_events = find_events(events, "function_result")
        assert len(fr_events) >= 1
        # Error message should be in the result
        assert "Video not accessible" in fr_events[0]["data"]["result"]
