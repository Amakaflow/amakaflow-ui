"""Instagram Reel workout cache service (Supabase-backed).

Two independent caches:
- InstagramApifyRawCacheService  — raw Apify response (transcript, caption, etc.)
- InstagramReelCacheService      — processed workout JSON from LLM

Clearing the workout cache forces LLM re-extraction without re-calling Apify.
Clearing both caches forces a full fresh fetch.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class InstagramApifyRawCacheService:
    """Cache for raw Apify reel data in Supabase.

    Stores the unprocessed Apify response keyed by shortcode so subsequent
    requests (e.g. after a prompt fix) can skip the Apify API call entirely.
    """

    TABLE_NAME = "instagram_reel_apify_cache"

    @staticmethod
    def get_cached_raw(shortcode: str) -> Optional[Dict[str, Any]]:
        """Return cached raw Apify data for shortcode, or None on miss/error."""
        supabase = _get_supabase_client()
        if not supabase:
            return None
        try:
            result = (
                supabase.table(InstagramApifyRawCacheService.TABLE_NAME)
                .select("raw_data")
                .eq("shortcode", shortcode)
                .single()
                .execute()
            )
            if result.data:
                logger.info(f"Apify raw cache HIT: {shortcode}")
                return result.data["raw_data"]
            return None
        except Exception as e:
            if "no rows" in str(e).lower() or "0 rows" in str(e).lower():
                logger.info(f"Apify raw cache MISS: {shortcode}")
                return None
            logger.error(f"Apify raw cache lookup error for {shortcode}: {e}")
            return None

    @staticmethod
    def save_raw(shortcode: str, source_url: str, raw_data: Dict[str, Any]) -> bool:
        """Persist raw Apify response. Silently skips on error (non-critical path)."""
        supabase = _get_supabase_client()
        if not supabase:
            return False
        try:
            supabase.table(InstagramApifyRawCacheService.TABLE_NAME).upsert(
                {
                    "shortcode": shortcode,
                    "source_url": source_url,
                    "raw_data": raw_data,
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                },
                on_conflict="shortcode",
            ).execute()
            logger.info(f"Saved Apify raw cache: {shortcode}")
            return True
        except Exception as e:
            logger.error(f"Failed to save Apify raw cache for {shortcode}: {e}")
            return False


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
