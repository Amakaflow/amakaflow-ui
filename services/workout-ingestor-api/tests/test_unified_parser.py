import json
from unittest.mock import patch, MagicMock
import pytest

from workout_ingestor_api.services.unified_parser import UnifiedParser, UnifiedParserError
from workout_ingestor_api.services.adapters.base import MediaContent


SAMPLE_MEDIA = MediaContent(
    primary_text="4 rounds: Squats 20 reps, Push-ups 15 reps",
    title="HYROX Session",
    media_metadata={"video_duration_sec": 120},
)

VALID_LLM_RESPONSE = json.dumps({
    "title": "HYROX Session",
    "workout_type": "circuit",
    "workout_type_confidence": 0.9,
    "blocks": [
        {"label": "Main", "structure": "circuit", "rounds": 4,
         "exercises": [{"name": "Squats", "reps": 20, "type": "strength"}],
         "supersets": []}
    ],
})


def _mock_openai_client(content: str):
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content=content))]
    mock_client.chat.completions.create.return_value = mock_response
    return mock_client


def test_parse_returns_dict_with_blocks():
    mock_client = _mock_openai_client(VALID_LLM_RESPONSE)
    with patch(
        "workout_ingestor_api.services.unified_parser.AIClientFactory.create_openai_client",
        return_value=mock_client,
    ):
        parser = UnifiedParser()
        result = parser.parse(SAMPLE_MEDIA, platform="instagram")
        assert "blocks" in result
        assert isinstance(result["blocks"], list)


def test_parse_raises_on_invalid_json():
    mock_client = _mock_openai_client("not valid json {{{")
    with patch(
        "workout_ingestor_api.services.unified_parser.AIClientFactory.create_openai_client",
        return_value=mock_client,
    ):
        parser = UnifiedParser()
        with pytest.raises(UnifiedParserError, match="invalid JSON"):
            parser.parse(SAMPLE_MEDIA, platform="instagram")
        # Assert no spurious retries on bad JSON — should fail fast
        assert mock_client.chat.completions.create.call_count == 1


def test_parse_feature_name_contains_platform():
    captured_context = {}

    def capture_context(context):
        captured_context["feature_name"] = context.feature_name
        return _mock_openai_client(VALID_LLM_RESPONSE)

    with patch(
        "workout_ingestor_api.services.unified_parser.AIClientFactory.create_openai_client",
        side_effect=capture_context,
    ):
        parser = UnifiedParser()
        parser.parse(SAMPLE_MEDIA, platform="tiktok")
        assert "tiktok" in captured_context["feature_name"]


def test_parse_calls_spacy_corrector():
    mock_client = _mock_openai_client(VALID_LLM_RESPONSE)
    with patch(
        "workout_ingestor_api.services.unified_parser.AIClientFactory.create_openai_client",
        return_value=mock_client,
    ), patch(
        "workout_ingestor_api.services.unified_parser.SpacyCorrector.correct",
        wraps=lambda data, raw_text: data,
    ) as mock_correct:
        parser = UnifiedParser()
        result = parser.parse(SAMPLE_MEDIA, platform="instagram")
        mock_correct.assert_called_once()
        _, kwargs = mock_correct.call_args
        # raw_text should be the primary_text from MediaContent
        assert SAMPLE_MEDIA.primary_text in str(mock_correct.call_args)
        assert "blocks" in result  # verify parse() returns the corrected dict, not self


# ---------------------------------------------------------------------------
# Confidence scoring pass-through tests
# ---------------------------------------------------------------------------

_HIGH_CONFIDENCE_LLM_RESPONSE = json.dumps({
    "title": "HYROX Session",
    "workout_type": "circuit",
    "workout_type_confidence": 0.9,
    "blocks": [
        {
            "label": "Main",
            "structure": "circuit",
            "rounds": 4,
            "exercises": [{"name": "Squats", "reps": 20, "type": "strength"}],
            "supersets": [],
            "structure_confidence": 1.0,
            "structure_options": [],
        }
    ],
})

_LOW_CONFIDENCE_LLM_RESPONSE = json.dumps({
    "title": "Unknown Structure Workout",
    "workout_type": "strength",
    "workout_type_confidence": 0.6,
    "blocks": [
        {
            "label": "Block A",
            "structure": "circuit",
            "structure_confidence": 0.4,
            "structure_options": ["circuit", "straight_sets"],
            "exercises": [
                {"name": "Push-ups", "type": "strength"},
                {"name": "Squats", "type": "strength"}
            ],
            "supersets": [],
        }
    ],
})

class TestUnifiedParserConfidenceOutput:
    # TODO(AMA-714): sanitizer resets structure=None without clearing structure_confidence; cover in workout_sanitizer tests
    """Parser passes through structure_confidence and structure_options from LLM."""

    def test_high_confidence_block_passes_through(self):
        """When LLM returns confidence=1.0, parser preserves it."""
        mock_client = _mock_openai_client(_HIGH_CONFIDENCE_LLM_RESPONSE)
        with patch(
            "workout_ingestor_api.services.unified_parser.AIClientFactory.create_openai_client",
            return_value=mock_client,
        ):
            parser = UnifiedParser()
            result = parser.parse(SAMPLE_MEDIA, platform="instagram")
            block = result["blocks"][0]
            assert block["structure_confidence"] == 1.0
            assert block["structure_options"] == []

    def test_low_confidence_block_upgraded_when_rounds_in_text(self):
        """When LLM returns low confidence but raw text has explicit rounds,
        the corrector upgrades confidence to 1.0 and clears structure_options."""
        mock_client = _mock_openai_client(_LOW_CONFIDENCE_LLM_RESPONSE)
        with patch(
            "workout_ingestor_api.services.unified_parser.AIClientFactory.create_openai_client",
            return_value=mock_client,
        ):
            parser = UnifiedParser()
            # SAMPLE_MEDIA.primary_text = "4 rounds: Squats 20 reps, Push-ups 15 reps"
            # The corrector detects "4 rounds" and upgrades confidence to 1.0.
            result = parser.parse(SAMPLE_MEDIA, platform="instagram")
            block = result["blocks"][0]
            assert block["structure_confidence"] == 1.0
            assert block["structure_options"] == []

    def test_missing_confidence_defaults_gracefully(self):
        """Block dict without confidence fields is accepted by the Block model with safe defaults."""
        block_dict = {
            "structure": "circuit",
            "exercises": [{"name": "Push-ups", "type": "strength"}],
        }
        from workout_ingestor_api.models import Block
        block = Block(**block_dict)
        assert block.structure_confidence == 1.0
        assert block.structure_options == []


# ---------------------------------------------------------------------------
# AMA-720: reps_range and X4 rounds pass-through tests
# ---------------------------------------------------------------------------

_REPS_RANGE_LLM_RESPONSE = json.dumps({
    "title": "Leg Day",
    "workout_type": "strength",
    "workout_type_confidence": 0.9,
    "blocks": [
        {
            "label": "Main",
            "structure": None,
            "structure_confidence": 0.85,
            "structure_options": [],
            "rounds": None,
            "exercises": [
                {
                    "name": "Bulgarian Split Squat",
                    "sets": 3,
                    "reps": None,
                    "reps_range": "6-8 each leg",
                    "type": "strength",
                    "notes": "Keep torso upright",
                },
            ],
            "supersets": [],
        }
    ],
})

_X4_ROUNDS_LLM_RESPONSE = json.dumps({
    "title": "Conditioning Block",
    "workout_type": "circuit",
    "workout_type_confidence": 1.0,
    "blocks": [
        {
            "label": "Circuit",
            "structure": "circuit",
            "structure_confidence": 1.0,
            "structure_options": [],
            "rounds": 4,
            "exercises": [
                {
                    "name": "Box Jump",
                    "sets": None,
                    "reps": 10,
                    "type": "strength",
                },
                {
                    "name": "Burpees",
                    "sets": None,
                    "reps": 10,
                    "type": "cardio",
                },
            ],
            "supersets": [],
        }
    ],
})


class TestAMA720RepsRangeParsing:
    """AMA-720: reps_range string and X4 rounds shorthand pass through without mangling."""

    def test_reps_range_string_passes_through_unchanged(self):
        """An exercise with reps_range='6-8 each leg' and reps=null must not be
        collapsed to a numeric reps value — the range string must survive the full
        parse pipeline."""
        mock_client = _mock_openai_client(_REPS_RANGE_LLM_RESPONSE)
        with patch(
            "workout_ingestor_api.services.unified_parser.AIClientFactory.create_openai_client",
            return_value=mock_client,
        ):
            parser = UnifiedParser()
            result = parser.parse(SAMPLE_MEDIA, platform="instagram")
            exercise = result["blocks"][0]["exercises"][0]
            assert exercise["reps"] is None, (
                f"Expected reps=null but got reps={exercise['reps']!r}. "
                "The pipeline must not collapse reps_range into a numeric reps value."
            )
            assert exercise["reps_range"] == "6-8 each leg", (
                f"Expected reps_range='6-8 each leg' but got {exercise['reps_range']!r}. "
                "The range string must pass through unchanged."
            )

    def test_x4_rounds_block_passes_through_unchanged(self):
        """A block with rounds=4 and exercises with sets=null must survive the
        parse pipeline with rounds and sets intact — the X4 shorthand should be
        interpreted as block-level rounds, not per-exercise sets."""
        mock_client = _mock_openai_client(_X4_ROUNDS_LLM_RESPONSE)
        with patch(
            "workout_ingestor_api.services.unified_parser.AIClientFactory.create_openai_client",
            return_value=mock_client,
        ):
            parser = UnifiedParser()
            result = parser.parse(SAMPLE_MEDIA, platform="instagram")
            block = result["blocks"][0]
            assert block["rounds"] == 4, (
                f"Expected rounds=4 but got {block['rounds']!r}. "
                "X4 shorthand must map to block-level rounds, not be lost."
            )
            for ex in block["exercises"]:
                assert ex.get("sets") is None, (
                    f"Expected sets=null on circuit exercise '{ex['name']}' "
                    f"but got sets={ex.get('sets')!r}. "
                    "Circuit exercises must have sets=null; rounds handle repetition."
                )
