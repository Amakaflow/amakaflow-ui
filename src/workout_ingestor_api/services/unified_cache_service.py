"""Unified workout cache backed by Supabase video_workout_cache table."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

_TABLE = "video_workout_cache"


def _get_supabase_client():
    """Get Supabase client (reuses youtube_cache_service pattern)."""
    from workout_ingestor_api.services.youtube_cache_service import get_supabase_client
    return get_supabase_client()


class UnifiedCacheService:
    """Static methods for reading/writing the unified workout cache."""

    @staticmethod
    def get(video_id: str, platform: str) -> Optional[Dict[str, Any]]:
        """Return cached workout_data or None on miss."""
        client = _get_supabase_client()
        if not client:
            return None
        try:
            result = (
                client.table(_TABLE)
                .select("workout_data")
                .eq("video_id", video_id)
                .eq("platform", platform)
                .single()
                .execute()
            )
            workout_data = result.data.get("workout_data") if result.data else None
            if workout_data is not None:
                logger.info("Cache HIT: %s/%s", platform, video_id)
                return workout_data
            logger.debug("Cache MISS: %s/%s", platform, video_id)
            return None
        except Exception as e:
            if "no rows" in str(e).lower() or "0 rows" in str(e).lower():
                logger.debug("Cache MISS: %s/%s", platform, video_id)
                return None
            logger.error("Cache read error for %s/%s: %s", platform, video_id, e)
            return None

    @staticmethod
    def save(video_id: str, platform: str, workout_data: Dict[str, Any]) -> bool:
        """Insert or ignore duplicate into the cache. Returns True on success."""
        client = _get_supabase_client()
        if not client:
            return False
        try:
            client.table(_TABLE).insert({
                "video_id": video_id,
                "platform": platform,
                "workout_data": workout_data,
                "ingested_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
            return True
        except Exception as e:
            if "duplicate" in str(e).lower() or "unique" in str(e).lower():
                logger.debug("Already cached: %s/%s", platform, video_id)
                return True  # Already exists = success
            else:
                logger.error("Cache save error for %s/%s: %s", platform, video_id, e)
                return False
