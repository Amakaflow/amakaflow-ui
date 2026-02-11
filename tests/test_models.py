import pytest
from pydantic import ValidationError

from workout_ingestor_api.models import Block, Exercise, Workout


class TestModels:
    def test_block_creation(self):
        """Block can be created with a valid structure value."""
        exercise = Exercise(name="Bench Press", reps=10)

        block = Block(
            label="Strength",
            structure="sets",  # valid literal value
            exercises=[exercise],
        )

        assert block.label == "Strength"
        assert block.structure == "sets"
        assert len(block.exercises) == 1
        assert block.exercises[0].name == "Bench Press"

    def test_block_invalid_structure_raises_error(self):
        """An invalid structure string should raise ValidationError."""
        exercise = Exercise(name="Bench Press", reps=10)

        with pytest.raises(ValidationError):
            Block(
                label="Strength",
                structure="3 sets",  # invalid according to Literal type
                exercises=[exercise],
            )


class TestWorkoutComputedFields:
    """Tests for Workout computed fields (exercises, exercise_count, exercise_names)."""

    def test_exercises_flattened_from_multiple_blocks(self):
        workout = Workout(
            title="Push Pull",
            blocks=[
                Block(exercises=[Exercise(name="Bench Press"), Exercise(name="Flyes")]),
                Block(exercises=[Exercise(name="Rows"), Exercise(name="Curls")]),
            ],
        )
        assert len(workout.exercises) == 4
        assert [e.name for e in workout.exercises] == [
            "Bench Press", "Flyes", "Rows", "Curls"
        ]

    def test_exercises_empty_workout(self):
        workout = Workout(title="Empty")
        assert workout.exercises == []
        assert workout.exercise_count == 0
        assert workout.exercise_names == []

    def test_exercise_count(self):
        workout = Workout(
            title="Test",
            blocks=[
                Block(exercises=[Exercise(name="A"), Exercise(name="B")]),
                Block(exercises=[Exercise(name="C")]),
            ],
        )
        assert workout.exercise_count == 3

    def test_exercise_names_capped_at_10(self):
        exercises = [Exercise(name=f"Ex {i}") for i in range(12)]
        workout = Workout(
            title="Big Workout",
            blocks=[Block(exercises=exercises)],
        )
        names = workout.exercise_names
        assert len(names) == 11  # 10 names + overflow indicator
        assert names[-1] == "... and 2 more"
        assert names[0] == "Ex 0"
        assert names[9] == "Ex 9"

    def test_exercise_names_no_overflow_at_10(self):
        exercises = [Exercise(name=f"Ex {i}") for i in range(10)]
        workout = Workout(
            title="Exactly 10",
            blocks=[Block(exercises=exercises)],
        )
        names = workout.exercise_names
        assert len(names) == 10
        assert "..." not in names[-1]

    def test_computed_fields_in_model_dump(self):
        workout = Workout(
            title="Dump Test",
            blocks=[
                Block(exercises=[Exercise(name="Squats", sets=3, reps=10)]),
            ],
        )
        data = workout.model_dump()
        assert "exercises" in data
        assert "exercise_count" in data
        assert "exercise_names" in data
        assert data["exercise_count"] == 1
        assert data["exercise_names"] == ["Squats"]
        assert data["exercises"][0]["name"] == "Squats"

    def test_computed_fields_after_convert_to_new_structure(self):
        from workout_ingestor_api.models import Superset

        workout = Workout(
            title="Legacy",
            blocks=[
                Block(
                    supersets=[
                        Superset(exercises=[Exercise(name="A"), Exercise(name="B")])
                    ]
                ),
                Block(exercises=[Exercise(name="C")]),
            ],
        )
        converted = workout.convert_to_new_structure()
        assert converted.exercise_count == 3
        assert [e.name for e in converted.exercises] == ["A", "B", "C"]
