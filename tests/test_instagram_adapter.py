from unittest.mock import patch
import pytest
from workout_ingestor_api.services.adapters.instagram_adapter import InstagramAdapter
from workout_ingestor_api.services.adapters.base import MediaContent, PlatformFetchError

REEL_WITH_TRANSCRIPT = {
    "caption": "X4 Rounds\nSquat 3x10\n#hyrox",
    "transcript": "Today we do four rounds of squats",
    "videoDuration": 30.0,
    "ownerUsername": "coach_anna",
    "shortCode": "DEaDjHLtHwA",
}

REEL_NO_TRANSCRIPT = {
    "caption": "X4 Rounds\nSquat 3x10",
    "transcript": None,
    "videoDuration": 14.7,
    "ownerUsername": "commando_charlie",
    "shortCode": "DEaDjHLtHwA",
}


def test_platform_name():
    assert InstagramAdapter.platform_name() == "instagram"


def test_fetch_uses_transcript_when_available():
    with patch(
        "workout_ingestor_api.services.adapters.instagram_adapter.ApifyService.fetch_reel_data",
        return_value=REEL_WITH_TRANSCRIPT,
    ):
        result = InstagramAdapter().fetch("https://instagram.com/reel/DEaDjHLtHwA/", "DEaDjHLtHwA")
        assert isinstance(result, MediaContent)
        assert result.primary_text == "Today we do four rounds of squats"
        assert result.secondary_texts == ["X4 Rounds\nSquat 3x10\n#hyrox"]


def test_fetch_falls_back_to_caption_when_no_transcript():
    with patch(
        "workout_ingestor_api.services.adapters.instagram_adapter.ApifyService.fetch_reel_data",
        return_value=REEL_NO_TRANSCRIPT,
    ):
        result = InstagramAdapter().fetch("https://instagram.com/p/DEaDjHLtHwA/", "DEaDjHLtHwA")
        assert result.primary_text == "X4 Rounds\nSquat 3x10"


def test_fetch_raises_when_no_text():
    empty = {"caption": "", "transcript": None, "videoDuration": 10, "ownerUsername": "x", "shortCode": "abc"}
    with patch(
        "workout_ingestor_api.services.adapters.instagram_adapter.ApifyService.fetch_reel_data",
        return_value=empty,
    ):
        with pytest.raises(PlatformFetchError, match="no transcript or caption"):
            InstagramAdapter().fetch("https://instagram.com/p/abc/", "abc")


def test_fetch_raises_on_apify_error():
    with patch(
        "workout_ingestor_api.services.adapters.instagram_adapter.ApifyService.fetch_reel_data",
        side_effect=RuntimeError("Apify down"),
    ):
        with pytest.raises(PlatformFetchError):
            InstagramAdapter().fetch("https://instagram.com/p/abc/", "abc")


def test_media_metadata_populated():
    with patch(
        "workout_ingestor_api.services.adapters.instagram_adapter.ApifyService.fetch_reel_data",
        return_value=REEL_NO_TRANSCRIPT,
    ):
        result = InstagramAdapter().fetch("https://instagram.com/p/DEaDjHLtHwA/", "DEaDjHLtHwA")
        assert result.media_metadata["creator"] == "commando_charlie"
        assert result.media_metadata["video_duration_sec"] == 14.7


def test_secondary_texts_empty_when_caption_is_whitespace_only():
    data = {
        "caption": "   ",  # whitespace-only
        "transcript": "Today we do four rounds of squats",
        "videoDuration": 30.0,
        "ownerUsername": "coach_anna",
        "shortCode": "DEaDjHLtHwA",
    }
    with patch(
        "workout_ingestor_api.services.adapters.instagram_adapter.ApifyService.fetch_reel_data",
        return_value=data,
    ):
        adapter = InstagramAdapter()
        result = adapter.fetch("https://instagram.com/reel/DEaDjHLtHwA/", "DEaDjHLtHwA")
        assert result.primary_text == "Today we do four rounds of squats"
        assert result.secondary_texts == []
