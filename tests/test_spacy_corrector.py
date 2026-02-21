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
