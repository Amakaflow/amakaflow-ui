"""Port interface for rate limit operations."""

from typing import Protocol


class RateLimitRepository(Protocol):
    """Repository protocol for AI request rate limiting."""

    def get_monthly_usage(self, user_id: str) -> int:
        """Get total request count for the current calendar month.

        Returns:
            Sum of request_count for all daily rows in the current month.
        """
        ...

    def increment(self, user_id: str) -> int:
        """Atomically increment the request count for today.

        Returns:
            The new request count after incrementing.
        """
        ...
