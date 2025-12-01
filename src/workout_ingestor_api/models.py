"""Data models for workout ingestion."""
from pydantic import BaseModel, Field
from typing import List, Optional, Literal


class Exercise(BaseModel):
    """Represents a single exercise."""
    name: str
    sets: Optional[int] = None
    reps: Optional[int] = None
    reps_range: Optional[str] = None
    duration_sec: Optional[int] = None
    rest_sec: Optional[int] = None  # Rest after this exercise (only used in 'regular' structure)
    distance_m: Optional[int] = None
    distance_range: Optional[str] = None
    type: str = "strength"
    notes: Optional[str] = None
    # Video timestamp fields for follow-along mode
    video_start_sec: Optional[int] = None  # When this exercise starts in the source video
    video_end_sec: Optional[int] = None  # When this exercise ends in the source video
    
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
    label: Optional[str] = None
    
    class Config:
        extra = "ignore"  # Ignore extra fields like 'id', 'supersets' from UI
    structure: Optional[Literal[
        'superset',
        'circuit', 
        'tabata',
        'emom',
        'amrap',
        'for-time',
        'rounds',
        'sets',
        'regular'
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
    
    class Config:
        extra = "ignore"  # Ignore extra fields from UI
    
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
            blocks=converted_blocks
        )