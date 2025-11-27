"""
Pydantic schemas for calendar API request/response validation.
"""
from datetime import date, time
from typing import Optional, Literal, Any
from uuid import UUID
from pydantic import BaseModel, Field


class WorkoutEventBase(BaseModel):
    """Base schema for workout event fields."""
    title: str
    date: date
    source: Literal[
        "runna",
        "gym_class",
        "amaka",
        "instagram",
        "tiktok",
        "manual",
        "garmin",
    ] = "manual"
    type: Optional[
        Literal[
            "run",
            "strength",
            "hyrox",
            "class",
            "home_workout",
            "mobility",
            "recovery",
        ]
    ] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    status: Literal["planned", "completed"] = "planned"
    json_payload: Optional[dict[str, Any]] = None


class WorkoutEventCreate(WorkoutEventBase):
    """Schema for creating a new workout event."""
    pass


class WorkoutEventUpdate(BaseModel):
    """Schema for updating a workout event (all fields optional)."""
    title: Optional[str] = None
    date: Optional[date] = None
    source: Optional[
        Literal[
            "runna",
            "gym_class",
            "amaka",
            "instagram",
            "tiktok",
            "manual",
            "garmin",
        ]
    ] = None
    type: Optional[
        Literal[
            "run",
            "strength",
            "hyrox",
            "class",
            "home_workout",
            "mobility",
            "recovery",
        ]
    ] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    status: Optional[Literal["planned", "completed"]] = None
    json_payload: Optional[dict[str, Any]] = None


class WorkoutEvent(WorkoutEventBase):
    """Schema for workout event response (includes id and user_id)."""
    id: UUID
    user_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True

