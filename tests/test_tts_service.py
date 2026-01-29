"""Unit tests for TTS Service.

Part of AMA-442: Extend Voice Infrastructure for Chat Assistant (TTS)
"""

import pytest
from unittest.mock import MagicMock, patch

from backend.services.tts_service import TTSService, TTSResult, VoiceInfo


class TestTTSService:
    """Test suite for TTSService."""

    @pytest.fixture
    def mock_elevenlabs_client(self):
        """Create mock ElevenLabs client."""
        mock_client = MagicMock()
        return mock_client

    @pytest.fixture
    def tts_service(self, mock_elevenlabs_client):
        """Create TTSService with mocked client."""
        with patch("backend.services.tts_service.ElevenLabs") as mock_class:
            mock_class.return_value = mock_elevenlabs_client
            service = TTSService(
                api_key="test-api-key",
                default_voice_id="test-voice-id",
                daily_char_limit=50000,
            )
            service._client = mock_elevenlabs_client
            return service

    def test_synthesize_success(self, tts_service, mock_elevenlabs_client):
        """Test successful audio synthesis."""
        # Mock audio response
        mock_audio = b"fake-audio-data" * 1000
        mock_elevenlabs_client.text_to_speech.convert.return_value = iter([mock_audio])

        result = tts_service.synthesize(
            text="Hello, this is a test.",
            voice_id="test-voice",
            speed=1.0,
        )

        assert result.success is True
        assert result.audio_data == mock_audio
        assert result.chars_used == len("Hello, this is a test.")
        assert result.voice_id == "test-voice"
        assert result.provider == "elevenlabs"
        assert result.error is None

    def test_synthesize_uses_default_voice(self, tts_service, mock_elevenlabs_client):
        """Test that default voice is used when not specified."""
        mock_elevenlabs_client.text_to_speech.convert.return_value = iter([b"audio"])

        tts_service.synthesize(text="Test", voice_id=None)

        mock_elevenlabs_client.text_to_speech.convert.assert_called_once()
        call_kwargs = mock_elevenlabs_client.text_to_speech.convert.call_args[1]
        assert call_kwargs["voice_id"] == "test-voice-id"

    def test_synthesize_api_error(self, tts_service, mock_elevenlabs_client):
        """Test handling of API errors."""
        from elevenlabs.core import ApiError

        mock_elevenlabs_client.text_to_speech.convert.side_effect = ApiError(
            status_code=429,
            body={"error": "Rate limit exceeded"},
        )

        result = tts_service.synthesize(text="Test")

        assert result.success is False
        assert result.audio_data is None
        assert result.chars_used == 0
        assert "TTS service error" in result.error

    def test_synthesize_unexpected_error(self, tts_service, mock_elevenlabs_client):
        """Test handling of unexpected errors."""
        mock_elevenlabs_client.text_to_speech.convert.side_effect = Exception(
            "Network error"
        )

        result = tts_service.synthesize(text="Test")

        assert result.success is False
        assert result.audio_data is None
        assert result.error == "TTS service temporarily unavailable"


class TestTTSServiceTextTruncation:
    """Test text truncation logic."""

    @pytest.fixture
    def tts_service(self):
        """Create TTSService with mocked client."""
        with patch("backend.services.tts_service.ElevenLabs"):
            return TTSService(api_key="test-key")

    def test_truncate_at_sentence_boundary(self, tts_service):
        """Test truncation at sentence boundary."""
        text = "First sentence. Second sentence. Third sentence."
        result = tts_service._truncate_at_sentence(text, 30)

        # Should end at a complete sentence
        assert result.endswith(".")
        assert len(result) <= 30

    def test_truncate_at_word_boundary(self, tts_service):
        """Test truncation at word boundary when no sentence found."""
        text = "This is a long text without any sentence endings anywhere"
        result = tts_service._truncate_at_sentence(text, 25)

        # Should end at word boundary with ellipsis
        assert result.endswith("...")
        assert " " not in result[-4:]  # No space before ellipsis

    def test_truncate_short_text(self, tts_service):
        """Test that short text is not truncated."""
        text = "Short text."
        result = tts_service._truncate_at_sentence(text, 100)

        assert result == text

    def test_truncate_preserves_question_marks(self, tts_service):
        """Test truncation preserves question marks as sentence endings."""
        text = "Is this working? Yes it is! Great."
        result = tts_service._truncate_at_sentence(text, 20)

        assert result in ["Is this working?", "Is this working? "]


class TestTTSServiceDailyLimit:
    """Test daily character limit checking."""

    @pytest.fixture
    def tts_service(self):
        """Create TTSService with specific daily limit."""
        with patch("backend.services.tts_service.ElevenLabs"):
            return TTSService(api_key="test-key", daily_char_limit=1000)

    def test_check_daily_limit_allowed(self, tts_service):
        """Test check when within limit."""
        allowed, remaining = tts_service.check_daily_limit(
            chars_used=500,
            chars_needed=200,
        )

        assert allowed is True
        assert remaining == 500

    def test_check_daily_limit_exceeded(self, tts_service):
        """Test check when limit would be exceeded."""
        allowed, remaining = tts_service.check_daily_limit(
            chars_used=900,
            chars_needed=200,
        )

        assert allowed is False
        assert remaining == 100

    def test_check_daily_limit_at_boundary(self, tts_service):
        """Test check at exact boundary."""
        allowed, remaining = tts_service.check_daily_limit(
            chars_used=800,
            chars_needed=200,
        )

        assert allowed is True
        assert remaining == 200


class TestTTSServiceVoices:
    """Test voice listing."""

    @pytest.fixture
    def mock_elevenlabs_client(self):
        """Create mock ElevenLabs client with voices."""
        mock_client = MagicMock()

        # Mock voice objects
        mock_voice1 = MagicMock()
        mock_voice1.voice_id = "voice-1"
        mock_voice1.name = "Rachel"
        mock_voice1.preview_url = "https://example.com/preview1.mp3"
        mock_voice1.labels = {"accent": "american", "gender": "female"}

        mock_voice2 = MagicMock()
        mock_voice2.voice_id = "voice-2"
        mock_voice2.name = "Adam"
        mock_voice2.preview_url = "https://example.com/preview2.mp3"
        mock_voice2.labels = {"accent": "british", "gender": "male"}

        mock_response = MagicMock()
        mock_response.voices = [mock_voice1, mock_voice2]
        mock_client.voices.get_all.return_value = mock_response

        return mock_client

    @pytest.fixture
    def tts_service(self, mock_elevenlabs_client):
        """Create TTSService with mocked client."""
        with patch("backend.services.tts_service.ElevenLabs") as mock_class:
            mock_class.return_value = mock_elevenlabs_client
            service = TTSService(api_key="test-key")
            service._client = mock_elevenlabs_client
            return service

    def test_get_available_voices(self, tts_service):
        """Test getting list of available voices."""
        voices = tts_service.get_available_voices()

        assert len(voices) == 2
        assert voices[0].voice_id == "voice-1"
        assert voices[0].name == "Rachel"
        assert voices[0].labels["accent"] == "american"
        assert voices[1].voice_id == "voice-2"
        assert voices[1].name == "Adam"

    def test_get_available_voices_error(self, tts_service, mock_elevenlabs_client):
        """Test error handling when fetching voices fails."""
        mock_elevenlabs_client.voices.get_all.side_effect = Exception("API Error")

        voices = tts_service.get_available_voices()

        assert voices == []


class TestTTSServiceStreaming:
    """Test streaming synthesis."""

    @pytest.fixture
    def mock_elevenlabs_client(self):
        """Create mock ElevenLabs client for streaming."""
        mock_client = MagicMock()
        return mock_client

    @pytest.fixture
    def tts_service(self, mock_elevenlabs_client):
        """Create TTSService with mocked client."""
        with patch("backend.services.tts_service.ElevenLabs") as mock_class:
            mock_class.return_value = mock_elevenlabs_client
            service = TTSService(api_key="test-key")
            service._client = mock_elevenlabs_client
            return service

    def test_synthesize_streaming(self, tts_service, mock_elevenlabs_client):
        """Test streaming audio synthesis."""
        # Mock streaming response
        chunks = [b"chunk1" * 1000, b"chunk2" * 1000, b"chunk3" * 500]
        mock_elevenlabs_client.text_to_speech.convert.return_value = iter(chunks)

        result_chunks = list(
            tts_service.synthesize_streaming(
                text="Test text",
                chunk_size=2000,
            )
        )

        # Should yield chunks of approximately the requested size
        assert len(result_chunks) > 0
        total_data = b"".join(result_chunks)
        assert len(total_data) == sum(len(c) for c in chunks)

    def test_synthesize_streaming_error(self, tts_service, mock_elevenlabs_client):
        """Test streaming handles errors gracefully."""
        mock_elevenlabs_client.text_to_speech.convert.side_effect = Exception("Error")

        result_chunks = list(tts_service.synthesize_streaming(text="Test"))

        # Should return empty iterator on error
        assert result_chunks == []
