"""Supabase implementation of ChatMessageRepository."""

from typing import Any, Dict, List

from supabase import Client


class SupabaseChatMessageRepository:
    """Supabase-backed chat message repository."""

    TABLE = "chat_messages"

    def __init__(self, client: Client) -> None:
        self._client = client

    def create(self, message: Dict[str, Any]) -> Dict[str, Any]:
        result = self._client.table(self.TABLE).insert(message).execute()
        return result.data[0]

    def list_for_session(
        self, session_id: str, limit: int = 100
    ) -> List[Dict[str, Any]]:
        result = (
            self._client.table(self.TABLE)
            .select("*")
            .eq("session_id", session_id)
            .order("created_at", desc=False)
            .limit(limit)
            .execute()
        )
        return result.data or []
