"""Pinterest platform adapter."""
from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from concurrent.futures import ThreadPoolExecutor

from workout_ingestor_api.services.pinterest_service import PinterestService
from workout_ingestor_api.services.vision_service import VisionService
from .base import MediaContent, PlatformAdapter, PlatformFetchError
from . import register_adapter

logger = logging.getLogger(__name__)

# Single reusable thread pool for bridging async→sync across all adapter calls.
_THREAD_POOL = ThreadPoolExecutor(max_workers=4, thread_name_prefix="pinterest_adapter")


def _run_async(coro):
    """
    Run an async coroutine from a synchronous context — safe whether or not
    there is already a running event loop (e.g. inside a FastAPI handler).

    Strategy: always execute in a brand-new event loop on a worker thread so we
    never try to nest loops, which would raise:
        RuntimeError: This event loop is already running
    """
    def _run_in_thread():
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()

    future = _THREAD_POOL.submit(_run_in_thread)
    return future.result()


class PinterestAdapter(PlatformAdapter):
    """Fetches Pinterest pin metadata and extracts workout content via Vision AI.

    Pipeline:
      URL -> resolve short URL -> fetch pin metadata (title + description + image_url)
          -> download pin image -> Vision AI (OCR + extraction) -> primary_text

    If Vision AI fails or returns no text, the adapter falls back to the pin's
    description/title as primary_text so the unified ingest layer always has
    something to index.
    """

    @staticmethod
    def platform_name() -> str:
        return "pinterest"

    def fetch(self, url: str, source_id: str) -> MediaContent:
        # ------------------------------------------------------------------
        # 1. Fetch pin metadata (async → sync bridge via thread executor)
        # ------------------------------------------------------------------
        try:
            service = PinterestService()
            pin = _run_async(self._fetch_pin(service, url))
        except PlatformFetchError:
            raise
        except Exception as e:
            raise PlatformFetchError(
                f"Pinterest fetch failed for {source_id}: {e}"
            ) from e

        description: str = (pin.description or "").strip()
        title: str = (pin.title or "").strip()

        # ------------------------------------------------------------------
        # 2. Download image and run Vision AI extraction (if image_url exists)
        # ------------------------------------------------------------------
        vision_text: str | None = None
        if pin.image_url:
            vision_text = self._extract_vision_text(service, pin.image_url, source_id)

        # ------------------------------------------------------------------
        # 3. Compose primary_text and secondary_texts
        #
        #    Vision success:  primary_text = vision output
        #                     secondary_texts = [description, title] (non-empty)
        #    Vision fallback: primary_text = description (or title)
        #                     secondary_texts = [title] (when both exist)
        # ------------------------------------------------------------------
        if vision_text:
            primary_text = vision_text
            # Preserve original metadata as secondary context
            secondary_texts: list[str] = [
                t for t in (description, title) if t
            ]
        else:
            # Fall back to text metadata
            secondary_texts = []
            if title and description:
                secondary_texts.append(title)
            primary_text = description if description else title
            if not primary_text:
                raise PlatformFetchError(
                    f"Pinterest pin {source_id} has no text (no description or title found)."
                )

        # ------------------------------------------------------------------
        # 4. Build MediaContent
        # ------------------------------------------------------------------
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
                "had_vision": bool(vision_text),
            },
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    async def _fetch_pin(service: PinterestService, url: str):
        """Resolve URL and fetch pin metadata via PinterestService helpers."""
        resolved_url = await service.resolve_short_url(url)
        pin = await service.get_pin_metadata(resolved_url)
        if pin is None:
            raise PlatformFetchError(
                f"PinterestService could not retrieve metadata for URL: {url}"
            )
        return pin

    @staticmethod
    def _extract_vision_text(
        service: PinterestService,
        image_url: str,
        source_id: str,
    ) -> str | None:
        """
        Download the pin image and run VisionService text extraction.

        Returns the stripped extracted text, or None if extraction fails or
        produces no usable text.
        """
        try:
            image_data: bytes | None = _run_async(service.download_image(image_url))
            if not image_data:
                logger.warning(
                    "Pinterest pin %s: image download returned no data from %s",
                    source_id, image_url,
                )
                return None

            # Write image bytes to a temp file — VisionService accepts file paths
            with tempfile.NamedTemporaryFile(
                suffix=".jpg", prefix=f"pin_{source_id}_", delete=False
            ) as tmp:
                tmp.write(image_data)
                tmp_path = tmp.name

            try:
                text = VisionService.extract_text_from_images(
                    [tmp_path],
                    provider="openai",
                    model="gpt-4o-mini",
                )
                stripped = (text or "").strip()
                if stripped:
                    logger.info(
                        "Pinterest pin %s: vision extracted %d chars", source_id, len(stripped)
                    )
                    return stripped
                logger.info(
                    "Pinterest pin %s: vision returned empty text — falling back to metadata",
                    source_id,
                )
                return None
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

        except Exception as exc:
            logger.warning(
                "Pinterest pin %s: vision extraction failed (%s) — falling back to metadata",
                source_id, exc,
            )
            return None


register_adapter(PinterestAdapter)
