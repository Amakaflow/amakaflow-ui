"""Tests for InstagramReelService."""
from unittest.mock import patch
from workout_ingestor_api.services.instagram_reel_service import (
    InstagramReelService,
)


MOCK_REEL_DATA = {
    "id": "abc123",
    "shortCode": "DRHiuniDM1K",
    "caption": "Full body HIIT workout! 3 rounds: 30s jumping jacks, 30s squats, 30s pushups, 30s rest",
    "videoDuration": 62,
    "videoUrl": "https://scontent.cdninstagram.com/v/example.mp4",
    "ownerUsername": "fitcoach",
    "likesCount": 1200,
    "timestamp": "2026-01-15T10:00:00.000Z",
    "transcript": "okay so today we're doing a full body HIIT workout three rounds first exercise jumping jacks for 30 seconds let's go next up bodyweight squats for 30 seconds keep your chest up now pushups for 30 seconds and rest for 30 seconds that's one round",
}


MOCK_LLM_RESPONSE = {
    "title": "Full Body HIIT Workout",
    "workout_type": "hiit",
    "workout_type_confidence": 0.95,
    "blocks": [
        {
            "label": "HIIT Circuit",
            "structure": "circuit",
            "rounds": 3,
            "exercises": [
                {"name": "Jumping Jacks", "duration_sec": 30, "type": "cardio", "video_start_sec": 5, "video_end_sec": 20},
                {"name": "Bodyweight Squats", "duration_sec": 30, "type": "strength", "video_start_sec": 20, "video_end_sec": 35},
                {"name": "Push-Ups", "duration_sec": 30, "type": "strength", "video_start_sec": 35, "video_end_sec": 50},
            ],
            "time_rest_sec": 30,
        }
    ],
}


def test_ingest_reel_returns_workout():
    """InstagramReelService should fetch reel, parse transcript, return workout."""
    with (
        patch.object(InstagramReelService, "_fetch_reel_data", return_value=MOCK_REEL_DATA),
        patch.object(InstagramReelService, "_parse_transcript", return_value=MOCK_LLM_RESPONSE),
    ):
        result = InstagramReelService.ingest_reel(
            url="https://www.instagram.com/reel/DRHiuniDM1K/"
        )

    assert result["title"] == "Full Body HIIT Workout"
    assert result["workout_type"] == "hiit"
    assert len(result["blocks"]) == 1
    assert result["blocks"][0]["exercises"][0]["video_start_sec"] == 5
    assert result["_provenance"]["mode"] == "instagram_reel"
    assert result["_provenance"]["source_url"] == "https://www.instagram.com/reel/DRHiuniDM1K/"


def test_ingest_reel_uses_caption_when_no_transcript():
    """Should fall back to caption if transcript is empty."""
    reel_no_transcript = {**MOCK_REEL_DATA, "transcript": None}

    with (
        patch.object(InstagramReelService, "_fetch_reel_data", return_value=reel_no_transcript),
        patch.object(InstagramReelService, "_parse_transcript", return_value=MOCK_LLM_RESPONSE) as mock_parse,
    ):
        InstagramReelService.ingest_reel(url="https://www.instagram.com/reel/DRHiuniDM1K/")

    # Should have been called with caption text since transcript was empty
    call_args = mock_parse.call_args
    transcript_arg = call_args.kwargs.get("transcript") or (call_args[0][0] if call_args[0] else "")
    assert "Full body HIIT workout" in transcript_arg


def test_extract_shortcode():
    """Should extract shortcode from various Instagram Reel URL formats."""
    assert InstagramReelService._extract_shortcode("https://www.instagram.com/reel/DRHiuniDM1K/") == "DRHiuniDM1K"
    assert InstagramReelService._extract_shortcode("https://instagram.com/reel/DRHiuniDM1K") == "DRHiuniDM1K"
    assert InstagramReelService._extract_shortcode("https://www.instagram.com/p/DRHiuniDM1K/") == "DRHiuniDM1K"


def test_parse_transcript_prompt_includes_mm_mm_timestamp_guidance():
    """Prompt should include guidance about MM-MM: timestamp format for timed stations."""
    from workout_ingestor_api.services.prompts import build_prompt

    # Build the prompt as _parse_transcript would — verify its content
    prompt = build_prompt(platform="instagram", video_duration_sec=90, raw_text="test", title="Test")

    # Verify the prompt contains guidance about MM-MM: timestamp format
    assert "MM-MM:" in prompt, "Prompt should contain MM-MM: timestamp format guidance"
    assert "minute-range timestamp" in prompt, "Prompt should describe MM-MM as minute-range timestamp"
    assert "35-40: 100 wall balls" in prompt, "Prompt should contain example of wall balls with MM-MM format"
    assert "distance_m: 1000" in prompt, "Prompt should contain example for distance extraction"


def test_parse_transcript_prompt_includes_timed_station_format():
    """Prompt should include TIMED STATION FORMAT section for 'X minute window' captions."""
    from workout_ingestor_api.services.prompts import build_prompt

    # Build the prompt as _parse_transcript would — verify its content
    prompt = build_prompt(platform="instagram", video_duration_sec=90, raw_text="test", title="Test")

    # Verify the prompt contains TIMED STATION FORMAT section
    assert "TIMED STATION FORMAT" in prompt, "Prompt should contain TIMED STATION FORMAT section"
    assert "time_cap_sec" in prompt, "Prompt should contain time_cap_sec guidance for timed stations"
    assert "rounds" in prompt and "1" in prompt, "Prompt should contain rounds=1 guidance for timed stations"
    assert "minute window" in prompt.lower(), "Prompt should mention 'minute window' in timed station format"


def test_parse_transcript_prompt_includes_notes_for_timed_station_format():
    """Prompt should include NOTES FOR TIMED STATION FORMAT section to set exercise notes to 'X minute cap'."""
    from workout_ingestor_api.services.prompts import build_prompt

    # Build the prompt as _parse_transcript would — verify its content
    prompt = build_prompt(platform="instagram", video_duration_sec=90, raw_text="test", title="Test")

    # Verify the prompt contains NOTES FOR TIMED STATION FORMAT section
    assert "NOTES FOR TIMED STATION FORMAT" in prompt, "Prompt should contain NOTES FOR TIMED STATION FORMAT section"
    assert "minute cap" in prompt, "Prompt should mention 'minute cap' for timed station notes"
    assert "Do NOT use" in prompt and "Complete as fast as possible" in prompt, "Prompt should instruct not to use 'Complete as fast as possible' for timed stations"
