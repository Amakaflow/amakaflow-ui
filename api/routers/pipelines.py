"""Pipeline status polling and resume endpoints.

GET /api/pipelines/{run_id}/status — poll pipeline run status
GET /api/pipelines/{run_id}/resume — get completed stages for resume
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from api.deps import (
    get_auth_context,
    get_async_pipeline_run_repository,
    AuthContext,
)
from infrastructure.db.async_pipeline_run_repository import AsyncPipelineRunRepository

router = APIRouter(prefix="/api/pipelines", tags=["pipelines"])


@router.get("/{run_id}/status")
async def get_pipeline_status(
    run_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    repo: AsyncPipelineRunRepository = Depends(get_async_pipeline_run_repository),
):
    """Get the current status of a pipeline run.

    Returns pipeline run details including status, result, and error.
    Scoped to the authenticated user (RLS + application-level check).
    """
    row = await repo.get(str(run_id), auth.user_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Pipeline run not found")

    return {
        "id": row["id"],
        "pipeline": row["pipeline"],
        "status": row["status"],
        "preview_id": row.get("preview_id"),
        "result": row.get("result"),
        "error": row.get("error"),
        "input_tokens": row.get("input_tokens", 0),
        "output_tokens": row.get("output_tokens", 0),
        "estimated_cost_usd": row.get("estimated_cost_usd", 0),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


@router.get("/{run_id}/resume")
async def get_pipeline_resume_data(
    run_id: UUID,
    auth: AuthContext = Depends(get_auth_context),
    repo: AsyncPipelineRunRepository = Depends(get_async_pipeline_run_repository),
):
    """Get completed stages and stage data for resuming a pipeline.

    Returns enough data for the frontend to:
    1. Show completed stages with checkmarks
    2. Resume from the last completed stage
    3. Display partial results if available
    """
    data = await repo.get_stage_data(str(run_id), auth.user_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Pipeline run not found")

    return {
        "status": data["status"],
        "completed_stages": data.get("completed_stages", []),
        "current_stage": data.get("current_stage"),
        "stage_data": data.get("stage_data", {}),
    }
