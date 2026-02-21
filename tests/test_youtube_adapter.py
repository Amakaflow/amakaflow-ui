"""Tests for YouTubeAdapter (AMA-708)."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from workout_ingestor_api.services.adapters import get_adapter
from workout_ingestor_api.services.adapters.base import PlatformFetchError
from workout_ingestor_api.services.adapters.youtube_adapter import YouTubeAdapter


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_metadata(
    title: str = "Best HIIT Workout",
    description: str = "Full body workout for beginners.",
    duration: int = 1800,
    channel: str = "FitChannel",
    captions: dict | None = None,
) -> dict:
    """Return a dict shaped like YouTubeService.extract_metadata()."""
    return {
        "title": title,
        "description": description,
        "duration": duration,
        "upload_date": "20260101",
        "channel": channel,
        "chapters": [],
        "captions": captions if captions is not None else {},
        "download_url": None,
    }


# Minimal caption structure: lang_code -> {"format": "srt", "data": "<srt text>"}
_SAMPLE_CAPTIONS = {
    "en": {
        "format": "srt",
        "data": (
            "1\n00:00:01,000 --> 00:00:04,000\nWelcome to the workout.\n\n"
            "2\n00:00:05,000 --> 00:00:08,000\nLet's begin with warm-up.\n\n"
        ),
    }
}

_SAMPLE_TRANSCRIPT_TEXT = "Welcome to the workout.\nLet's begin with warm-up."


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestYouTubeAdapterPlatformName:
    def test_platform_name(self):
        assert YouTubeAdapter.platform_name() == "youtube"

    def test_registered_in_registry(self):
        adapter = get_adapter("youtube")
        assert isinstance(adapter, YouTubeAdapter)


class TestYouTubeAdapterFetch:
    """Tests for YouTubeAdapter.fetch(), using a mocked YouTubeService."""

    def _run_fetch(self, metadata_return: dict) -> "MediaContent":  # noqa: F821
        with patch(
            "workout_ingestor_api.services.adapters.youtube_adapter.YouTubeService.extract_metadata",
            return_value=metadata_return,
        ):
            adapter = YouTubeAdapter()
            return adapter.fetch("https://youtube.com/watch?v=abc123", "abc123")

    # ------------------------------------------------------------------
    # Test 1 — transcript available → primary_text = transcript
    # ------------------------------------------------------------------
    def test_fetch_returns_media_content_with_transcript(self):
        metadata = _make_metadata(captions=_SAMPLE_CAPTIONS)
        result = self._run_fetch(metadata)

        # primary_text must be transcript-derived (not description)
        assert "Welcome to the workout" in result.primary_text
        assert "warm-up" in result.primary_text

        # description goes into secondary_texts when transcript present
        assert metadata["description"] in result.secondary_texts

        # Standard fields
        assert result.title == "Best HIIT Workout"
        assert result.media_metadata["video_duration_sec"] == 1800
        assert result.media_metadata["channel"] == "FitChannel"
        assert result.media_metadata["video_id"] == "abc123"

    # ------------------------------------------------------------------
    # Test 2 — no captions → falls back to description
    # ------------------------------------------------------------------
    def test_fetch_falls_back_to_description(self):
        metadata = _make_metadata(captions={})
        result = self._run_fetch(metadata)

        assert result.primary_text == "Full body workout for beginners."
        # No secondary text when we fell back
        assert result.secondary_texts == []

    # ------------------------------------------------------------------
    # Test 3 — both transcript and description empty → PlatformFetchError
    # ------------------------------------------------------------------
    def test_fetch_raises_when_no_text(self):
        metadata = _make_metadata(description="", captions={})
        with pytest.raises(PlatformFetchError, match="No extractable text"):
            self._run_fetch(metadata)

    # ------------------------------------------------------------------
    # Test 4 — service raises → wrapped in PlatformFetchError
    # ------------------------------------------------------------------
    def test_fetch_raises_on_service_failure(self):
        with patch(
            "workout_ingestor_api.services.adapters.youtube_adapter.YouTubeService.extract_metadata",
            side_effect=RuntimeError("yt-dlp exploded"),
        ):
            adapter = YouTubeAdapter()
            with pytest.raises(PlatformFetchError, match="YouTube fetch failed"):
                adapter.fetch("https://youtube.com/watch?v=xyz", "xyz")

    # ------------------------------------------------------------------
    # Test 5 — channel falls back to uploader when channel is absent
    # ------------------------------------------------------------------
    def test_fetch_uses_uploader_fallback(self):
        metadata = _make_metadata(channel="", captions={})
        metadata["uploader"] = "SomeFitGuru"
        # description still present so fetch succeeds
        result = self._run_fetch(metadata)
        assert result.media_metadata["channel"] == "SomeFitGuru"
