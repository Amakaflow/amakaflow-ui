"""
Calendar API routes for workout events.

Connected to Supabase PostgreSQL database.
"""
from datetime import date, datetime
from typing import List, Optional
from uuid import UUID
import json

from fastapi import APIRouter, HTTPException, Header, Query
import httpx

from ..schemas import (
    WorkoutEvent, WorkoutEventCreate, WorkoutEventUpdate,
    ConnectedCalendar, ConnectedCalendarCreate, ConnectedCalendarUpdate
)
from ..db import get_db_connection
from ..utils.ics_parser import parse_ics_content, convert_to_workout_event
from ..utils.recurrence import expand_recurring_event, should_expand_recurring_event

router = APIRouter()


# ============================================
# WORKOUT EVENTS ENDPOINTS
# ============================================

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

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Query for events in two parts:
            # 1. Non-recurring events in the date range
            # 2. Recurring events that might have instances in the date range
            #    (original event date is before or during the range)
            cur.execute("""
                SELECT
                    id, user_id, title, source, date, start_time, end_time,
                    type, status, is_anchor, primary_muscle, intensity,
                    connected_calendar_id, connected_calendar_type,
                    external_event_url, recurrence_rule, json_payload,
                    created_at, updated_at
                FROM workout_events
                WHERE user_id = %s AND (
                    (recurrence_rule IS NULL AND date >= %s AND date <= %s)
                    OR (recurrence_rule IS NOT NULL AND date <= %s)
                )
                ORDER BY date, start_time
            """, (x_user_id, start_date, end_date, end_date))

            rows = cur.fetchall()
            columns = [desc[0] for desc in cur.description]

            all_events = []

            for row in rows:
                event_dict = dict(zip(columns, row))

                # Convert datetime objects to ISO strings for serialization
                if event_dict.get('created_at'):
                    event_dict['created_at'] = event_dict['created_at'].isoformat()
                if event_dict.get('updated_at'):
                    event_dict['updated_at'] = event_dict['updated_at'].isoformat()
                # Convert time objects to strings
                if event_dict.get('start_time'):
                    event_dict['start_time'] = event_dict['start_time'].isoformat()
                if event_dict.get('end_time'):
                    event_dict['end_time'] = event_dict['end_time'].isoformat()

                # Check if this is a recurring event
                if event_dict.get('recurrence_rule'):
                    # Expand recurring event into instances
                    instances = expand_recurring_event(event_dict, start_date, end_date)
                    for instance in instances:
                        # Convert date to ISO string for response
                        if isinstance(instance['date'], date):
                            instance['date'] = instance['date'].isoformat()
                        all_events.append(WorkoutEvent(**instance))
                else:
                    # Non-recurring event - add as-is
                    all_events.append(WorkoutEvent(**event_dict))

            # Sort by date and time (ensure start_time is string for comparison)
            all_events.sort(key=lambda e: (e.date, str(e.start_time) if e.start_time else ''))

            return all_events


@router.post("", response_model=WorkoutEvent, status_code=201)
async def create_calendar_event(
    event: WorkoutEventCreate,
    x_user_id: str = Header(..., alias="X-User-Id", description="Authenticated user ID"),
):
    """Create a new workout event."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO workout_events (
                    user_id, title, source, date, start_time, end_time,
                    type, status, is_anchor, primary_muscle, intensity,
                    connected_calendar_id, connected_calendar_type,
                    external_event_url, recurrence_rule, json_payload
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                RETURNING 
                    id, user_id, title, source, date, start_time, end_time,
                    type, status, is_anchor, primary_muscle, intensity,
                    connected_calendar_id, connected_calendar_type,
                    external_event_url, recurrence_rule, json_payload,
                    created_at, updated_at
            """, (
                x_user_id,
                event.title,
                event.source,
                event.date,
                event.start_time,
                event.end_time,
                event.type,
                event.status,
                event.is_anchor,
                event.primary_muscle,
                event.intensity,
                str(event.connected_calendar_id) if event.connected_calendar_id else None,
                event.connected_calendar_type,
                event.external_event_url,
                event.recurrence_rule,
                json.dumps(event.json_payload) if event.json_payload else None,
            ))
            
            row = cur.fetchone()
            columns = [desc[0] for desc in cur.description]
            event_dict = dict(zip(columns, row))
            
            # Convert datetime objects
            if event_dict.get('created_at'):
                event_dict['created_at'] = event_dict['created_at'].isoformat()
            if event_dict.get('updated_at'):
                event_dict['updated_at'] = event_dict['updated_at'].isoformat()
            if event_dict.get('start_time'):
                event_dict['start_time'] = event_dict['start_time'].isoformat()
            if event_dict.get('end_time'):
                event_dict['end_time'] = event_dict['end_time'].isoformat()
            
            return WorkoutEvent(**event_dict)


# ============================================
# CONNECTED CALENDARS ENDPOINTS
# ============================================
# NOTE: These must come BEFORE /{event_id} routes to avoid route matching conflicts

@router.get("/connected-calendars", response_model=List[ConnectedCalendar])
async def get_connected_calendars(
    x_user_id: str = Header(..., alias="X-User-Id", description="Authenticated user ID"),
):
    """Get all connected calendars for the user."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    id, user_id, name, type, integration_type,
                    is_workout_calendar, ics_url, last_sync, sync_status,
                    sync_error_message, color, workouts_this_week,
                    created_at, updated_at
                FROM connected_calendars
                WHERE user_id = %s
                ORDER BY created_at DESC
            """, (x_user_id,))
            
            rows = cur.fetchall()
            columns = [desc[0] for desc in cur.description]
            
            calendars = []
            for row in rows:
                cal_dict = dict(zip(columns, row))
                if cal_dict.get('created_at'):
                    cal_dict['created_at'] = cal_dict['created_at'].isoformat()
                if cal_dict.get('updated_at'):
                    cal_dict['updated_at'] = cal_dict['updated_at'].isoformat()
                if cal_dict.get('last_sync'):
                    cal_dict['last_sync'] = cal_dict['last_sync'].isoformat()
                calendars.append(ConnectedCalendar(**cal_dict))
            
            return calendars


@router.post("/connected-calendars", response_model=ConnectedCalendar, status_code=201)
async def create_connected_calendar(
    calendar: ConnectedCalendarCreate,
    x_user_id: str = Header(..., alias="X-User-Id", description="Authenticated user ID"),
):
    """Create a new connected calendar."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO connected_calendars (
                    user_id, name, type, integration_type,
                    is_workout_calendar, ics_url, color
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING 
                    id, user_id, name, type, integration_type,
                    is_workout_calendar, ics_url, last_sync, sync_status,
                    sync_error_message, color, workouts_this_week,
                    created_at, updated_at
            """, (
                x_user_id,
                calendar.name,
                calendar.type,
                calendar.integration_type,
                calendar.is_workout_calendar,
                calendar.ics_url,
                calendar.color,
            ))
            
            row = cur.fetchone()
            columns = [desc[0] for desc in cur.description]
            cal_dict = dict(zip(columns, row))
            
            if cal_dict.get('created_at'):
                cal_dict['created_at'] = cal_dict['created_at'].isoformat()
            if cal_dict.get('updated_at'):
                cal_dict['updated_at'] = cal_dict['updated_at'].isoformat()
            if cal_dict.get('last_sync'):
                cal_dict['last_sync'] = cal_dict['last_sync'].isoformat()
            
            return ConnectedCalendar(**cal_dict)


@router.delete("/connected-calendars/{calendar_id}")
async def delete_connected_calendar(
    calendar_id: UUID,
    x_user_id: str = Header(..., alias="X-User-Id", description="Authenticated user ID"),
):
    """Delete a connected calendar."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM connected_calendars WHERE id = %s AND user_id = %s RETURNING id",
                (str(calendar_id), x_user_id)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Calendar not found")

            return {"success": True}


@router.post("/connected-calendars/{calendar_id}/sync")
async def sync_connected_calendar(
    calendar_id: UUID,
    x_user_id: str = Header(..., alias="X-User-Id", description="Authenticated user ID"),
):
    """
    Sync a connected calendar by fetching and parsing its ICS feed.
    Creates/updates workout events from the ICS data.
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Get the calendar and verify ownership
            cur.execute(
                """SELECT id, ics_url, type FROM connected_calendars
                   WHERE id = %s AND user_id = %s""",
                (str(calendar_id), x_user_id)
            )
            calendar_row = cur.fetchone()

            if not calendar_row:
                raise HTTPException(status_code=404, detail="Calendar not found")

            cal_id, ics_url, cal_type = calendar_row

            if not ics_url:
                raise HTTPException(
                    status_code=400,
                    detail="Calendar does not have an ICS URL configured"
                )

            # Fetch ICS content
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(ics_url)
                    response.raise_for_status()
                    ics_content = response.text
            except httpx.HTTPError as e:
                cur.execute(
                    """UPDATE connected_calendars
                       SET sync_status = 'error',
                           sync_error_message = %s,
                           updated_at = NOW()
                       WHERE id = %s""",
                    (f"Failed to fetch ICS: {str(e)}", str(calendar_id))
                )
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to fetch ICS feed: {str(e)}"
                )

            # Parse ICS content
            try:
                events = parse_ics_content(ics_content)
            except Exception as e:
                cur.execute(
                    """UPDATE connected_calendars
                       SET sync_status = 'error',
                           sync_error_message = %s,
                           updated_at = NOW()
                       WHERE id = %s""",
                    (f"Failed to parse ICS: {str(e)}", str(calendar_id))
                )
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to parse ICS content: {str(e)}"
                )

            # Convert and insert/update events
            created_count = 0
            updated_count = 0

            for ics_event in events:
                workout_event = convert_to_workout_event(
                    ics_event,
                    str(calendar_id),
                    x_user_id
                )

                # Check if event already exists by external ics_uid
                ics_uid = workout_event['json_payload'].get('ics_uid')

                cur.execute(
                    """SELECT id FROM workout_events
                       WHERE user_id = %s
                       AND connected_calendar_id = %s
                       AND json_payload->>'ics_uid' = %s""",
                    (x_user_id, str(calendar_id), ics_uid)
                )
                existing = cur.fetchone()

                if existing:
                    # Update existing event
                    cur.execute("""
                        UPDATE workout_events
                        SET title = %s,
                            date = %s,
                            start_time = %s,
                            end_time = %s,
                            type = %s,
                            status = %s,
                            external_event_url = %s,
                            json_payload = %s,
                            updated_at = NOW()
                        WHERE id = %s
                    """, (
                        workout_event['title'],
                        workout_event['date'],
                        workout_event.get('start_time'),
                        workout_event.get('end_time'),
                        workout_event['type'],
                        workout_event['status'],
                        workout_event.get('external_event_url'),
                        json.dumps(workout_event['json_payload']),
                        existing[0]
                    ))
                    updated_count += 1
                else:
                    # Insert new event
                    cur.execute("""
                        INSERT INTO workout_events (
                            user_id, title, source, date, start_time, end_time,
                            type, status, connected_calendar_id, connected_calendar_type,
                            external_event_url, json_payload
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        x_user_id,
                        workout_event['title'],
                        workout_event['source'],
                        workout_event['date'],
                        workout_event.get('start_time'),
                        workout_event.get('end_time'),
                        workout_event['type'],
                        workout_event['status'],
                        workout_event['connected_calendar_id'],
                        workout_event['connected_calendar_type'],
                        workout_event.get('external_event_url'),
                        json.dumps(workout_event['json_payload'])
                    ))
                    created_count += 1

            # Update calendar sync status
            cur.execute(
                """UPDATE connected_calendars
                   SET last_sync = NOW(),
                       sync_status = 'active',
                       sync_error_message = NULL,
                       updated_at = NOW()
                   WHERE id = %s""",
                (str(calendar_id),)
            )

            return {
                "success": True,
                "events_created": created_count,
                "events_updated": updated_count,
                "total_events": len(events)
            }


# ============================================
# SINGLE WORKOUT EVENT ENDPOINTS (with dynamic ID)
# ============================================
# NOTE: These must come AFTER static routes like /connected-calendars

@router.get("/{event_id}", response_model=WorkoutEvent)
async def get_calendar_event(
    event_id: UUID,
    x_user_id: str = Header(..., alias="X-User-Id", description="Authenticated user ID"),
):
    """Get a single workout event by ID."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    id, user_id, title, source, date, start_time, end_time,
                    type, status, is_anchor, primary_muscle, intensity,
                    connected_calendar_id, connected_calendar_type,
                    external_event_url, recurrence_rule, json_payload,
                    created_at, updated_at
                FROM workout_events
                WHERE id = %s AND user_id = %s
            """, (str(event_id), x_user_id))

            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Event not found")

            columns = [desc[0] for desc in cur.description]
            event_dict = dict(zip(columns, row))

            if event_dict.get('created_at'):
                event_dict['created_at'] = event_dict['created_at'].isoformat()
            if event_dict.get('updated_at'):
                event_dict['updated_at'] = event_dict['updated_at'].isoformat()
            if event_dict.get('start_time'):
                event_dict['start_time'] = event_dict['start_time'].isoformat()
            if event_dict.get('end_time'):
                event_dict['end_time'] = event_dict['end_time'].isoformat()

            return WorkoutEvent(**event_dict)


@router.put("/{event_id}", response_model=WorkoutEvent)
async def update_calendar_event(
    event_id: UUID,
    event_update: WorkoutEventUpdate,
    x_user_id: str = Header(..., alias="X-User-Id", description="Authenticated user ID"),
):
    """Update an existing workout event."""
    # Build dynamic UPDATE query
    update_fields = []
    values = []

    if event_update.title is not None:
        update_fields.append("title = %s")
        values.append(event_update.title)
    if event_update.date is not None:
        update_fields.append("date = %s")
        values.append(event_update.date)
    if event_update.source is not None:
        update_fields.append("source = %s")
        values.append(event_update.source)
    if event_update.type is not None:
        update_fields.append("type = %s")
        values.append(event_update.type)
    if event_update.start_time is not None:
        update_fields.append("start_time = %s")
        values.append(event_update.start_time)
    if event_update.end_time is not None:
        update_fields.append("end_time = %s")
        values.append(event_update.end_time)
    if event_update.status is not None:
        update_fields.append("status = %s")
        values.append(event_update.status)
    if event_update.is_anchor is not None:
        update_fields.append("is_anchor = %s")
        values.append(event_update.is_anchor)
    if event_update.primary_muscle is not None:
        update_fields.append("primary_muscle = %s")
        values.append(event_update.primary_muscle)
    if event_update.intensity is not None:
        update_fields.append("intensity = %s")
        values.append(event_update.intensity)
    if event_update.connected_calendar_id is not None:
        update_fields.append("connected_calendar_id = %s")
        values.append(str(event_update.connected_calendar_id))
    if event_update.connected_calendar_type is not None:
        update_fields.append("connected_calendar_type = %s")
        values.append(event_update.connected_calendar_type)
    if event_update.external_event_url is not None:
        update_fields.append("external_event_url = %s")
        values.append(event_update.external_event_url)
    if event_update.recurrence_rule is not None:
        update_fields.append("recurrence_rule = %s")
        values.append(event_update.recurrence_rule)
    if event_update.json_payload is not None:
        update_fields.append("json_payload = %s")
        values.append(json.dumps(event_update.json_payload))

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Add updated_at
    update_fields.append("updated_at = NOW()")

    # Add WHERE clause values
    values.extend([str(event_id), x_user_id])

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Check ownership first
            cur.execute(
                "SELECT id FROM workout_events WHERE id = %s AND user_id = %s",
                (str(event_id), x_user_id)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Event not found")

            query = f"""
                UPDATE workout_events
                SET {', '.join(update_fields)}
                WHERE id = %s AND user_id = %s
                RETURNING
                    id, user_id, title, source, date, start_time, end_time,
                    type, status, is_anchor, primary_muscle, intensity,
                    connected_calendar_id, connected_calendar_type,
                    external_event_url, recurrence_rule, json_payload,
                    created_at, updated_at
            """

            cur.execute(query, values)
            row = cur.fetchone()
            columns = [desc[0] for desc in cur.description]
            event_dict = dict(zip(columns, row))

            if event_dict.get('created_at'):
                event_dict['created_at'] = event_dict['created_at'].isoformat()
            if event_dict.get('updated_at'):
                event_dict['updated_at'] = event_dict['updated_at'].isoformat()
            if event_dict.get('start_time'):
                event_dict['start_time'] = event_dict['start_time'].isoformat()
            if event_dict.get('end_time'):
                event_dict['end_time'] = event_dict['end_time'].isoformat()

            return WorkoutEvent(**event_dict)


@router.delete("/{event_id}")
async def delete_calendar_event(
    event_id: UUID,
    x_user_id: str = Header(..., alias="X-User-Id", description="Authenticated user ID"),
):
    """Delete a workout event."""
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM workout_events WHERE id = %s AND user_id = %s RETURNING id",
                (str(event_id), x_user_id)
            )
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Event not found")

            return {"success": True}
