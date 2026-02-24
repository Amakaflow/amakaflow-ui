"""Supabase implementation of ChatMessageRepository."""

from typing import Any, Dict, List, Optional

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
        self,
        session_id: str,
        limit: int = 100,
        before: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List messages for a session with cursor-based pagination.

        Args:
            session_id: The session ID to fetch messages for.
            limit: Maximum number of messages to return.
            before: Cursor for pagination - message ID to fetch messages before.
                   Returns messages with created_at < the cursor message's created_at.

        Returns:
            List of messages in chronological order (oldest first).
        """
        query = (
            self._client.table(self.TABLE)
            .select("*")
            .eq("session_id", session_id)
        )

        if before:
            # Get the created_at of the cursor message (scoped to this session)
            cursor_result = (
                self._client.table(self.TABLE)
                .select("created_at")
                .eq("id", before)
                .eq("session_id", session_id)
                .limit(1)
                .execute()
            )
            if not cursor_result.data:
                # Invalid cursor: message doesn't exist in this session
                return []
            cursor_created_at = cursor_result.data[0]["created_at"]
            query = query.lt("created_at", cursor_created_at)

        result = query.order("created_at", desc=False).limit(limit).execute()
        return result.data or []
