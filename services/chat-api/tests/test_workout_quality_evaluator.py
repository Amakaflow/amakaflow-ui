import pytest
from backend.services.workout_quality_evaluator import (
    WorkoutQualityEvaluator,
    QualityScore,
)


@pytest.fixture
def evaluator():
    return WorkoutQualityEvaluator()


def test_scores_valid_push_day(evaluator):
    workout = {
        "name": "Push Day",
        "exercises": [
            {"name": "Bench Press", "sets": 4, "reps": 10, "muscle_group": "chest"},
            {"name": "Shoulder Press", "sets": 3, "reps": 12, "muscle_group": "shoulders"},
            {"name": "Tricep Pushdown", "sets": 3, "reps": 15, "muscle_group": "triceps"},
            {"name": "Lateral Raise", "sets": 3, "reps": 15, "muscle_group": "shoulders"},
        ],
    }
    score = evaluator.evaluate(workout)
    assert isinstance(score, QualityScore)
    assert score.overall >= 0.7
    assert score.exercise_count >= 0.8
    assert score.variety >= 0.5


def test_scores_empty_workout_low(evaluator):
    workout = {"name": "Empty", "exercises": []}
    score = evaluator.evaluate(workout)
    assert score.overall < 0.3
    assert "no exercises" in score.issues[0].lower()


def test_detects_duplicate_exercises(evaluator):
    workout = {
        "name": "Dupes",
        "exercises": [
            {"name": "Bench Press", "sets": 3, "reps": 10},
            {"name": "Bench Press", "sets": 3, "reps": 10},
            {"name": "Bench Press", "sets": 3, "reps": 10},
        ],
    }
    score = evaluator.evaluate(workout)
    assert score.variety < 0.5
    assert any("duplicate" in i.lower() for i in score.issues)


def test_detects_insane_rep_ranges(evaluator):
    workout = {
        "name": "Bad Reps",
        "exercises": [
            {"name": "Curls", "sets": 3, "reps": 500},
        ],
    }
    score = evaluator.evaluate(workout)
    assert score.volume_sanity < 0.5
    assert any("rep" in i.lower() for i in score.issues)


def test_detects_hallucinated_exercises(evaluator):
    workout = {
        "name": "Hallucinated",
        "exercises": [
            {"name": "Quantum Bicep Flux", "sets": 3, "reps": 10},
            {"name": "Neuromuscular Synapse Crunch", "sets": 3, "reps": 10},
        ],
    }
    score = evaluator.evaluate(workout)
    assert score.overall < 0.8


def test_equipment_match(evaluator):
    workout = {
        "name": "Bodyweight Only",
        "exercises": [
            {"name": "Push-ups", "sets": 3, "reps": 15, "equipment": "bodyweight"},
            {"name": "Barbell Squat", "sets": 3, "reps": 10, "equipment": "barbell"},
        ],
    }
    score = evaluator.evaluate(workout, requested_equipment=["bodyweight"])
    assert score.equipment_match < 1.0
    assert any("equipment" in i.lower() for i in score.issues)
