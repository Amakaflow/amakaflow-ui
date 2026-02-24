"""Port interface for embedding storage operations."""

from typing import Any, Dict, List, Optional, Protocol


class EmbeddingRepository(Protocol):
    """Repository protocol for workout embedding operations."""

    def get_workouts_without_embeddings(
        self,
        table: str,
        limit: int,
        workout_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Fetch workouts that have no embedding yet.

        Args:
            table: Table name ('workouts' or 'follow_along_workouts').
            limit: Max rows to return.
            workout_ids: Optional list of specific IDs to filter.

        Returns:
            List of workout dicts with id and data columns.
        """
        ...

    def save_embedding(
        self,
        table: str,
        workout_id: str,
        embedding: List[float],
        content_hash: str,
    ) -> None:
        """Persist an embedding vector for a workout.

        Args:
            table: Table name.
            workout_id: Row ID.
            embedding: Float vector from OpenAI.
            content_hash: SHA-256 of the content that was embedded.
        """
        ...

    def get_workout_by_id(
        self,
        table: str,
        workout_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Fetch a single workout by ID.

        Args:
            table: Table name ('workouts' or 'follow_along_workouts').
            workout_id: Row ID.

        Returns:
            Workout dict or None if not found.
        """
        ...

    def get_progress(self, table: str) -> Dict[str, int]:
        """Return embedding progress counts for a table.

        Returns:
            Dict with 'total', 'embedded', 'remaining' keys.
        """
        ...
