"""
Calendar API routes for workout events.

TODO: Replace X-User-Id header authentication with proper Clerk JWT validation.
For now, the frontend sends X-User-Id header which we trust.
"""
from datetime import date, time
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import ValidationError

from ..db import get_db_connection
from ..schemas import WorkoutEvent, WorkoutEventCreate, WorkoutEventUpdate
from ..models import WorkoutEventModel

router = APIRouter()


def _row_to_event(row: tuple) -> WorkoutEvent:
    """Convert a database row tuple to WorkoutEvent schema."""
    return WorkoutEvent(
        id=row[0],
        user_id=row[1],
        title=row[2],
        source=row[3],
        date=row[4],
        start_time=row[5],
        end_time=row[6],
        type=row[7],
        json_payload=row[8],
        status=row[9],
        created_at=row[10].isoformat() if row[10] else None,
        updated_at=row[11].isoformat() if row[11] else None,
    )


@router.get("", response_model=List[WorkoutEvent])
async def get_calendar_events(
    start: str = Query(..., description="Start date (YYYY-MM-DD)"),
    end: str = Query(..., description="End date (YYYY-MM-DD)"),
    x_user_id: str = Header(..., alias="X-User-Id", description="Authenticated user ID"),
):
    """
    Get workout events for the authenticated user within a date range.
    
    Returns events ordered by date, then start_time.
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

    # TODO: Replace X-User-Id header with proper Clerk JWT validation
    # For now, we trust the header value from the frontend
    user_id = x_user_id

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT 
                    id, user_id, title, source, date, start_time, end_time,
                    type, json_payload, status, created_at, updated_at
                FROM workout_events
                WHERE user_id = %s
                  AND date >= %s
                  AND date <= %s
                ORDER BY date ASC, start_time ASC NULLS LAST
                """,
                (user_id, start_date, end_date),
            )
            rows = cur.fetchall()

    events = [_row_to_event(row) for row in rows]
    return events


@router.post("", response_model=WorkoutEvent, status_code=201)
async def create_calendar_event(
    event: WorkoutEventCreate,
    x_user_id: str = Header(..., alias="X-User-Id", description="Authenticated user ID"),
):
    """
    Create a new workout event for the authenticated user.
    """
    # TODO: Replace X-User-Id header with proper Clerk JWT validation
    user_id = x_user_id

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO workout_events (
                    user_id, title, source, date, start_time, end_time,
                    type, json_payload, status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING 
                    id, user_id, title, source, date, start_time, end_time,
                    type, json_payload, status, created_at, updated_at
                """,
                (
                    user_id,
                    event.title,
                    event.source,
                    event.date,
                    event.start_time,
                    event.end_time,
                    event.type,
                    event.json_payload,
                    event.status,
                ),
            )
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=500, detail="Failed to create event")

    return _row_to_event(row)


@router.put("/{event_id}", response_model=WorkoutEvent)
async def update_calendar_event(
    event_id: UUID,
    event_update: WorkoutEventUpdate,
    x_user_id: str = Header(..., alias="X-User-Id", description="Authenticated user ID"),
):
    """
    Update an existing workout event.
    
    Only updates fields that are provided in the request body.
    Verifies the event exists and belongs to the authenticated user.
    """
    # TODO: Replace X-User-Id header with proper Clerk JWT validation
    user_id = x_user_id

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # First, verify the event exists and belongs to the user
            cur.execute(
                "SELECT id, user_id FROM workout_events WHERE id = %s",
                (str(event_id),),
            )
            existing = cur.fetchone()

            if not existing:
                raise HTTPException(status_code=404, detail="Event not found")

            if existing[1] != user_id:
                raise HTTPException(
                    status_code=403, detail="Forbidden: Event does not belong to user"
                )

            # Build update query dynamically based on provided fields
            update_fields = []
            update_values = []

            if event_update.title is not None:
                update_fields.append("title = %s")
                update_values.append(event_update.title)
            if event_update.date is not None:
                update_fields.append("date = %s")
                update_values.append(event_update.date)
            if event_update.source is not None:
                update_fields.append("source = %s")
                update_values.append(event_update.source)
            if event_update.type is not None:
                update_fields.append("type = %s")
                update_values.append(event_update.type)
            if event_update.start_time is not None:
                update_fields.append("start_time = %s")
                update_values.append(event_update.start_time)
            if event_update.end_time is not None:
                update_fields.append("end_time = %s")
                update_values.append(event_update.end_time)
            if event_update.status is not None:
                update_fields.append("status = %s")
                update_values.append(event_update.status)
            if event_update.json_payload is not None:
                update_fields.append("json_payload = %s")
                update_values.append(event_update.json_payload)

            if not update_fields:
                # No fields to update, just return the existing event
                cur.execute(
                    """
                    SELECT 
                        id, user_id, title, source, date, start_time, end_time,
                        type, json_payload, status, created_at, updated_at
                    FROM workout_events
                    WHERE id = %s
                    """,
                    (str(event_id),),
                )
                row = cur.fetchone()
                return _row_to_event(row)

            # Add event_id to values for WHERE clause
            update_values.append(str(event_id))
            update_values.append(user_id)  # Double-check ownership

            cur.execute(
                f"""
                UPDATE workout_events
                SET {', '.join(update_fields)}, updated_at = now()
                WHERE id = %s AND user_id = %s
                RETURNING 
                    id, user_id, title, source, date, start_time, end_time,
                    type, json_payload, status, created_at, updated_at
                """,
                update_values,
            )
            row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=500, detail="Failed to update event")

    return _row_to_event(row)


@router.delete("/{event_id}")
async def delete_calendar_event(
    event_id: UUID,
    x_user_id: str = Header(..., alias="X-User-Id", description="Authenticated user ID"),
):
    """
    Delete a workout event.
    
    Verifies the event exists and belongs to the authenticated user.
    """
    # TODO: Replace X-User-Id header with proper Clerk JWT validation
    user_id = x_user_id

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # First, verify the event exists and belongs to the user
            cur.execute(
                "SELECT id, user_id FROM workout_events WHERE id = %s",
                (str(event_id),),
            )
            existing = cur.fetchone()

            if not existing:
                raise HTTPException(status_code=404, detail="Event not found")

            if existing[1] != user_id:
                raise HTTPException(
                    status_code=403, detail="Forbidden: Event does not belong to user"
                )

            # Delete the event
            cur.execute(
                "DELETE FROM workout_events WHERE id = %s AND user_id = %s",
                (str(event_id), user_id),
            )

            if cur.rowcount == 0:
                raise HTTPException(status_code=500, detail="Failed to delete event")

    return {"success": True}

