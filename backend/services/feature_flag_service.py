"""Feature Flag Service for chat feature rollout.

Provides methods to check feature flags and rate limits for users.
Integrates with Supabase feature_flags table.

Part of AMA-437: Feature Flags & Beta Rollout Configuration
"""

import logging
from typing import Any, Dict, List

from supabase import Client

logger = logging.getLogger(__name__)


# Default rate limits by tier (messages per month)
RATE_LIMITS = {
    "free": 50,
    "paid": 500,
    "unlimited": 999999,
}

# Default enabled functions
DEFAULT_FUNCTIONS = [
    "get_user_profile",
    "search_workouts",
    "get_workout_history",
]


class FeatureFlagService:
    """Service for checking feature flags and rate limits."""

    def __init__(self, supabase_client: Client) -> None:
        """Initialize with Supabase client.

        Args:
            supabase_client: Supabase client for database access.
        """
        self._client = supabase_client
        self._cache: Dict[str, Dict[str, Any]] = {}

    def get_user_flags(self, user_id: str) -> Dict[str, Any]:
        """Get merged feature flags for a user.

        Calls the get_user_feature_flags RPC function which merges
        global and user-specific flags. Results are cached per-request
        to avoid redundant database calls.

        Args:
            user_id: Clerk user ID.

        Returns:
            Dict of flag_key -> value.
        """
        # Check per-request cache first
        if user_id in self._cache:
            return self._cache[user_id]

        try:
            result = self._client.rpc(
                "get_user_feature_flags",
                {"p_user_id": user_id},
            ).execute()

            flags = result.data if result.data else {}
            self._cache[user_id] = flags
            return flags
        except Exception as e:
            logger.warning("Failed to fetch feature flags for user %s: %s", user_id, e)
            # Cache empty result to avoid repeated failed calls
            self._cache[user_id] = {}
            return {}

    def is_chat_enabled(self, user_id: str) -> bool:
        """Check if chat is enabled for a user.

        Considers both the global chat_enabled flag and beta access.

        Args:
            user_id: Clerk user ID.

        Returns:
            True if chat is accessible for this user.
        """
        flags = self.get_user_flags(user_id)

        # Check master kill switch
        chat_enabled = self._parse_flag(flags.get("chat_enabled"), True)
        if not chat_enabled:
            return False

        # Check beta period
        beta_period = self._parse_flag(flags.get("chat_beta_period"), False)
        if beta_period:
            # During beta, user needs beta access
            beta_access = self._parse_flag(flags.get("chat_beta_access"), False)
            return beta_access

        return True

    def get_rate_limit_for_user(self, user_id: str) -> int:
        """Get the rate limit (messages per month) for a user.

        Args:
            user_id: Clerk user ID.

        Returns:
            Monthly message limit for the user.
        """
        flags = self.get_user_flags(user_id)
        tier = self._parse_flag(flags.get("chat_rate_limit_tier"), "free")

        if isinstance(tier, str) and tier in RATE_LIMITS:
            return RATE_LIMITS[tier]

        return RATE_LIMITS["free"]

    def is_function_enabled(self, user_id: str, function_name: str) -> bool:
        """Check if a specific function/tool is enabled for a user.

        Args:
            user_id: Clerk user ID.
            function_name: Name of the function to check.

        Returns:
            True if the function is enabled for this user.
        """
        flags = self.get_user_flags(user_id)
        enabled_functions = self._parse_flag(
            flags.get("chat_functions_enabled"),
            DEFAULT_FUNCTIONS,
        )

        if isinstance(enabled_functions, list):
            return function_name in enabled_functions

        return function_name in DEFAULT_FUNCTIONS

    def get_enabled_functions(self, user_id: str) -> List[str]:
        """Get list of enabled functions for a user.

        Args:
            user_id: Clerk user ID.

        Returns:
            List of enabled function names.
        """
        flags = self.get_user_flags(user_id)
        enabled_functions = self._parse_flag(
            flags.get("chat_functions_enabled"),
            DEFAULT_FUNCTIONS,
        )

        if isinstance(enabled_functions, list):
            return enabled_functions

        return DEFAULT_FUNCTIONS

    def is_voice_enabled(self, user_id: str) -> bool:
        """Check if voice input is enabled for a user.

        Args:
            user_id: Clerk user ID.

        Returns:
            True if voice input is enabled.
        """
        flags = self.get_user_flags(user_id)
        return self._parse_flag(flags.get("chat_voice_enabled"), True)

    @staticmethod
    def _parse_flag(value: Any, default: Any) -> Any:
        """Parse a flag value from JSONB storage.

        Args:
            value: Raw value from database.
            default: Default value if parsing fails.

        Returns:
            Parsed value or default.
        """
        if value is None:
            return default

        # JSONB values are already parsed by Supabase client
        if isinstance(value, (bool, int, float, str, list, dict)):
            return value

        return default


def create_feature_flag_service(supabase_client: Client) -> FeatureFlagService:
    """Create a new FeatureFlagService instance.

    Note: This creates a fresh instance per request. The service uses
    internal per-request caching for flag lookups to avoid redundant
    database calls within the same request.

    Args:
        supabase_client: Supabase client for database access.

    Returns:
        FeatureFlagService instance.
    """
    return FeatureFlagService(supabase_client)
