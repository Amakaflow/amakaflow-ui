"""Per-user pipeline concurrency limiter.

Enforces a maximum number of active pipelines per user.
Uses in-memory tracking (suitable for single-instance deployments).

Part of AMA-567 Phase E: Program pipeline (batched generation)
"""

import asyncio
import contextlib
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class PipelineConcurrencyLimiter:
    """Limits the number of concurrent pipeline executions per user.

    Thread-safe via asyncio.Lock. For multi-instance deployments,
    replace with Redis-based tracking.
    """

    def __init__(self, max_per_user: int = 2):
        self._max_per_user = max_per_user
        self._active: dict[str, set[str]] = {}  # user_id -> {run_id, ...}
        self._lock = asyncio.Lock()

    async def acquire(self, user_id: str, run_id: str) -> bool:
        """Try to acquire a pipeline slot for the user.

        Returns True if allowed, False if at the per-user limit.
        """
        async with self._lock:
            user_runs = self._active.setdefault(user_id, set())
            if len(user_runs) >= self._max_per_user:
                return False
            user_runs.add(run_id)
            return True

    async def release(self, user_id: str, run_id: str) -> None:
        """Release a pipeline slot for the user."""
        async with self._lock:
            user_runs = self._active.get(user_id)
            if user_runs:
                user_runs.discard(run_id)
                if not user_runs:
                    del self._active[user_id]

    @contextlib.asynccontextmanager
    async def limit(self, user_id: str, run_id: str):
        """Context manager: acquire on enter, release on exit.

        Raises PipelineConcurrencyExceeded if at limit.
        """
        acquired = await self.acquire(user_id, run_id)
        if not acquired:
            raise PipelineConcurrencyExceeded(
                f"Too many active pipelines (max {self._max_per_user}). Please wait."
            )
        try:
            yield
        finally:
            await self.release(user_id, run_id)

    @property
    def active_count(self) -> int:
        """Total active pipelines across all users."""
        return sum(len(runs) for runs in self._active.values())

    def user_active_count(self, user_id: str) -> int:
        """Number of active pipelines for a specific user."""
        return len(self._active.get(user_id, set()))


class PipelineConcurrencyExceeded(Exception):
    """Raised when a user exceeds their pipeline concurrency limit."""
    pass
