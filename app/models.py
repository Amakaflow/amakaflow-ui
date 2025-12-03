"""
Data models for calendar-api tables.

Simple dataclass representation - no ORM needed.
"""
from dataclasses import dataclass, field
from datetime import date, time
from typing import Optional, Any
from uuid import UUID


@dataclass
class WorkoutEventModel:
    """
    Represents a row from the workout_events table.
    """
    id: UUID
    user_id: str
    title: str
    source: str
    date: date
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    type: Optional[str] = None
    status: str = "planned"
    
    # New fields
    is_anchor: bool = False
    primary_muscle: Optional[str] = None
    intensity: Optional[int] = 1
    connected_calendar_id: Optional[UUID] = None
    connected_calendar_type: Optional[str] = None
    external_event_url: Optional[str] = None
    recurrence_rule: Optional[str] = None
    
    json_payload: Optional[dict[str, Any]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


@dataclass
class ConnectedCalendarModel:
    """
    Represents a row from the connected_calendars table.
    """
    id: UUID
    user_id: str
    name: str
    type: str
    integration_type: str
    is_workout_calendar: bool = True
    ics_url: Optional[str] = None
    oauth_token_encrypted: Optional[str] = None
    last_sync: Optional[str] = None
    sync_status: str = "active"
    sync_error_message: Optional[str] = None
    color: Optional[str] = None
    workouts_this_week: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
