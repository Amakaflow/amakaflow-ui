"""Unit tests for canonical AI format parser."""
import pytest
from app.services.parser_service import ParserService
from app.models import Workout, Block, Exercise


class TestCanonicalFormatDetection:
    """Test canonical format detection."""
    
    def test_detects_canonical_format(self):
        """Test that canonical format is detected correctly."""
        text = """Title: Test Workout

Block: Warm-Up
- Exercise 1 | type:warmup

Block: Main
- Exercise 2 | 3×8 | type:strength"""
        
        assert ParserService.looks_like_canonical_ai_format(text) is True
    
    def test_detects_non_canonical_format(self):
        """Test that free-form text is not detected as canonical."""
        text = """Test Workout

• Exercise 1
• Exercise 2 – 3×8"""
        
        assert ParserService.looks_like_canonical_ai_format(text) is False
    
    def test_requires_title_and_block(self):
        """Test that both title and block are required."""
        # Missing title
        text = """Block: Warm-Up
- Exercise 1"""
        assert ParserService.looks_like_canonical_ai_format(text) is False
        
        # Missing block
        text = """Title: Test Workout
- Exercise 1"""
        assert ParserService.looks_like_canonical_ai_format(text) is False


class TestCanonicalFormatParsing:
    """Test canonical format parsing."""
    
    def test_parse_simple_workout(self):
        """Test parsing a simple workout."""
        text = """Title: Simple Workout

Block: Warm-Up
- Shoulder mobility | type:warmup

Block: Main
- Bench Press | 3×8 | type:strength"""
        
        result = ParserService.parse_canonical_ai_workout(text)
        
        assert result["title"] == "Simple Workout"
        assert len(result["blocks"]) == 2
        assert result["blocks"][0]["label"] == "Warm-Up"
        assert len(result["blocks"][0]["exercises"]) == 1
        assert result["blocks"][0]["exercises"][0]["name"] == "Shoulder mobility"
        assert result["blocks"][0]["exercises"][0]["type"] == "warmup"
    
    def test_parse_sets_and_reps(self):
        """Test parsing sets and reps."""
        text = """Title: Test

Block: Main
- Exercise 1 | 3×8 | type:strength
- Exercise 2 | 4×6–8 | type:strength
- Exercise 3 | 3×AMRAP | type:amrap"""
        
        result = ParserService.parse_canonical_ai_workout(text)
        exercises = result["blocks"][0]["exercises"]
        
        # Exercise 1: 3×8
        assert exercises[0]["sets"] == 3
        assert exercises[0]["reps"] == 8
        assert exercises[0]["reps_range"] is None
        
        # Exercise 2: 4×6–8
        assert exercises[1]["sets"] == 4
        assert exercises[1]["reps"] is None
        assert exercises[1]["reps_range"] == "6-8"
        
        # Exercise 3: 3×AMRAP
        assert exercises[2]["sets"] == 3
        assert exercises[2]["reps"] is None
        assert exercises[2]["reps_range"] == "AMRAP"
        assert exercises[2]["type"] == "amrap"
    
    def test_parse_notes(self):
        """Test parsing exercise notes."""
        text = """Title: Test

Block: Main
- Bench Press | 4×6–8 | type:strength | note:Heavy, main lower body driver"""
        
        result = ParserService.parse_canonical_ai_workout(text)
        exercise = result["blocks"][0]["exercises"][0]
        
        assert exercise["name"] == "Bench Press"
        assert exercise["notes"] == "Heavy, main lower body driver"
    
    def test_parse_type_inference(self):
        """Test that exercise type is inferred from block label."""
        text = """Title: Test

Block: Warm-Up
- Exercise 1

Block: Cool-Down
- Exercise 2

Block: Main Strength
- Exercise 3"""
        
        result = ParserService.parse_canonical_ai_workout(text)
        
        assert result["blocks"][0]["exercises"][0]["type"] == "warmup"
        assert result["blocks"][1]["exercises"][0]["type"] == "cooldown"
        assert result["blocks"][2]["exercises"][0]["type"] == "strength"
    
    def test_parse_multiple_blocks(self):
        """Test parsing multiple blocks."""
        text = """Title: Full Workout

Block: Warm-Up
- Exercise 1 | type:warmup

Block: Main
- Exercise 2 | 3×8 | type:strength

Block: Cool-Down
- Exercise 3 | type:cooldown"""
        
        result = ParserService.parse_canonical_ai_workout(text)
        
        assert len(result["blocks"]) == 3
        assert result["blocks"][0]["label"] == "Warm-Up"
        assert result["blocks"][1]["label"] == "Main"
        assert result["blocks"][2]["label"] == "Cool-Down"
    
    def test_parse_empty_block_label(self):
        """Test that empty block label defaults to 'Workout'."""
        text = """Title: Test

Block:
- Exercise 1 | 3×8"""
        
        result = ParserService.parse_canonical_ai_workout(text)
        
        assert result["blocks"][0]["label"] == "Workout"
    
    def test_parse_missing_title(self):
        """Test that missing title defaults to 'Untitled Workout'."""
        text = """Block: Main
- Exercise 1 | 3×8"""
        
        result = ParserService.parse_canonical_ai_workout(text)
        
        assert result["title"] == "Untitled Workout"
    
    def test_parse_exercise_without_sets_reps(self):
        """Test parsing exercises without sets/reps."""
        text = """Title: Test

Block: Warm-Up
- Dynamic mobility | type:warmup
- Hip flexor stretch | type:cooldown"""
        
        result = ParserService.parse_canonical_ai_workout(text)
        exercises = result["blocks"][0]["exercises"]
        
        assert exercises[0]["name"] == "Dynamic mobility"
        assert exercises[0]["sets"] is None
        assert exercises[0]["reps"] is None
        assert exercises[1]["name"] == "Hip flexor stretch"


class TestSetsRepsParsing:
    """Test sets/reps field parsing."""
    
    def test_parse_amrap(self):
        """Test parsing AMRAP format."""
        sets, reps, reps_range = ParserService._parse_sets_reps_field("3×AMRAP")
        assert sets == 3
        assert reps is None
        assert reps_range == "AMRAP"
    
    def test_parse_rep_range(self):
        """Test parsing rep range format."""
        sets, reps, reps_range = ParserService._parse_sets_reps_field("4×6–8")
        assert sets == 4
        assert reps is None
        assert reps_range == "6-8"
    
    def test_parse_sets_and_reps(self):
        """Test parsing sets and reps format."""
        sets, reps, reps_range = ParserService._parse_sets_reps_field("3×8")
        assert sets == 3
        assert reps == 8
        assert reps_range is None
    
    def test_parse_just_reps(self):
        """Test parsing just reps (no sets)."""
        sets, reps, reps_range = ParserService._parse_sets_reps_field("8")
        assert sets is None
        assert reps == 8
        assert reps_range is None
    
    def test_parse_invalid_format(self):
        """Test parsing invalid format returns None."""
        sets, reps, reps_range = ParserService._parse_sets_reps_field("invalid")
        assert sets is None
        assert reps is None
        assert reps_range is None


class TestRouterFunction:
    """Test the parse_ai_workout router function."""
    
    def test_routes_to_canonical_parser(self):
        """Test that canonical format routes to canonical parser."""
        text = """Title: Test Workout

Block: Main
- Exercise 1 | 3×8 | type:strength"""
        
        result = ParserService.parse_ai_workout(text)
        
        assert isinstance(result, Workout)
        assert result.title == "Test Workout"
        assert len(result.blocks) == 1
        assert result.blocks[0].label == "Main"
    
    def test_routes_to_freeform_parser(self):
        """Test that free-form text routes to freeform parser."""
        text = """Test Workout

• Exercise 1 – 3×8
• Exercise 2 – 4×6"""
        
        result = ParserService.parse_ai_workout(text)
        
        assert isinstance(result, Workout)
        # Freeform parser should still work
        assert len(result.blocks) > 0


class TestJSONMode:
    """Test JSON mode detection and parsing."""
    
    def test_detects_json(self):
        """Test that JSON is detected correctly."""
        text = '{"title": "Test", "blocks": []}'
        assert ParserService.looks_like_json(text) is True
    
    def test_detects_non_json(self):
        """Test that non-JSON text is not detected as JSON."""
        text = "This is not JSON"
        assert ParserService.looks_like_json(text) is False
    
    def test_parse_valid_json(self):
        """Test parsing valid JSON workout."""
        json_text = """{
            "title": "Test Workout",
            "blocks": [
                {
                    "label": "Main",
                    "exercises": [
                        {
                            "name": "Bench Press",
                            "sets": 3,
                            "reps": 8,
                            "type": "strength"
                        }
                    ]
                }
            ]
        }"""
        
        result = ParserService.parse_json_workout(json_text)
        
        assert result["title"] == "Test Workout"
        assert len(result["blocks"]) == 1
        assert result["blocks"][0]["label"] == "Main"
        assert len(result["blocks"][0]["exercises"]) == 1
        assert result["blocks"][0]["exercises"][0]["name"] == "Bench Press"
    
    def test_parse_json_validation_errors(self):
        """Test that invalid JSON raises appropriate errors."""
        # Missing title
        with pytest.raises(ValueError, match="must contain 'title' and 'blocks'"):
            ParserService.parse_json_workout('{"blocks": []}')
        
        # Missing blocks
        with pytest.raises(ValueError, match="must contain 'title' and 'blocks'"):
            ParserService.parse_json_workout('{"title": "Test"}')
        
        # Invalid blocks type
        with pytest.raises(ValueError, match="'blocks' must be a list"):
            ParserService.parse_json_workout('{"title": "Test", "blocks": "invalid"}')
        
        # Missing block label
        with pytest.raises(ValueError, match="missing label"):
            ParserService.parse_json_workout('{"title": "Test", "blocks": [{"exercises": []}]}')


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

