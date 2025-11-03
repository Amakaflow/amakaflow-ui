"""Unit tests for data models."""
import pytest
from app.models import Exercise, Superset, Block, Workout


class TestModels:
    """Test cases for data models."""
    
    def test_exercise_creation(self):
        """Test Exercise model creation."""
        exercise = Exercise(name="Bench Press", reps=10, sets=3)
        
        assert exercise.name == "Bench Press"
        assert exercise.reps == 10
        assert exercise.sets == 3
        assert exercise.type == "strength"
    
    def test_exercise_default_type(self):
        """Test Exercise default type."""
        exercise = Exercise(name="Squat")
        assert exercise.type == "strength"
    
    def test_superset_creation(self):
        """Test Superset model creation."""
        exercise1 = Exercise(name="Bench Press", reps=10)
        exercise2 = Exercise(name="Squat", reps=10)
        superset = Superset(exercises=[exercise1, exercise2], rest_between_sec=60)
        
        assert len(superset.exercises) == 2
        assert superset.rest_between_sec == 60
    
    def test_block_creation(self):
        """Test Block model creation."""
        exercise = Exercise(name="Bench Press", reps=10)
        block = Block(
            label="Strength",
            structure="3 sets",
            exercises=[exercise]
        )
        
        assert block.label == "Strength"
        assert block.structure == "3 sets"
        assert len(block.exercises) == 1
    
    def test_workout_creation(self):
        """Test Workout model creation."""
        block = Block(label="Strength")
        workout = Workout(title="My Workout", blocks=[block], source="test")
        
        assert workout.title == "My Workout"
        assert workout.source == "test"
        assert len(workout.blocks) == 1
    
    def test_workout_defaults(self):
        """Test Workout default values."""
        workout = Workout()
        
        assert workout.title == "Imported Workout"
        assert workout.source is None
        assert workout.blocks == []

