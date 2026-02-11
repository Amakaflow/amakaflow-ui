"""Instagram Reel workout cache service (Supabase-backed)."""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def _get_supabase_client():
    """Get Supabase client (reuses youtube_cache_service pattern)."""
    from workout_ingestor_api.services.youtube_cache_service import get_supabase_client
    return get_supabase_client()


class InstagramReelCacheService:
    """Cache for Instagram Reel workout data in Supabase."""

    TABLE_NAME = "instagram_reel_workout_cache"

    @staticmethod
    def get_cached_workout(shortcode: str) -> Optional[Dict[str, Any]]:
        supabase = _get_supabase_client()
        if not supabase:
            return None
        try:
            result = (
                supabase.table(InstagramReelCacheService.TABLE_NAME)
                .select("*")
                .eq("shortcode", shortcode)
                .single()
                .execute()
            )
            if result.data:
                logger.info(f"Instagram reel cache HIT: {shortcode}")
                return result.data
            return None
        except Exception as e:
            if "no rows" in str(e).lower() or "0 rows" in str(e).lower():
                logger.info(f"Instagram reel cache MISS: {shortcode}")
                return None
            logger.error(f"Cache lookup error for {shortcode}: {e}")
            return None

    @staticmethod
    def save_workout(
        shortcode: str,
        source_url: str,
        workout_data: Dict[str, Any],
        reel_metadata: Dict[str, Any],
        processing_method: str = "apify_transcript",
        user_id: Optional[str] = None,
    ) -> bool:
        supabase = _get_supabase_client()
        if not supabase:
            return False
        try:
            row = {
                "shortcode": shortcode,
                "source_url": source_url,
                "workout_data": workout_data,
                "reel_metadata": {
                    "creator": reel_metadata.get("ownerUsername"),
                    "caption": (reel_metadata.get("caption") or "")[:500],
                    "duration_seconds": reel_metadata.get("videoDuration"),
                    "likes": reel_metadata.get("likesCount"),
                },
                "processing_method": processing_method,
                "ingested_at": datetime.now(timezone.utc).isoformat(),
                "ingested_by": user_id,
                "cache_hits": 0,
            }
            supabase.table(InstagramReelCacheService.TABLE_NAME).upsert(
                row, on_conflict="shortcode"
            ).execute()
            logger.info(f"Cached Instagram reel workout: {shortcode}")
            return True
        except Exception as e:
            logger.error(f"Failed to cache reel workout {shortcode}: {e}")
            return False

    @staticmethod
    def increment_cache_hit(shortcode: str) -> None:
        supabase = _get_supabase_client()
        if not supabase:
            return
        try:
            supabase.rpc(
                "increment_instagram_reel_cache_hits",
                {"p_shortcode": shortcode},
            ).execute()
        except Exception:
            pass  # Non-critical
