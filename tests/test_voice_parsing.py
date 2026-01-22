"""
Tests for voice-to-workout parsing endpoint (AMA-5).

Tests the /workouts/parse-voice endpoint that converts natural language
workout descriptions into structured workout data.
"""

import json
import pytest
from unittest.mock import patch, MagicMock


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_openai_voice_response():
    """Mock OpenAI chat completion response for voice parsing."""
    return {
        "name": "4x400m Interval Workout",
        "sport": "running",
        "duration": 2100,
        "description": "400m repeats at 5K pace with 90s recovery",
        "source": "ai",
        "sourceUrl": None,
        "intervals": [
            {"kind": "warmup", "seconds": 300, "target": "Easy jog"},
            {
                "kind": "repeat",
                "reps": 4,
                "intervals": [
                    {"kind": "distance", "meters": 400, "target": "5K pace"},
                    {"kind": "time", "seconds": 90, "target": "Rest"},
                ],
            },
            {"kind": "cooldown", "seconds": 600, "target": "Easy jog"},
        ],
        "confidence": 0.92,
        "suggestions": ["Consider specifying exact pace targets"],
    }


@pytest.fixture
def mock_openai_voice_client(mock_openai_voice_response):
    """Mock the AIClientFactory for voice parsing tests.

    After the Helicone integration (PR #34), the voice parsing service
    now uses AIClientFactory.create_openai_client() instead of directly
    instantiating the OpenAI client.
    """
    with patch("workout_ingestor_api.services.voice_parsing_service.AIClientFactory") as mock_factory:
        mock_client = MagicMock()
        mock_choice = MagicMock()
        mock_choice.message.content = json.dumps(mock_openai_voice_response)
        mock_response = MagicMock()
        mock_response.choices = [mock_choice]
        mock_client.chat.completions.create.return_value = mock_response
        mock_factory.create_openai_client.return_value = mock_client
        yield mock_client


@pytest.fixture
def mock_openai_available():
    """Mock openai as available."""
    with patch(
        "workout_ingestor_api.services.voice_parsing_service.OPENAI_AVAILABLE",
        True,
    ):
        yield


# ---------------------------------------------------------------------------
# Endpoint Tests
# ---------------------------------------------------------------------------


class TestParseVoiceEndpoint:
    """Tests for /workouts/parse-voice endpoint."""

    def test_parse_running_workout(
        self, client, mock_openai_voice_client, mock_openai_available, monkeypatch
    ):
        """Test parsing a running interval workout."""
        monkeypatch.setenv("OPENAI_API_KEY", "test-api-key")

        response = client.post(
            "/workouts/parse-voice",
            json={
                "transcription": "5 minute warmup jog, then 4 sets of 400 meters at 5k pace with 90 seconds rest between each, then 10 minute cooldown",
                "sport_hint": "running",
            },
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert "workout" in data
        assert data["workout"]["sport"] == "running"
        assert len(data["workout"]["intervals"]) > 0
        assert "confidence" in data
        assert data["confidence"] >= 0.0 and data["confidence"] <= 1.0
        assert "suggestions" in data

    def test_parse_strength_workout(
        self, client, mock_openai_available, monkeypatch
    ):
        """Test parsing a strength workout."""
        monkeypatch.setenv("OPENAI_API_KEY", "test-api-key")

        # Mock response for strength workout
        strength_response = {
            "name": "Lower Body Strength",
            "sport": "strength",
            "duration": 2400,
            "description": "Squats and Romanian deadlifts workout",
            "source": "ai",
            "sourceUrl": None,
            "intervals": [
                {
                    "kind": "reps",
                    "reps": 8,
                    "name": "Barbell Squat",
                    "sets": 4,
                    "load": "185 lbs",
                    "restSec": 90,
                },
                {
                    "kind": "reps",
                    "reps": 10,
                    "name": "Romanian Deadlift",
                    "sets": 3,
                    "load": "135 lbs",
                    "restSec": 90,
                },
            ],
            "confidence": 0.92,
            "suggestions": ["Rest periods estimated at 90 seconds"],
        }

        with patch("workout_ingestor_api.services.voice_parsing_service.AIClientFactory") as mock_factory:
            mock_client = MagicMock()
            mock_choice = MagicMock()
            mock_choice.message.content = json.dumps(strength_response)
            mock_response = MagicMock()
            mock_response.choices = [mock_choice]
            mock_client.chat.completions.create.return_value = mock_response
            mock_factory.create_openai_client.return_value = mock_client

            response = client.post(
                "/workouts/parse-voice",
                json={
                    "transcription": "Strength workout: 4 sets of 8 squats at 185 pounds, then 3 sets of 10 Romanian deadlifts at 135",
                    "sport_hint": "strength",
                },
            )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["workout"]["sport"] == "strength"
        assert len(data["workout"]["intervals"]) == 2
        assert data["workout"]["intervals"][0]["kind"] == "reps"

    def test_parse_without_sport_hint(
        self, client, mock_openai_voice_client, mock_openai_available, monkeypatch
    ):
        """Test parsing without sport_hint - should still work."""
        monkeypatch.setenv("OPENAI_API_KEY", "test-api-key")

        response = client.post(
            "/workouts/parse-voice",
            json={
                "transcription": "30 minute easy run at zone 2 pace",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_parse_empty_transcription(self, client):
        """Test parsing with empty transcription returns error."""
        response = client.post(
            "/workouts/parse-voice",
            json={"transcription": ""},
        )

        # Should return 422 or 500 depending on validation
        assert response.status_code in [422, 500]

    def test_parse_too_short_transcription(self, client, mock_openai_available, monkeypatch):
        """Test parsing with very short transcription returns error."""
        monkeypatch.setenv("OPENAI_API_KEY", "test-api-key")

        response = client.post(
            "/workouts/parse-voice",
            json={"transcription": "run"},
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert "error" in data

    def test_parse_missing_api_key(self, client, mock_openai_available, monkeypatch):
        """Test parsing without API key returns error."""
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)

        response = client.post(
            "/workouts/parse-voice",
            json={
                "transcription": "5 minute warmup then 10 x 100m sprints",
            },
        )

        assert response.status_code == 500


# ---------------------------------------------------------------------------
# Service Unit Tests
# ---------------------------------------------------------------------------


class TestVoiceParsingService:
    """Unit tests for VoiceParsingService."""

    def test_service_handles_json_in_markdown(
        self, mock_openai_available, monkeypatch
    ):
        """Test that service extracts JSON from markdown-wrapped response."""
        monkeypatch.setenv("OPENAI_API_KEY", "test-api-key")

        markdown_response = """Here's the parsed workout:

```json
{
    "name": "Quick HIIT",
    "sport": "hiit",
    "duration": 600,
    "description": "10 minute HIIT session",
    "source": "ai",
    "sourceUrl": null,
    "intervals": [
        {"kind": "time", "seconds": 30, "target": "Work"},
        {"kind": "time", "seconds": 30, "target": "Rest"}
    ],
    "confidence": 0.85,
    "suggestions": []
}
```

Let me know if you need any adjustments!"""

        with patch("workout_ingestor_api.services.voice_parsing_service.AIClientFactory") as mock_factory:
            mock_client = MagicMock()
            mock_choice = MagicMock()
            mock_choice.message.content = markdown_response
            mock_response = MagicMock()
            mock_response.choices = [mock_choice]
            mock_client.chat.completions.create.return_value = mock_response
            mock_factory.create_openai_client.return_value = mock_client

            from workout_ingestor_api.services.voice_parsing_service import (
                VoiceParsingService,
            )

            result = VoiceParsingService.parse_voice_workout(
                transcription="30 seconds work, 30 seconds rest, repeat 10 times"
            )

        assert result.success is True
        assert result.workout is not None
        assert result.workout["sport"] == "hiit"

    def test_service_returns_error_for_invalid_json(
        self, mock_openai_available, monkeypatch
    ):
        """Test that service handles invalid JSON response gracefully."""
        monkeypatch.setenv("OPENAI_API_KEY", "test-api-key")

        with patch("workout_ingestor_api.services.voice_parsing_service.AIClientFactory") as mock_factory:
            mock_client = MagicMock()
            mock_choice = MagicMock()
            mock_choice.message.content = "This is not valid JSON at all"
            mock_response = MagicMock()
            mock_response.choices = [mock_choice]
            mock_client.chat.completions.create.return_value = mock_response
            mock_factory.create_openai_client.return_value = mock_client

            from workout_ingestor_api.services.voice_parsing_service import (
                VoiceParsingService,
            )

            result = VoiceParsingService.parse_voice_workout(
                transcription="some workout description"
            )

        assert result.success is False
        assert result.error is not None


# ---------------------------------------------------------------------------
# Response Format Tests
# ---------------------------------------------------------------------------


class TestResponseFormat:
    """Tests for response format matching iOS expectations."""

    def test_workout_has_required_fields(
        self, client, mock_openai_voice_client, mock_openai_available, monkeypatch
    ):
        """Test that workout response has all required iOS fields."""
        monkeypatch.setenv("OPENAI_API_KEY", "test-api-key")

        response = client.post(
            "/workouts/parse-voice",
            json={
                "transcription": "5 minute warmup, 4x400m at 5k pace, 10 minute cooldown",
                "sport_hint": "running",
            },
        )

        assert response.status_code == 200
        data = response.json()
        workout = data["workout"]

        # Check required fields per AMA-5 spec
        assert "id" in workout or "name" in workout  # One of these required
        assert "name" in workout
        assert "sport" in workout
        assert "duration" in workout
        assert "description" in workout
        assert "source" in workout
        assert "intervals" in workout
        assert isinstance(workout["intervals"], list)

    def test_interval_types_match_spec(
        self, client, mock_openai_voice_client, mock_openai_available, monkeypatch
    ):
        """Test that interval types match AMA-5 specification."""
        monkeypatch.setenv("OPENAI_API_KEY", "test-api-key")

        response = client.post(
            "/workouts/parse-voice",
            json={
                "transcription": "5 minute warmup, 4x400m at 5k pace, 10 minute cooldown",
                "sport_hint": "running",
            },
        )

        data = response.json()
        intervals = data["workout"]["intervals"]

        valid_kinds = {"warmup", "cooldown", "time", "distance", "reps", "repeat"}

        for interval in intervals:
            assert "kind" in interval
            assert interval["kind"] in valid_kinds

            # Check kind-specific required fields
            if interval["kind"] == "warmup" or interval["kind"] == "cooldown":
                assert "seconds" in interval
            elif interval["kind"] == "time":
                assert "seconds" in interval
            elif interval["kind"] == "distance":
                assert "meters" in interval
            elif interval["kind"] == "reps":
                assert "reps" in interval
                assert "name" in interval
            elif interval["kind"] == "repeat":
                assert "reps" in interval
                assert "intervals" in interval
