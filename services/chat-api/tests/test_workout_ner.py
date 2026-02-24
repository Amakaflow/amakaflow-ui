"""Unit tests for workout_ner service (AMA-686).

Tests spaCy NER Phase 1 - rule-based workout entity extraction.
Accuracy gate: 80% of 20 assertions must pass.
"""

import pytest

from backend.services.workout_ner import (
    build_workout_nlp,
    extract_entities,
    ALL_EXERCISES,
    MODIFIERS,
)


# Marker for NER tests
pytestmark = pytest.mark.ner


@pytest.fixture
def nlp():
    """Build workout NLP pipeline for testing."""
    return build_workout_nlp()


def test_build_workout_nlp_returns_pipeline_with_entityruler(nlp):
    """Test that build_workout_nlp() returns a spaCy pipeline with EntityRuler before NER."""
    assert "entity_ruler" in nlp.pipe_names
    # EntityRuler should be before NER
    pipe_names = nlp.pipe_names
    assert pipe_names.index("entity_ruler") < pipe_names.index("ner")


def test_extract_exercise_from_text(nlp):
    """Test EXERCISE entity extraction."""
    text = "do 3 sets of 10 push-ups"
    result = extract_entities(text, nlp)

    exercise_texts = [e.text.lower() for e in result.exercises]
    assert any("push-up" in ex or "pushup" in ex for ex in exercise_texts)


def test_extract_sets_from_text(nlp):
    """Test SETS entity extraction."""
    text = "do 3 sets of 10 push-ups"
    result = extract_entities(text, nlp)

    sets_texts = [e.text for e in result.sets]
    assert "3" in sets_texts


def test_extract_reps_from_text(nlp):
    """Test REPS entity extraction."""
    text = "do 3 sets of 10 push-ups"
    result = extract_entities(text, nlp)

    reps_texts = [e.text for e in result.reps]
    assert "10" in reps_texts


def test_nxm_shorthand_parsing(nlp):
    """Test NxM shorthand (3x10) correctly parsed as sets=3, reps=10."""
    text = "3x10 push-ups"
    result = extract_entities(text, nlp)

    sets_texts = [e.text for e in result.sets]
    reps_texts = [e.text for e in result.reps]

    assert "3" in sets_texts
    assert "10" in reps_texts


def test_bodyweight_as_load_entity(nlp):
    """Test bodyweight extracted as LOAD entity."""
    text = "bodyweight squats"
    result = extract_entities(text, nlp)

    load_texts = [e.text.lower() for e in result.load]
    assert "bodyweight" in load_texts


def test_bw_as_load_entity(nlp):
    """Test BW extracted as LOAD entity."""
    text = "BW squats"
    result = extract_entities(text, nlp)

    load_texts = [e.text.lower() for e in result.load]
    assert "bw" in load_texts


def test_rest_entity_extraction(nlp):
    """Test REST entity extraction."""
    text = "rest 60 seconds"
    result = extract_entities(text, nlp)

    rest_texts = [e.text.lower() for e in result.rest]
    assert any("rest" in r for r in rest_texts)


def test_duration_entity_extraction(nlp):
    """Test DURATION entity extraction."""
    text = "do plank for 60 seconds"
    result = extract_entities(text, nlp)

    duration_texts = [e.text.lower() for e in result.duration]
    assert any("60" in d or "seconds" in d for d in duration_texts)


def test_load_entity_with_weight(nlp):
    """Test LOAD entity with weight values."""
    text = "barbell squat 100 lbs"
    result = extract_entities(text, nlp)

    load_texts = [e.text.lower() for e in result.load]
    assert any("lbs" in l or "100" in l for l in load_texts)


def test_50_plus_exercises_covered(nlp):
    """Test that 50+ exercises covered in EntityRuler patterns."""
    assert len(ALL_EXERCISES) >= 50


def test_modifiers_covered(nlp):
    """Test that modifiers are included in patterns."""
    assert len(MODIFIERS) >= 8  # weighted, strict, kipping, banded, decline, incline, close grip, wide grip


def test_multiple_exercises_in_text(nlp):
    """Test extraction of multiple exercises from text."""
    text = "do barbell bench press and barbell squat"
    result = extract_entities(text, nlp)

    exercise_texts = [e.text.lower() for e in result.exercises]
    assert any("barbell bench press" in ex for ex in exercise_texts)
    assert any("squat" in ex or "barbell squat" in ex for ex in exercise_texts)


def test_barbell_exercise_extraction(nlp):
    """Test barbell exercise extraction."""
    text = "barbell bench press 4x8"
    result = extract_entities(text, nlp)

    exercise_texts = [e.text.lower() for e in result.exercises]
    assert any("barbell bench press" in ex for ex in exercise_texts)


def test_dumbbell_exercise_extraction(nlp):
    """Test dumbbell exercise extraction."""
    text = "dumbbell curl with 25 lbs"
    result = extract_entities(text, nlp)

    exercise_texts = [e.text.lower() for e in result.exercises]
    assert any("dumbbell curl" in ex or "curl" in ex for ex in exercise_texts)


def test_cardio_exercise_extraction(nlp):
    """Test cardio exercise extraction."""
    text = "run for 20 minutes"
    result = extract_entities(text, nlp)

    exercise_texts = [e.text.lower() for e in result.exercises]
    assert "run" in exercise_texts or "running" in exercise_texts


def test_complex_workout_text(nlp):
    """Test extraction from complex workout text."""
    text = "3x10 barbell squat at 100 lbs, rest 90 seconds between sets"
    result = extract_entities(text, nlp)

    # Check exercise
    exercise_texts = [e.text.lower() for e in result.exercises]
    assert any("squat" in ex or "barbell squat" in ex for ex in exercise_texts)

    # Check sets
    sets_texts = [e.text for e in result.sets]
    assert "3" in sets_texts

    # Check reps
    reps_texts = [e.text for e in result.reps]
    assert "10" in reps_texts

    # Check load
    load_texts = [e.text.lower() for e in result.load]
    assert any("100" in l or "lbs" in l for l in load_texts)


# Accuracy gate test - 80% of 20 assertions must pass
def test_accuracy_gate(nlp):
    """Test accuracy gate: 80% of assertions must pass."""
    test_cases = [
        # (text, expected_exercises, expected_sets, expected_reps)
        ("3x10 push-ups", ["push-up"], ["3"], ["10"]),
        ("4 sets of 8 barbell bench press", ["bench press"], ["4"], ["8"]),
        ("5x5 deadlift", ["deadlift"], ["5"], ["5"]),
        ("bodyweight squats", ["squat"], [], []),
        ("BW pull-ups", ["pull-up"], [], []),
        ("run 30 minutes", ["run"], [], ["30"]),
        ("rest 60 seconds", [], [], []),
        ("dumbbell press 20 lbs", ["dumbbell press"], [], ["20"]),
        ("plank for 60 seconds", ["plank"], [], ["60"]),
        ("burpees 3x15", ["burpee"], ["3"], ["15"]),
    ]

    passed = 0
    total_checks = 0

    for text, expected_exercises, expected_sets, expected_reps in test_cases:
        result = extract_entities(text, nlp)

        # Check exercises
        exercise_texts = [e.text.lower() for e in result.exercises]
        for expected in expected_exercises:
            total_checks += 1
            if any(expected.lower() in ex for ex in exercise_texts):
                passed += 1

        # Check sets
        sets_texts = [e.text for e in result.sets]
        for expected in expected_sets:
            total_checks += 1
            if expected in sets_texts:
                passed += 1

        # Check reps (could be in duration for cardio)
        reps_texts = [e.text for e in result.reps]
        duration_texts = [e.text for e in result.duration]
        for expected in expected_reps:
            total_checks += 1
            if expected in reps_texts or expected in duration_texts:
                passed += 1

    accuracy = passed / total_checks if total_checks > 0 else 0
    assert accuracy >= 0.80, f"Accuracy {accuracy:.2%} is below 80% gate"
