"""TikTok platform adapter — uses TikTokService (oEmbed + yt-dlp)."""
from __future__ import annotations

import logging
from .base import PlatformAdapter, MediaContent, PlatformFetchError
from . import register_adapter
from workout_ingestor_api.services.tiktok_service import TikTokService

logger = logging.getLogger(__name__)


class TikTokAdapter(PlatformAdapter):
    @staticmethod
    def platform_name() -> str:
        return "tiktok"

    def fetch(self, url: str, source_id: str) -> MediaContent:
        try:
            metadata = TikTokService.extract_metadata(url)
        except Exception as e:
            raise PlatformFetchError(f"TikTok fetch failed for {source_id}: {e}") from e

        # TikTok oEmbed provides no transcript — description is the creator's caption
        description = metadata.title.strip() if metadata.title else ""
        primary_text = description
        if not primary_text:
            raise PlatformFetchError(f"No text found for TikTok video {source_id}")

        title = ((metadata.title or "").strip() or f"TikTok by @{metadata.author_name}")[:80]

        return MediaContent(
            primary_text=primary_text,
            secondary_texts=[],
            title=title,
            media_metadata={
                "platform": "tiktok",
                "video_id": source_id,
                "creator": metadata.author_name,
                "hashtags": metadata.hashtags,
                "duration_seconds": metadata.duration_seconds,
            },
        )


register_adapter(TikTokAdapter)
