"""Workout generation streaming endpoint.

POST /api/workouts/generate/stream returns an SSE event stream
for standalone AI workout generation (outside the chat pipeline).
"""

from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from api.deps import get_auth_context, get_workout_pipeline_service, AuthContext
from backend.services.workout_pipeline_service import WorkoutPipelineService

router = APIRouter(prefix="/api/workouts", tags=["workouts"])


class GenerateWorkoutRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=5000)
    difficulty: Optional[str] = None
    duration_minutes: Optional[int] = Field(None, ge=5, le=180)
    equipment: Optional[List[str]] = None


@router.post("/generate/stream")
async def generate_workout_stream(
    body: GenerateWorkoutRequest,
    auth: AuthContext = Depends(get_auth_context),
    pipeline: WorkoutPipelineService = Depends(get_workout_pipeline_service),
):
    """Stream workout generation progress as Server-Sent Events.

    Returns an SSE stream with event types:
    - stage: Pipeline progress updates
    - preview: Generated workout data
    - error: Error details
    """

    async def event_generator():
        async for event in pipeline.generate(
            description=body.description,
            difficulty=body.difficulty,
            duration_minutes=body.duration_minutes,
            equipment=body.equipment,
            user_id=auth.user_id,
        ):
            yield {"event": event.event, "data": event.data}

    return EventSourceResponse(event_generator())
