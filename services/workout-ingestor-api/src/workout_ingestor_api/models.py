"""Data models for workout ingestion."""
import uuid
from pydantic import BaseModel, Field, computed_field
from typing import Any, Dict, List, Optional, Literal

# AMA-213: Workout type detection
WorkoutType = Literal['strength', 'circuit', 'hiit', 'cardio', 'follow_along', 'mixed']

# AMA-208: Two-tier confidence threshold system (per design doc Phase 4c)
# >= 0.8  → confident, save as-is (no flag, no clarification)
# 0.5–0.79 → ambiguous, soft flag in UI — structure_options MUST be populated
# < 0.5   → needs interactive clarification — structure_options MUST be populated
STRUCTURE_CONFIDENCE_THRESHOLD = 0.8   # kept for backward-compat (soft-flag boundary)
NEEDS_CLARIFICATION_THRESHOLD = 0.5   # below this → needs_clarification = True


class Exercise(BaseModel):
    """Represents a single exercise."""
    name: str
    sets: Optional[int] = None
    reps: Optional[int] = None
    reps_range: Optional[str] = None
    duration_sec: Optional[int] = None
    rest_sec: Optional[int] = None  # Rest after this exercise (only used in 'regular' structure)
    rest_type: Optional[str] = None  # 'timed' or 'button' for rest between sets
    distance_m: Optional[int] = None
    distance_range: Optional[str] = None
    type: str = "strength"
    notes: Optional[str] = None
    # Video timestamp fields for follow-along mode
    video_start_sec: Optional[int] = None  # When this exercise starts in the source video
    video_end_sec: Optional[int] = None  # When this exercise ends in the source video
    # Warm-up sets (AMA-94)
    warmup_sets: Optional[int] = None  # Number of warm-up sets before working sets
    warmup_reps: Optional[int] = None  # Reps per warm-up set
    # AMA-753: alternative weight options (e.g. 8kg / 12kg)
    load_options: Optional[List[Dict[str, Any]]] = None

    class Config:
        extra = "ignore"  # Ignore extra fields like 'id' from UI


# Legacy Superset class for backward compatibility
class Superset(BaseModel):
    """Deprecated: Use Block with structure='superset' and exercises array instead."""
    exercises: List[Exercise] = Field(default_factory=list)
    rest_between_sec: Optional[int] = None


class Block(BaseModel):
    """
    Represents a block or section of a workout.

    Structure types:
    - 'superset': 2 exercises back to back with no rest between, rest after the pair
    - 'circuit': Multiple exercises back to back with no rest between, rest after the circuit
    - 'tabata': Work/rest intervals (typically 20s work, 10s rest)
    - 'emom': Every Minute On the Minute (work at start of each minute)
    - 'amrap': As Many Rounds As Possible (work for a set time)
    - 'for-time': Complete as fast as possible with optional time cap
    - 'rounds': Fixed number of rounds
    - 'sets': Fixed number of sets with rest between
    - 'regular': Standard workout with rest between exercises
    """

    class Config:
        extra = "ignore"  # Ignore extra fields like 'supersets' from UI; declared fields (id, source, etc.) are accepted normally

    label: Optional[str] = None

    # Portability and confidence fields (AMA-714)
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source: Optional[Dict[str, str]] = None  # {platform, source_id, source_url}
    structure_confidence: float = Field(default=1.0, ge=0.0, le=1.0)  # 0.0–1.0; <0.5 → needs_clarification; 0.5–0.79 → soft flag; >=0.8 → confident
    structure_options: List[str] = Field(default_factory=list)  # LLM candidate structures
    structure: Optional[Literal[
        'superset',
        'circuit',
        'tabata',
        'emom',
        'amrap',
        'for-time',
        'rounds',
        'sets',
        'regular',
        'ladder',
        'pyramid',
        'complex',
        'drop-set',
    ]] = None
    
    # Exercises in order (no duplication - exercises appear only once)
    exercises: List[Exercise] = Field(default_factory=list)
    
    # Structure-specific parameters
    rounds: Optional[int] = None  # For 'rounds' structure: number of rounds
    sets: Optional[int] = None  # For 'sets' structure: number of sets
    time_cap_sec: Optional[int] = None  # For 'amrap' and 'for-time': time limit in seconds
    time_work_sec: Optional[int] = None  # For 'tabata' and 'emom': work time in seconds
    time_rest_sec: Optional[int] = None  # For 'tabata': rest time in seconds
    
    # Rest periods
    rest_between_rounds_sec: Optional[int] = None  # Rest between rounds (for 'rounds', 'circuit', 'superset')
    rest_between_sets_sec: Optional[int] = None  # Rest between sets (for 'sets' structure)
    
    # AMA-753: rep scheme and session metadata
    rep_scheme: Optional[str] = None  # e.g. "15-12-9-6-3", "10-9-8-7-6-5-4-3-2-1"
    rep_scheme_type: Optional[Literal[
        'descending',
        'ascending',
        'pyramid',
        'wave',
        'custom',
    ]] = None
    session: Optional[str] = None  # e.g. "Session 1", "AM", "PM"
    block_type: Optional[Literal[
        'warmup',
        'strength',
        'metcon',
        'cooldown',
        'cardio',
    ]] = None
    load_variants: Optional[List[Dict[str, Any]]] = None  # M/F, RX/Scaled weight options

    # Legacy fields for backward compatibility (deprecated)
    rest_between_sec: Optional[int] = None  # Alias for rest_between_rounds_sec
    default_reps_range: Optional[str] = None  # Deprecated
    default_sets: Optional[int] = None  # Deprecated
    supersets: List[Superset] = Field(default_factory=list)  # Deprecated - use exercises with structure='superset'


class Workout(BaseModel):
    """Represents a complete workout."""
    title: str = "Imported Workout"
    source: Optional[str] = None
    blocks: List[Block] = Field(default_factory=list)
    # AMA-213: Workout type detection
    workout_type: Optional[WorkoutType] = None
    workout_type_confidence: Optional[float] = None
    needs_clarification: bool = False  # True if any block has structure_confidence < threshold

    class Config:
        extra = "ignore"  # Ignore extra fields from UI

    @computed_field
    @property
    def exercises(self) -> List[Exercise]:
        """Flatten all exercises from all blocks into a single list."""
        return [ex for block in self.blocks for ex in block.exercises]

    @computed_field
    @property
    def exercise_count(self) -> int:
        """Total number of exercises across all blocks."""
        return len(self.exercises)

    @computed_field
    @property
    def exercise_names(self) -> List[str]:
        """Exercise names capped at 10 with overflow indicator."""
        all_exercises = self.exercises
        names = [ex.name for ex in all_exercises[:10]]
        if len(all_exercises) > 10:
            names.append(f"... and {len(all_exercises) - 10} more")
        return names

    def convert_to_new_structure(self) -> 'Workout':
        """
        Convert workout from old format (with supersets) to new format (exercises with structure).
        This method flattens supersets into exercises array and sets appropriate structure type.
        """
        converted_blocks = []
        
        for block in self.blocks:
            # Start with existing exercises
            exercises = block.exercises.copy() if block.exercises else []
            structure = block.structure
            rest_between_rounds_sec = block.rest_between_rounds_sec or block.rest_between_sec
            
            # Convert supersets to exercises
            if hasattr(block, 'supersets') and block.supersets:
                for superset in block.supersets:
                    exercises.extend(superset.exercises)
                    
                    # Use rest from superset if not already set
                    if superset.rest_between_sec and not rest_between_rounds_sec:
                        rest_between_rounds_sec = superset.rest_between_sec
                
                # Auto-detect structure if not set
                if not structure:
                    if len(exercises) == 2:
                        structure = 'superset'
                    elif len(exercises) > 2:
                        structure = 'circuit'
            
            # Create new block with converted structure
            converted_block = Block(
                label=block.label,
                id=block.id,                                      # preserve identity
                source=block.source,                               # preserve provenance
                structure_confidence=block.structure_confidence,   # preserve confidence
                structure_options=block.structure_options,         # preserve options
                structure=structure,
                exercises=exercises,
                rounds=block.rounds,
                sets=block.sets,
                time_cap_sec=block.time_cap_sec,
                time_work_sec=block.time_work_sec,
                time_rest_sec=block.time_rest_sec,
                rest_between_rounds_sec=rest_between_rounds_sec,
                rest_between_sets_sec=block.rest_between_sets_sec,
                # Legacy fields for backward compatibility
                rest_between_sec=rest_between_rounds_sec,
            )
            
            converted_blocks.append(converted_block)
        
        return Workout(
            title=self.title,
            source=self.source,
            blocks=converted_blocks,
            # AMA-213: Preserve workout type detection
            workout_type=self.workout_type,
            workout_type_confidence=self.workout_type_confidence,
            needs_clarification=self.needs_clarification,
        )
