"""Async Supabase implementation of ChatSessionRepository."""

from typing import Any, Dict, List, Optional

from supabase import AsyncClient


class AsyncSupabaseChatSessionRepository:
    """Async Supabase-backed chat session repository."""

    TABLE = "chat_sessions"

    def __init__(self, client: AsyncClient) -> None:
        self._client = client

    async def create(self, user_id: str, title: Optional[str] = None) -> Dict[str, Any]:
        result = await (
            self._client.table(self.TABLE)
            .insert({"user_id": user_id, "title": title or "New Chat"})
            .execute()
        )
        return result.data[0]

    async def get(self, session_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        result = await (
            self._client.table(self.TABLE)
            .select("*")
            .eq("id", session_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        return result.data[0] if result.data else None

    async def update_title(self, session_id: str, title: str) -> None:
        await (
            self._client.table(self.TABLE)
            .update({"title": title})
            .eq("id", session_id)
            .execute()
        )

    async def list_for_user(
        self, user_id: str, limit: int = 20, offset: int = 0
    ) -> List[Dict[str, Any]]:
        result = await (
            self._client.table(self.TABLE)
            .select("*")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data or []

    async def delete(self, session_id: str, user_id: str) -> bool:
        """Delete a session if it belongs to the user.

        Args:
            session_id: The session ID to delete.
            user_id: The user ID (for ownership verification).

        Returns:
            True if a session was deleted, False if not found.
        """
        result = await (
            self._client.table(self.TABLE)
            .delete()
            .eq("id", session_id)
            .eq("user_id", user_id)
            .execute()
        )
        return len(result.data) > 0 if result.data else False
