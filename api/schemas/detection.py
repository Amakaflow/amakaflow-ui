"""Detection schemas for workout auto-detection endpoint.

Part of AMA-688: Auto-detection endpoint for matching wearable-detected
exercises against scheduled AmakaFlow workouts.
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DetectionRequest(BaseModel):
    """Request body for workout detection endpoint."""
    user_id: str
    device: str  # "apple_watch" | "garmin" | "wear_os"
    timestamp: datetime
    sport: str  # "strength" | "running" | "cycling" | "cardio" | "unknown"
    detected_exercises: list[str]  # e.g. ["squat", "deadlift"]


class DetectionMatch(BaseModel):
    """Response from workout detection endpoint."""
    matched: bool
    workout_id: Optional[str] = None
    workout_name: Optional[str] = None
    confidence: Optional[float] = None
    reason: Optional[str] = None  # "no_scheduled_workout" | "low_confidence" | "sport_mismatch"


class ScheduledWorkout(BaseModel):
    """Internal model for scheduled workout data."""
    id: str
    name: str
    sport: str
    scheduled_time: datetime
    exercises: list[str]
