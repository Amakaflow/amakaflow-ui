"""Data models for workout ingestion."""
from pydantic import BaseModel, Field
from typing import List, Optional


class Exercise(BaseModel):
    """Represents a single exercise."""
    name: str
    sets: Optional[int] = None
    reps: Optional[int] = None
    reps_range: Optional[str] = None
    duration_sec: Optional[int] = None
    rest_sec: Optional[int] = None
    distance_m: Optional[int] = None
    distance_range: Optional[str] = None
    type: str = "strength"


class Superset(BaseModel):
    """Represents a group of exercises performed as a superset."""
    exercises: List[Exercise] = Field(default_factory=list)
    rest_between_sec: Optional[int] = None  # rest between exercises in superset


class Block(BaseModel):
    """Represents a block or section of a workout."""
    label: Optional[str] = None
    structure: Optional[str] = None  # "3 rounds", "4 sets"
    rest_between_sec: Optional[int] = None  # between sets/rounds
    time_work_sec: Optional[int] = None  # for time-based circuits (e.g., Tabata 20s)
    default_reps_range: Optional[str] = None  # "10-12"
    default_sets: Optional[int] = None  # number of sets/rounds (from structure)
    exercises: List[Exercise] = Field(default_factory=list)  # for backward compatibility
    supersets: List[Superset] = Field(default_factory=list)  # new superset support


class Workout(BaseModel):
    """Represents a complete workout."""
    title: str = "Imported Workout"
    source: Optional[str] = None
    blocks: List[Block] = Field(default_factory=list)

