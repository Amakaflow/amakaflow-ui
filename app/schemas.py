"""
Pydantic schemas for calendar API request/response validation.

Updated with full calendar event fields for connected calendars,
anchor workouts, and smart planner features.
"""
from datetime import date, time
from typing import Optional, Literal, Any
from uuid import UUID
from pydantic import BaseModel, Field


# Type definitions
SourceType = Literal[
    "manual",
    "gym_manual_sync",
    "connected_calendar",
    "smart_planner",
    "template",
    "gym_class",
    "amaka",
    "instagram",
    "tiktok",
    "garmin",
    "runna",
    "training_program",
]

WorkoutType = Literal[
    "run",
    "strength",
    "hyrox",
    "class",
    "home_workout",
    "mobility",
    "recovery",
]

StatusType = Literal["planned", "completed"]

PrimaryMuscleType = Literal["upper", "lower", "full_body", "core", "none"]

ConnectedCalendarType = Literal["runna", "apple", "google", "outlook", "ics_custom"]

IntegrationType = Literal["ics_url", "oauth", "os_integration"]

SyncStatusType = Literal["active", "error", "paused"]


class WorkoutEventBase(BaseModel):
    """Base schema for workout event fields."""
    title: str
    date: date
    source: SourceType = "manual"
    type: Optional[WorkoutType] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    status: StatusType = "planned"

    # New fields
    is_anchor: bool = False
    primary_muscle: Optional[PrimaryMuscleType] = None
    intensity: Optional[int] = Field(default=1, ge=0, le=3)
    connected_calendar_id: Optional[UUID] = None
    connected_calendar_type: Optional[ConnectedCalendarType] = None
    external_event_url: Optional[str] = None
    recurrence_rule: Optional[str] = None

    # Program integration fields (AMA-469)
    program_id: Optional[UUID] = None
    program_workout_id: Optional[UUID] = None
    program_week_number: Optional[int] = None

    json_payload: Optional[dict[str, Any]] = None


class WorkoutEventCreate(WorkoutEventBase):
    """Schema for creating a new workout event."""
    pass


class WorkoutEventUpdate(BaseModel):
    """Schema for updating a workout event (all fields optional)."""
    title: Optional[str] = None
    date: Optional[date] = None
    source: Optional[SourceType] = None
    type: Optional[WorkoutType] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    status: Optional[StatusType] = None

    # New fields
    is_anchor: Optional[bool] = None
    primary_muscle: Optional[PrimaryMuscleType] = None
    intensity: Optional[int] = Field(default=None, ge=0, le=3)
    connected_calendar_id: Optional[UUID] = None
    connected_calendar_type: Optional[ConnectedCalendarType] = None
    external_event_url: Optional[str] = None
    recurrence_rule: Optional[str] = None

    # Program integration fields (AMA-469)
    program_id: Optional[UUID] = None
    program_workout_id: Optional[UUID] = None
    program_week_number: Optional[int] = None

    json_payload: Optional[dict[str, Any]] = None


class WorkoutEvent(WorkoutEventBase):
    """Schema for workout event response (includes id and user_id)."""
    id: UUID
    user_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


# Connected Calendar schemas
class ConnectedCalendarBase(BaseModel):
    """Base schema for connected calendar fields."""
    name: str
    type: ConnectedCalendarType
    integration_type: IntegrationType
    is_workout_calendar: bool = True
    ics_url: Optional[str] = None
    color: Optional[str] = None


class ConnectedCalendarCreate(ConnectedCalendarBase):
    """Schema for creating a connected calendar."""
    pass


class ConnectedCalendarUpdate(BaseModel):
    """Schema for updating a connected calendar."""
    name: Optional[str] = None
    is_workout_calendar: Optional[bool] = None
    ics_url: Optional[str] = None
    color: Optional[str] = None
    sync_status: Optional[SyncStatusType] = None


class ConnectedCalendar(ConnectedCalendarBase):
    """Schema for connected calendar response."""
    id: UUID
    user_id: str
    last_sync: Optional[str] = None
    sync_status: SyncStatusType = "active"
    sync_error_message: Optional[str] = None
    workouts_this_week: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True


# Program Events schemas (AMA-469)
class ProgramEventCreate(BaseModel):
    """Schema for creating a single program event in bulk."""
    title: str
    date: date
    type: Optional[WorkoutType] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    primary_muscle: Optional[PrimaryMuscleType] = None
    intensity: Optional[int] = Field(default=1, ge=0, le=3)
    program_workout_id: UUID
    program_week_number: int = Field(ge=1)
    json_payload: Optional[dict[str, Any]] = None


class BulkProgramEventsCreate(BaseModel):
    """Schema for bulk creating program events."""
    program_id: UUID
    events: list[ProgramEventCreate]


class BulkProgramEventsResponse(BaseModel):
    """Response schema for bulk program event creation."""
    program_id: UUID
    events_created: int
    event_ids: list[UUID]


class ProgramEventsResponse(BaseModel):
    """Response schema for listing program events."""
    program_id: UUID
    events: list[WorkoutEvent]
    total: int
