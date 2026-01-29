"""Supabase implementation of ChatSessionRepository."""

from typing import Any, Dict, List, Optional

from supabase import Client


class SupabaseChatSessionRepository:
    """Supabase-backed chat session repository."""

    TABLE = "chat_sessions"

    def __init__(self, client: Client) -> None:
        self._client = client

    def create(self, user_id: str, title: Optional[str] = None) -> Dict[str, Any]:
        result = (
            self._client.table(self.TABLE)
            .insert({"user_id": user_id, "title": title or "New Chat"})
            .execute()
        )
        return result.data[0]

    def get(self, session_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        result = (
            self._client.table(self.TABLE)
            .select("*")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    def update_title(self, session_id: str, title: str) -> None:
        self._client.table(self.TABLE).update({"title": title}).eq(
            "id", session_id
        ).execute()

    def list_for_user(
        self, user_id: str, limit: int = 20, offset: int = 0
    ) -> List[Dict[str, Any]]:
        result = (
            self._client.table(self.TABLE)
            .select("*")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data or []
