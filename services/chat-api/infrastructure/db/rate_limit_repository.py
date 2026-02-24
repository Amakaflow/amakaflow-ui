"""Supabase implementation of RateLimitRepository."""

from datetime import date

from supabase import Client


class SupabaseRateLimitRepository:
    """Supabase-backed rate limit repository.

    Uses daily rows in ai_request_limits table.
    Monthly usage is the SUM of request_count for the current calendar month.
    """

    TABLE = "ai_request_limits"

    def __init__(self, client: Client) -> None:
        self._client = client

    def get_monthly_usage(self, user_id: str) -> int:
        first_of_month = date.today().replace(day=1).isoformat()
        result = (
            self._client.table(self.TABLE)
            .select("request_count")
            .eq("user_id", user_id)
            .gte("request_date", first_of_month)
            .execute()
        )
        return sum(row["request_count"] for row in (result.data or []))

    def increment(self, user_id: str) -> int:
        """Atomically increment the AI request count for today.

        Uses an atomic RPC to prevent race conditions where concurrent
        requests could bypass the rate limit.

        Args:
            user_id: The user's ID.

        Returns:
            The new request count after incrementing.
        """
        today = date.today().isoformat()
        result = self._client.rpc(
            "increment_ai_request_limit",
            {"p_user_id": user_id, "p_date": today},
        ).execute()

        if result.data:
            return result.data[0]["new_count"]
        return 1
