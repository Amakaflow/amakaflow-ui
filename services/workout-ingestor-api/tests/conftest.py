"""
Test fixtures for workout-ingestor-api.

Provides mock fixtures for external services (OpenAI, YouTube, TikTok, etc.)
to enable fast, deterministic, offline testing.
"""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch
from typing import Dict, Any

import pytest
from fastapi.testclient import TestClient

# Repo root: .../amakaflow-dev/workout-ingestor-api
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

# Make src/ importable so tests can do `import workout_ingestor_api...`
for p in {ROOT, SRC}:
    p_str = str(p)
    if p_str not in sys.path:
        sys.path.insert(0, p_str)

# Import FastAPI app (main.py at repo root)
from main import app  # noqa: E402
from workout_ingestor_api.auth import get_current_user, get_user_with_metadata  # noqa: E402


# ---------------------------------------------------------------------------
# Auth Mock
# ---------------------------------------------------------------------------


TEST_USER_ID = "test-user-123"


async def mock_get_current_user() -> str:
    """Mock auth dependency that returns a test user."""
    return TEST_USER_ID


async def mock_get_user_with_metadata() -> dict:
    """Mock auth dependency that returns a test user with pro subscription."""
    return {"user_id": TEST_USER_ID, "metadata": {"subscription": "pro"}}


# ---------------------------------------------------------------------------
# Core Test Client
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def api_client() -> TestClient:
    """Shared FastAPI TestClient for workout-ingestor-api."""
    # Override auth dependency for all tests
    app.dependency_overrides[get_current_user] = mock_get_current_user
    app.dependency_overrides[get_user_with_metadata] = mock_get_user_with_metadata
    return TestClient(app)


@pytest.fixture
def client() -> TestClient:
    """Per-test FastAPI TestClient (for tests needing fresh state)."""
    # Override auth dependency for all tests
    app.dependency_overrides[get_current_user] = mock_get_current_user
    app.dependency_overrides[get_user_with_metadata] = mock_get_user_with_metadata
    return TestClient(app)


# ---------------------------------------------------------------------------
# Sample Data Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_workout_dict() -> Dict[str, Any]:
    """Standard workout dictionary for testing."""
    return {
        "title": "Test Workout",
        "source": "https://example.com/workout",
        "blocks": [
            {
                "label": "Warm-up",
                "structure": "regular",
                "exercises": [
                    {
                        "name": "Jumping Jacks",
                        "sets": 1,
                        "reps": 30,
                        "type": "cardio",
                    }
                ],
            },
            {
                "label": "Main Workout",
                "structure": "regular",
                "exercises": [
                    {
                        "name": "Barbell Squats",
                        "sets": 4,
                        "reps": 8,
                        "type": "strength",
                    },
                    {
                        "name": "Bench Press",
                        "sets": 4,
                        "reps": 10,
                        "type": "strength",
                    },
                    {
                        "name": "Deadlifts",
                        "sets": 3,
                        "reps": 5,
                        "type": "strength",
                    },
                ],
            },
        ],
    }


@pytest.fixture
def sample_workout_json() -> str:
    """Sample workout as JSON string for LLM mock responses."""
    import json
    return json.dumps({
        "title": "Full Body Workout",
        "blocks": [
            {
                "label": "Workout",
                "structure": "regular",
                "exercises": [
                    {"name": "Push-ups", "sets": 3, "reps": 15, "type": "strength"},
                    {"name": "Squats", "sets": 3, "reps": 20, "type": "strength"},
                    {"name": "Plank", "duration_sec": 60, "type": "strength"},
                ],
            }
        ],
    })


@pytest.fixture
def sample_amrap_workout() -> Dict[str, Any]:
    """Sample AMRAP workout structure."""
    return {
        "title": "20 Min AMRAP",
        "blocks": [
            {
                "label": "AMRAP",
                "structure": "amrap",
                "time_cap_sec": 1200,
                "exercises": [
                    {"name": "Air Squats", "reps": 15, "type": "strength"},
                    {"name": "Push-ups", "reps": 10, "type": "strength"},
                    {"name": "Pull-ups", "reps": 5, "type": "strength"},
                ],
            }
        ],
    }


@pytest.fixture
def sample_emom_workout() -> Dict[str, Any]:
    """Sample EMOM workout structure."""
    return {
        "title": "10 Min EMOM",
        "blocks": [
            {
                "label": "EMOM",
                "structure": "emom",
                "rounds": 10,
                "time_work_sec": 60,
                "exercises": [
                    {"name": "Burpees", "reps": 10, "type": "cardio"},
                ],
            }
        ],
    }


# ---------------------------------------------------------------------------
# OpenAI Mock Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_openai_response(sample_workout_json):
    """Mock OpenAI chat completion response."""
    mock_response = MagicMock()
    mock_response.choices = [
        MagicMock(message=MagicMock(content=sample_workout_json))
    ]
    return mock_response


@pytest.fixture
def mock_openai_client(mock_openai_response):
    """Mock the OpenAI client for LLM parsing tests."""
    with patch("openai.OpenAI") as mock_class:
        mock_instance = MagicMock()
        mock_instance.chat.completions.create.return_value = mock_openai_response
        mock_class.return_value = mock_instance
        yield mock_instance


# ---------------------------------------------------------------------------
# YouTube Mock Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_youtube_metadata() -> Dict[str, Any]:
    """Mock yt-dlp extract_info response for YouTube."""
    return {
        "id": "dQw4w9WgXcQ",
        "title": "30 Minute Full Body Workout",
        "description": "Complete workout routine with exercises",
        "duration": 1800,
        "uploader": "FitnessChannel",
        "upload_date": "20240101",
        "view_count": 1000000,
        "like_count": 50000,
        "chapters": [],
    }


@pytest.fixture
def mock_youtube_transcript() -> str:
    """Mock YouTube transcript text."""
    return """
    Today we're doing a full body workout.
    First exercise: 3 sets of 10 squats.
    Rest 60 seconds between sets.
    Next up: 4 sets of 12 push-ups.
    Keep your core tight throughout.
    Last exercise: 3 sets of 8 lunges per leg.
    """


@pytest.fixture
def mock_ytdlp(mock_youtube_metadata):
    """Mock yt-dlp YoutubeDL for YouTube tests."""
    with patch("yt_dlp.YoutubeDL") as mock_class:
        mock_instance = MagicMock()
        mock_instance.__enter__ = MagicMock(return_value=mock_instance)
        mock_instance.__exit__ = MagicMock(return_value=False)
        mock_instance.extract_info.return_value = mock_youtube_metadata
        mock_class.return_value = mock_instance
        yield mock_instance


# ---------------------------------------------------------------------------
# TikTok Mock Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_tiktok_metadata():
    """Mock TikTok metadata response."""
    from workout_ingestor_api.services.tiktok_service import TikTokVideoMetadata
    return TikTokVideoMetadata(
        video_id="7575571317500546322",
        url="https://www.tiktok.com/@fitnessguru/video/7575571317500546322",
        title="Quick 5 Minute Ab Workout #fitness #abs #workout",
        author_name="fitnessguru",
        author_url="https://www.tiktok.com/@fitnessguru",
        hashtags=["fitness", "abs", "workout"],
    )


@pytest.fixture
def mock_tiktok_service(mock_tiktok_metadata, tmp_path):
    """Mock TikTok service for ingestion tests."""
    with patch.multiple(
        "workout_ingestor_api.services.tiktok_service.TikTokService",
        extract_metadata=MagicMock(return_value=mock_tiktok_metadata),
        download_video=MagicMock(return_value=str(tmp_path / "video.mp4")),
        is_tiktok_url=MagicMock(return_value=True),
    ):
        yield


# ---------------------------------------------------------------------------
# Instagram Mock Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_instagram_images(tmp_path) -> list:
    """Create mock image files for Instagram tests."""
    from PIL import Image

    images = []
    for i in range(2):
        img_path = tmp_path / f"instagram_{i}.jpg"
        # Create a simple test image
        img = Image.new("RGB", (800, 800), color="white")
        img.save(img_path, "JPEG")
        images.append(str(img_path))

    return images


@pytest.fixture
def mock_instagram_service(mock_instagram_images):
    """Mock Instagram service for ingestion tests."""
    with patch(
        "workout_ingestor_api.services.instagram_service.InstagramService.download_post_images_no_login",
        return_value=mock_instagram_images,
    ):
        yield


# ---------------------------------------------------------------------------
# OCR Mock Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_ocr_text() -> str:
    """Mock OCR extracted text from workout image."""
    return """
    UPPER BODY WORKOUT

    Bench Press 4x10
    Shoulder Press 3x12
    Bicep Curls 3x15

    Rest 90 seconds
    """


@pytest.fixture
def mock_ocr_service(mock_ocr_text):
    """Mock OCR service for image ingestion tests."""
    with patch(
        "workout_ingestor_api.services.ocr_service.OCRService.ocr_image_bytes",
        return_value=mock_ocr_text,
    ):
        yield


# ---------------------------------------------------------------------------
# Vision Service Mock Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_vision_workout_dict() -> Dict[str, Any]:
    """Mock Vision API workout extraction result."""
    return {
        "title": "Vision Extracted Workout",
        "blocks": [
            {
                "label": "Workout",
                "structure": "regular",
                "exercises": [
                    {"name": "Dumbbell Rows", "sets": 3, "reps": 12, "type": "strength"},
                    {"name": "Lat Pulldowns", "sets": 3, "reps": 10, "type": "strength"},
                ],
            }
        ],
    }


@pytest.fixture
def mock_vision_service(mock_vision_workout_dict):
    """Mock Vision service for image/video ingestion tests."""
    with patch(
        "workout_ingestor_api.services.vision_service.VisionService.extract_and_structure_workout_openai",
        return_value=mock_vision_workout_dict,
    ):
        yield


# ---------------------------------------------------------------------------
# Supabase Cache Mock Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_supabase_cache_hit(sample_workout_dict):
    """Mock Supabase cache with a cached workout."""
    with patch(
        "workout_ingestor_api.services.youtube_cache_service.YouTubeCacheService.get_cached_workout",
        return_value={
            "workout_data": sample_workout_dict,
            "cache_hits": 5,
        },
    ):
        yield


@pytest.fixture
def mock_supabase_cache_miss():
    """Mock Supabase cache with no cached workout."""
    with patch(
        "workout_ingestor_api.services.youtube_cache_service.YouTubeCacheService.get_cached_workout",
        return_value=None,
    ), patch(
        "workout_ingestor_api.services.youtube_cache_service.YouTubeCacheService.save_workout",
        return_value=True,
    ):
        yield


# ---------------------------------------------------------------------------
# ASR (Audio Transcription) Mock Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_asr_transcript() -> Dict[str, Any]:
    """Mock ASR transcription result."""
    return {
        "text": "This workout includes 3 sets of 10 squats, followed by 4 sets of 12 push-ups.",
        "language": "en",
        "duration": 45.5,
    }


@pytest.fixture
def mock_asr_service(mock_asr_transcript, tmp_path):
    """Mock ASR service for TikTok audio transcription tests."""
    with patch.multiple(
        "workout_ingestor_api.services.asr_service.ASRService",
        extract_audio=MagicMock(return_value=str(tmp_path / "audio.mp3")),
        transcribe_with_openai_api=MagicMock(return_value=mock_asr_transcript),
    ):
        yield


# ---------------------------------------------------------------------------
# Video Service Mock Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_video_service():
    """Mock video service for frame extraction."""
    with patch(
        "workout_ingestor_api.services.video_service.VideoService.sample_frames",
        return_value=None,
    ):
        yield


# ---------------------------------------------------------------------------
# Environment Variables
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def mock_env_vars(monkeypatch):
    """Set mock environment variables for tests."""
    monkeypatch.setenv("OPENAI_API_KEY", "test-api-key")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-anthropic-key")
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_KEY", "test-supabase-key")
