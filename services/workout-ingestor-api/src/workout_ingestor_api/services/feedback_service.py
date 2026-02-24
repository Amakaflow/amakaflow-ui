"""Service for collecting user feedback to improve OCR and parsing."""
import json
import os
from datetime import datetime
from typing import List, Dict
from pathlib import Path

# Path to store feedback data
FEEDBACK_DIR = Path(__file__).parent.parent / "feedback_data"
FEEDBACK_DIR.mkdir(exist_ok=True)

NOT_WORKOUT_FILE = FEEDBACK_DIR / "not_workout_patterns.json"
JUNK_PATTERNS_FILE = FEEDBACK_DIR / "junk_patterns.json"


class FeedbackService:
    """Service for collecting and using user feedback to improve OCR/parsing."""
    
    @staticmethod
    def record_not_workout(text: str, block_label: str = None, source: str = None) -> None:
        """
        Record text that user marked as "not a workout" to improve future filtering.
        
        Args:
            text: Text content that was marked as not a workout
            block_label: Label of the block that was deleted
            source: Source of the workout (e.g., "instagram", "image")
        """
        try:
            # Load existing patterns
            patterns = []
            if NOT_WORKOUT_FILE.exists():
                with open(NOT_WORKOUT_FILE, 'r') as f:
                    patterns = json.load(f)
            
            # Add new pattern
            pattern = {
                "text": text,
                "block_label": block_label,
                "source": source,
                "timestamp": datetime.now().isoformat()
            }
            patterns.append(pattern)
            
            # Keep only last 1000 patterns to avoid file bloat
            if len(patterns) > 1000:
                patterns = patterns[-1000:]
            
            # Save back
            with open(NOT_WORKOUT_FILE, 'w') as f:
                json.dump(patterns, f, indent=2)
        except Exception as e:
            # Don't fail if feedback storage fails
            print(f"Failed to record feedback: {e}")
    
    @staticmethod
    def record_junk_pattern(text: str, reason: str = None) -> None:
        """
        Record junk patterns that users confirm are junk.
        
        Args:
            text: Text that was confirmed as junk
            reason: Reason for filtering (e.g., "junk_detection", "numeric_unit_only")
        """
        try:
            # Load existing patterns
            patterns = []
            if JUNK_PATTERNS_FILE.exists():
                with open(JUNK_PATTERNS_FILE, 'r') as f:
                    patterns = json.load(f)
            
            # Add new pattern
            pattern = {
                "text": text,
                "reason": reason,
                "timestamp": datetime.now().isoformat()
            }
            patterns.append(pattern)
            
            # Keep only last 1000 patterns
            if len(patterns) > 1000:
                patterns = patterns[-1000:]
            
            # Save back
            with open(JUNK_PATTERNS_FILE, 'w') as f:
                json.dump(patterns, f, indent=2)
        except Exception as e:
            print(f"Failed to record junk pattern: {e}")
    
    @staticmethod
    def get_not_workout_patterns() -> List[Dict]:
        """Get all recorded 'not workout' patterns."""
        if NOT_WORKOUT_FILE.exists():
            try:
                with open(NOT_WORKOUT_FILE, 'r') as f:
                    return json.load(f)
            except Exception:
                return []
        return []
    
    @staticmethod
    def get_junk_patterns() -> List[Dict]:
        """Get all recorded junk patterns."""
        if JUNK_PATTERNS_FILE.exists():
            try:
                with open(JUNK_PATTERNS_FILE, 'r') as f:
                    return json.load(f)
            except Exception:
                return []
        return []
    
    @staticmethod
    def is_likely_not_workout(text: str) -> bool:
        """
        Check if text matches known 'not workout' patterns.
        
        Args:
            text: Text to check
            
        Returns:
            True if text matches known not-workout patterns
        """
        patterns = FeedbackService.get_not_workout_patterns()
        text_lower = text.lower().strip()
        
        for pattern in patterns:
            pattern_text = pattern.get("text", "").lower().strip()
            # Check if text contains the pattern or vice versa
            if pattern_text in text_lower or text_lower in pattern_text:
                return True
            # Check for similar patterns (same words)
            pattern_words = set(pattern_text.split())
            text_words = set(text_lower.split())
            if len(pattern_words) > 0 and len(text_words) > 0:
                # If > 50% words match, consider it similar
                overlap = len(pattern_words & text_words) / len(pattern_words | text_words)
                if overlap > 0.5:
                    return True
        
        return False

