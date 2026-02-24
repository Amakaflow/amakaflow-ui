"""
Training Programs API routes for managing AI-generated training programs.

AMA-528: Fix Training Programs 404 Error

These endpoints allow the UI to manage training programs stored in the
calendar-api database. Programs are created by the chat-api's AI and
stored here for retrieval and management.
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from ..auth import get_current_user
from ..db import get_db_connection
from ..schemas import (
    TrainingProgram,
    ProgramWorkout,
    TrainingProgramResponse,
    TrainingProgramsListResponse,
    TrainingProgramStatusUpdate,
    TrainingProgramProgressUpdate,
    TrainingProgramStatusResponse,
    TrainingProgramDelete,
    WorkoutCompleteUpdate,
    WorkoutResponse,
)

router = APIRouter()


def _convert_datetime_to_iso(value) -> Optional[str]:
    """Convert a datetime or date value to ISO string."""
    if value is None:
        return None
    if hasattr(value, 'isoformat'):
        return value.isoformat()
    return str(value)


def _fetch_program_with_nested_data(cur, program_id: str, user_id: str) -> Optional[dict]:
    """
    Fetch a training program with all nested weeks, workouts, and exercises.
    Returns None if not found.

    Note: Exercises are stored as JSONB in program_workouts.exercises column,
    not in a separate table.
    """
    # Fetch the program
    cur.execute("""
        SELECT
            id, user_id, name, goal, periodization_model, duration_weeks,
            sessions_per_week, experience_level, equipment_available,
            time_per_session_minutes, status, current_week, started_at,
            completed_at, notes, created_at, updated_at
        FROM training_programs
        WHERE id = %s AND user_id = %s
    """, (program_id, user_id))

    program_row = cur.fetchone()
    if not program_row:
        return None

    program_columns = [desc[0] for desc in cur.description]
    program_dict = dict(zip(program_columns, program_row))

    # Convert timestamps
    for field in ['started_at', 'completed_at', 'created_at', 'updated_at']:
        program_dict[field] = _convert_datetime_to_iso(program_dict.get(field))

    # Ensure equipment_available is a list
    if program_dict.get('equipment_available') is None:
        program_dict['equipment_available'] = []

    # Fetch weeks for this program
    cur.execute("""
        SELECT
            id, program_id, week_number, focus,
            intensity_percentage, volume_modifier, is_deload, notes, created_at
        FROM program_weeks
        WHERE program_id = %s
        ORDER BY week_number
    """, (program_id,))

    week_rows = cur.fetchall()
    week_columns = [desc[0] for desc in cur.description]
    weeks = []

    for week_row in week_rows:
        week_dict = dict(zip(week_columns, week_row))
        week_dict['created_at'] = _convert_datetime_to_iso(week_dict.get('created_at'))
        week_dict['volume_modifier'] = float(week_dict.get('volume_modifier', 1.0))
        # Remove notes field if it's used for week-level notes (not in ProgramWeek schema)
        week_dict.pop('notes', None)

        # Fetch workouts for this week
        # Note: exercises are stored as JSONB in the exercises column
        cur.execute("""
            SELECT
                id, week_id, day_of_week, name, workout_type,
                target_duration_minutes, exercises, is_completed, completed_at,
                notes, created_at
            FROM program_workouts
            WHERE week_id = %s
            ORDER BY day_of_week, sort_order
        """, (str(week_dict['id']),))

        workout_rows = cur.fetchall()
        workout_columns = [desc[0] for desc in cur.description]
        workouts = []

        for workout_row in workout_rows:
            workout_dict = dict(zip(workout_columns, workout_row))
            workout_dict['created_at'] = _convert_datetime_to_iso(workout_dict.get('created_at'))
            workout_dict['completed_at'] = _convert_datetime_to_iso(workout_dict.get('completed_at'))

            # Exercises are already stored as JSONB array
            # If None or empty, default to empty list
            exercises = workout_dict.get('exercises') or []
            # Ensure it's a list (could be a JSON string from some drivers)
            if isinstance(exercises, str):
                import json
                exercises = json.loads(exercises)
            workout_dict['exercises'] = exercises

            # Default is_completed if column doesn't exist yet (pre-migration)
            if 'is_completed' not in workout_dict or workout_dict['is_completed'] is None:
                workout_dict['is_completed'] = False

            workouts.append(workout_dict)

        week_dict['workouts'] = workouts
        weeks.append(week_dict)

    program_dict['weeks'] = weeks
    return program_dict


# ============================================
# WORKOUT ENDPOINTS (must come BEFORE /{program_id} to avoid route conflicts)
# ============================================

@router.get("/workouts/{workout_id}", response_model=WorkoutResponse)
async def get_program_workout(
    workout_id: UUID,
    user_id: str = Query(..., description="User ID"),
    _auth_user_id: str = Depends(get_current_user),
):
    """
    Get a single workout with all exercises.

    Args:
        workout_id: The workout's UUID
        user_id: The user's ID

    Returns:
        WorkoutResponse with the workout data
    """
    if _auth_user_id != user_id and _auth_user_id != "admin":
        raise HTTPException(
            status_code=403,
            detail="Not authorized to access this workout"
        )

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Verify ownership through the program chain
            cur.execute("""
                SELECT
                    pw.id, pw.week_id, pw.day_of_week, pw.name, pw.workout_type,
                    pw.target_duration_minutes, pw.exercises, pw.is_completed,
                    pw.completed_at, pw.notes, pw.created_at
                FROM program_workouts pw
                JOIN program_weeks pwe ON pwe.id = pw.week_id
                JOIN training_programs tp ON tp.id = pwe.program_id
                WHERE pw.id = %s AND tp.user_id = %s
            """, (str(workout_id), user_id))

            workout_row = cur.fetchone()
            if not workout_row:
                raise HTTPException(status_code=404, detail="Workout not found")

            workout_columns = [desc[0] for desc in cur.description]
            workout_dict = dict(zip(workout_columns, workout_row))
            workout_dict['created_at'] = _convert_datetime_to_iso(workout_dict.get('created_at'))
            workout_dict['completed_at'] = _convert_datetime_to_iso(workout_dict.get('completed_at'))

            # Exercises are stored as JSONB array
            exercises = workout_dict.get('exercises') or []
            if isinstance(exercises, str):
                import json
                exercises = json.loads(exercises)
            workout_dict['exercises'] = exercises

            # Default is_completed if column doesn't exist yet (pre-migration)
            if 'is_completed' not in workout_dict or workout_dict['is_completed'] is None:
                workout_dict['is_completed'] = False

            return WorkoutResponse(
                success=True,
                workout=ProgramWorkout(**workout_dict),
            )


@router.patch("/workouts/{workout_id}/complete", response_model=TrainingProgramStatusResponse)
async def mark_workout_complete(
    workout_id: UUID,
    update: WorkoutCompleteUpdate,
    _auth_user_id: str = Depends(get_current_user),
):
    """
    Mark a workout as complete or incomplete.

    Args:
        workout_id: The workout's UUID
        update: Completion update data

    Returns:
        TrainingProgramStatusResponse with success status
    """
    if _auth_user_id != update.user_id and _auth_user_id != "admin":
        raise HTTPException(
            status_code=403,
            detail="Not authorized to update this workout"
        )

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # First verify ownership through the program chain
            cur.execute("""
                SELECT pw.id
                FROM program_workouts pw
                JOIN program_weeks pwe ON pwe.id = pw.week_id
                JOIN training_programs tp ON tp.id = pwe.program_id
                WHERE pw.id = %s AND tp.user_id = %s
            """, (str(workout_id), update.user_id))

            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Workout not found")

            # Now update the workout
            if update.is_completed:
                cur.execute("""
                    UPDATE program_workouts
                    SET is_completed = TRUE, completed_at = NOW()
                    WHERE id = %s
                    RETURNING id
                """, (str(workout_id),))
            else:
                cur.execute("""
                    UPDATE program_workouts
                    SET is_completed = FALSE, completed_at = NULL
                    WHERE id = %s
                    RETURNING id
                """, (str(workout_id),))

            status_text = "completed" if update.is_completed else "incomplete"
            return TrainingProgramStatusResponse(
                success=True,
                message=f"Workout marked as {status_text}",
            )


# ============================================
# PROGRAM ENDPOINTS
# ============================================

@router.get("", response_model=TrainingProgramsListResponse)
async def list_training_programs(
    user_id: str = Query(..., description="User ID to fetch programs for"),
    include_archived: bool = Query(False, description="Include archived programs"),
    _auth_user_id: str = Depends(get_current_user),
):
    """
    List all training programs for a user.

    Args:
        user_id: The user's ID
        include_archived: Whether to include archived programs

    Returns:
        TrainingProgramsListResponse with list of programs
    """
    # Verify the authenticated user matches the requested user_id
    if _auth_user_id != user_id and _auth_user_id != "admin":
        raise HTTPException(
            status_code=403,
            detail="Not authorized to access this user's programs"
        )

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Build query based on include_archived
            if include_archived:
                cur.execute("""
                    SELECT id FROM training_programs
                    WHERE user_id = %s
                    ORDER BY created_at DESC
                """, (user_id,))
            else:
                cur.execute("""
                    SELECT id FROM training_programs
                    WHERE user_id = %s AND status != 'archived'
                    ORDER BY created_at DESC
                """, (user_id,))

            program_ids = [row[0] for row in cur.fetchall()]

            programs = []
            for program_id in program_ids:
                program_dict = _fetch_program_with_nested_data(cur, str(program_id), user_id)
                if program_dict:
                    programs.append(TrainingProgram(**program_dict))

            return TrainingProgramsListResponse(
                success=True,
                programs=programs,
                count=len(programs),
            )


@router.get("/{program_id}", response_model=TrainingProgramResponse)
async def get_training_program(
    program_id: UUID,
    user_id: str = Query(..., description="User ID"),
    _auth_user_id: str = Depends(get_current_user),
):
    """
    Get a single training program with all weeks, workouts, and exercises.

    Args:
        program_id: The program's UUID
        user_id: The user's ID

    Returns:
        TrainingProgramResponse with the program data
    """
    if _auth_user_id != user_id and _auth_user_id != "admin":
        raise HTTPException(
            status_code=403,
            detail="Not authorized to access this program"
        )

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            program_dict = _fetch_program_with_nested_data(cur, str(program_id), user_id)

            if not program_dict:
                raise HTTPException(status_code=404, detail="Program not found")

            return TrainingProgramResponse(
                success=True,
                program=TrainingProgram(**program_dict),
            )


@router.patch("/{program_id}/status", response_model=TrainingProgramStatusResponse)
async def update_program_status(
    program_id: UUID,
    update: TrainingProgramStatusUpdate,
    _auth_user_id: str = Depends(get_current_user),
):
    """
    Update the status of a training program.

    Args:
        program_id: The program's UUID
        update: Status update data

    Returns:
        TrainingProgramStatusResponse with success status
    """
    if _auth_user_id != update.user_id and _auth_user_id != "admin":
        raise HTTPException(
            status_code=403,
            detail="Not authorized to update this program"
        )

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Build update based on status transitions
            now = datetime.utcnow()

            # Handle special status transitions
            if update.status == "active":
                cur.execute("""
                    UPDATE training_programs
                    SET status = %s, started_at = COALESCE(started_at, %s), updated_at = %s
                    WHERE id = %s AND user_id = %s
                    RETURNING id
                """, (update.status, now, now, str(program_id), update.user_id))
            elif update.status == "completed":
                cur.execute("""
                    UPDATE training_programs
                    SET status = %s, completed_at = %s, updated_at = %s
                    WHERE id = %s AND user_id = %s
                    RETURNING id
                """, (update.status, now, now, str(program_id), update.user_id))
            else:
                cur.execute("""
                    UPDATE training_programs
                    SET status = %s, updated_at = %s
                    WHERE id = %s AND user_id = %s
                    RETURNING id
                """, (update.status, now, str(program_id), update.user_id))

            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Program not found")

            return TrainingProgramStatusResponse(
                success=True,
                message=f"Program status updated to {update.status}",
            )


@router.patch("/{program_id}/progress", response_model=TrainingProgramStatusResponse)
async def update_program_progress(
    program_id: UUID,
    update: TrainingProgramProgressUpdate,
    _auth_user_id: str = Depends(get_current_user),
):
    """
    Update the current week progress of a training program.

    Args:
        program_id: The program's UUID
        update: Progress update data

    Returns:
        TrainingProgramStatusResponse with success status
    """
    if _auth_user_id != update.user_id and _auth_user_id != "admin":
        raise HTTPException(
            status_code=403,
            detail="Not authorized to update this program"
        )

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            # Verify the new week is within program duration
            cur.execute("""
                SELECT duration_weeks FROM training_programs
                WHERE id = %s AND user_id = %s
            """, (str(program_id), update.user_id))

            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Program not found")

            duration_weeks = row[0]
            if update.current_week > duration_weeks:
                raise HTTPException(
                    status_code=400,
                    detail=f"Current week cannot exceed program duration ({duration_weeks} weeks)"
                )

            cur.execute("""
                UPDATE training_programs
                SET current_week = %s, updated_at = NOW()
                WHERE id = %s AND user_id = %s
                RETURNING id
            """, (update.current_week, str(program_id), update.user_id))

            return TrainingProgramStatusResponse(
                success=True,
                message=f"Program progress updated to week {update.current_week}",
            )


@router.delete("/{program_id}", response_model=TrainingProgramStatusResponse)
async def delete_training_program(
    program_id: UUID,
    delete_request: TrainingProgramDelete,
    _auth_user_id: str = Depends(get_current_user),
):
    """
    Delete a training program and all its associated data.
    Cascading delete handles weeks, workouts, and exercises.

    Args:
        program_id: The program's UUID
        delete_request: Delete request with user_id

    Returns:
        TrainingProgramStatusResponse with success status
    """
    if _auth_user_id != delete_request.user_id and _auth_user_id != "admin":
        raise HTTPException(
            status_code=403,
            detail="Not authorized to delete this program"
        )

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                DELETE FROM training_programs
                WHERE id = %s AND user_id = %s
                RETURNING id
            """, (str(program_id), delete_request.user_id))

            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Program not found")

            return TrainingProgramStatusResponse(
                success=True,
                message="Program deleted successfully",
            )
