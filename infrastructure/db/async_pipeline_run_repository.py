"""Async Supabase implementation of PipelineRunRepository."""

from typing import Any, Dict, Optional

from supabase import AsyncClient


class AsyncPipelineRunRepository:
    """Async Supabase-backed pipeline run repository."""

    TABLE = "pipeline_runs"

    def __init__(self, client: AsyncClient) -> None:
        self._client = client

    async def create(
        self,
        user_id: str,
        pipeline: str,
        preview_id: Optional[str] = None,
        input_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create a new pipeline run record.

        Args:
            user_id: The user who initiated the run.
            pipeline: Pipeline type (e.g. "generate", "save_and_push").
            preview_id: Optional preview ID linking generate→save.
            input_data: Optional JSON of the request inputs.

        Returns:
            The created row as a dict (includes id, status, timestamps).
        """
        row = {
            "user_id": user_id,
            "pipeline": pipeline,
            "status": "pending",
        }
        if preview_id is not None:
            row["preview_id"] = preview_id
        if input_data is not None:
            row["input"] = input_data

        result = await (
            self._client.table(self.TABLE)
            .insert(row)
            .execute()
        )
        return result.data[0]

    async def update_status(
        self,
        run_id: str,
        status: str,
        result_data: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> None:
        """Update the status (and optionally result/error) of a pipeline run.

        Args:
            run_id: The pipeline run ID.
            status: New status (e.g. "running", "completed", "failed", "cancelled").
            result_data: Optional result payload on success.
            error: Optional error message on failure.
        """
        update: Dict[str, Any] = {"status": status}
        if result_data is not None:
            update["result"] = result_data
        if error is not None:
            update["error"] = error

        await (
            self._client.table(self.TABLE)
            .update(update)
            .eq("id", run_id)
            .execute()
        )

    async def get(self, run_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get a pipeline run by ID, scoped to the owning user.

        Args:
            run_id: The pipeline run ID.
            user_id: The user ID (for RLS / ownership check).

        Returns:
            The row dict, or None if not found.
        """
        result = await (
            self._client.table(self.TABLE)
            .select("*")
            .eq("id", run_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None
