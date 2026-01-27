"""
Program Events API routes for calendar integration.

AMA-469: Calendar Integration for Program Workouts

These endpoints allow the Program-API to manage calendar events for
training programs. When a program is activated, the Program-API calls
these endpoints to create workout events on the user's calendar.
"""
import json
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from ..auth import get_current_user
from ..db import get_db_connection
from ..schemas import (
    BulkProgramEventsCreate,
    BulkProgramEventsResponse,
    ProgramEventsResponse,
    WorkoutEvent,
)

router = APIRouter()


@router.post("/bulk-create", response_model=BulkProgramEventsResponse, status_code=201)
async def bulk_create_program_events(
    request: BulkProgramEventsCreate,
    user_id: str = Depends(get_current_user),
):
    """
    Bulk create calendar events for a training program.

    Called by Program-API when a program is activated. Creates all workout
    events for the program in a single transaction.

    Args:
        request: Program ID and list of events to create

    Returns:
        BulkProgramEventsResponse with count and IDs of created events
    """
    if not request.events:
        raise HTTPException(
            status_code=400,
            detail="No events provided"
        )

    created_ids = []

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            for event in request.events:
                cur.execute("""
                    INSERT INTO workout_events (
                        user_id, title, source, date, start_time, end_time,
                        type, status, primary_muscle, intensity,
                        program_id, program_workout_id, program_week_number,
                        json_payload
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    RETURNING id
                """, (
                    user_id,
                    event.title,
                    "training_program",
                    event.date,
                    event.start_time,
                    event.end_time,
                    event.type,
                    "planned",
                    event.primary_muscle,
                    event.intensity,
                    str(request.program_id),
                    str(event.program_workout_id),
                    event.program_week_number,
                    json.dumps(event.json_payload) if event.json_payload else None,
                ))

                row = cur.fetchone()
                created_ids.append(row[0])

    return BulkProgramEventsResponse(
        program_id=request.program_id,
        events_created=len(created_ids),
        event_ids=created_ids,
    )


@router.get("/{program_id}", response_model=ProgramEventsResponse)
async def get_program_events(
    program_id: UUID,
    user_id: str = Depends(get_current_user),
):
    """
    Get all calendar events for a specific training program.

    Args:
        program_id: The training program UUID

    Returns:
        ProgramEventsResponse with list of events
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    id, user_id, title, source, date, start_time, end_time,
                    type, status, is_anchor, primary_muscle, intensity,
                    connected_calendar_id, connected_calendar_type,
                    external_event_url, recurrence_rule,
                    program_id, program_workout_id, program_week_number,
                    json_payload, created_at, updated_at
                FROM workout_events
                WHERE user_id = %s AND program_id = %s
                ORDER BY date, start_time
            """, (user_id, str(program_id)))

            rows = cur.fetchall()
            columns = [desc[0] for desc in cur.description]

            events = []
            for row in rows:
                event_dict = dict(zip(columns, row))

                # Convert datetime objects to ISO strings
                if event_dict.get('created_at'):
                    event_dict['created_at'] = event_dict['created_at'].isoformat()
                if event_dict.get('updated_at'):
                    event_dict['updated_at'] = event_dict['updated_at'].isoformat()
                if event_dict.get('start_time'):
                    event_dict['start_time'] = event_dict['start_time'].isoformat()
                if event_dict.get('end_time'):
                    event_dict['end_time'] = event_dict['end_time'].isoformat()

                events.append(WorkoutEvent(**event_dict))

            return ProgramEventsResponse(
                program_id=program_id,
                events=events,
                total=len(events),
            )


@router.delete("/{program_id}")
async def delete_program_events(
    program_id: UUID,
    user_id: str = Depends(get_current_user),
):
    """
    Delete all calendar events for a specific training program.

    Called when a program is deactivated or deleted. Removes all associated
    workout events from the user's calendar.

    Args:
        program_id: The training program UUID

    Returns:
        Success status with count of deleted events
    """
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                DELETE FROM workout_events
                WHERE user_id = %s AND program_id = %s
                RETURNING id
            """, (user_id, str(program_id)))

            deleted_rows = cur.fetchall()

            return {
                "success": True,
                "program_id": str(program_id),
                "events_deleted": len(deleted_rows),
            }
