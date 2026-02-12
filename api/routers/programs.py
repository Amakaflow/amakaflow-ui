"""Program generation streaming endpoints.

Three-phase pipeline with SSE event streams:
  POST /api/programs/design/stream        — Phase 1a: design program outline
  POST /api/programs/generate/stream      — Phase 1b: generate workouts week-by-week
  POST /api/programs/save/stream          — Phase 2:  save, schedule, push

Part of AMA-567 Phase E.
"""

import json
import logging
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from api.deps import get_auth_context, get_program_pipeline_service, AuthContext
from backend.services.program_pipeline_service import ProgramPipelineService
from backend.services.pipeline_concurrency import (
    PipelineConcurrencyLimiter,
    ConcurrencyLimitExceeded,
)

router = APIRouter(prefix="/api/programs", tags=["programs"])
logger = logging.getLogger(__name__)

# Shared concurrency limiter (singleton per process)
_concurrency = PipelineConcurrencyLimiter(max_per_user=2)


# =============================================================================
# Request Models
# =============================================================================


class DesignProgramRequest(BaseModel):
    goal: str = Field(..., pattern="^(strength|hypertrophy|fat_loss|endurance|general_fitness)$")
    experience_level: str = Field(..., pattern="^(beginner|intermediate|advanced)$")
    duration_weeks: int = Field(..., ge=2, le=16)
    sessions_per_week: int = Field(..., ge=1, le=7)
    equipment: List[str] = Field(..., min_length=1)
    time_per_session: Optional[int] = Field(None, ge=10, le=180)
    preferred_days: Optional[List[str]] = None
    injuries: Optional[str] = Field(None, max_length=1000)
    focus_areas: Optional[List[str]] = None
    avoid_exercises: Optional[List[str]] = None


class GenerateWorkoutsRequest(BaseModel):
    preview_id: str = Field(..., min_length=1, max_length=64)


class SaveProgramRequest(BaseModel):
    preview_id: str = Field(..., min_length=1, max_length=64)
    schedule_start_date: Optional[str] = Field(
        None, pattern=r"^\d{4}-\d{2}-\d{2}$"
    )


# =============================================================================
# Endpoints
# =============================================================================


@router.post("/design/stream")
async def design_program_stream(
    body: DesignProgramRequest,
    auth: AuthContext = Depends(get_auth_context),
    pipeline: ProgramPipelineService = Depends(get_program_pipeline_service),
):
    """Phase 1a: Design program outline via LLM + periodization.

    Returns an SSE stream with event types:
    - stage: Pipeline progress (designing → complete)
    - preview: Program outline with preview_id
    - error: Error details
    """
    run_id = str(uuid.uuid4())

    async def event_generator():
        try:
            async with _concurrency.limit(auth.user_id, run_id):
                async for event in pipeline.design_outline(
                    goal=body.goal,
                    experience_level=body.experience_level,
                    duration_weeks=body.duration_weeks,
                    sessions_per_week=body.sessions_per_week,
                    equipment=body.equipment,
                    time_per_session=body.time_per_session,
                    preferred_days=body.preferred_days,
                    injuries=body.injuries,
                    focus_areas=body.focus_areas,
                    avoid_exercises=body.avoid_exercises,
                    user_id=auth.user_id,
                ):
                    yield {"event": event.event, "data": event.data}
        except ConcurrencyLimitExceeded:
            yield {
                "event": "error",
                "data": json.dumps({
                    "stage": "designing",
                    "message": "Too many active pipelines. Please wait for one to finish.",
                    "recoverable": True,
                }),
            }
        except Exception:
            logger.exception("Unhandled error in program design pipeline")
            yield {
                "event": "error",
                "data": json.dumps({
                    "stage": "designing",
                    "message": "An unexpected error occurred. Please try again.",
                    "recoverable": True,
                }),
            }

    return EventSourceResponse(event_generator())


@router.post("/generate/stream")
async def generate_workouts_stream(
    body: GenerateWorkoutsRequest,
    auth: AuthContext = Depends(get_auth_context),
    pipeline: ProgramPipelineService = Depends(get_program_pipeline_service),
):
    """Phase 1b: Generate workouts week-by-week with batched LLM calls.

    Returns an SSE stream with event types:
    - stage: Pipeline progress with sub_progress (generating → mapping → complete)
    - preview: Full program with new preview_id
    - error: Error details
    """
    run_id = str(uuid.uuid4())

    async def event_generator():
        try:
            async with _concurrency.limit(auth.user_id, run_id):
                async for event in pipeline.generate_workouts(
                    preview_id=body.preview_id,
                    user_id=auth.user_id,
                ):
                    yield {"event": event.event, "data": event.data}
        except ConcurrencyLimitExceeded:
            yield {
                "event": "error",
                "data": json.dumps({
                    "stage": "generating",
                    "message": "Too many active pipelines. Please wait for one to finish.",
                    "recoverable": True,
                }),
            }
        except Exception:
            logger.exception("Unhandled error in program workout generation pipeline")
            yield {
                "event": "error",
                "data": json.dumps({
                    "stage": "generating",
                    "message": "An unexpected error occurred. Please try again.",
                    "recoverable": True,
                }),
            }

    return EventSourceResponse(event_generator())


@router.post("/save/stream")
async def save_program_stream(
    body: SaveProgramRequest,
    auth: AuthContext = Depends(get_auth_context),
    pipeline: ProgramPipelineService = Depends(get_program_pipeline_service),
):
    """Phase 2: Save program, schedule workouts, push to devices.

    Returns an SSE stream with event types:
    - stage: Pipeline progress (saving → scheduling → pushing → complete)
    - complete: Final result with workout_ids and counts
    - error: Error details
    """
    run_id = str(uuid.uuid4())

    async def event_generator():
        try:
            async with _concurrency.limit(auth.user_id, run_id):
                async for event in pipeline.save_program(
                    preview_id=body.preview_id,
                    user_id=auth.user_id,
                    schedule_start_date=body.schedule_start_date,
                ):
                    yield {"event": event.event, "data": event.data}
        except ConcurrencyLimitExceeded:
            yield {
                "event": "error",
                "data": json.dumps({
                    "stage": "saving",
                    "message": "Too many active pipelines. Please wait for one to finish.",
                    "recoverable": True,
                }),
            }
        except Exception:
            logger.exception("Unhandled error in program save pipeline")
            yield {
                "event": "error",
                "data": json.dumps({
                    "stage": "saving",
                    "message": "An unexpected error occurred. Please try again.",
                    "recoverable": True,
                }),
            }

    return EventSourceResponse(event_generator())
