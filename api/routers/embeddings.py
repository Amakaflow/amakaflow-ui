"""Internal embedding generation endpoint.

Secured by X-Internal-Key header. No user auth required.
"""

from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from api.deps import get_generate_embeddings_use_case, get_settings
from application.use_cases.generate_embeddings import GenerateEmbeddingsUseCase
from backend.settings import Settings

router = APIRouter(prefix="/internal/embeddings", tags=["embeddings"])

TableName = Literal["workouts", "follow_along_workouts"]


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class GenerateRequest(BaseModel):
    """Request body for embedding generation."""
    table: TableName = "workouts"
    workout_ids: Optional[List[str]] = None


class GenerateResponse(BaseModel):
    """Response from embedding generation."""
    total_processed: int
    total_embedded: int
    total_skipped: int
    errors: list
    duration_seconds: float


class ProgressResponse(BaseModel):
    """Embedding progress for a table."""
    table: str
    total: int
    embedded: int
    remaining: int


class WebhookRequest(BaseModel):
    """Request body for single-workout webhook."""
    table: TableName = "workouts"
    workout_id: str


class WebhookResponse(BaseModel):
    """Response from webhook embedding generation."""
    status: str
    workout_id: str
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------


def _verify_internal_key(
    x_internal_key: str = Header(..., alias="X-Internal-Key"),
    settings: Settings = Depends(get_settings),
) -> None:
    """Verify the internal API key."""
    if not settings.internal_api_key:
        raise HTTPException(status_code=503, detail="Internal API key not configured")
    if x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=403, detail="Invalid internal API key")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/generate", response_model=GenerateResponse)
def generate_embeddings(
    body: GenerateRequest,
    _auth: None = Depends(_verify_internal_key),
    use_case: GenerateEmbeddingsUseCase = Depends(get_generate_embeddings_use_case),
):
    """Generate embeddings for workouts without them.

    Secured by X-Internal-Key header.
    """
    result = use_case.execute(
        table=body.table,
        workout_ids=body.workout_ids,
    )
    return GenerateResponse(
        total_processed=result.total_processed,
        total_embedded=result.total_embedded,
        total_skipped=result.total_skipped,
        errors=result.errors,
        duration_seconds=result.duration_seconds,
    )


@router.get("/progress/{table}", response_model=ProgressResponse)
def get_progress(
    table: TableName,
    _auth: None = Depends(_verify_internal_key),
    use_case: GenerateEmbeddingsUseCase = Depends(get_generate_embeddings_use_case),
):
    """Get embedding progress for a table."""
    progress = use_case.get_progress(table)
    return ProgressResponse(table=table, **progress)


@router.post("/webhook", response_model=WebhookResponse)
def webhook_generate_embedding(
    body: WebhookRequest,
    _auth: None = Depends(_verify_internal_key),
    use_case: GenerateEmbeddingsUseCase = Depends(get_generate_embeddings_use_case),
):
    """Generate embedding for a single workout on create/update.

    Called by mapper-api when a workout is created or updated.
    Secured by X-Internal-Key header.
    """
    result = use_case.execute_single(
        table=body.table,
        workout_id=body.workout_id,
    )

    if result.status == "not_found":
        raise HTTPException(status_code=404, detail=f"Workout {body.workout_id} not found in {body.table}")

    if result.status == "error":
        raise HTTPException(
            status_code=502,
            detail=result.error or "Embedding generation failed",
        )

    return WebhookResponse(
        status=result.status,
        workout_id=result.workout_id,
        error=result.error,
    )
