"""OpenAI embedding service wrapper.

Uses text-embedding-3-small to generate embeddings for workout content.
"""

import hashlib
import logging
from typing import Any, Dict, List

from openai import OpenAI

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "text-embedding-3-small"


def build_content(workout: Dict[str, Any]) -> str:
    """Build a text representation of a workout for embedding.

    Concatenates top-level columns and selected workout_data fields
    into a single string suitable for embedding.

    Args:
        workout: Dict with workout columns.

    Returns:
        Concatenated text string (may be empty if no useful data).
    """
    parts: List[str] = []

    # Top-level columns
    for field in ("title", "description", "workout_type", "difficulty_level"):
        val = workout.get(field)
        if val:
            parts.append(str(val))

    # List columns
    for field in ("target_muscle_groups", "equipment"):
        val = workout.get(field)
        if val and isinstance(val, list):
            parts.append(", ".join(str(v) for v in val))

    # Duration
    duration = workout.get("duration_minutes")
    if duration:
        parts.append(f"{duration} minutes")

    # JSONB workout_data fields
    wd = workout.get("workout_data")
    if isinstance(wd, dict):
        for key in ("goals", "instructions", "notes"):
            val = wd.get(key)
            if val:
                if isinstance(val, list):
                    parts.append(", ".join(str(v) for v in val))
                else:
                    parts.append(str(val))

    return " | ".join(parts)


def content_hash(content: str) -> str:
    """SHA-256 hash of content string."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


class EmbeddingService:
    """Wraps OpenAI embeddings API."""

    def __init__(self, api_key: str) -> None:
        self._client = OpenAI(api_key=api_key)

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Embed a batch of text strings.

        Args:
            texts: List of strings to embed.

        Returns:
            List of embedding vectors (same order as input).
        """
        if not texts:
            return []

        response = self._client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=texts,
        )
        # Sort by index to preserve input order
        sorted_data = sorted(response.data, key=lambda d: d.index)
        return [d.embedding for d in sorted_data]

    def embed_single(self, text: str) -> List[float]:
        """Embed a single text string."""
        results = self.embed_batch([text])
        return results[0]
