"""Supabase implementation of RateLimitRepository."""

from datetime import date, datetime

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

    def increment(self, user_id: str) -> None:
        today = date.today().isoformat()

        # Check for existing row
        existing = (
            self._client.table(self.TABLE)
            .select("id, request_count")
            .eq("user_id", user_id)
            .eq("request_date", today)
            .limit(1)
            .execute()
        )

        if existing.data:
            row = existing.data[0]
            self._client.table(self.TABLE).update(
                {
                    "request_count": row["request_count"] + 1,
                    "last_request_at": datetime.utcnow().isoformat(),
                }
            ).eq("id", row["id"]).execute()
        else:
            self._client.table(self.TABLE).insert(
                {
                    "user_id": user_id,
                    "request_date": today,
                    "request_count": 1,
                    "last_request_at": datetime.utcnow().isoformat(),
                }
            ).execute()
