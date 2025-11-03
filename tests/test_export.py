"""Unit tests for export service."""
import pytest
from app.models import Workout, Block, Exercise, Superset
from app.services.export_service import ExportService


class TestExportService:
    """Test cases for ExportService."""
    
    def test_render_text_for_tp_simple(self):
        """Test rendering simple workout as TP text."""
        exercise = Exercise(name="Bench Press", reps=10, sets=3)
        block = Block(label="Strength", exercises=[exercise])
        workout = Workout(title="Test Workout", blocks=[block])
        
        text = ExportService.render_text_for_tp(workout)
        
        assert "# Test Workout" in text
        assert "## Strength" in text
        assert "Bench Press" in text
        assert "10 reps" in text
        assert "3 sets" in text
    
    def test_render_text_for_tp_with_source(self):
        """Test rendering workout with source."""
        workout = Workout(title="Test", source="test_source", blocks=[])
        
        text = ExportService.render_text_for_tp(workout)
        
        assert "(source: test_source)" in text
    
    def test_render_text_for_tp_with_supersets(self):
        """Test rendering workout with supersets."""
        exercise1 = Exercise(name="Bench Press", reps=10)
        exercise2 = Exercise(name="Squat", reps=10)
        superset = Superset(exercises=[exercise1, exercise2])
        block = Block(label="Strength", supersets=[superset])
        workout = Workout(title="Test", blocks=[block])
        
        text = ExportService.render_text_for_tp(workout)
        
        assert "Bench Press" in text
        assert "Squat" in text
    
    def test_render_tcx_simple(self):
        """Test rendering simple workout as TCX."""
        exercise = Exercise(name="Bench Press", reps=10)
        block = Block(label="Strength", exercises=[exercise])
        workout = Workout(title="Test Workout", blocks=[block])
        
        tcx = ExportService.render_tcx(workout)
        
        assert "<?xml version=\"1.0\"" in tcx
        assert "TrainingCenterDatabase" in tcx
        assert "Bench Press" in tcx
        assert "10 reps" in tcx
    
    def test_render_tcx_with_distance(self):
        """Test rendering workout with distance."""
        exercise = Exercise(name="Run", distance_m=200)
        block = Block(label="Cardio", exercises=[exercise])
        workout = Workout(title="Test", blocks=[block])
        
        tcx = ExportService.render_tcx(workout)
        
        assert "200m" in tcx
    
    def test_canonical_name(self):
        """Test exercise name canonicalization."""
        assert ExportService._canonical_name("db incline bench press") == "Dumbbell Incline Bench Press"
        assert ExportService._canonical_name("trx row") == "TRX Row"
        assert ExportService._canonical_name("unknown exercise") == "unknown exercise"
    
    def test_infer_sets_reps_with_reps(self):
        """Test inferring sets and reps when reps are provided."""
        exercise = Exercise(name="Bench Press", reps=10, sets=3)
        sets, reps = ExportService._infer_sets_reps(exercise)
        
        assert sets == 3
        assert reps == 10
    
    def test_infer_sets_reps_with_range(self):
        """Test inferring sets and reps with rep range."""
        exercise = Exercise(name="Bench Press", reps_range="10-12", sets=3)
        sets, reps = ExportService._infer_sets_reps(exercise)
        
        assert sets == 3
        assert reps == 12  # Uses upper bound
    
    def test_infer_sets_reps_defaults(self):
        """Test inferring sets and reps with defaults."""
        exercise = Exercise(name="Bench Press")
        sets, reps = ExportService._infer_sets_reps(exercise)
        
        assert sets == 3  # Default sets
        assert reps == 8  # Default reps
    
    def test_rounds_from_structure(self):
        """Test extracting rounds from structure string."""
        assert ExportService._rounds_from_structure("3 rounds") == 3
        assert ExportService._rounds_from_structure("5 sets") == 5
        assert ExportService._rounds_from_structure(None) == 1
        assert ExportService._rounds_from_structure("invalid") == 1

