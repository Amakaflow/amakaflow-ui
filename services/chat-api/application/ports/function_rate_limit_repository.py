"""Port interface for per-function rate limit operations."""

from typing import Protocol, Tuple


class FunctionRateLimitRepository(Protocol):
    """Repository protocol for per-function rate limiting.

    Used for rate-limiting expensive operations like sync functions
    (e.g., Strava sync limited to 3/hour).
    """

    def check_and_increment(
        self, user_id: str, function_name: str, limit: int, window_hours: int = 1
    ) -> Tuple[bool, int, int]:
        """Check if call is allowed and increment counter if so.

        Uses hourly windows by default. Increments atomically.

        Args:
            user_id: The user making the call.
            function_name: Name of the rate-limited function.
            limit: Maximum calls allowed per window.
            window_hours: Size of the rate limit window in hours (default: 1).

        Returns:
            Tuple of (allowed: bool, current_count: int, limit: int).
            If allowed is False, current_count shows how many calls were made.
        """
        ...

    def get_remaining(
        self, user_id: str, function_name: str, limit: int, window_hours: int = 1
    ) -> int:
        """Get remaining calls available in the current window.

        Args:
            user_id: The user to check.
            function_name: Name of the rate-limited function.
            limit: Maximum calls allowed per window.
            window_hours: Size of the rate limit window in hours (default: 1).

        Returns:
            Number of remaining calls (0 if limit reached).
        """
        ...
