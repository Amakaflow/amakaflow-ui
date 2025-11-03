"""Unit tests for parser service."""
import pytest
from app.models import Workout, Block, Exercise
from app.services.parser_service import ParserService


class TestParserService:
    """Test cases for ParserService."""
    
    def test_parse_simple_workout(self):
        """Test parsing a simple workout with labeled exercises."""
        text = """
        STRENGTH
        
        A1: Bench Press X10
        A2: Squat X10
        """
        workout = ParserService.parse_free_text_to_workout(text)
        
        assert workout.title == "Imported Workout"
        assert len(workout.blocks) == 1
        assert workout.blocks[0].label == "Strength"
        assert len(workout.blocks[0].supersets) == 1
        assert len(workout.blocks[0].supersets[0].exercises) == 2
        assert workout.blocks[0].supersets[0].exercises[0].name == "A1: Bench Press X10"
        assert workout.blocks[0].supersets[0].exercises[0].reps == 10
        assert workout.blocks[0].supersets[0].exercises[1].name == "A2: Squat X10"
    
    def test_parse_workout_with_reps_range(self):
        """Test parsing workout with rep ranges."""
        text = """
        A1: Bench Press 10-12 reps
        A2: Squat 8-10 reps
        """
        workout = ParserService.parse_free_text_to_workout(text)
        
        assert len(workout.blocks) == 1
        assert workout.blocks[0].supersets[0].exercises[0].reps_range == "10-12"
        assert workout.blocks[0].supersets[0].exercises[1].reps_range == "8-10"
    
    def test_parse_workout_with_structure(self):
        """Test parsing workout with structure (rounds/sets)."""
        text = """
        STRENGTH
        3 sets
        
        A1: Bench Press X10
        """
        workout = ParserService.parse_free_text_to_workout(text)
        
        assert workout.blocks[0].structure == "3 sets"
        assert workout.blocks[0].default_sets == 3
        assert workout.blocks[0].supersets[0].exercises[0].sets == 3
    
    def test_parse_tabata_workout(self):
        """Test parsing Tabata workout."""
        text = """
        Tabata
        20 work / 10 rest X8
        
        A1: Burpees
        """
        workout = ParserService.parse_free_text_to_workout(text)
        
        assert workout.blocks[0].label == "Tabata"
        assert workout.blocks[0].time_work_sec == 20
        assert workout.blocks[0].rest_between_sec == 10
        assert workout.blocks[0].structure == "8 rounds"
    
    def test_parse_distance_based_exercise(self):
        """Test parsing distance-based exercises."""
        text = """
        A1: 200m Run
        A2: 300m Ski Erg
        """
        workout = ParserService.parse_free_text_to_workout(text)
        
        assert workout.blocks[0].supersets[0].exercises[0].distance_m == 200
        assert workout.blocks[0].supersets[0].exercises[1].distance_m == 300
    
    def test_parse_interval_exercise(self):
        """Test parsing interval/timed exercises."""
        text = """
        METABOLIC CONDITIONING
        
        A1: Ski Erg 60S ON 90S OFF X3
        """
        workout = ParserService.parse_free_text_to_workout(text)
        
        exercise = workout.blocks[0].supersets[0].exercises[0]
        assert exercise.duration_sec == 60
        assert exercise.rest_sec == 90
        assert exercise.sets == 3
        assert exercise.type == "interval"
    
    def test_parse_multiple_blocks(self):
        """Test parsing workout with multiple blocks."""
        text = """
        PRIMER
        
        A1: Warm Up X10
        
        STRENGTH
        
        B1: Bench Press X10
        B2: Squat X10
        """
        workout = ParserService.parse_free_text_to_workout(text)
        
        assert len(workout.blocks) == 2
        assert workout.blocks[0].label == "Primer"
        assert workout.blocks[1].label == "Strength"
        assert len(workout.blocks[0].supersets) == 1
        assert len(workout.blocks[1].supersets) == 1
    
    def test_parse_muscular_endurance_multiple_supersets(self):
        """Test parsing Muscular Endurance block with multiple supersets."""
        text = """
        MUSCULAR ENDURANCE
        
        C1: Exercise 1 X10
        C2: Exercise 2 X10
        D1: Exercise 3 X10
        D2: Exercise 4 X10
        """
        workout = ParserService.parse_free_text_to_workout(text)
        
        assert workout.blocks[0].label == "Muscular Endurance"
        assert len(workout.blocks[0].supersets) == 2
        assert len(workout.blocks[0].supersets[0].exercises) == 2
        assert len(workout.blocks[0].supersets[1].exercises) == 2
    
    def test_parse_week_title(self):
        """Test parsing workout with week title."""
        text = """
        Week 1 of 4
        
        STRENGTH
        
        A1: Bench Press X10
        """
        workout = ParserService.parse_free_text_to_workout(text)
        
        assert workout.title == "Week 1 Of 4"
    
    def test_parse_unlabeled_exercise(self):
        """Test parsing unlabeled exercises."""
        text = """
        STRENGTH
        
        Bench Press X10
        Squat X10
        """
        workout = ParserService.parse_free_text_to_workout(text)
        
        assert len(workout.blocks[0].exercises) == 2
        assert workout.blocks[0].exercises[0].name == "Bench Press X10"
        assert workout.blocks[0].exercises[0].reps == 10
    
    def test_is_junk_filters_junk(self):
        """Test that junk lines are filtered out."""
        assert ParserService._is_junk("abc") is True  # Too short
        assert ParserService._is_junk("Like") is True  # Instagram UI
        assert ParserService._is_junk("block 1") is True  # OCR artifact
        assert ParserService._is_junk("Bench Press X10") is False  # Valid exercise
    
    def test_looks_like_header(self):
        """Test header detection."""
        assert ParserService._looks_like_header("STRENGTH") is True
        assert ParserService._looks_like_header("A1: Bench Press") is False
        assert ParserService._looks_like_header("3 sets") is False
    
    def test_clean_ocr_artifacts(self):
        """Test OCR artifact cleaning."""
        lines = ["82: Bench Press", "B1: Squat", "81: Deadlift"]
        cleaned = ParserService._clean_ocr_artifacts(lines)
        
        assert "B2: Bench Press" in cleaned or "B1: Bench Press" in cleaned
        assert "B1: Squat" in cleaned
        assert "B1: Deadlift" in cleaned

