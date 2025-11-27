"""
Data models for workout_events table.

Simple dataclass representation - no ORM needed.
"""
from dataclasses import dataclass
from datetime import date, time
from typing import Optional, Any
from uuid import UUID


@dataclass
class WorkoutEventModel:
    """
    Represents a row from the workout_events table.
    """
    id: UUID
    user_id: str  # text in DB, matches profiles.id
    title: str
    source: str
    date: date
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    type: Optional[str] = None
    json_payload: Optional[dict[str, Any]] = None
    status: str = "planned"
    created_at: Optional[str] = None  # timestamptz as ISO string
    updated_at: Optional[str] = None  # timestamptz as ISO string

