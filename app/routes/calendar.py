"""
Calendar API routes for workout events.

NOTE: Currently using mock data. Database connection will be enabled later.
"""
from datetime import date, datetime
from typing import List
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, Header, Query

from ..schemas import WorkoutEvent, WorkoutEventCreate, WorkoutEventUpdate

router = APIRouter()

# In-memory mock storage (will be replaced with database)
_mock_events: dict[str, dict] = {}


@router.get("", response_model=List[WorkoutEvent])
async def get_calendar_events(
    start: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end: str = Query(..., description="End date (YYYY-MM-DD)"),
    x_user_id: str = Header(..., alias="X-User-Id", description="Authenticated user ID"),
):
    """
    Get workout events for the authenticated user within a date range.
    
    Returns events ordered by date, then start_time.
    
    NOTE: Currently returns mock data. Database connection will be enabled later.
    """
    # Validate date format
    try:
        start_date = date.fromisoformat(start)
        end_date = date.fromisoformat(end)
    except ValueError:
        raise HTTPException(
            status_code=400, detail="Invalid date format. Use YYYY-MM-DD"
        )

    if start_date > end_date:
        raise HTTPException(
            status_code=400, detail="start date must be <= end date"
        )

    # Return mock events filtered by date range and user
    user_events = [e for e in _mock_events.values() if e["user_id"] == x_user_id]
    filtered = [
        e for e in user_events
        if start <= e["date"] <= end
    ]
    
    # Sort by date, then start_time
    filtered.sort(key=lambda x: (x["date"], x.get("start_time") or ""))
    
    return [WorkoutEvent(**e) for e in filtered]


@router.post("", response_model=WorkoutEvent, status_code=201)
async def create_calendar_event(
    event: WorkoutEventCreate,
    x_user_id: str = Header(..., alias="X-User-Id", description="Authenticated user ID"),
):
    """
    Create a new workout event.
    
    NOTE: Currently uses mock storage. Database connection will be enabled later.
    """
    event_id = str(uuid4())
    now = datetime.now().isoformat()
    
    mock_event = {
        "id": event_id,
        "user_id": x_user_id,
        "title": event.title,
        "source": event.source or "manual",
        "date": event.date,
        "start_time": event.start_time,
        "end_time": event.end_time,
        "type": event.type,
        "json_payload": event.json_payload or {},
        "status": event.status or "planned",
        "created_at": now,
        "updated_at": now,
    }
    
    _mock_events[event_id] = mock_event
    return WorkoutEvent(**mock_event)


@router.put("/{event_id}", response_model=WorkoutEvent)
async def update_calendar_event(
    event_id: UUID,
    event_update: WorkoutEventUpdate,
    x_user_id: str = Header(..., alias="X-User-Id", description="Authenticated user ID"),
):
    """
    Update an existing workout event.
    
    NOTE: Currently uses mock storage. Database connection will be enabled later.
    """
    event_id_str = str(event_id)
    
    if event_id_str not in _mock_events:
        raise HTTPException(status_code=404, detail="Event not found")
    
    existing = _mock_events[event_id_str]
    
    if existing["user_id"] != x_user_id:
        raise HTTPException(
            status_code=403, detail="Forbidden: Event does not belong to user"
        )
    
    # Update fields
    if event_update.title is not None:
        existing["title"] = event_update.title
    if event_update.date is not None:
        existing["date"] = event_update.date
    if event_update.source is not None:
        existing["source"] = event_update.source
    if event_update.type is not None:
        existing["type"] = event_update.type
    if event_update.start_time is not None:
        existing["start_time"] = event_update.start_time
    if event_update.end_time is not None:
        existing["end_time"] = event_update.end_time
    if event_update.status is not None:
        existing["status"] = event_update.status
    if event_update.json_payload is not None:
        existing["json_payload"] = event_update.json_payload
    
    existing["updated_at"] = datetime.now().isoformat()
    
    return WorkoutEvent(**existing)


@router.delete("/{event_id}")
async def delete_calendar_event(
    event_id: UUID,
    x_user_id: str = Header(..., alias="X-User-Id", description="Authenticated user ID"),
):
    """
    Delete a workout event.
    
    NOTE: Currently uses mock storage. Database connection will be enabled later.
    """
    event_id_str = str(event_id)
    
    if event_id_str not in _mock_events:
        raise HTTPException(status_code=404, detail="Event not found")
    
    existing = _mock_events[event_id_str]
    
    if existing["user_id"] != x_user_id:
        raise HTTPException(
            status_code=403, detail="Forbidden: Event does not belong to user"
        )
    
    del _mock_events[event_id_str]
    return {"success": True}
