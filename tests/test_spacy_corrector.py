import pytest
from workout_ingestor_api.services.spacy_corrector import SpacyCorrector


@pytest.fixture
def corrector():
    return SpacyCorrector()


def _single_block(raw_text: str, block_override: dict = None) -> dict:
    block = {"structure": None, "exercises": [{"name": "Squat", "sets": 3, "reps": 10}], "supersets": []}
    if block_override:
        block.update(block_override)
    return {"title": "Test", "blocks": [block]}


def test_rounds_extracted_from_x4_rounds(corrector):
    data = _single_block("X4 Rounds\nSquat 3x10")
    result = corrector.correct(data, raw_text="X4 Rounds\nSquat 3x10")
    assert result["blocks"][0].get("rounds") == 4

def test_rounds_extracted_from_4_rounds(corrector):
    data = _single_block("")
    result = corrector.correct(data, raw_text="4 rounds of each exercise")
    assert result["blocks"][0].get("rounds") == 4

def test_rest_extracted_from_rest_1_2_mins(corrector):
    data = _single_block("")
    result = corrector.correct(data, raw_text="rest 1-2 mins between sets")
    assert result["blocks"][0].get("rest_between_rounds_sec") == 90

def test_rest_extracted_single_value(corrector):
    data = _single_block("")
    result = corrector.correct(data, raw_text="rest 60 seconds")
    assert result["blocks"][0].get("rest_between_rounds_sec") == 60

def test_per_side_note_added_to_exercise(corrector):
    data = _single_block("6-8 reps each leg", {"exercises": [{"name": "Lunge", "sets": 3, "reps": 10}]})
    result = corrector.correct(data, raw_text="6-8 reps each leg")
    exercise = result["blocks"][0]["exercises"][0]
    assert "(per side)" in (exercise.get("notes") or "")

def test_no_mutation_when_nothing_matches(corrector):
    data = {"title": "Test", "blocks": [{"exercises": [], "supersets": []}]}
    result = corrector.correct(data, raw_text="just some plain text")
    assert result["blocks"][0].get("rounds") is None

def test_existing_rounds_not_overwritten(corrector):
    block = {"structure": "circuit", "rounds": 5, "exercises": [], "supersets": []}
    data = {"title": "Test", "blocks": [block]}
    result = corrector.correct(data, raw_text="3 rounds")
    assert result["blocks"][0]["rounds"] == 5

def test_rounds_zero_not_overwritten(corrector):
    """rounds=0 (AMRAP/open-ended) must not be overwritten."""
    block = {"structure": "amrap", "rounds": 0, "exercises": [], "supersets": []}
    data = {"title": "Test", "blocks": [block]}
    result = corrector.correct(data, raw_text="3 rounds")
    assert result["blocks"][0]["rounds"] == 0

def test_multiple_distinct_round_counts_skipped(corrector):
    """When text has two different round counts, do not apply either."""
    data = {"title": "Test", "blocks": [
        {"exercises": [], "supersets": []},
        {"exercises": [], "supersets": []},
    ]}
    result = corrector.correct(data, raw_text="Block A: 4 rounds\nBlock B: 6 rounds")
    assert result["blocks"][0].get("rounds") is None
    assert result["blocks"][1].get("rounds") is None


class TestSpacyCorrectorConfidenceUpgrade:
    """Corrector upgrades confidence when explicit round signal is found."""

    # TODO(AMA-714-followup): workout_sanitizer.py can reset block["structure"] = None (superset
    # with no valid supersets path) without clearing structure_confidence. The corrector then runs
    # and may upgrade structure_confidence to 1.0 when a round signal is present, producing a
    # block with structure=None, structure_confidence=1.0 — a high-confidence incoherent state.
    # Fix: sanitizer should clear structure_confidence when resetting structure to None.
    # See: workout_sanitizer.py line ~87 (block["structure"] = None path)

    def _corrector(self):
        from workout_ingestor_api.services.spacy_corrector import SpacyCorrector
        return SpacyCorrector()

    def test_confidence_upgraded_to_1_when_rounds_found_in_text(self):
        corrector = self._corrector()
        workout_data = {
            "blocks": [{
                "label": "Block",
                "structure": "circuit",
                "structure_confidence": 0.4,
                "structure_options": ["circuit", "straight_sets"],
                "exercises": [{"name": "Squat", "notes": None}],
                "supersets": [],
            }]
        }
        result = corrector.correct(workout_data, raw_text="X4 Rounds: Squat, Deadlift, Lunge")
        block = result["blocks"][0]
        assert block["structure_confidence"] == 1.0
        assert block["structure_options"] == []

    def test_confidence_not_changed_when_no_rounds_in_text(self):
        corrector = self._corrector()
        workout_data = {
            "blocks": [{
                "label": "Block",
                "structure": None,
                "structure_confidence": 0.4,
                "structure_options": ["circuit", "straight_sets"],
                "exercises": [{"name": "Squat", "notes": None}],
                "supersets": [],
            }]
        }
        result = corrector.correct(workout_data, raw_text="Squat, Deadlift, Lunge")
        block = result["blocks"][0]
        assert block["structure_confidence"] == 0.4
        assert block["structure_options"] == ["circuit", "straight_sets"]

    def test_confidence_not_downgraded_when_already_high(self):
        corrector = self._corrector()
        workout_data = {
            "blocks": [{
                "label": "Block",
                "structure": "circuit",
                "structure_confidence": 1.0,
                "structure_options": [],
                "exercises": [{"name": "Squat", "notes": None}],
                "supersets": [],
            }]
        }
        result = corrector.correct(workout_data, raw_text="X4 Rounds: Squat")
        assert result["blocks"][0]["structure_confidence"] == 1.0
        assert result["blocks"][0]["structure_options"] == []

    def test_confidence_upgrade_uses_get_with_default(self):
        """Blocks missing confidence field entirely are handled safely."""
        corrector = self._corrector()
        workout_data = {
            "blocks": [{
                "label": "Block",
                "structure": "circuit",
                # No structure_confidence or structure_options keys at all
                "exercises": [],
                "supersets": [],
            }]
        }
        # Should not raise
        result = corrector.correct(workout_data, raw_text="4 rounds of squats")
        block = result["blocks"][0]
        # Should be upgraded to 1.0
        assert block.get("structure_confidence") == 1.0
        assert block.get("structure_options") == []

    def test_confidence_upgraded_when_rounds_already_set_by_llm(self):
        """Even if LLM already set block.rounds, confidence is upgraded if raw text has a round signal."""
        corrector = self._corrector()
        workout_data = {
            "blocks": [{
                "label": "Block",
                "structure": "circuit",
                "rounds": 4,  # LLM already set this
                "structure_confidence": 0.5,
                "structure_options": ["circuit", "straight_sets"],
                "exercises": [{"name": "Squat", "notes": None}],
                "supersets": [],
            }]
        }
        result = corrector.correct(workout_data, raw_text="4 rounds of squats")
        block = result["blocks"][0]
        assert block["structure_confidence"] == 1.0
        assert block["structure_options"] == []
