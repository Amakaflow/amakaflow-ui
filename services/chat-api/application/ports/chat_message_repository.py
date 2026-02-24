"""Port interface for chat message operations."""

from typing import Any, Dict, List, Protocol


class ChatMessageRepository(Protocol):
    """Repository protocol for chat messages."""

    def create(self, message: Dict[str, Any]) -> Dict[str, Any]:
        """Persist a chat message.

        Args:
            message: Dict with session_id, role, content, and optional
                     tool_calls, model, input_tokens, output_tokens, latency_ms.

        Returns:
            Created message dict with id.
        """
        ...

    def list_for_session(
        self, session_id: str, limit: int = 100
    ) -> List[Dict[str, Any]]:
        """List messages for a session, oldest first."""
        ...
