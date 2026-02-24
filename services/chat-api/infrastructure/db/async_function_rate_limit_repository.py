"""Async Supabase implementation of FunctionRateLimitRepository."""

from datetime import datetime, timezone
from typing import Tuple

from supabase import AsyncClient


class AsyncSupabaseFunctionRateLimitRepository:
    """Async Supabase-backed function rate limit repository.

    Uses hourly windows for rate limiting sync operations.
    Each row represents a (user, function, window) combination with a call count.
    """

    TABLE = "function_rate_limits"

    def __init__(self, client: AsyncClient) -> None:
        self._client = client

    def _get_window_start(self, window_hours: int = 1) -> datetime:
        """Get the start of the current rate limit window.

        For hourly windows, truncates to the current hour.
        For multi-hour windows, aligns to window boundaries from midnight.
        """
        now = datetime.now(timezone.utc)

        if window_hours == 1:
            # Simple case: truncate to current hour
            return now.replace(minute=0, second=0, microsecond=0)

        # Multi-hour window: align to window boundaries
        hours_since_midnight = now.hour
        window_start_hour = (hours_since_midnight // window_hours) * window_hours
        return now.replace(hour=window_start_hour, minute=0, second=0, microsecond=0)

    async def check_and_increment(
        self, user_id: str, function_name: str, limit: int, window_hours: int = 1
    ) -> Tuple[bool, int, int]:
        """Check if call is allowed and increment counter if so.

        Uses an atomic RPC to prevent race conditions where concurrent
        requests could bypass the rate limit.

        Returns:
            Tuple of (allowed: bool, current_count: int, limit: int).
        """
        window_start = self._get_window_start(window_hours)
        window_start_iso = window_start.isoformat()

        # Use atomic RPC to check and increment in a single operation
        result = await self._client.rpc(
            "check_and_increment_rate_limit",
            {
                "p_user_id": user_id,
                "p_function_name": function_name,
                "p_limit": limit,
                "p_window_start": window_start_iso,
            },
        ).execute()

        if result.data and len(result.data) > 0:
            row = result.data[0]
            return (row["allowed"], row["call_count"], row["rate_limit"])

        # Fallback if RPC returns empty (shouldn't happen)
        return (False, 0, limit)

    async def get_remaining(
        self, user_id: str, function_name: str, limit: int, window_hours: int = 1
    ) -> int:
        """Get remaining calls available in the current window."""
        window_start = self._get_window_start(window_hours)
        window_start_iso = window_start.isoformat()

        result = await (
            self._client.table(self.TABLE)
            .select("call_count")
            .eq("user_id", user_id)
            .eq("function_name", function_name)
            .eq("window_start", window_start_iso)
            .limit(1)
            .execute()
        )

        if result.data:
            current_count = result.data[0]["call_count"]
            return max(0, limit - current_count)

        # No calls made yet in this window
        return limit
