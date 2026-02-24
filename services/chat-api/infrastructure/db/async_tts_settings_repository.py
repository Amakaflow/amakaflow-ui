"""
Async Supabase implementation of TTS Settings Repository.

Part of AMA-505: Convert Streaming to Async Patterns

Handles persistence and retrieval of user TTS preferences and daily usage tracking.
"""

from dataclasses import dataclass
from datetime import date
from typing import Any, Dict, Optional

from supabase import AsyncClient


@dataclass
class TTSSettings:
    """User's TTS settings and usage."""

    tts_enabled: bool = True
    tts_voice_id: Optional[str] = None
    tts_speed: float = 1.0
    tts_pitch: float = 1.0
    auto_play_responses: bool = True
    tts_daily_chars_used: int = 0
    tts_daily_reset_date: Optional[date] = None
    daily_char_limit: int = 50_000  # Configurable limit from repository

    @property
    def daily_chars_remaining(self) -> int:
        """Calculate remaining daily characters based on configured limit."""
        return max(0, self.daily_char_limit - self.tts_daily_chars_used)


@dataclass
class TTSSettingsUpdate:
    """Fields that can be updated for TTS settings."""

    tts_enabled: Optional[bool] = None
    tts_voice_id: Optional[str] = None
    tts_speed: Optional[float] = None
    tts_pitch: Optional[float] = None
    auto_play_responses: Optional[bool] = None


class AsyncSupabaseTTSSettingsRepository:
    """Async Supabase-backed TTS settings repository."""

    TABLE = "user_voice_settings"

    def __init__(self, client: AsyncClient, daily_char_limit: int = 50_000) -> None:
        self._client = client
        self._daily_char_limit = daily_char_limit

    async def get_settings(self, user_id: str) -> TTSSettings:
        """
        Get user's TTS settings.

        Creates default settings if user has no record.

        Args:
            user_id: User ID to get settings for.

        Returns:
            TTSSettings with user preferences or defaults.
        """
        result = await (
            self._client.table(self.TABLE)
            .select(
                "tts_enabled, tts_voice_id, tts_speed, tts_pitch, "
                "auto_play_responses, tts_daily_chars_used, tts_daily_reset_date"
            )
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        if not result.data:
            # Return defaults - record will be created on first update
            return TTSSettings(daily_char_limit=self._daily_char_limit)

        row = result.data[0]
        return TTSSettings(
            tts_enabled=row.get("tts_enabled", True),
            tts_voice_id=row.get("tts_voice_id"),
            tts_speed=float(row.get("tts_speed", 1.0)),
            tts_pitch=float(row.get("tts_pitch", 1.0)),
            auto_play_responses=row.get("auto_play_responses", True),
            tts_daily_chars_used=row.get("tts_daily_chars_used", 0),
            tts_daily_reset_date=self._parse_date(row.get("tts_daily_reset_date")),
            daily_char_limit=self._daily_char_limit,
        )

    async def update_settings(
        self, user_id: str, settings: TTSSettingsUpdate
    ) -> TTSSettings:
        """
        Update user's TTS settings (upsert pattern).

        Args:
            user_id: User ID to update settings for.
            settings: Settings fields to update.

        Returns:
            Updated TTSSettings.
        """
        # Build update dict from non-None values
        update_data: Dict[str, Any] = {"user_id": user_id}

        if settings.tts_enabled is not None:
            update_data["tts_enabled"] = settings.tts_enabled
        if settings.tts_voice_id is not None:
            update_data["tts_voice_id"] = settings.tts_voice_id
        if settings.tts_speed is not None:
            update_data["tts_speed"] = settings.tts_speed
        if settings.tts_pitch is not None:
            update_data["tts_pitch"] = settings.tts_pitch
        if settings.auto_play_responses is not None:
            update_data["auto_play_responses"] = settings.auto_play_responses

        # Upsert the record
        await self._client.table(self.TABLE).upsert(
            update_data,
            on_conflict="user_id",
        ).execute()

        return await self.get_settings(user_id)

    async def increment_daily_chars(self, user_id: str, chars: int) -> int:
        """
        Atomically increment daily character usage, resetting if new day.

        Uses a Postgres function to ensure atomic increment and avoid
        race conditions from concurrent TTS requests.

        Args:
            user_id: User ID to increment for.
            chars: Number of characters to add.

        Returns:
            New total characters used today.
        """
        result = await self._client.rpc(
            "increment_tts_daily_chars",
            {"p_user_id": user_id, "p_chars": chars},
        ).execute()

        # RPC returns the new total directly
        return result.data if isinstance(result.data, int) else 0

    async def reset_daily_chars_if_needed(self, user_id: str) -> None:
        """
        Reset daily character counter if it's a new day.

        Args:
            user_id: User ID to check/reset.
        """
        await self._ensure_record_exists(user_id)
        await self._reset_daily_chars_if_needed(user_id)

    async def _ensure_record_exists(self, user_id: str) -> None:
        """Create voice settings record if it doesn't exist."""
        result = await (
            self._client.table(self.TABLE)
            .select("user_id")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        if not result.data:
            # Create with defaults
            await self._client.table(self.TABLE).insert(
                {
                    "user_id": user_id,
                    "tts_enabled": True,
                    "tts_speed": 1.0,
                    "tts_pitch": 1.0,
                    "auto_play_responses": True,
                    "tts_daily_chars_used": 0,
                    "tts_daily_reset_date": date.today().isoformat(),
                }
            ).execute()

    async def _reset_daily_chars_if_needed(self, user_id: str) -> None:
        """Internal: reset counter if date has changed."""
        result = await (
            self._client.table(self.TABLE)
            .select("tts_daily_reset_date")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )

        if not result.data:
            return

        stored_date = self._parse_date(result.data[0].get("tts_daily_reset_date"))
        today = date.today()

        if stored_date is None or stored_date < today:
            # New day - reset counter
            await (
                self._client.table(self.TABLE)
                .update(
                    {
                        "tts_daily_chars_used": 0,
                        "tts_daily_reset_date": today.isoformat(),
                    }
                )
                .eq("user_id", user_id)
                .execute()
            )

    def _parse_date(self, value: Any) -> Optional[date]:
        """Parse date from database value."""
        if value is None:
            return None
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            try:
                return date.fromisoformat(value)
            except ValueError:
                return None
        return None
