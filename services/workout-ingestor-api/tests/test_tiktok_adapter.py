"""Tests for TikTokAdapter — three-tier fallback: transcript → vision → oEmbed."""
from unittest.mock import patch

import pytest

from workout_ingestor_api.services.adapters.base import MediaContent, PlatformFetchError
from workout_ingestor_api.services.adapters.tiktok_adapter import (
    TRANSCRIPT_MIN_CHARS,
    TikTokAdapter,
)
from workout_ingestor_api.services.tiktok_service import TikTokVideoMetadata


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

MOCK_METADATA = TikTokVideoMetadata(
    video_id="7575571317500546322",
    url="https://www.tiktok.com/@user/video/7575571317500546322",
    title="5 rounds: squats push-ups burpees #fitness #workout",
    author_name="fitnessguru",
    author_url="https://tiktok.com/@fitnessguru",
    hashtags=["fitness", "workout"],
    duration_seconds=45.0,
    thumbnail_url="https://p16-sign.tiktokcdn.com/thumb.jpg",
)

EMPTY_METADATA = TikTokVideoMetadata(
    video_id="000",
    url="https://www.tiktok.com/@x/video/000",
    title="   ",
    author_name="x",
    author_url="",
    hashtags=[],
)

PATCH_EXTRACT_METADATA = (
    "workout_ingestor_api.services.adapters.tiktok_adapter.TikTokService.extract_metadata"
)
PATCH_DOWNLOAD_VIDEO = (
    "workout_ingestor_api.services.adapters.tiktok_adapter.TikTokService.download_video"
)
PATCH_ASR_EXTRACT_AUDIO = (
    "workout_ingestor_api.services.adapters.tiktok_adapter.ASRService.extract_audio"
)
PATCH_ASR_TRANSCRIBE = (
    "workout_ingestor_api.services.adapters.tiktok_adapter.ASRService.transcribe_with_openai_api"
)
PATCH_VIDEO_SERVICE_SAMPLE = (
    "workout_ingestor_api.services.adapters.tiktok_adapter.VideoService.sample_frames"
)
PATCH_VISION_SERVICE = (
    "workout_ingestor_api.services.adapters.tiktok_adapter.VisionService.extract_text_from_images"
)
PATCH_TEMPFILE_MKDTEMP = (
    "workout_ingestor_api.services.adapters.tiktok_adapter.tempfile.mkdtemp"
)
PATCH_SHUTIL_RMTREE = (
    "workout_ingestor_api.services.adapters.tiktok_adapter.shutil.rmtree"
)
PATCH_OS_LISTDIR = (
    "workout_ingestor_api.services.adapters.tiktok_adapter.os.listdir"
)

_LONG_TRANSCRIPT = (
    "Do 3 sets of 10 squats. Then 3 sets of 8 push-ups. "
    "Finish with 3 sets of 15 burpees. Rest 60 seconds between sets."
)
assert len(_LONG_TRANSCRIPT) >= 50, "fixture transcript must be >= 50 chars"

_SHORT_TRANSCRIPT = "short"
assert len(_SHORT_TRANSCRIPT) < 50, "fixture transcript must be < 50 chars"

_VISION_TEXT = (
    "Workout: squat x10, lunge x10, plank 30s - repeat 3 rounds"
)


# ---------------------------------------------------------------------------
# Existing tests (oEmbed-only behaviour — must still pass)
# ---------------------------------------------------------------------------

def test_platform_name():
    assert TikTokAdapter.platform_name() == "tiktok"


def test_fetch_returns_media_content_with_description():
    """When transcript and vision both fail, oEmbed caption is used as primary_text."""
    with (
        patch(PATCH_EXTRACT_METADATA, return_value=MOCK_METADATA),
        patch(PATCH_DOWNLOAD_VIDEO, return_value=None),
    ):
        adapter = TikTokAdapter()
        result = adapter.fetch(
            "https://tiktok.com/@user/video/7575571317500546322",
            "7575571317500546322",
        )
        assert isinstance(result, MediaContent)
        assert result.primary_text == MOCK_METADATA.title.strip()


def test_fetch_raises_when_no_text():
    """oEmbed caption is blank → all tiers fail → PlatformFetchError."""
    with (
        patch(PATCH_EXTRACT_METADATA, return_value=EMPTY_METADATA),
        patch(PATCH_DOWNLOAD_VIDEO, return_value=None),
    ):
        adapter = TikTokAdapter()
        with pytest.raises(PlatformFetchError):
            adapter.fetch("https://tiktok.com/@x/video/000", "000")


def test_fetch_raises_on_service_failure():
    """extract_metadata raises → PlatformFetchError propagated."""
    with patch(PATCH_EXTRACT_METADATA, side_effect=RuntimeError("Network error")):
        adapter = TikTokAdapter()
        with pytest.raises(PlatformFetchError):
            adapter.fetch("https://tiktok.com/@user/video/123", "123")


def test_fetch_includes_metadata_fields():
    """Media metadata dict contains expected keys regardless of extraction tier."""
    with (
        patch(PATCH_EXTRACT_METADATA, return_value=MOCK_METADATA),
        patch(PATCH_DOWNLOAD_VIDEO, return_value=None),
    ):
        adapter = TikTokAdapter()
        result = adapter.fetch(
            "https://tiktok.com/@user/video/7575571317500546322",
            "7575571317500546322",
        )
        assert result.media_metadata["video_id"] == "7575571317500546322"
        assert result.media_metadata["creator"] == "fitnessguru"
        assert result.media_metadata["hashtags"] == ["fitness", "workout"]


# ---------------------------------------------------------------------------
# New tests: Tier 1 — Transcription success path
# ---------------------------------------------------------------------------

def test_transcription_success_path_uses_transcript_as_primary_text(tmp_path):
    """
    Tier 1 happy path:
    yt-dlp downloads the video → ffmpeg extracts audio → OpenAI Whisper
    returns a long enough transcript → primary_text == transcript.
    """
    fake_video = str(tmp_path / "video.mp4")
    fake_audio = str(tmp_path / "audio.wav")

    with (
        patch(PATCH_EXTRACT_METADATA, return_value=MOCK_METADATA),
        patch(PATCH_DOWNLOAD_VIDEO, return_value=fake_video),
        patch(PATCH_ASR_EXTRACT_AUDIO, return_value=fake_audio),
        patch(
            PATCH_ASR_TRANSCRIBE,
            return_value={"text": _LONG_TRANSCRIPT},
        ),
        patch(PATCH_SHUTIL_RMTREE),
        patch(PATCH_TEMPFILE_MKDTEMP, return_value=str(tmp_path)),
    ):
        adapter = TikTokAdapter()
        result = adapter.fetch(
            "https://tiktok.com/@user/video/7575571317500546322",
            "7575571317500546322",
        )

    assert result.primary_text == _LONG_TRANSCRIPT
    assert result.media_metadata["extraction_tier"] == "transcript"


def test_transcription_success_path_metadata_preserved(tmp_path):
    """Transcript tier must still populate all standard metadata fields."""
    fake_video = str(tmp_path / "video.mp4")
    fake_audio = str(tmp_path / "audio.wav")

    with (
        patch(PATCH_EXTRACT_METADATA, return_value=MOCK_METADATA),
        patch(PATCH_DOWNLOAD_VIDEO, return_value=fake_video),
        patch(PATCH_ASR_EXTRACT_AUDIO, return_value=fake_audio),
        patch(
            PATCH_ASR_TRANSCRIBE,
            return_value={"text": _LONG_TRANSCRIPT},
        ),
        patch(PATCH_SHUTIL_RMTREE),
        patch(PATCH_TEMPFILE_MKDTEMP, return_value=str(tmp_path)),
    ):
        adapter = TikTokAdapter()
        result = adapter.fetch(
            "https://tiktok.com/@user/video/7575571317500546322",
            "7575571317500546322",
        )

    assert result.media_metadata["video_id"] == "7575571317500546322"
    assert result.media_metadata["creator"] == "fitnessguru"
    assert result.media_metadata["duration_seconds"] == 45.0


# ---------------------------------------------------------------------------
# New tests: Tier 2 — Vision fallback (transcript too short)
# ---------------------------------------------------------------------------

def test_vision_fallback_when_transcript_too_short(tmp_path):
    """
    Tier 2 path:
    Transcript exists but is < TRANSCRIPT_MIN_CHARS → vision keyframes are
    analysed → primary_text == vision text.
    """
    fake_video = str(tmp_path / "video.mp4")
    fake_audio = str(tmp_path / "audio.wav")
    # Create a fake frame file in tmp_path so os.listdir returns it
    frame_file = tmp_path / "frame_00001.png"
    frame_file.touch()

    with (
        patch(PATCH_EXTRACT_METADATA, return_value=MOCK_METADATA),
        patch(PATCH_DOWNLOAD_VIDEO, return_value=fake_video),
        patch(PATCH_ASR_EXTRACT_AUDIO, return_value=fake_audio),
        patch(
            PATCH_ASR_TRANSCRIBE,
            return_value={"text": _SHORT_TRANSCRIPT},
        ),
        patch(PATCH_VIDEO_SERVICE_SAMPLE),
        patch(PATCH_OS_LISTDIR, return_value=["frame_00001.png"]),
        patch(PATCH_VISION_SERVICE, return_value=_VISION_TEXT),
        patch(PATCH_SHUTIL_RMTREE),
        patch(PATCH_TEMPFILE_MKDTEMP, return_value=str(tmp_path)),
    ):
        adapter = TikTokAdapter()
        result = adapter.fetch(
            "https://tiktok.com/@user/video/7575571317500546322",
            "7575571317500546322",
        )

    assert result.primary_text == _VISION_TEXT
    assert result.media_metadata["extraction_tier"] == "vision"


def test_vision_fallback_when_download_succeeds_but_transcription_raises(tmp_path):
    """
    Tier 2 path:
    ASRService.transcribe_with_openai_api raises → vision is attempted as
    fallback.
    """
    fake_video = str(tmp_path / "video.mp4")
    fake_audio = str(tmp_path / "audio.wav")
    frame_file = tmp_path / "frame_00001.png"
    frame_file.touch()

    with (
        patch(PATCH_EXTRACT_METADATA, return_value=MOCK_METADATA),
        patch(PATCH_DOWNLOAD_VIDEO, return_value=fake_video),
        patch(PATCH_ASR_EXTRACT_AUDIO, return_value=fake_audio),
        patch(
            PATCH_ASR_TRANSCRIBE,
            side_effect=RuntimeError("Whisper API down"),
        ),
        patch(PATCH_VIDEO_SERVICE_SAMPLE),
        patch(PATCH_OS_LISTDIR, return_value=["frame_00001.png"]),
        patch(PATCH_VISION_SERVICE, return_value=_VISION_TEXT),
        patch(PATCH_SHUTIL_RMTREE),
        patch(PATCH_TEMPFILE_MKDTEMP, return_value=str(tmp_path)),
    ):
        adapter = TikTokAdapter()
        result = adapter.fetch(
            "https://tiktok.com/@user/video/7575571317500546322",
            "7575571317500546322",
        )

    assert result.primary_text == _VISION_TEXT
    assert result.media_metadata["extraction_tier"] == "vision"


def test_vision_fallback_metadata_preserved(tmp_path):
    """Vision tier must still populate all standard metadata fields."""
    fake_video = str(tmp_path / "video.mp4")
    fake_audio = str(tmp_path / "audio.wav")
    (tmp_path / "frame_00001.png").touch()

    with (
        patch(PATCH_EXTRACT_METADATA, return_value=MOCK_METADATA),
        patch(PATCH_DOWNLOAD_VIDEO, return_value=fake_video),
        patch(PATCH_ASR_EXTRACT_AUDIO, return_value=fake_audio),
        patch(PATCH_ASR_TRANSCRIBE, return_value={"text": _SHORT_TRANSCRIPT}),
        patch(PATCH_VIDEO_SERVICE_SAMPLE),
        patch(PATCH_OS_LISTDIR, return_value=["frame_00001.png"]),
        patch(PATCH_VISION_SERVICE, return_value=_VISION_TEXT),
        patch(PATCH_SHUTIL_RMTREE),
        patch(PATCH_TEMPFILE_MKDTEMP, return_value=str(tmp_path)),
    ):
        adapter = TikTokAdapter()
        result = adapter.fetch(
            "https://tiktok.com/@user/video/7575571317500546322",
            "7575571317500546322",
        )

    assert result.media_metadata["video_id"] == "7575571317500546322"
    assert result.media_metadata["creator"] == "fitnessguru"


# ---------------------------------------------------------------------------
# New tests: Tier 3 — oEmbed fallback (both transcript and vision fail)
# ---------------------------------------------------------------------------

def test_oembed_fallback_when_download_fails():
    """
    Tier 3 path:
    download_video returns None → both upstream tiers are skipped →
    oEmbed caption is used.
    """
    with (
        patch(PATCH_EXTRACT_METADATA, return_value=MOCK_METADATA),
        patch(PATCH_DOWNLOAD_VIDEO, return_value=None),
    ):
        adapter = TikTokAdapter()
        result = adapter.fetch(
            "https://tiktok.com/@user/video/7575571317500546322",
            "7575571317500546322",
        )

    assert result.primary_text == MOCK_METADATA.title.strip()
    assert result.media_metadata["extraction_tier"] == "oembed"


def test_oembed_fallback_when_no_frames(tmp_path):
    """
    Tier 3 path:
    Video downloaded, transcript too short, but no frames extracted →
    oEmbed caption used.
    """
    fake_video = str(tmp_path / "video.mp4")
    fake_audio = str(tmp_path / "audio.wav")

    with (
        patch(PATCH_EXTRACT_METADATA, return_value=MOCK_METADATA),
        patch(PATCH_DOWNLOAD_VIDEO, return_value=fake_video),
        patch(PATCH_ASR_EXTRACT_AUDIO, return_value=fake_audio),
        patch(PATCH_ASR_TRANSCRIBE, return_value={"text": _SHORT_TRANSCRIPT}),
        patch(PATCH_VIDEO_SERVICE_SAMPLE),
        patch(PATCH_OS_LISTDIR, return_value=[]),   # no PNG frames
        patch(PATCH_SHUTIL_RMTREE),
        patch(PATCH_TEMPFILE_MKDTEMP, return_value=str(tmp_path)),
    ):
        adapter = TikTokAdapter()
        result = adapter.fetch(
            "https://tiktok.com/@user/video/7575571317500546322",
            "7575571317500546322",
        )

    assert result.primary_text == MOCK_METADATA.title.strip()
    assert result.media_metadata["extraction_tier"] == "oembed"


def test_oembed_fallback_when_vision_raises(tmp_path):
    """
    Tier 3 path:
    Vision service raises → graceful fallback to oEmbed.
    """
    fake_video = str(tmp_path / "video.mp4")
    fake_audio = str(tmp_path / "audio.wav")
    (tmp_path / "frame_00001.png").touch()

    with (
        patch(PATCH_EXTRACT_METADATA, return_value=MOCK_METADATA),
        patch(PATCH_DOWNLOAD_VIDEO, return_value=fake_video),
        patch(PATCH_ASR_EXTRACT_AUDIO, return_value=fake_audio),
        patch(PATCH_ASR_TRANSCRIBE, return_value={"text": _SHORT_TRANSCRIPT}),
        patch(PATCH_VIDEO_SERVICE_SAMPLE),
        patch(PATCH_OS_LISTDIR, return_value=["frame_00001.png"]),
        patch(PATCH_VISION_SERVICE, side_effect=RuntimeError("GPT-4o quota exceeded")),
        patch(PATCH_SHUTIL_RMTREE),
        patch(PATCH_TEMPFILE_MKDTEMP, return_value=str(tmp_path)),
    ):
        adapter = TikTokAdapter()
        result = adapter.fetch(
            "https://tiktok.com/@user/video/7575571317500546322",
            "7575571317500546322",
        )

    assert result.primary_text == MOCK_METADATA.title.strip()
    assert result.media_metadata["extraction_tier"] == "oembed"


def test_oembed_fallback_empty_caption_raises():
    """
    All three tiers fail (download None + empty oEmbed title) →
    PlatformFetchError raised.
    """
    with (
        patch(PATCH_EXTRACT_METADATA, return_value=EMPTY_METADATA),
        patch(PATCH_DOWNLOAD_VIDEO, return_value=None),
    ):
        adapter = TikTokAdapter()
        with pytest.raises(PlatformFetchError):
            adapter.fetch("https://tiktok.com/@x/video/000", "000")


# ---------------------------------------------------------------------------
# New tests: tmpdir cleanup
# ---------------------------------------------------------------------------

def test_tmpdir_cleaned_up_on_success(tmp_path):
    """Temp directory is removed after a successful transcript extraction."""
    fake_video = str(tmp_path / "video.mp4")
    fake_audio = str(tmp_path / "audio.wav")

    with (
        patch(PATCH_EXTRACT_METADATA, return_value=MOCK_METADATA),
        patch(PATCH_DOWNLOAD_VIDEO, return_value=fake_video),
        patch(PATCH_ASR_EXTRACT_AUDIO, return_value=fake_audio),
        patch(PATCH_ASR_TRANSCRIBE, return_value={"text": _LONG_TRANSCRIPT}),
        patch(PATCH_SHUTIL_RMTREE) as mock_rmtree,
        patch(PATCH_TEMPFILE_MKDTEMP, return_value=str(tmp_path)),
    ):
        TikTokAdapter().fetch(
            "https://tiktok.com/@user/video/7575571317500546322",
            "7575571317500546322",
        )

    mock_rmtree.assert_called_once_with(str(tmp_path), ignore_errors=True)


def test_tmpdir_cleaned_up_on_vision_error(tmp_path):
    """Temp directory is removed even when the vision service raises."""
    fake_video = str(tmp_path / "video.mp4")
    fake_audio = str(tmp_path / "audio.wav")
    (tmp_path / "frame_00001.png").touch()

    with (
        patch(PATCH_EXTRACT_METADATA, return_value=MOCK_METADATA),
        patch(PATCH_DOWNLOAD_VIDEO, return_value=fake_video),
        patch(PATCH_ASR_EXTRACT_AUDIO, return_value=fake_audio),
        patch(PATCH_ASR_TRANSCRIBE, return_value={"text": _SHORT_TRANSCRIPT}),
        patch(PATCH_VIDEO_SERVICE_SAMPLE),
        patch(PATCH_OS_LISTDIR, return_value=["frame_00001.png"]),
        patch(PATCH_VISION_SERVICE, side_effect=RuntimeError("crash")),
        patch(PATCH_SHUTIL_RMTREE) as mock_rmtree,
        patch(PATCH_TEMPFILE_MKDTEMP, return_value=str(tmp_path)),
    ):
        TikTokAdapter().fetch(
            "https://tiktok.com/@user/video/7575571317500546322",
            "7575571317500546322",
        )

    mock_rmtree.assert_called_once_with(str(tmp_path), ignore_errors=True)


# ---------------------------------------------------------------------------
# Constant export test
# ---------------------------------------------------------------------------

def test_transcript_min_chars_constant():
    """TRANSCRIPT_MIN_CHARS must equal 50 (the threshold agreed in the spec)."""
    assert TRANSCRIPT_MIN_CHARS == 50
