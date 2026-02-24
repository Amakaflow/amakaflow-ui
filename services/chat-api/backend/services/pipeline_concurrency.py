"""Per-user pipeline concurrency limiter.

Limits the number of active pipeline runs per user to prevent resource abuse.
Used by both WorkoutPipelineService and ProgramPipelineService.

Part of AMA-567 Phase E.
"""

import asyncio
import contextlib
import logging
from typing import AsyncIterator

logger = logging.getLogger(__name__)


class PipelineConcurrencyExceeded(Exception):
    """Raised when a user has too many active pipelines."""

    pass


# Backwards-compatible alias used by programs router
ConcurrencyLimitExceeded = PipelineConcurrencyExceeded


class PipelineConcurrencyLimiter:
    """In-memory per-user concurrency limiter for pipelines.

    Tracks active pipeline runs per user and rejects new runs when the limit
    is reached. Thread-safe via asyncio.Lock.
    """

    def __init__(self, max_per_user: int = 2):
        self._max = max_per_user
        self._active: dict[str, set[str]] = {}  # user_id -> {run_id, ...}
        self._lock = asyncio.Lock()

    async def acquire(self, user_id: str, run_id: str) -> bool:
        """Try to acquire a pipeline slot. Returns True if allowed."""
        async with self._lock:
            active = self._active.get(user_id, set())
            if len(active) >= self._max:
                return False
            active.add(run_id)
            self._active[user_id] = active
            return True

    async def release(self, user_id: str, run_id: str) -> None:
        """Release a pipeline slot."""
        async with self._lock:
            active = self._active.get(user_id)
            if active:
                active.discard(run_id)
                if not active:
                    del self._active[user_id]

    @contextlib.asynccontextmanager
    async def limit(self, user_id: str, run_id: str) -> AsyncIterator[None]:
        """Context manager: acquire on enter, release on exit (even on error)."""
        acquired = await self.acquire(user_id, run_id)
        if not acquired:
            raise PipelineConcurrencyExceeded(
                f"Too many active pipelines (max {self._max}). Please wait."
            )
        try:
            yield
        finally:
            await self.release(user_id, run_id)

    def user_active_count(self, user_id: str) -> int:
        """Get number of active pipelines for a user (sync, no lock)."""
        return len(self._active.get(user_id, set()))

    @property
    def active_count(self) -> int:
        """Get total number of active pipelines across all users."""
        return sum(len(s) for s in self._active.values())
