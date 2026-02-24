"""
YouTube workout cache service.

Handles caching of YouTube workout metadata to avoid redundant API calls
and AI processing for previously ingested videos.
"""

import os
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def get_supabase_client():
    """Get Supabase client instance."""
    try:
        from supabase import create_client, Client
    except ImportError:
        logger.warning("Supabase library not installed. Caching will be disabled.")
        return None

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY")

    if not supabase_url or not supabase_key:
        logger.warning("Supabase credentials not configured. YouTube caching will be disabled.")
        return None

    try:
        return create_client(supabase_url, supabase_key)
    except Exception as e:
        logger.error(f"Failed to create Supabase client: {e}")
        return None


class YouTubeCacheService:
    """Service for caching YouTube workout metadata."""

    TABLE_NAME = "youtube_workout_cache"

    @staticmethod
    def get_cached_workout(video_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a cached workout by YouTube video ID.

        Args:
            video_id: YouTube video ID (11 characters)

        Returns:
            Cached workout data or None if not found
        """
        supabase = get_supabase_client()
        if not supabase:
            return None

        try:
            result = supabase.table(YouTubeCacheService.TABLE_NAME) \
                .select("*") \
                .eq("video_id", video_id) \
                .single() \
                .execute()

            if result.data:
                logger.info(f"Cache HIT for video_id: {video_id}")
                return result.data
            return None
        except Exception as e:
            # single() raises exception when no rows found
            if "no rows" in str(e).lower() or "0 rows" in str(e).lower():
                logger.info(f"Cache MISS for video_id: {video_id}")
                return None
            logger.error(f"Error fetching cached workout for video_id {video_id}: {e}")
            return None

    @staticmethod
    def get_cached_workout_by_url(normalized_url: str) -> Optional[Dict[str, Any]]:
        """
        Get a cached workout by normalized URL.

        Args:
            normalized_url: Normalized YouTube URL (e.g., "youtube.com/watch?v=VIDEO_ID")

        Returns:
            Cached workout data or None if not found
        """
        supabase = get_supabase_client()
        if not supabase:
            return None

        try:
            result = supabase.table(YouTubeCacheService.TABLE_NAME) \
                .select("*") \
                .eq("normalized_url", normalized_url) \
                .single() \
                .execute()

            if result.data:
                logger.info(f"Cache HIT for normalized_url: {normalized_url}")
                return result.data
            return None
        except Exception as e:
            if "no rows" in str(e).lower() or "0 rows" in str(e).lower():
                logger.info(f"Cache MISS for normalized_url: {normalized_url}")
                return None
            logger.error(f"Error fetching cached workout for url {normalized_url}: {e}")
            return None

    @staticmethod
    def save_cached_workout(
        video_id: str,
        source_url: str,
        normalized_url: str,
        video_metadata: Dict[str, Any],
        workout_data: Dict[str, Any],
        processing_method: str,
        ingested_by: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Save a workout to the cache.

        Args:
            video_id: YouTube video ID
            source_url: Original URL submitted by user
            normalized_url: Normalized URL for lookups
            video_metadata: Video metadata (title, channel, duration, etc.)
            workout_data: Extracted workout structure
            processing_method: How the workout was processed (e.g., "llm_openai", "llm_anthropic")
            ingested_by: Optional user ID who first ingested this workout

        Returns:
            Saved cache entry or None if failed
        """
        supabase = get_supabase_client()
        if not supabase:
            return None

        try:
            now = datetime.now(timezone.utc).isoformat()

            data = {
                "video_id": video_id,
                "source_url": source_url,
                "normalized_url": normalized_url,
                "platform": "youtube",
                "video_metadata": video_metadata,
                "workout_data": workout_data,
                "processing_method": processing_method,
                "ingested_at": now,
                "ingested_by": ingested_by,
            }

            result = supabase.table(YouTubeCacheService.TABLE_NAME) \
                .insert(data) \
                .execute()

            if result.data and len(result.data) > 0:
                logger.info(f"Cached workout saved for video_id: {video_id}")
                return result.data[0]
            return None
        except Exception as e:
            error_str = str(e)
            # Handle duplicate key violation (workout already cached)
            if "duplicate" in error_str.lower() or "unique" in error_str.lower():
                logger.info(f"Workout already cached for video_id: {video_id}")
                return YouTubeCacheService.get_cached_workout(video_id)
            logger.error(f"Failed to cache workout for video_id {video_id}: {e}")
            return None

    @staticmethod
    def update_cached_workout(
        video_id: str,
        workout_data: Optional[Dict[str, Any]] = None,
        video_metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Update an existing cached workout.

        Args:
            video_id: YouTube video ID
            workout_data: Updated workout structure (optional)
            video_metadata: Updated video metadata (optional)

        Returns:
            True if update successful, False otherwise
        """
        supabase = get_supabase_client()
        if not supabase:
            return False

        try:
            update_data = {
                "updated_at": datetime.now(timezone.utc).isoformat()
            }

            if workout_data is not None:
                update_data["workout_data"] = workout_data
            if video_metadata is not None:
                update_data["video_metadata"] = video_metadata

            result = supabase.table(YouTubeCacheService.TABLE_NAME) \
                .update(update_data) \
                .eq("video_id", video_id) \
                .execute()

            return result.data is not None and len(result.data) > 0
        except Exception as e:
            logger.error(f"Failed to update cached workout for video_id {video_id}: {e}")
            return False

    @staticmethod
    def increment_cache_hit(video_id: str) -> bool:
        """
        Increment the cache hit counter for a video.

        This is useful for tracking popularity and usage patterns.

        Args:
            video_id: YouTube video ID

        Returns:
            True if successful, False otherwise
        """
        supabase = get_supabase_client()
        if not supabase:
            return False

        try:
            # Use RPC to increment counter atomically
            # Note: Requires a database function, fallback to manual update
            result = supabase.table(YouTubeCacheService.TABLE_NAME) \
                .select("cache_hits") \
                .eq("video_id", video_id) \
                .single() \
                .execute()

            if result.data:
                current_hits = result.data.get("cache_hits", 0) or 0
                supabase.table(YouTubeCacheService.TABLE_NAME) \
                    .update({
                        "cache_hits": current_hits + 1,
                        "last_accessed_at": datetime.now(timezone.utc).isoformat()
                    }) \
                    .eq("video_id", video_id) \
                    .execute()
                return True
            return False
        except Exception as e:
            # Non-critical operation, just log and continue
            logger.debug(f"Failed to increment cache hit for video_id {video_id}: {e}")
            return False

    @staticmethod
    def delete_cached_workout(video_id: str) -> bool:
        """
        Delete a cached workout by video ID.

        Args:
            video_id: YouTube video ID

        Returns:
            True if successful, False otherwise
        """
        supabase = get_supabase_client()
        if not supabase:
            return False

        try:
            result = supabase.table(YouTubeCacheService.TABLE_NAME) \
                .delete() \
                .eq("video_id", video_id) \
                .execute()

            deleted = result.data is not None and len(result.data) > 0
            if deleted:
                logger.info(f"Deleted cached workout for video_id: {video_id}")
            return deleted
        except Exception as e:
            logger.error(f"Failed to delete cached workout for video_id {video_id}: {e}")
            return False

    @staticmethod
    def get_cache_stats() -> Dict[str, Any]:
        """
        Get cache statistics.

        Returns:
            Dict with total_cached, total_hits, etc.
        """
        supabase = get_supabase_client()
        if not supabase:
            return {"error": "Supabase not configured"}

        try:
            # Get total count
            count_result = supabase.table(YouTubeCacheService.TABLE_NAME) \
                .select("id", count="exact") \
                .execute()

            total_cached = count_result.count if hasattr(count_result, 'count') else 0

            # Get total hits (sum of cache_hits column)
            hits_result = supabase.table(YouTubeCacheService.TABLE_NAME) \
                .select("cache_hits") \
                .execute()

            total_hits = sum(
                (row.get("cache_hits", 0) or 0)
                for row in (hits_result.data or [])
            )

            return {
                "total_cached": total_cached,
                "total_cache_hits": total_hits,
            }
        except Exception as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {"error": str(e)}
