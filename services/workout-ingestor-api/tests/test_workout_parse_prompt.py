"""Tests for the consolidated workout parse prompt module (AMA-747)."""
from __future__ import annotations

import pytest

from workout_ingestor_api.services.prompts.workout_parse_prompt import build_prompt


# ---------------------------------------------------------------------------
# 1. Platform-specific context preambles
# ---------------------------------------------------------------------------


class TestPlatformPreambles:
    """build_prompt() should include a platform-specific context preamble."""

    def test_instagram_preamble_present(self):
        prompt = build_prompt(
            platform="instagram",
            video_duration_sec=None,
            raw_text="Squat 3x10",
        )
        # Phrase unique to the instagram preamble — not in general rules
        assert "Instagram Reel captions" in prompt

    def test_youtube_preamble_present(self):
        prompt = build_prompt(
            platform="youtube",
            video_duration_sec=None,
            raw_text="Squat 3x10",
        )
        # Phrase unique to the youtube preamble — chapter titles signal
        assert "Chapter titles are particularly" in prompt

    def test_tiktok_preamble_present(self):
        prompt = build_prompt(
            platform="tiktok",
            video_duration_sec=None,
            raw_text="Squat 3x10",
        )
        # Phrase unique to the tiktok preamble — on-screen text priority
        assert "Prioritise on-screen text over audio transcripts" in prompt

    def test_pinterest_preamble_present(self):
        prompt = build_prompt(
            platform="pinterest",
            video_duration_sec=None,
            raw_text="Squat 3x10",
        )
        # Phrase unique to the pinterest preamble — no video transcript
        assert "There is no video transcript" in prompt

    def test_unknown_platform_still_returns_prompt(self):
        """Unknown platforms should still produce a usable prompt."""
        prompt = build_prompt(
            platform="unknown_platform",
            video_duration_sec=None,
            raw_text="Squat 3x10",
        )
        assert "Squat 3x10" in prompt
        assert len(prompt) > 100

    def test_instagram_and_youtube_preambles_are_distinct(self):
        """Each platform's opening context must differ from the others."""
        ig_prompt = build_prompt(
            platform="instagram",
            video_duration_sec=None,
            raw_text="Squat 3x10",
        )
        yt_prompt = build_prompt(
            platform="youtube",
            video_duration_sec=None,
            raw_text="Squat 3x10",
        )
        # The prompts must not be identical (preambles differ)
        assert ig_prompt != yt_prompt

    def test_tiktok_and_pinterest_preambles_are_distinct(self):
        tt_prompt = build_prompt(
            platform="tiktok",
            video_duration_sec=None,
            raw_text="Squat 3x10",
        )
        pin_prompt = build_prompt(
            platform="pinterest",
            video_duration_sec=None,
            raw_text="Squat 3x10",
        )
        assert tt_prompt != pin_prompt


# ---------------------------------------------------------------------------
# 2. Structure detection rules present
# ---------------------------------------------------------------------------


class TestStructureDetectionRules:
    """Key detection rule keywords must appear in every generated prompt."""

    @pytest.fixture()
    def base_prompt(self) -> str:
        return build_prompt(
            platform="instagram",
            video_duration_sec=None,
            raw_text="Squat 3x10",
        )

    def test_straight_sets_rule_present(self, base_prompt: str):
        assert "STRAIGHT SETS" in base_prompt

    def test_circuit_rule_present(self, base_prompt: str):
        assert "CIRCUIT" in base_prompt

    def test_superset_rule_present(self, base_prompt: str):
        assert "SUPERSET" in base_prompt or "superset" in base_prompt

    def test_emom_keyword_present(self, base_prompt: str):
        assert "EMOM" in base_prompt

    def test_amrap_keyword_present(self, base_prompt: str):
        assert "AMRAP" in base_prompt

    def test_tabata_keyword_present(self, base_prompt: str):
        assert "Tabata" in base_prompt or "TABATA" in base_prompt

    def test_timed_station_format_rule_present(self, base_prompt: str):
        assert "TIMED STATION" in base_prompt

    def test_structure_rules_present_for_youtube(self):
        prompt = build_prompt(
            platform="youtube",
            video_duration_sec=600,
            raw_text="3 rounds: 10 push ups, 10 squats, 10 lunges",
        )
        assert "STRAIGHT SETS" in prompt
        assert "CIRCUIT" in prompt

    def test_structure_rules_present_for_tiktok(self):
        prompt = build_prompt(
            platform="tiktok",
            video_duration_sec=None,
            raw_text="A1 Bench Press 5x5 / A2 Rows 5x5",
        )
        assert "SUPERSET" in prompt or "superset" in prompt


# ---------------------------------------------------------------------------
# 3. secondary_texts included in the prompt
# ---------------------------------------------------------------------------


class TestSecondaryTexts:
    """secondary_texts must appear in the prompt when provided."""

    def test_single_secondary_text_included(self):
        prompt = build_prompt(
            platform="instagram",
            video_duration_sec=None,
            raw_text="Primary workout text",
            secondary_texts=["Caption: 5 rounds for time"],
        )
        assert "Caption: 5 rounds for time" in prompt

    def test_multiple_secondary_texts_all_included(self):
        prompt = build_prompt(
            platform="youtube",
            video_duration_sec=300,
            raw_text="Main transcript",
            secondary_texts=[
                "Description: leg day workout",
                "Chapter: warm-up",
                "Chapter: main work",
            ],
        )
        assert "Description: leg day workout" in prompt
        assert "Chapter: warm-up" in prompt
        assert "Chapter: main work" in prompt

    def test_no_secondary_texts_does_not_error(self):
        """Omitting secondary_texts (default None) should not raise."""
        prompt = build_prompt(
            platform="tiktok",
            video_duration_sec=None,
            raw_text="Just a caption",
        )
        assert "Just a caption" in prompt

    def test_empty_secondary_texts_list_does_not_error(self):
        prompt = build_prompt(
            platform="pinterest",
            video_duration_sec=None,
            raw_text="Pin description",
            secondary_texts=[],
        )
        assert "Pin description" in prompt

    def test_secondary_texts_appear_after_primary(self):
        """secondary_texts block should be positioned after the primary text."""
        prompt = build_prompt(
            platform="instagram",
            video_duration_sec=None,
            raw_text="PRIMARY CONTENT",
            secondary_texts=["SECONDARY CONTENT"],
        )
        primary_pos = prompt.index("PRIMARY CONTENT")
        secondary_pos = prompt.index("SECONDARY CONTENT")
        assert secondary_pos > primary_pos


# ---------------------------------------------------------------------------
# 4. raw_text appears in the prompt
# ---------------------------------------------------------------------------


class TestRawTextInclusion:
    """The raw_text argument must be embedded in the returned prompt string."""

    def test_raw_text_present(self):
        prompt = build_prompt(
            platform="instagram",
            video_duration_sec=None,
            raw_text="Deadlift 4x6 Romanian",
        )
        assert "Deadlift 4x6 Romanian" in prompt

    def test_raw_text_present_with_duration(self):
        prompt = build_prompt(
            platform="youtube",
            video_duration_sec=1200,
            raw_text="Bench Press 3x8 @ RPE 8",
        )
        assert "Bench Press 3x8 @ RPE 8" in prompt

    def test_raw_text_present_with_secondary_texts(self):
        prompt = build_prompt(
            platform="tiktok",
            video_duration_sec=None,
            raw_text="Overhead Press 5x5",
            secondary_texts=["Extra context"],
        )
        assert "Overhead Press 5x5" in prompt

    def test_multiline_raw_text_preserved(self):
        raw = "Exercise 1: Squat\nExercise 2: Deadlift\nExercise 3: Bench"
        prompt = build_prompt(
            platform="instagram",
            video_duration_sec=None,
            raw_text=raw,
        )
        assert "Exercise 1: Squat" in prompt
        assert "Exercise 2: Deadlift" in prompt
        assert "Exercise 3: Bench" in prompt


# ---------------------------------------------------------------------------
# 5. Video duration context
# ---------------------------------------------------------------------------


class TestVideoDurationContext:
    """When video_duration_sec is provided, the prompt should mention it."""

    def test_duration_included_when_provided(self):
        prompt = build_prompt(
            platform="instagram",
            video_duration_sec=120,
            raw_text="Squat 3x10",
        )
        # Should mention the duration somewhere
        assert "120" in prompt or "2 minutes" in prompt

    def test_no_duration_does_not_crash(self):
        prompt = build_prompt(
            platform="youtube",
            video_duration_sec=None,
            raw_text="Squat 3x10",
        )
        assert "Squat 3x10" in prompt

    def test_duration_zero_handled_gracefully(self):
        """video_duration_sec=0 is a valid duration and MUST include duration context."""
        prompt = build_prompt(
            platform="tiktok",
            video_duration_sec=0,
            raw_text="Squat 3x10",
        )
        assert "Squat 3x10" in prompt
        # 0 is a valid duration value (not missing), so the duration context must be present
        assert "The video is 0 seconds long" in prompt
        # vd_placeholder in the JSON footer must be 0 (int), not "null"
        assert '"video_duration_sec": 0' in prompt


# ---------------------------------------------------------------------------
# 6. Optional title parameter
# ---------------------------------------------------------------------------


class TestTitleParameter:
    """build_prompt() should include the title in the header when provided."""

    def test_title_appears_when_provided(self):
        prompt = build_prompt(
            platform="instagram",
            video_duration_sec=None,
            raw_text="Squat 3x10",
            title="Full Body HIIT Blast",
        )
        assert "Title: Full Body HIIT Blast" in prompt

    def test_title_line_absent_when_not_provided(self):
        prompt = build_prompt(
            platform="instagram",
            video_duration_sec=None,
            raw_text="Squat 3x10",
        )
        assert "Title:" not in prompt

    def test_title_line_absent_when_none(self):
        prompt = build_prompt(
            platform="youtube",
            video_duration_sec=300,
            raw_text="Squat 3x10",
            title=None,
        )
        assert "Title:" not in prompt

    def test_title_appears_between_platform_and_text_to_parse(self):
        """Title line must sit between 'Platform:' and 'Text to parse:' in the header."""
        prompt = build_prompt(
            platform="youtube",
            video_duration_sec=None,
            raw_text="Deadlift 5x3",
            title="Leg Day Strength",
        )
        platform_pos = prompt.index("Platform: youtube")
        title_pos = prompt.index("Title: Leg Day Strength")
        text_pos = prompt.index("Text to parse:")
        assert platform_pos < title_pos < text_pos


# ---------------------------------------------------------------------------
# 7. Return type and basic sanity
# ---------------------------------------------------------------------------


class TestReturnType:
    def test_returns_string(self):
        result = build_prompt(
            platform="instagram",
            video_duration_sec=None,
            raw_text="Bench Press",
        )
        assert isinstance(result, str)

    def test_prompt_is_non_empty(self):
        result = build_prompt(
            platform="youtube",
            video_duration_sec=None,
            raw_text="",
        )
        assert len(result) > 200

    def test_prompt_ends_with_json_instruction(self):
        """Prompt should instruct the model to return only JSON."""
        result = build_prompt(
            platform="instagram",
            video_duration_sec=None,
            raw_text="Squat",
        )
        assert "JSON" in result
