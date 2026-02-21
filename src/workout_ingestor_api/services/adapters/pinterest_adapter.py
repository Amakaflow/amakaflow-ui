"""Pinterest platform adapter."""
from __future__ import annotations

import asyncio
import logging

from workout_ingestor_api.services.pinterest_service import PinterestService
from .base import MediaContent, PlatformAdapter, PlatformFetchError
from . import register_adapter

logger = logging.getLogger(__name__)


class PinterestAdapter(PlatformAdapter):
    """Fetches Pinterest pin metadata via PinterestService.

    Pinterest is primarily an image platform, so there is no transcript.
    The pipeline here is:
      URL -> resolve short URL -> fetch pin metadata (title + description)

    Vision AI / OCR extraction happens downstream in the ingestion pipeline;
    the adapter's job is to surface the textual metadata attached to the pin
    so the unified ingest layer has something to index.
    """

    @staticmethod
    def platform_name() -> str:
        return "pinterest"

    def fetch(self, url: str, source_id: str) -> MediaContent:
        try:
            service = PinterestService()
            pin = asyncio.run(self._fetch_pin(service, url))
        except PlatformFetchError:
            raise
        except Exception as e:
            raise PlatformFetchError(
                f"Pinterest fetch failed for {source_id}: {e}"
            ) from e

        # Pinterest is image-based — description is the only text on the pin.
        description: str = (pin.description or "").strip()
        title: str = (pin.title or "").strip()

        # Build secondary_texts from any auxiliary textual fields.
        secondary_texts: list[str] = []
        if title and description:
            # title goes in secondary when description is primary
            secondary_texts.append(title)

        # primary_text: prefer description; fall back to title
        primary_text = description if description else title
        if not primary_text:
            raise PlatformFetchError(
                f"Pinterest pin {source_id} has no text (no description or title found)."
            )

        # Compose the MediaContent title — truncate to 80 chars for consistency
        media_title = title if title else f"Pinterest pin {source_id}"
        media_title = media_title[:80]

        return MediaContent(
            primary_text=primary_text,
            secondary_texts=secondary_texts,
            title=media_title,
            media_metadata={
                "pin_id": pin.pin_id,
                "image_url": pin.image_url,
                "is_carousel": pin.is_carousel,
                "carousel_image_count": len(pin.image_urls) if pin.is_carousel else 1,
                "original_url": pin.original_url or url,
            },
        )

    # ------------------------------------------------------------------
    # Internal async helper
    # ------------------------------------------------------------------

    @staticmethod
    async def _fetch_pin(service: PinterestService, url: str):
        """Resolve URL and fetch pin metadata via PinterestService helpers."""
        resolved_url = await service._resolve_short_url(url)
        pin = await service._get_pin_metadata(resolved_url)
        if pin is None:
            raise PlatformFetchError(
                f"PinterestService could not retrieve metadata for URL: {url}"
            )
        return pin


register_adapter(PinterestAdapter)
