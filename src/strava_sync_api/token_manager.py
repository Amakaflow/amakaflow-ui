"""Token management with automatic refresh."""
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import logging

from strava_sync_api.config import settings
from strava_sync_api.database import db
from strava_sync_api.strava_client import StravaClient, StravaAPIError
from strava_sync_api.crypto_utils import encrypt_token, decrypt_token

logger = logging.getLogger(__name__)


class TokenManager:
    """Manages Strava tokens with automatic refresh."""
    
    def __init__(self):
        self.strava_client = StravaClient(settings.strava_api_base)
    
    async def get_valid_token(self, user_id: str) -> str:
        """
        Get a valid access token for a user, refreshing if necessary.
        
        Args:
            user_id: MyAmaka user ID
            
        Returns:
            Valid access token (decrypted)
        """
        tokens = await db.get_tokens(user_id)
        
        if not tokens:
            raise ValueError(f"No tokens found for user {user_id}")
        
        # Check if token is expired (with 60 second buffer)
        expires_at = tokens["expires_at"]
        now = int(datetime.now(timezone.utc).timestamp())
        
        if now >= (expires_at - 60):
            logger.info(f"Token expired for user {user_id}, refreshing...")
            await self.refresh_token(user_id)
            tokens = await db.get_tokens(user_id)
        
        # Decrypt and return access token
        return decrypt_token(tokens["access_token"])
    
    async def refresh_token(self, user_id: str) -> Dict[str, Any]:
        """
        Refresh access token for a user.
        
        Args:
            user_id: MyAmaka user ID
            
        Returns:
            Updated token information
            
        Raises:
            ValueError: If no tokens found
            StravaAPIError: If refresh fails (may indicate refresh token expired)
        """
        tokens = await db.get_tokens(user_id)
        
        if not tokens:
            raise ValueError(f"No tokens found for user {user_id}")
        
        # Decrypt refresh token
        refresh_token = decrypt_token(tokens["refresh_token"])
        
        # Refresh with Strava
        try:
            new_tokens = await self.strava_client.refresh_access_token(
                refresh_token=refresh_token,
                client_id=settings.strava_client_id,
                client_secret=settings.strava_client_secret,
            )
            
            # Encrypt and store new tokens
            encrypted_access = encrypt_token(new_tokens["access_token"])
            encrypted_refresh = encrypt_token(new_tokens["refresh_token"])
            
            # Preserve existing athlete_id
            existing = await db.get_tokens(user_id)
            athlete_id = existing.get("athlete_id") if existing else None
            
            await db.update_tokens(
                user_id=user_id,
                access_token=encrypted_access,
                refresh_token=encrypted_refresh,
                expires_at=new_tokens["expires_at"],
                athlete_id=athlete_id,
            )
            
            logger.info(f"Successfully refreshed token for user {user_id}")
            return {
                "access_token": new_tokens["access_token"],  # Return decrypted for internal use
                "refresh_token": new_tokens["refresh_token"],
                "expires_at": new_tokens["expires_at"],
            }
        except StravaAPIError as e:
            error_message = str(e)
            logger.error(f"Failed to refresh token for user {user_id}: {e}")
            
            # Check if refresh token is expired (common error patterns)
            if "invalid" in error_message.lower() or "expired" in error_message.lower() or "401" in error_message:
                # Create a more specific error message for refresh token expiration
                raise StravaAPIError(
                    f"Refresh token expired or invalid for user {user_id}. Reauthorization required."
                )
            raise
    
    async def store_initial_tokens(
        self,
        user_id: str,
        access_token: str,
        refresh_token: str,
        expires_at: int,
        athlete_id: Optional[int] = None,
    ) -> None:
        """
        Store initial tokens after OAuth.
        
        Args:
            user_id: MyAmaka user ID
            access_token: Access token (will be encrypted)
            refresh_token: Refresh token (will be encrypted)
            expires_at: Expiration timestamp
            athlete_id: Strava athlete ID (optional)
        """
        encrypted_access = encrypt_token(access_token)
        encrypted_refresh = encrypt_token(refresh_token)
        
        await db.store_tokens(
            user_id=user_id,
            access_token=encrypted_access,
            refresh_token=encrypted_refresh,
            expires_at=expires_at,
            athlete_id=athlete_id,
        )
        
        logger.info(f"Stored initial tokens for user {user_id}")


# Global instance
token_manager = TokenManager()

