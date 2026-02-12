"""Pipeline status polling endpoint.

GET /api/pipelines/{run_id}/status — poll pipeline run status
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
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }
