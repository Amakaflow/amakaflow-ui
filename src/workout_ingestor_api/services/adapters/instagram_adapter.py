"""Instagram platform adapter — fetches via Apify."""
from __future__ import annotations

import logging

from workout_ingestor_api.services.apify_service import ApifyService
from .base import PlatformAdapter, MediaContent, PlatformFetchError
from . import register_adapter

logger = logging.getLogger(__name__)


class InstagramAdapter(PlatformAdapter):
    """Fetches Instagram posts/reels/TV via Apify."""

    @staticmethod
    def platform_name() -> str:
        return "instagram"

    def fetch(self, url: str, source_id: str) -> MediaContent:
        try:
            reel = ApifyService.fetch_reel_data(url)
        except Exception as e:
            raise PlatformFetchError(f"Instagram fetch failed for {source_id}: {e}") from e

        caption: str = reel.get("caption") or ""
        transcript: str = reel.get("transcript") or ""
        duration: float | None = reel.get("videoDuration")
        creator: str = reel.get("ownerUsername", "unknown")

        primary_text = transcript.strip() if transcript.strip() else caption.strip()
        if not primary_text:
            raise PlatformFetchError(f"Instagram post {source_id} has no transcript or caption.")

        title = (caption.split("\n")[0] if caption else f"Instagram by @{creator}")[:80]

        return MediaContent(
            primary_text=primary_text,
            secondary_texts=[caption.strip()] if transcript.strip() and caption.strip() else [],
            title=title,
            media_metadata={
                "video_duration_sec": duration,
                "creator": creator,
                "shortcode": source_id,
                "had_transcript": bool(transcript.strip()),
            },
        )


register_adapter(InstagramAdapter)
