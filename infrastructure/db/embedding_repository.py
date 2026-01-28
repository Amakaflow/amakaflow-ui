"""Supabase implementation of EmbeddingRepository."""

from typing import Any, Dict, List, Optional

from supabase import Client

_ALLOWED_TABLES = frozenset({"workouts", "follow_along_workouts"})

_WORKOUT_COLUMNS = (
    "id, title, description, workout_type, target_muscle_groups,"
    " equipment, duration_minutes, difficulty_level, workout_data"
)


class SupabaseEmbeddingRepository:
    """Supabase-backed embedding repository for workouts and follow-along workouts."""

    def __init__(self, client: Client) -> None:
        self._client = client

    @staticmethod
    def _check_table(table: str) -> None:
        if table not in _ALLOWED_TABLES:
            raise ValueError(f"Invalid table: {table}")

    def get_workouts_without_embeddings(
        self,
        table: str,
        limit: int,
        workout_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        self._check_table(table)
        query = (
            self._client.table(table)
            .select(_WORKOUT_COLUMNS)
            .is_("embedding", "null")
            .limit(limit)
        )
        if workout_ids:
            query = query.in_("id", workout_ids)
        result = query.execute()
        return result.data or []

    def save_embedding(
        self,
        table: str,
        workout_id: str,
        embedding: List[float],
        content_hash: str,
    ) -> None:
        self._check_table(table)
        self._client.table(table).update(
            {"embedding": embedding, "embedding_content_hash": content_hash}
        ).eq("id", workout_id).execute()

    def get_workout_by_id(
        self,
        table: str,
        workout_id: str,
    ) -> Optional[Dict[str, Any]]:
        self._check_table(table)
        result = (
            self._client.table(table)
            .select(f"{_WORKOUT_COLUMNS}, embedding_content_hash")
            .eq("id", workout_id)
            .execute()
        )
        if result.data:
            return result.data[0]
        return None

    def get_progress(self, table: str) -> Dict[str, int]:
        self._check_table(table)
        # Count total rows
        total_result = (
            self._client.table(table)
            .select("id", count="exact")
            .execute()
        )
        total = total_result.count or 0

        # Count rows with embeddings
        embedded_result = (
            self._client.table(table)
            .select("id", count="exact")
            .not_.is_("embedding", "null")
            .execute()
        )
        embedded = embedded_result.count or 0

        return {
            "total": total,
            "embedded": embedded,
            "remaining": total - embedded,
        }
