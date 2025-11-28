import pytest
from pydantic import ValidationError

from workout_ingestor_api.models import Block, Exercise


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
