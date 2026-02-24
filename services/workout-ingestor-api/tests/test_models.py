import uuid as _uuid

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


class TestBlockPortabilityFields:
    def test_block_gets_uuid_id_by_default(self):
        block = Block(label="Test")
        assert block.id is not None
        _uuid.UUID(block.id)

    def test_block_id_is_unique_per_instance(self):
        b1 = Block(label="A")
        b2 = Block(label="B")
        assert b1.id != b2.id

    def test_block_id_preserved_when_provided(self):
        fixed_id = str(_uuid.uuid4())
        block = Block(label="Test", id=fixed_id)
        assert block.id == fixed_id

    def test_block_source_defaults_to_none(self):
        block = Block(label="Test")
        assert block.source is None

    def test_block_source_roundtrips(self):
        src = {"platform": "instagram", "source_id": "abc123", "source_url": "https://instagram.com/p/abc123/"}
        block = Block(label="Test", source=src)
        assert block.source == src

    def test_block_structure_confidence_defaults_to_1(self):
        block = Block(label="Test")
        assert block.structure_confidence == 1.0

    def test_block_structure_options_defaults_to_empty(self):
        block = Block(label="Test")
        assert block.structure_options == []

    def test_block_structure_options_roundtrips(self):
        block = Block(label="Test", structure_confidence=0.4, structure_options=["circuit", "straight_sets"])
        assert block.structure_confidence == 0.4
        assert block.structure_options == ["circuit", "straight_sets"]

    def test_workout_needs_clarification_defaults_to_false(self):
        workout = Workout(title="Test")
        assert workout.needs_clarification is False

    def test_workout_needs_clarification_roundtrips(self):
        workout = Workout(title="Test", needs_clarification=True)
        assert workout.needs_clarification is True

    def test_block_id_survives_model_dump_and_reload(self):
        original = Block(label="Test", structure="circuit")
        dumped = original.model_dump()
        reloaded = Block(**dumped)
        assert reloaded.id == original.id

    def test_structure_confidence_threshold_constant_exists(self):
        from workout_ingestor_api.models import STRUCTURE_CONFIDENCE_THRESHOLD
        assert 0.0 < STRUCTURE_CONFIDENCE_THRESHOLD < 1.0

    def test_convert_to_new_structure_preserves_portability_fields(self):
        """convert_to_new_structure must not drop id, source, or confidence fields."""
        fixed_id = str(_uuid.uuid4())
        src = {"platform": "instagram", "source_id": "abc", "source_url": "https://..."}
        workout = Workout(
            title="Test",
            needs_clarification=True,
            blocks=[Block(
                label="Block",
                id=fixed_id,
                source=src,
                structure_confidence=0.4,
                structure_options=["circuit", "straight_sets"],
                exercises=[],
            )]
        )
        converted = workout.convert_to_new_structure()
        block = converted.blocks[0]
        assert block.id == fixed_id
        assert block.source == src
        assert block.structure_confidence == 0.4
        assert block.structure_options == ["circuit", "straight_sets"]
        assert converted.needs_clarification is True
