"""E2E tests for Voice + Chat integration.

Part of AMA-442: Extend Voice Infrastructure for Chat Assistant (TTS)

Tests the full user journey of chat with voice responses enabled.
These tests verify that:
1. Chat SSE includes voice_response when TTS is enabled
2. TTS settings are respected across chat sessions
3. Daily limits are enforced gracefully
4. TTS failures don't break chat functionality
"""

import pytest

from tests.e2e.conftest import (
    TEST_USER_ID,
    parse_sse_events,
    find_events,
    FakeTTSService,
    FakeTTSSettingsRepository,
)
from infrastructure.db.tts_settings_repository import TTSSettings


class TestVoiceChatSmoke:
    """Critical voice+chat integration tests for every PR.

    These tests verify the core user journey of receiving voice responses
    in the chat assistant.
    """

    def test_chat_stream_includes_voice_response_when_tts_enabled(
        self, client, tts_service, tts_settings_repo
    ):
        """POST /chat/stream returns voice_response in message_end when TTS enabled."""
        # Setup: TTS enabled (default)
        tts_settings_repo.set_settings(
            TEST_USER_ID,
            TTSSettings(
                tts_enabled=True,
                tts_voice_id="voice-rachel",
                tts_speed=1.0,
                tts_pitch=1.0,
                auto_play_responses=True,
                tts_daily_chars_used=0,
            ),
        )

        response = client.post(
            "/chat/stream",
            json={"message": "Hello, can you help me?"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        # Find message_end event
        end_events = find_events(events, "message_end")
        assert len(end_events) == 1
        end_data = end_events[0]["data"]

        # Should have voice_response
        assert "voice_response" in end_data
        assert end_data["voice_response"] is not None
        assert "audio_base64" in end_data["voice_response"]
        assert "duration_ms" in end_data["voice_response"]
        assert "voice_id" in end_data["voice_response"]

        # TTS service should have been called
        assert tts_service.call_count == 1
        assert tts_service.last_call["voice_id"] == "voice-rachel"

    def test_chat_stream_no_voice_when_tts_disabled(
        self, client, tts_service, tts_settings_repo
    ):
        """POST /chat/stream omits voice_response when user has TTS disabled."""
        # Setup: TTS disabled
        tts_settings_repo.set_settings(
            TEST_USER_ID,
            TTSSettings(
                tts_enabled=False,
                tts_voice_id=None,
                tts_speed=1.0,
                tts_pitch=1.0,
                auto_play_responses=False,
                tts_daily_chars_used=0,
            ),
        )

        response = client.post(
            "/chat/stream",
            json={"message": "Hello!"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        # Find message_end event
        end_events = find_events(events, "message_end")
        assert len(end_events) == 1
        end_data = end_events[0]["data"]

        # Should NOT have voice_response
        assert "voice_response" not in end_data or end_data.get("voice_response") is None

        # TTS service should NOT have been called
        assert tts_service.call_count == 0

    def test_chat_continues_with_voice_error_when_tts_limit_exceeded(
        self, client, tts_service, tts_settings_repo
    ):
        """Chat SSE completes with voice_error when TTS daily limit is exceeded."""
        # Setup: User has exhausted daily limit
        tts_settings_repo.set_settings(
            TEST_USER_ID,
            TTSSettings(
                tts_enabled=True,
                tts_voice_id=None,
                tts_speed=1.0,
                tts_pitch=1.0,
                auto_play_responses=True,
                tts_daily_chars_used=50000,  # At limit
            ),
        )

        response = client.post(
            "/chat/stream",
            json={"message": "What workout should I do?"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        # Chat should complete normally
        event_types = [e["event"] for e in events]
        assert "message_start" in event_types
        assert "content_delta" in event_types
        assert "message_end" in event_types
        assert "error" not in event_types

        # message_end should have voice_error instead of voice_response
        end_events = find_events(events, "message_end")
        end_data = end_events[0]["data"]

        assert end_data.get("voice_response") is None
        assert "voice_error" in end_data
        assert "limit" in end_data["voice_error"].lower()

        # TTS synthesis should NOT have been called
        assert tts_service.call_count == 0

    def test_chat_continues_with_voice_error_when_tts_fails(
        self, client, tts_service, tts_settings_repo
    ):
        """Chat SSE completes with voice_error when TTS synthesis fails."""
        # Setup: TTS enabled but will fail
        tts_settings_repo.set_settings(
            TEST_USER_ID,
            TTSSettings(tts_enabled=True, tts_daily_chars_used=0),
        )
        tts_service.set_failure(True, "ElevenLabs API rate limit exceeded")

        response = client.post(
            "/chat/stream",
            json={"message": "Tell me about leg workouts"},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        # Chat should complete normally (TTS failure is non-fatal)
        event_types = [e["event"] for e in events]
        assert "message_start" in event_types
        assert "message_end" in event_types
        assert "error" not in event_types

        # message_end should have voice_error
        end_events = find_events(events, "message_end")
        end_data = end_events[0]["data"]

        assert end_data.get("voice_response") is None
        assert "voice_error" in end_data
        assert "ElevenLabs" in end_data["voice_error"]

    def test_tts_settings_change_applies_to_next_chat(
        self, client, tts_service, tts_settings_repo
    ):
        """After updating voice_id, next chat uses new voice."""
        # Setup: Start with default voice
        tts_settings_repo.set_settings(
            TEST_USER_ID,
            TTSSettings(
                tts_enabled=True,
                tts_voice_id="voice-rachel",
                tts_speed=1.0,
                tts_daily_chars_used=0,
            ),
        )

        # First chat uses Rachel
        response1 = client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )
        assert response1.status_code == 200
        assert tts_service.last_call["voice_id"] == "voice-rachel"

        # Update to Adam
        tts_settings_repo.set_settings(
            TEST_USER_ID,
            TTSSettings(
                tts_enabled=True,
                tts_voice_id="voice-adam",
                tts_speed=1.5,
                tts_daily_chars_used=0,
            ),
        )

        # Second chat should use Adam with new speed
        response2 = client.post(
            "/chat/stream",
            json={"message": "Hello again"},
        )
        assert response2.status_code == 200
        assert tts_service.last_call["voice_id"] == "voice-adam"
        assert tts_service.last_call["speed"] == 1.5


class TestVoiceChatRegression:
    """Extended voice+chat tests for nightly runs.

    These tests cover edge cases and less common scenarios.
    """

    def test_tts_tracks_daily_usage_across_chats(
        self, client, tts_service, tts_settings_repo
    ):
        """Multiple chats accumulate daily character usage."""
        tts_settings_repo.set_settings(
            TEST_USER_ID,
            TTSSettings(tts_enabled=True, tts_daily_chars_used=0),
        )

        # First chat
        client.post("/chat/stream", json={"message": "Hello"})
        usage_after_first = tts_settings_repo.get_settings(TEST_USER_ID).tts_daily_chars_used

        # Second chat
        client.post("/chat/stream", json={"message": "How are you?"})
        usage_after_second = tts_settings_repo.get_settings(TEST_USER_ID).tts_daily_chars_used

        # Usage should increase
        assert usage_after_second > usage_after_first

    def test_voice_response_contains_correct_metadata(
        self, client, tts_service, tts_settings_repo
    ):
        """voice_response includes all required fields with correct values."""
        tts_settings_repo.set_settings(
            TEST_USER_ID,
            TTSSettings(
                tts_enabled=True,
                tts_voice_id="voice-adam",
                tts_daily_chars_used=0,
            ),
        )

        response = client.post(
            "/chat/stream",
            json={"message": "Test message"},
        )

        events = parse_sse_events(response.text)
        end_events = find_events(events, "message_end")
        voice_response = end_events[0]["data"]["voice_response"]

        # Verify all fields present
        assert "audio_base64" in voice_response
        assert "duration_ms" in voice_response
        assert "voice_id" in voice_response
        assert "chars_used" in voice_response

        # Verify values are sensible
        assert len(voice_response["audio_base64"]) > 0
        assert voice_response["duration_ms"] > 0
        assert voice_response["voice_id"] == "voice-adam"
        assert voice_response["chars_used"] > 0

    def test_empty_ai_response_skips_tts(self, client, tts_service, tts_settings_repo, ai_client):
        """Empty AI response does not trigger TTS synthesis."""
        from backend.services.ai_client import StreamEvent

        tts_settings_repo.set_settings(
            TEST_USER_ID,
            TTSSettings(tts_enabled=True, tts_daily_chars_used=0),
        )

        # Configure AI to return empty response
        ai_client.response_events = [
            StreamEvent(event="message_end", data={
                "model": "claude-sonnet-4-20250514",
                "input_tokens": 100,
                "output_tokens": 0,
                "latency_ms": 500,
            }),
        ]

        response = client.post(
            "/chat/stream",
            json={"message": "..."},
        )

        assert response.status_code == 200
        events = parse_sse_events(response.text)

        # Chat completes
        event_types = [e["event"] for e in events]
        assert "message_end" in event_types

        # No TTS call for empty response
        assert tts_service.call_count == 0

    def test_session_continuity_preserves_tts_settings(
        self, client, tts_service, tts_settings_repo
    ):
        """TTS settings persist across multiple messages in same session."""
        tts_settings_repo.set_settings(
            TEST_USER_ID,
            TTSSettings(
                tts_enabled=True,
                tts_voice_id="voice-rachel",
                tts_speed=1.25,
                tts_daily_chars_used=0,
            ),
        )

        # First message creates session
        response1 = client.post(
            "/chat/stream",
            json={"message": "Start a conversation"},
        )
        events1 = parse_sse_events(response1.text)
        session_id = find_events(events1, "message_start")[0]["data"]["session_id"]

        # Remember first call settings
        first_voice = tts_service.last_call["voice_id"]
        first_speed = tts_service.last_call["speed"]

        # Second message in same session
        response2 = client.post(
            "/chat/stream",
            json={"message": "Continue the conversation", "session_id": session_id},
        )
        assert response2.status_code == 200

        # Settings should be consistent
        assert tts_service.last_call["voice_id"] == first_voice
        assert tts_service.last_call["speed"] == first_speed

    def test_near_limit_allows_synthesis_then_blocks(
        self, client, tts_service, tts_settings_repo
    ):
        """User near daily limit can synthesize until exceeded."""
        # Set usage very close to limit (AI response is ~30 chars)
        tts_settings_repo.set_settings(
            TEST_USER_ID,
            TTSSettings(
                tts_enabled=True,
                tts_daily_chars_used=49950,  # 50 chars remaining
            ),
        )

        # First chat should succeed (response fits in remaining)
        response1 = client.post(
            "/chat/stream",
            json={"message": "Hi"},
        )
        events1 = parse_sse_events(response1.text)
        end1 = find_events(events1, "message_end")[0]["data"]

        # Should have voice (or error if response too long)
        # The fake AI returns ~30 chars which should fit
        if end1.get("voice_response"):
            # Voice worked, usage increased
            usage = tts_settings_repo.get_settings(TEST_USER_ID).tts_daily_chars_used
            assert usage > 49950

            # Now should be over limit for next request
            response2 = client.post(
                "/chat/stream",
                json={"message": "Another message"},
            )
            events2 = parse_sse_events(response2.text)
            end2 = find_events(events2, "message_end")[0]["data"]

            # Should have voice_error now
            assert end2.get("voice_response") is None
            assert "voice_error" in end2
