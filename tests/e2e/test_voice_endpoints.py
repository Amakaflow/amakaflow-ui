"""E2E tests for Voice/TTS endpoints.

Part of AMA-442: Extend Voice Infrastructure for Chat Assistant (TTS)

Tests the /voice/* endpoints for TTS synthesis and settings management.
"""

import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from backend.main import create_app
from backend.settings import Settings
from api.deps import (
    get_auth_context,
    get_tts_service,
    get_tts_settings_repository,
    AuthContext,
)
from backend.services.tts_service import TTSResult, VoiceInfo
from infrastructure.db.tts_settings_repository import TTSSettings


# Test constants
TEST_USER_ID = "test-user-voice"


@pytest.fixture
def mock_auth_context():
    """Mock auth context for voice endpoints."""
    async def _mock():
        return AuthContext(user_id=TEST_USER_ID, auth_token="Bearer test-token")
    return _mock


@pytest.fixture
def mock_tts_service():
    """Create mock TTS service."""
    service = MagicMock()

    # Default successful synthesis
    service.synthesize.return_value = TTSResult(
        success=True,
        audio_data=b"fake-audio-data" * 100,
        duration_ms=2500,
        chars_used=50,
        provider="elevenlabs",
        voice_id="test-voice",
    )

    # Default voices list
    service.get_available_voices.return_value = [
        VoiceInfo(
            voice_id="voice-1",
            name="Rachel",
            preview_url="https://example.com/preview1.mp3",
            labels={"accent": "american", "gender": "female"},
        ),
        VoiceInfo(
            voice_id="voice-2",
            name="Adam",
            preview_url="https://example.com/preview2.mp3",
            labels={"accent": "british", "gender": "male"},
        ),
    ]

    # Default limit check - allowed
    service.check_daily_limit.return_value = (True, 40000)

    return service


@pytest.fixture
def mock_tts_settings_repo():
    """Create mock TTS settings repository."""
    repo = MagicMock()

    # Default settings
    repo.get_settings.return_value = TTSSettings(
        tts_enabled=True,
        tts_voice_id=None,
        tts_speed=1.0,
        tts_pitch=1.0,
        auto_play_responses=True,
        tts_daily_chars_used=10000,
    )

    repo.update_settings.return_value = TTSSettings(
        tts_enabled=True,
        tts_voice_id="custom-voice",
        tts_speed=1.25,
        tts_pitch=1.0,
        auto_play_responses=True,
        tts_daily_chars_used=10000,
    )

    repo.increment_daily_chars.return_value = 10050

    return repo


@pytest.fixture
def voice_client(mock_auth_context, mock_tts_service, mock_tts_settings_repo):
    """Create test client with mocked TTS dependencies."""
    # Clear cached functions before test
    get_tts_service.cache_clear()

    settings = Settings(
        environment="test",
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="test-key",
        elevenlabs_api_key="test-elevenlabs-key",
        tts_enabled=True,
        _env_file=None,
    )

    app = create_app(settings=settings)

    # Override dependencies - return the mock directly
    app.dependency_overrides[get_auth_context] = mock_auth_context
    app.dependency_overrides[get_tts_service] = lambda: mock_tts_service
    app.dependency_overrides[get_tts_settings_repository] = lambda: mock_tts_settings_repo

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()
    # Clear cache again after test
    get_tts_service.cache_clear()


class TestSynthesizeEndpoint:
    """Tests for POST /voice/synthesize endpoint."""

    def test_synthesize_returns_audio(self, voice_client, mock_tts_service):
        """Test successful synthesis returns audio/mpeg."""
        response = voice_client.post(
            "/voice/synthesize",
            json={"text": "Hello, this is a test."},
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/mpeg"
        assert "X-TTS-Duration-Ms" in response.headers
        assert "X-TTS-Chars-Used" in response.headers
        assert len(response.content) > 0

    def test_synthesize_with_custom_voice(self, voice_client, mock_tts_service):
        """Test synthesis with custom voice ID."""
        voice_client.post(
            "/voice/synthesize",
            json={"text": "Test", "voice_id": "custom-voice"},
        )

        mock_tts_service.synthesize.assert_called_once()
        call_kwargs = mock_tts_service.synthesize.call_args[1]
        assert call_kwargs["voice_id"] == "custom-voice"

    def test_synthesize_with_custom_speed(self, voice_client, mock_tts_service):
        """Test synthesis with custom speed."""
        voice_client.post(
            "/voice/synthesize",
            json={"text": "Test", "speed": 1.5},
        )

        mock_tts_service.synthesize.assert_called_once()
        call_kwargs = mock_tts_service.synthesize.call_args[1]
        assert call_kwargs["speed"] == 1.5

    def test_synthesize_validates_text_length(self, voice_client):
        """Test that text length is validated."""
        response = voice_client.post(
            "/voice/synthesize",
            json={"text": "x" * 3001},  # Over 3000 char limit
        )

        assert response.status_code == 422  # Validation error

    def test_synthesize_validates_speed_range(self, voice_client):
        """Test that speed is validated."""
        response = voice_client.post(
            "/voice/synthesize",
            json={"text": "Test", "speed": 5.0},  # Over 4.0 max
        )

        assert response.status_code == 422

    def test_synthesize_exactly_3000_chars_boundary(self, voice_client):
        """Test synthesis with exactly 3000 chars (boundary condition)."""
        response = voice_client.post(
            "/voice/synthesize",
            json={"text": "x" * 3000},  # Exactly at the limit
        )

        assert response.status_code == 200

    def test_synthesize_daily_limit_exceeded(
        self, voice_client, mock_tts_service, mock_tts_settings_repo
    ):
        """Test 429 when daily limit is exceeded."""
        mock_tts_service.check_daily_limit.return_value = (False, 100)

        response = voice_client.post(
            "/voice/synthesize",
            json={"text": "Test"},
        )

        assert response.status_code == 429
        assert "daily_limit_exceeded" in response.json()["detail"]["error"]

    def test_synthesize_tts_failure(self, voice_client, mock_tts_service):
        """Test 502 when TTS service fails."""
        mock_tts_service.synthesize.return_value = TTSResult(
            success=False,
            audio_data=None,
            duration_ms=None,
            chars_used=0,
            provider="elevenlabs",
            voice_id="test-voice",
            error="ElevenLabs API error",
        )

        response = voice_client.post(
            "/voice/synthesize",
            json={"text": "Test"},
        )

        assert response.status_code == 502
        assert "tts_failed" in response.json()["detail"]["error"]


class TestSynthesizeStreamingEndpoint:
    """Tests for POST /voice/synthesize with stream=true."""

    def test_synthesize_streaming_returns_audio_chunks(
        self, voice_client, mock_tts_service
    ):
        """Test streaming synthesis returns chunked audio."""
        mock_tts_service.synthesize_streaming.return_value = iter(
            [b"chunk1", b"chunk2", b"chunk3"]
        )

        response = voice_client.post(
            "/voice/synthesize",
            json={"text": "Test streaming", "stream": True},
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "audio/mpeg"
        assert "X-TTS-Chars-Used" in response.headers
        assert len(response.content) > 0

    def test_synthesize_streaming_tracks_usage(
        self, voice_client, mock_tts_service, mock_tts_settings_repo
    ):
        """Test streaming synthesis tracks character usage."""
        mock_tts_service.synthesize_streaming.return_value = iter([b"audio"])

        voice_client.post(
            "/voice/synthesize",
            json={"text": "Test text", "stream": True},
        )

        # Usage should be tracked based on text length
        mock_tts_settings_repo.increment_daily_chars.assert_called_once()


class TestSynthesizeJsonEndpoint:
    """Tests for POST /voice/synthesize/json endpoint."""

    def test_synthesize_json_returns_base64(self, voice_client):
        """Test JSON synthesis returns base64-encoded audio."""
        response = voice_client.post(
            "/voice/synthesize/json",
            json={"text": "Hello, this is a test."},
        )

        assert response.status_code == 200
        data = response.json()
        assert "audio_base64" in data
        assert "duration_ms" in data
        assert "voice_id" in data
        assert "chars_used" in data


class TestVoicesEndpoint:
    """Tests for GET /voice/voices endpoint."""

    def test_list_voices(self, voice_client):
        """Test listing available voices."""
        response = voice_client.get("/voice/voices")

        assert response.status_code == 200
        voices = response.json()
        assert len(voices) == 2
        assert voices[0]["voice_id"] == "voice-1"
        assert voices[0]["name"] == "Rachel"
        assert voices[1]["voice_id"] == "voice-2"
        assert voices[1]["name"] == "Adam"


class TestTTSSettingsEndpoints:
    """Tests for /voice/tts-settings endpoints."""

    def test_get_settings(self, voice_client):
        """Test getting TTS settings."""
        response = voice_client.get("/voice/tts-settings")

        assert response.status_code == 200
        data = response.json()
        assert data["tts_enabled"] is True
        assert data["tts_speed"] == 1.0
        assert "daily_chars_remaining" in data

    def test_update_settings(self, voice_client, mock_tts_settings_repo):
        """Test updating TTS settings."""
        response = voice_client.patch(
            "/voice/tts-settings",
            json={
                "tts_voice_id": "custom-voice",
                "tts_speed": 1.25,
            },
        )

        assert response.status_code == 200
        mock_tts_settings_repo.update_settings.assert_called_once()

    def test_update_settings_validates_speed(self, voice_client):
        """Test speed validation on settings update."""
        response = voice_client.patch(
            "/voice/tts-settings",
            json={"tts_speed": 0.1},  # Below 0.25 minimum
        )

        assert response.status_code == 422

    def test_update_settings_validates_pitch(self, voice_client):
        """Test pitch validation on settings update."""
        response = voice_client.patch(
            "/voice/tts-settings",
            json={"tts_pitch": 3.0},  # Above 2.0 maximum
        )

        assert response.status_code == 422


class TestUsageEndpoint:
    """Tests for GET /voice/usage endpoint."""

    def test_get_usage(self, voice_client):
        """Test getting usage information."""
        response = voice_client.get("/voice/usage")

        assert response.status_code == 200
        data = response.json()
        assert "daily_chars_used" in data
        assert "daily_chars_remaining" in data
        assert "daily_char_limit" in data


class TestTTSServiceNotConfigured:
    """Tests when TTS service is not configured."""

    @pytest.fixture
    def no_tts_client(self, mock_auth_context, mock_tts_settings_repo):
        """Create test client with TTS service returning None."""
        settings = Settings(
            environment="test",
            supabase_url="https://test.supabase.co",
            supabase_service_role_key="test-key",
            elevenlabs_api_key=None,  # Not configured
            tts_enabled=False,
            _env_file=None,
        )

        app = create_app(settings=settings)

        app.dependency_overrides[get_auth_context] = mock_auth_context
        app.dependency_overrides[get_tts_service] = lambda: None
        app.dependency_overrides[get_tts_settings_repository] = lambda: mock_tts_settings_repo

        with TestClient(app) as client:
            yield client

        app.dependency_overrides.clear()

    def test_synthesize_503_when_not_configured(self, no_tts_client):
        """Test 503 when TTS service not configured."""
        response = no_tts_client.post(
            "/voice/synthesize",
            json={"text": "Test"},
        )

        assert response.status_code == 503
        assert "not available" in response.json()["detail"]

    def test_voices_503_when_not_configured(self, no_tts_client):
        """Test 503 for voices endpoint when not configured."""
        response = no_tts_client.get("/voice/voices")

        assert response.status_code == 503
