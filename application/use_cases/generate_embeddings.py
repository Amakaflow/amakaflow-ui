"""Use case: Generate embeddings for workouts in batch.

Supports resume (skips already-embedded rows) and progress tracking.
"""

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from application.ports.embedding_repository import EmbeddingRepository
from backend.services.embedding_service import (
    EmbeddingService,
    build_content,
    content_hash,
)

logger = logging.getLogger(__name__)


@dataclass
class EmbeddingResult:
    """Result of an embedding generation run."""

    total_processed: int = 0
    total_embedded: int = 0
    total_skipped: int = 0
    errors: List[Dict[str, str]] = field(default_factory=list)
    duration_seconds: float = 0.0


@dataclass
class SingleEmbeddingResult:
    """Result of a single-workout embedding generation."""

    status: str  # "embedded", "unchanged", "skipped", "not_found", "error"
    workout_id: str
    error: Optional[str] = None


class GenerateEmbeddingsUseCase:
    """Orchestrates batch embedding generation with resume capability."""

    def __init__(
        self,
        repository: EmbeddingRepository,
        embedding_service: EmbeddingService,
        batch_size: int = 100,
    ) -> None:
        self._repo = repository
        self._embedding_service = embedding_service
        self._batch_size = batch_size

    def execute(
        self,
        table: str = "workouts",
        workout_ids: Optional[List[str]] = None,
    ) -> EmbeddingResult:
        """Run embedding generation for a table.

        Args:
            table: 'workouts' or 'follow_along_workouts'.
            workout_ids: Optional specific IDs; None = all unembedded.

        Returns:
            EmbeddingResult with counts and errors.
        """
        start = time.time()
        result = EmbeddingResult()
        skip_ids: set = set()

        while True:
            batch = self._repo.get_workouts_without_embeddings(
                table=table,
                limit=self._batch_size,
                workout_ids=workout_ids,
            )
            # Filter out IDs already seen and skipped/errored to avoid
            # infinite loops when workouts can never be embedded.
            batch = [w for w in batch if w["id"] not in skip_ids]
            if not batch:
                break

            new_skips = self._process_batch(batch, table, result)
            skip_ids.update(new_skips)

        result.duration_seconds = round(time.time() - start, 2)
        return result

    def _process_batch(
        self,
        workouts: List[Dict[str, Any]],
        table: str,
        result: EmbeddingResult,
    ) -> set:
        """Process a single batch of workouts.

        Returns:
            Set of workout IDs that were skipped or errored (not embedded).
        """
        non_embedded_ids: set = set()

        # Build content and filter empty
        contents: List[tuple] = []  # (workout, content_text, hash)
        for w in workouts:
            result.total_processed += 1
            text = build_content(w)
            if not text.strip():
                result.total_skipped += 1
                non_embedded_ids.add(w["id"])
                logger.debug("Skipped workout %s: empty content", w["id"])
                continue
            contents.append((w, text, content_hash(text)))

        if not contents:
            return non_embedded_ids

        # Batch embed
        texts = [c[1] for c in contents]
        try:
            embeddings = self._embedding_service.embed_batch(texts)
        except Exception as e:
            logger.error("Batch embedding failed: %s", e)
            for w, _, _ in contents:
                result.errors.append({"workout_id": w["id"], "error": str(e)})
                non_embedded_ids.add(w["id"])
            return non_embedded_ids

        # Save each embedding
        for (w, _, chash), embedding in zip(contents, embeddings):
            try:
                self._repo.save_embedding(
                    table=table,
                    workout_id=w["id"],
                    embedding=embedding,
                    content_hash=chash,
                )
                result.total_embedded += 1
            except Exception as e:
                logger.error("Failed to save embedding for %s: %s", w["id"], e)
                result.errors.append({"workout_id": w["id"], "error": str(e)})
                non_embedded_ids.add(w["id"])

        return non_embedded_ids

    def execute_single(
        self,
        table: str = "workouts",
        workout_id: str = "",
    ) -> SingleEmbeddingResult:
        """Generate embedding for a single workout by ID.

        Fetches the workout, builds content, generates embedding, saves it.
        Skips re-embedding if content has not changed (idempotent).

        Args:
            table: 'workouts' or 'follow_along_workouts'.
            workout_id: The workout row ID.

        Returns:
            SingleEmbeddingResult with status and optional error.
        """
        workout = self._repo.get_workout_by_id(table=table, workout_id=workout_id)
        if workout is None:
            return SingleEmbeddingResult(status="not_found", workout_id=workout_id)

        text = build_content(workout)
        if not text.strip():
            logger.debug("Skipped workout %s: empty content", workout_id)
            return SingleEmbeddingResult(status="skipped", workout_id=workout_id)

        # Check content hash for idempotency — skip if unchanged
        new_hash = content_hash(text)
        existing_hash = workout.get("embedding_content_hash")
        if existing_hash and existing_hash == new_hash:
            logger.debug("Workout %s unchanged (hash match), skipping", workout_id)
            return SingleEmbeddingResult(status="unchanged", workout_id=workout_id)

        try:
            embedding = self._embedding_service.embed_single(text)
        except Exception as e:
            logger.error("Embedding failed for %s: %s", workout_id, e)
            return SingleEmbeddingResult(status="error", workout_id=workout_id, error=str(e))

        try:
            self._repo.save_embedding(
                table=table,
                workout_id=workout_id,
                embedding=embedding,
                content_hash=new_hash,
            )
        except Exception as e:
            logger.error("Save failed for %s: %s", workout_id, e)
            return SingleEmbeddingResult(status="error", workout_id=workout_id, error=str(e))

        return SingleEmbeddingResult(status="embedded", workout_id=workout_id)

    def get_progress(self, table: str = "workouts") -> Dict[str, int]:
        """Get embedding progress for a table."""
        return self._repo.get_progress(table)
