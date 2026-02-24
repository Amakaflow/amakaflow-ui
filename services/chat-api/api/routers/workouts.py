"""Workout generation, import, and save streaming endpoints.

POST /api/workouts/generate/stream     — SSE stream for AI workout generation
POST /api/workouts/import/stream       — SSE stream for URL import (YouTube, TikTok, etc.)
POST /api/workouts/save/stream         — SSE stream for saving a previewed workout
POST /api/workouts/bulk-import/stream  — SSE stream for parallel multi-URL bulk import
"""

import asyncio
from typing import List, Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from sse_starlette.sse import EventSourceResponse

from api.deps import (
    get_auth_context,
    get_bulk_import_pipeline_service,
    get_pipeline_rate_limiter,
    get_save_rate_limiter,
    get_url_import_pipeline_service,
    get_workout_pipeline_service,
    AuthContext,
)
from backend.services.bulk_import_pipeline_service import BulkImportPipelineService
from backend.services.rate_limiter import InMemoryRateLimiter
from backend.services.url_import_pipeline_service import URLImportPipelineService
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
    request: Request,
    auth: AuthContext = Depends(get_auth_context),
    pipeline: WorkoutPipelineService = Depends(get_workout_pipeline_service),
    rate_limiter: InMemoryRateLimiter = Depends(get_pipeline_rate_limiter),
):
    """Stream workout generation progress as Server-Sent Events.

    Returns an SSE stream with event types:
    - stage: Pipeline progress updates
    - preview: Generated workout data
    - error: Error details

    Returns 429 if per-minute burst limit is exceeded.
    Supports cancellation via client disconnect.
    """
    result = rate_limiter.check(auth.user_id)
    if not result.allowed:
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Please try again shortly."},
            headers={"Retry-After": str(int(result.retry_after or 60))},
        )

    cancel_event = asyncio.Event()

    async def event_generator():
        async for event in pipeline.generate(
            description=body.description,
            difficulty=body.difficulty,
            duration_minutes=body.duration_minutes,
            equipment=body.equipment,
            user_id=auth.user_id,
            cancel_event=cancel_event,
        ):
            if await request.is_disconnected():
                cancel_event.set()
                break
            yield {"event": event.event, "data": event.data}

    return EventSourceResponse(event_generator())


class ImportFromURLRequest(BaseModel):
    url: str = Field(..., min_length=1, max_length=2048)


@router.post("/import/stream")
async def import_from_url_stream(
    body: ImportFromURLRequest,
    request: Request,
    auth: AuthContext = Depends(get_auth_context),
    pipeline: URLImportPipelineService = Depends(get_url_import_pipeline_service),
    rate_limiter: InMemoryRateLimiter = Depends(get_pipeline_rate_limiter),
):
    """Stream URL import progress as Server-Sent Events.

    Imports a workout from YouTube, TikTok, Instagram, or Pinterest URLs.
    Auto-detects the platform from the URL.

    Returns an SSE stream with event types:
    - stage: Pipeline progress updates (fetching, extracting, parsing, mapping, complete)
    - preview: Imported workout data with preview_id
    - error: Error details

    Returns 429 if per-minute burst limit is exceeded.
    Supports cancellation via client disconnect.
    """
    result = rate_limiter.check(auth.user_id)
    if not result.allowed:
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Please try again shortly."},
            headers={"Retry-After": str(int(result.retry_after or 60))},
        )

    cancel_event = asyncio.Event()

    async def event_generator():
        async for event in pipeline.ingest(
            url=body.url,
            user_id=auth.user_id,
            cancel_event=cancel_event,
        ):
            if await request.is_disconnected():
                cancel_event.set()
                break
            yield {"event": event.event, "data": event.data}

    return EventSourceResponse(event_generator())


class SaveWorkoutRequest(BaseModel):
    preview_id: str = Field(..., min_length=1, max_length=64)
    schedule_date: Optional[str] = None


@router.post("/save/stream")
async def save_workout_stream(
    body: SaveWorkoutRequest,
    request: Request,
    auth: AuthContext = Depends(get_auth_context),
    pipeline: WorkoutPipelineService = Depends(get_workout_pipeline_service),
    rate_limiter: InMemoryRateLimiter = Depends(get_save_rate_limiter),
):
    """Stream workout save progress as Server-Sent Events.

    Saves a previously generated preview to the user's library.

    Returns an SSE stream with event types:
    - stage: Pipeline progress updates
    - complete: Saved workout details
    - error: Error details

    Returns 429 if per-minute burst limit is exceeded.
    Supports cancellation via client disconnect.
    """
    result = rate_limiter.check(auth.user_id)
    if not result.allowed:
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Please try again shortly."},
            headers={"Retry-After": str(int(result.retry_after or 60))},
        )

    cancel_event = asyncio.Event()

    async def event_generator():
        async for event in pipeline.save_and_push(
            preview_id=body.preview_id,
            user_id=auth.user_id,
            schedule_date=body.schedule_date,
            cancel_event=cancel_event,
        ):
            if await request.is_disconnected():
                cancel_event.set()
                break
            yield {"event": event.event, "data": event.data}

    return EventSourceResponse(event_generator())


class BulkImportRequest(BaseModel):
    urls: List[str] = Field(..., min_length=1, max_length=20)

    @field_validator("urls")
    @classmethod
    def validate_url_lengths(cls, v: List[str]) -> List[str]:
        for url in v:
            if len(url) > 2048:
                raise ValueError("URL exceeds maximum length of 2048 characters")
        return v


@router.post("/bulk-import/stream")
async def bulk_import_stream(
    body: BulkImportRequest,
    request: Request,
    auth: AuthContext = Depends(get_auth_context),
    pipeline: BulkImportPipelineService = Depends(get_bulk_import_pipeline_service),
    rate_limiter: InMemoryRateLimiter = Depends(get_pipeline_rate_limiter),
):
    """Stream parallel bulk import progress as Server-Sent Events.

    Imports multiple workout URLs in parallel with bounded concurrency.

    Returns an SSE stream with event types:
    - stage: Pipeline progress updates (validating, importing, fetching, sub_complete, complete)
    - sub_pipeline_error: Per-URL error details
    - preview: Aggregated imported workout data with preview_id
    - error: Fatal error details

    Returns 429 if per-minute burst limit is exceeded.
    Supports cancellation via client disconnect.
    """
    result = rate_limiter.check(auth.user_id)
    if not result.allowed:
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Please try again shortly."},
            headers={"Retry-After": str(int(result.retry_after or 60))},
        )

    cancel_event = asyncio.Event()

    async def event_generator():
        async for event in pipeline.bulk_import(
            urls=body.urls,
            user_id=auth.user_id,
            cancel_event=cancel_event,
        ):
            if await request.is_disconnected():
                cancel_event.set()
                break
            yield {"event": event.event, "data": event.data}

    return EventSourceResponse(event_generator())
