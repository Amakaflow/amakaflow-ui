"""Database models and operations for token storage."""
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)


class TokenStore:
    """
    Token storage interface.
    
    This will be implemented with Supabase later.
    For now, uses in-memory storage for development.
    """
    
    def __init__(self):
        # In-memory storage (replace with Supabase later)
        self._tokens: Dict[str, Dict[str, Any]] = {}
    
    async def store_tokens(
        self,
        user_id: str,
        access_token: str,
        refresh_token: str,
        expires_at: int,
        athlete_id: Optional[int] = None,
    ) -> None:
        """
        Store encrypted tokens for a user.
        
        Args:
            user_id: MyAmaka user ID
            access_token: Encrypted access token
            refresh_token: Encrypted refresh token
            expires_at: Unix timestamp when token expires
            athlete_id: Strava athlete ID (optional)
        """
        self._tokens[user_id] = {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_at": expires_at,
            "athlete_id": athlete_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        logger.info(f"Stored tokens for user {user_id}")
    
    async def get_tokens(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve encrypted tokens for a user.
        
        Returns:
            Dict with access_token, refresh_token, expires_at or None
        """
        return self._tokens.get(user_id)
    
    async def update_tokens(
        self,
        user_id: str,
        access_token: str,
        refresh_token: str,
        expires_at: int,
        athlete_id: Optional[int] = None,
    ) -> None:
        """Update stored tokens."""
        # Preserve existing athlete_id if not provided
        existing = await self.get_tokens(user_id)
        if athlete_id is None and existing:
            athlete_id = existing.get("athlete_id")
        await self.store_tokens(user_id, access_token, refresh_token, expires_at, athlete_id)
    
    async def delete_tokens(self, user_id: str) -> None:
        """Delete tokens for a user."""
        if user_id in self._tokens:
            del self._tokens[user_id]
            logger.info(f"Deleted tokens for user {user_id}")


# Global instance
db = TokenStore()

