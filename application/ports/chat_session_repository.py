"""Port interface for chat session operations."""

from typing import Any, Dict, List, Optional, Protocol


class ChatSessionRepository(Protocol):
    """Repository protocol for chat sessions."""

    def create(self, user_id: str, title: Optional[str] = None) -> Dict[str, Any]:
        """Create a new chat session.

        Returns:
            Dict with at least 'id' and 'title' keys.
        """
        ...

    def get(self, session_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get a session by ID, scoped to user.

        Returns:
            Session dict or None if not found / not owned by user.
        """
        ...

    def update_title(self, session_id: str, title: str) -> None:
        """Update the title of a session."""
        ...

    def list_for_user(
        self, user_id: str, limit: int = 50, offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List sessions for a user, newest first."""
        ...
