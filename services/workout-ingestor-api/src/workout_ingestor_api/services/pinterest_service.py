"""
Pinterest Service

Service for ingesting workouts from Pinterest URLs.
Pinterest workout content is primarily images with text overlays (infographics),
so the pipeline is: Pinterest URL -> Download Image -> OCR + LLM -> Parsed Workout

This leverages the existing image_parser.py for extraction, adding a Pinterest-specific
download layer using web scraping (no external library required).
"""

from __future__ import annotations

import json
import logging
import os
import re
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs, quote

import httpx

from ..parsers.image_parser import ImageParser, ImageParseResult

logger = logging.getLogger(__name__)


# Pinterest URL patterns
PIN_SHORT_URL_RE = re.compile(r"pin\.it/([A-Za-z0-9]+)")
# Match pinterest.com/pin/123456 or pinterest.com/pin/123456--title-slug/
PIN_FULL_URL_RE = re.compile(r"pinterest\.[a-z.]+/pin/([0-9]+)")
# Also match alphanumeric pin IDs (some pins have these)
PIN_FULL_URL_ALPHA_RE = re.compile(r"pinterest\.[a-z.]+/pin/([A-Za-z0-9_-]+)")
BOARD_URL_RE = re.compile(r"pinterest\.[a-z.]+/([^/]+)/([^/?]+)")


class PinterestServiceError(RuntimeError):
    """Raised when Pinterest ingestion fails."""


@dataclass
class PinterestPin:
    """Metadata about a Pinterest pin."""
    pin_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    original_url: str = ""
    # For carousel pins with multiple images
    image_urls: List[str] = field(default_factory=list)
    is_carousel: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "pin_id": self.pin_id,
            "title": self.title,
            "description": self.description,
            "image_url": self.image_url,
            "image_urls": self.image_urls,
            "is_carousel": self.is_carousel,
            "original_url": self.original_url,
        }


@dataclass
class PinterestIngestResult:
    """Result of ingesting a Pinterest pin or board."""
    success: bool
    pins_processed: int = 0
    workouts: List[Dict[str, Any]] = field(default_factory=list)
    parse_results: List[ImageParseResult] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    source_url: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": self.success,
            "pins_processed": self.pins_processed,
            "workouts": self.workouts,
            "parse_results": [r.to_dict() for r in self.parse_results],
            "errors": self.errors,
            "source_url": self.source_url,
        }


class PinterestService:
    """Service for ingesting workouts from Pinterest URLs."""

    def __init__(self, timeout: float = 30.0):
        """
        Initialize Pinterest service.

        Args:
            timeout: HTTP request timeout in seconds
        """
        self.timeout = timeout
        self.image_parser = ImageParser()

        # Common headers for Pinterest requests
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
        }

    # =========================================================================
    # URL Parsing
    # =========================================================================

    @classmethod
    def is_pinterest_url(cls, url: str) -> bool:
        """Check if URL is a Pinterest URL."""
        if not url:
            return False
        url_lower = url.lower()
        return "pinterest.com" in url_lower or "pin.it" in url_lower

    @classmethod
    def extract_pin_id(cls, url: str) -> Optional[str]:
        """
        Extract Pinterest pin ID from URL.

        Supports:
        - Short URLs: https://pin.it/2MgsyKLTB
        - Full URLs: https://pinterest.com/pin/123456789
        - URLs with slug: https://pinterest.com/pin/123456789--title-here/
        """
        if not url:
            return None

        # Try short URL format (pin.it/xxx)
        match = PIN_SHORT_URL_RE.search(url)
        if match:
            logger.debug(f"Extracted pin ID from short URL: {match.group(1)}")
            return match.group(1)

        # Try full URL format with numeric ID (pinterest.com/pin/xxx)
        match = PIN_FULL_URL_RE.search(url)
        if match:
            logger.debug(f"Extracted pin ID from full URL: {match.group(1)}")
            return match.group(1)

        # Try alphanumeric ID format
        match = PIN_FULL_URL_ALPHA_RE.search(url)
        if match:
            # Extract just the ID part (before any -- slug)
            pin_id = match.group(1).split('--')[0]
            logger.debug(f"Extracted pin ID from alpha URL: {pin_id}")
            return pin_id

        logger.warning(f"Could not extract pin ID from URL: {url}")
        return None

    @classmethod
    def is_board_url(cls, url: str) -> bool:
        """Check if URL is a Pinterest board URL."""
        if not url or not cls.is_pinterest_url(url):
            return False

        # Board URLs don't have /pin/ in the path
        if "/pin/" in url:
            return False

        # Board URLs have format: pinterest.com/username/board-name
        match = BOARD_URL_RE.search(url)
        return bool(match)

    @classmethod
    def get_url_type(cls, url: str) -> str:
        """
        Determine the type of Pinterest URL.

        Returns:
            "pin" | "board" | "search" | "unknown"
        """
        if not cls.is_pinterest_url(url):
            return "unknown"

        if "/pin/" in url or "pin.it" in url:
            return "pin"
        elif "/search/" in url:
            return "search"
        elif cls.is_board_url(url):
            return "board"
        else:
            return "unknown"

    # =========================================================================
    # Single Pin Ingestion
    # =========================================================================

    async def ingest_pin(
        self,
        url: str,
        vision_model: str = "gpt-4o-mini",
    ) -> PinterestIngestResult:
        """
        Ingest a workout from a Pinterest pin URL.

        Handles both single-image pins and carousel pins with multiple images.
        Each image in a carousel is processed separately and may yield multiple workouts.

        Args:
            url: Pinterest URL (pin.it/xxx or pinterest.com/pin/xxx)
            vision_model: Vision model for OCR/extraction

        Returns:
            PinterestIngestResult with extracted workout data
        """
        result = PinterestIngestResult(
            success=False,
            source_url=url,
        )

        try:
            # 1. Resolve short URL if needed
            resolved_url = await self._resolve_short_url(url)
            logger.info(f"Pinterest: Resolved URL: {resolved_url}")

            # 2. Get pin metadata and image URL(s)
            pin = await self._get_pin_metadata(resolved_url)
            if not pin or not pin.image_url:
                logger.warning(f"Pinterest: Failed to get pin metadata or image URL")
                result.errors.append("Could not extract image URL from Pinterest pin")
                return result
            logger.info(f"Pinterest: Got pin - id={pin.pin_id}, image={pin.image_url}, is_carousel={pin.is_carousel}")

            # Determine which images to process
            if pin.is_carousel and pin.image_urls:
                images_to_process = pin.image_urls
                logger.info(f"Pinterest: Carousel pin with {len(images_to_process)} images")
            else:
                images_to_process = [pin.image_url]
                logger.info(f"Pinterest: Single image pin: {pin.image_url}")

            # 3. Process each image
            for idx, image_url in enumerate(images_to_process):
                try:
                    # Download the image
                    image_data = await self._download_image(image_url)
                    if not image_data:
                        result.errors.append(f"Failed to download image {idx + 1}")
                        continue

                    logger.info(f"Pinterest: Downloaded image {idx + 1}/{len(images_to_process)} ({len(image_data)} bytes)")

                    # Parse the image using Vision AI
                    parse_result = await ImageParser.parse_image(
                        image_data=image_data,
                        filename=f"pinterest_{pin.pin_id}_{idx}.jpg",
                        mode="vision",
                        vision_model=vision_model,
                    )

                    # If no exercises found with gpt-4o-mini, try with gpt-4o as fallback
                    # Pinterest infographics often need the stronger model
                    if (parse_result.success and len(parse_result.exercises or []) == 0
                        and vision_model in (None, "gpt-4o-mini")):
                        logger.info(f"Pinterest: No exercises found with {vision_model or 'gpt-4o-mini'}, retrying with gpt-4o")
                        parse_result = await ImageParser.parse_image(
                            image_data=image_data,
                            filename=f"pinterest_{pin.pin_id}_{idx}.jpg",
                            mode="vision",
                            vision_model="gpt-4o",
                        )

                    result.parse_results.append(parse_result)
                    result.pins_processed += 1

                    logger.info(f"Pinterest: Vision result - success={parse_result.success}, confidence={parse_result.confidence}%, title={parse_result.title}, exercises={len(parse_result.exercises or [])}, blocks={len(parse_result.blocks or [])}")

                    if parse_result.success and parse_result.confidence >= 30:
                        # Build workout data
                        workout_title = parse_result.title or pin.title or "Pinterest Workout"
                        if len(images_to_process) > 1:
                            workout_title = f"{workout_title} (Image {idx + 1})"

                        workout_data = {
                            "title": workout_title,
                            "source": "pinterest",
                            "source_url": url,
                            "pin_id": pin.pin_id,
                            "blocks": parse_result.blocks or [],
                            "exercises": parse_result.exercises or [],
                            "confidence": parse_result.confidence,
                            "metadata": {
                                "pin_description": pin.description,
                                "extraction_method": parse_result.extraction_method,
                                "model_used": parse_result.model_used,
                                "flagged_items": parse_result.flagged_items,
                                "is_carousel": pin.is_carousel,
                                "carousel_index": idx if pin.is_carousel else None,
                                "carousel_total": len(images_to_process) if pin.is_carousel else None,
                            }
                        }
                        result.workouts.append(workout_data)
                    elif parse_result.confidence < 30:
                        logger.info(f"Pinterest: Skipping image {idx + 1} - low confidence ({parse_result.confidence}%)")

                except Exception as e:
                    logger.warning(f"Error processing image {idx + 1}: {e}")
                    result.errors.append(f"Image {idx + 1}: {str(e)}")
                    continue

            result.success = len(result.workouts) > 0

            if not result.success and not result.errors:
                result.errors.append("No workout content could be extracted from the image(s)")

            return result

        except PinterestServiceError as e:
            result.errors.append(str(e))
            return result
        except Exception as e:
            logger.exception(f"Error ingesting Pinterest pin: {e}")
            result.errors.append(f"Unexpected error: {str(e)}")
            return result

    # =========================================================================
    # Board Ingestion
    # =========================================================================

    async def ingest_board(
        self,
        url: str,
        limit: int = 20,
        vision_model: str = "gpt-4o-mini",
    ) -> PinterestIngestResult:
        """
        Ingest multiple workouts from a Pinterest board.

        Args:
            url: Pinterest board URL
            limit: Maximum number of pins to process
            vision_model: Vision model for OCR/extraction

        Returns:
            PinterestIngestResult with extracted workouts
        """
        result = PinterestIngestResult(
            success=False,
            source_url=url,
        )

        try:
            # Get pins from board
            pins = await self._get_board_pins(url, limit=limit)
            if not pins:
                result.errors.append("Could not extract pins from Pinterest board")
                return result

            logger.info(f"Pinterest: Found {len(pins)} pins in board")

            # Process each pin
            for pin in pins:
                try:
                    if not pin.image_url:
                        continue

                    # Download image
                    image_data = await self._download_image(pin.image_url)
                    if not image_data:
                        result.errors.append(f"Failed to download pin {pin.pin_id}")
                        continue

                    # Parse image
                    parse_result = await ImageParser.parse_image(
                        image_data=image_data,
                        filename=f"pinterest_{pin.pin_id}.jpg",
                        mode="vision",
                        vision_model=vision_model,
                    )

                    # If no exercises found with gpt-4o-mini, try with gpt-4o as fallback
                    if (parse_result.success and len(parse_result.exercises or []) == 0
                        and vision_model in (None, "gpt-4o-mini")):
                        logger.info(f"Pinterest: No exercises found with {vision_model or 'gpt-4o-mini'}, retrying with gpt-4o for pin {pin.pin_id}")
                        parse_result = await ImageParser.parse_image(
                            image_data=image_data,
                            filename=f"pinterest_{pin.pin_id}.jpg",
                            mode="vision",
                            vision_model="gpt-4o",
                        )

                    result.parse_results.append(parse_result)
                    result.pins_processed += 1

                    if parse_result.success and parse_result.confidence >= 30:
                        workout_data = {
                            "title": parse_result.title or pin.title or f"Pinterest Workout {result.pins_processed}",
                            "source": "pinterest",
                            "source_url": pin.original_url or url,
                            "pin_id": pin.pin_id,
                            "blocks": parse_result.blocks or [],
                            "exercises": parse_result.exercises or [],
                            "confidence": parse_result.confidence,
                            "metadata": {
                                "pin_description": pin.description,
                                "extraction_method": parse_result.extraction_method,
                            }
                        }
                        result.workouts.append(workout_data)
                    elif parse_result.confidence < 30:
                        logger.info(f"Pinterest: Skipping pin {pin.pin_id} - low confidence ({parse_result.confidence}%)")

                except Exception as e:
                    logger.warning(f"Error processing pin {pin.pin_id}: {e}")
                    result.errors.append(f"Pin {pin.pin_id}: {str(e)}")
                    continue

            result.success = len(result.workouts) > 0
            return result

        except Exception as e:
            logger.exception(f"Error ingesting Pinterest board: {e}")
            result.errors.append(f"Unexpected error: {str(e)}")
            return result

    # =========================================================================
    # HTTP Helpers
    # =========================================================================

    async def _resolve_short_url(self, url: str) -> str:
        """Resolve pin.it short URLs to full Pinterest URLs."""
        if "pin.it" not in url:
            return url

        try:
            async with httpx.AsyncClient(
                timeout=self.timeout,
                follow_redirects=True,
                headers=self.headers,
            ) as client:
                response = await client.get(url)
                # The final URL after redirects
                resolved = str(response.url)
                logger.info(f"Pinterest: Short URL resolved to: {resolved}")

                # Clean up the URL - remove /sent/ path and invite parameters
                # e.g. /pin/123456/sent/?invite_code=... -> /pin/123456/
                resolved = self._clean_pinterest_url(resolved)

                return resolved
        except Exception as e:
            logger.warning(f"Failed to resolve short URL: {e}")
            return url

    def _clean_pinterest_url(self, url: str) -> str:
        """
        Clean Pinterest URL to a canonical format for API calls.

        Handles special URL formats like:
        - /pin/123456/sent/?invite_code=... -> /pin/123456/
        - /pin/123456--title-slug/ -> /pin/123456/
        """
        # Extract pin ID from the URL
        match = PIN_FULL_URL_RE.search(url) or PIN_FULL_URL_ALPHA_RE.search(url)
        if match:
            pin_id = match.group(1).split('--')[0]  # Remove title slug if present
            clean_url = f"https://www.pinterest.com/pin/{pin_id}/"
            if clean_url != url:
                logger.info(f"Pinterest: Cleaned URL: {url} -> {clean_url}")
            return clean_url

        return url

    async def _get_pin_metadata(self, url: str) -> Optional[PinterestPin]:
        """
        Get pin metadata from Pinterest page.

        Uses oEmbed API first, then falls back to HTML scraping.
        """
        pin_id = self.extract_pin_id(url)
        logger.info(f"Pinterest: Extracted pin_id={pin_id} from URL: {url}")

        # Even without a pin_id, we can still try to scrape
        if not pin_id:
            pin_id = "unknown"

        pin = PinterestPin(pin_id=pin_id, original_url=url)

        # Try oEmbed API first (simpler, more reliable)
        try:
            # URL-encode the Pinterest URL for oEmbed parameter
            encoded_url = quote(url, safe='')
            oembed_url = f"https://www.pinterest.com/oembed.json?url={encoded_url}"
            logger.info(f"Pinterest oEmbed URL: {oembed_url}")

            async with httpx.AsyncClient(timeout=self.timeout, headers=self.headers) as client:
                response = await client.get(oembed_url)
                logger.info(f"Pinterest oEmbed response: status={response.status_code}")
                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"Pinterest oEmbed data keys: {list(data.keys())}")
                    logger.debug(f"Pinterest oEmbed full data: {data}")
                    pin.title = data.get("title")
                    pin.description = data.get("description")

                    # oEmbed may return thumbnail_url or url for the image
                    thumbnail = data.get("thumbnail_url") or data.get("url")
                    if thumbnail:
                        pin.image_url = self._upgrade_image_url(thumbnail)
                        logger.info(f"Pinterest oEmbed: Got thumbnail, upgraded to: {pin.image_url}")

                    # Also check if there's an HTML embed that contains the image
                    html_embed = data.get("html", "")
                    if html_embed and not pin.image_url:
                        img_match = re.search(r'src="(https://[^"]+pinimg\.com[^"]+)"', html_embed)
                        if img_match:
                            pin.image_url = self._upgrade_image_url(img_match.group(1))
                            logger.info(f"Pinterest oEmbed: Found image in HTML embed: {pin.image_url}")
                else:
                    logger.warning(f"Pinterest oEmbed failed with status {response.status_code}: {response.text[:500]}")
        except Exception as e:
            logger.warning(f"oEmbed failed: {e}", exc_info=True)

        # If we don't have image URL yet, scrape the page
        if not pin.image_url:
            logger.info("Pinterest: oEmbed didn't provide image, falling back to scraping")
            pin = await self._scrape_pin_page(url, pin)

        return pin if pin.image_url else None

    async def _scrape_pin_page(self, url: str, pin: PinterestPin) -> PinterestPin:
        """Scrape Pinterest pin page for image URL(s). Handles carousel pins."""
        logger.info(f"Pinterest: Scraping page: {url}")
        try:
            async with httpx.AsyncClient(
                timeout=self.timeout,
                headers=self.headers,
                follow_redirects=True,
            ) as client:
                response = await client.get(url)
                html = response.text
                logger.info(f"Pinterest: Got page response, length={len(html)}, status={response.status_code}")

                # Log first 2000 chars to help debug
                logger.debug(f"Pinterest HTML preview: {html[:2000]}")

                # First, try to detect carousel pins by looking for multiple images
                # Pinterest carousel pins often have multiple high-res images in the page
                all_originals = re.findall(
                    r'(https://i\.pinimg\.com/originals/[^"\'\\s]+\.(?:jpg|jpeg|png|webp))',
                    html
                )
                # Deduplicate while preserving order
                unique_originals = list(dict.fromkeys(all_originals))
                logger.debug(f"Pinterest: Found {len(unique_originals)} original images")

                # Also look for 736x images
                all_736x = re.findall(
                    r'(https://i\.pinimg\.com/736x/[^"\'\\s]+\.(?:jpg|jpeg|png|webp))',
                    html
                )
                unique_736x = list(dict.fromkeys(all_736x))
                logger.debug(f"Pinterest: Found {len(unique_736x)} 736x images")

                # Check if this looks like a carousel (multiple unique images)
                if len(unique_originals) > 1:
                    pin.is_carousel = True
                    pin.image_urls = [self._upgrade_image_url(u) for u in unique_originals]
                    pin.image_url = pin.image_urls[0]  # Primary image
                    logger.info(f"Pinterest: Detected carousel pin with {len(pin.image_urls)} images")
                elif len(unique_736x) > 1:
                    pin.is_carousel = True
                    pin.image_urls = [self._upgrade_image_url(u) for u in unique_736x]
                    pin.image_url = pin.image_urls[0]
                    logger.info(f"Pinterest: Detected carousel pin with {len(pin.image_urls)} images (736x)")
                else:
                    # Single image pin - use existing logic
                    logger.debug(f"Pinterest: Processing as single image pin")

                    # Method 1: Look for og:image meta tag (usually high quality)
                    # Try multiple patterns as Pinterest format varies
                    og_patterns = [
                        r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"',
                        r'<meta[^>]+content="([^"]+)"[^>]+property="og:image"',
                        r'"og:image"[^>]+content="(https://[^"]+)"',
                    ]
                    for pattern in og_patterns:
                        og_image = re.search(pattern, html)
                        if og_image:
                            pin.image_url = self._upgrade_image_url(og_image.group(1))
                            logger.info(f"Pinterest: Found og:image: {pin.image_url}")
                            break

                    # Method 2: Look for image in JSON-LD
                    if not pin.image_url:
                        json_ld = re.search(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL)
                        if json_ld:
                            try:
                                data = json.loads(json_ld.group(1))
                                logger.debug(f"Pinterest: Found JSON-LD data")
                                if isinstance(data, dict) and "image" in data:
                                    img = data["image"]
                                    if isinstance(img, str):
                                        pin.image_url = self._upgrade_image_url(img)
                                        logger.info(f"Pinterest: Found image in JSON-LD: {pin.image_url}")
                                    elif isinstance(img, list) and img:
                                        # Multiple images in JSON-LD - carousel!
                                        if len(img) > 1:
                                            pin.is_carousel = True
                                            pin.image_urls = [self._upgrade_image_url(u) for u in img]
                                        pin.image_url = self._upgrade_image_url(img[0])
                                        logger.info(f"Pinterest: Found image in JSON-LD (list): {pin.image_url}")
                            except json.JSONDecodeError as e:
                                logger.debug(f"Pinterest: JSON-LD parse failed: {e}")

                    # Method 3: Look for high-res image patterns in HTML/JS
                    if not pin.image_url and unique_originals:
                        pin.image_url = unique_originals[0]
                        logger.info(f"Pinterest: Found originals image: {pin.image_url}")

                    # Method 4: Look for 736x or larger images
                    if not pin.image_url and unique_736x:
                        pin.image_url = unique_736x[0]
                        logger.info(f"Pinterest: Found 736x image: {pin.image_url}")

                    # Method 5: Look for any pinimg.com image
                    if not pin.image_url:
                        any_pinimg = re.findall(r'(https://i\.pinimg\.com/[^"\'\\s]+\.(?:jpg|jpeg|png|webp))', html)
                        if any_pinimg:
                            pin.image_url = self._upgrade_image_url(any_pinimg[0])
                            logger.info(f"Pinterest: Found pinimg image (fallback): {pin.image_url}")

                    # Method 6: Look in Pinterest's embedded Redux state or PWS data
                    if not pin.image_url:
                        # Pinterest often embeds image URLs in script tags
                        redux_match = re.search(r'window\.__PRELOADED_STATE__\s*=\s*({.*?});', html, re.DOTALL)
                        if redux_match:
                            try:
                                # Extract just the images part - full JSON is too large
                                redux_text = redux_match.group(1)
                                img_urls = re.findall(r'"url":\s*"(https://i\.pinimg\.com/[^"]+)"', redux_text)
                                if img_urls:
                                    pin.image_url = self._upgrade_image_url(img_urls[0])
                                    logger.info(f"Pinterest: Found image in Redux state: {pin.image_url}")
                            except Exception as e:
                                logger.debug(f"Pinterest: Redux parse failed: {e}")

                    # Method 7: Look in the data-pin-* attributes
                    if not pin.image_url:
                        data_pin_match = re.search(r'data-pin-media="([^"]+)"', html)
                        if data_pin_match:
                            pin.image_url = self._upgrade_image_url(data_pin_match.group(1))
                            logger.info(f"Pinterest: Found image in data-pin-media: {pin.image_url}")

                # Get title if not already set
                if not pin.title:
                    title_match = re.search(r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"', html)
                    if title_match:
                        pin.title = title_match.group(1)

                # Get description if not already set
                if not pin.description:
                    desc_match = re.search(r'<meta[^>]+property="og:description"[^>]+content="([^"]+)"', html)
                    if desc_match:
                        pin.description = desc_match.group(1)

        except Exception as e:
            logger.warning(f"Failed to scrape Pinterest page: {e}", exc_info=True)

        # If still no image, try the widgets endpoint as last resort
        if not pin.image_url and pin.pin_id and pin.pin_id != "unknown":
            pin = await self._try_widgets_endpoint(pin)

        logger.info(f"Pinterest scrape result: image_url={pin.image_url}, is_carousel={pin.is_carousel}, images={len(pin.image_urls)}")
        return pin

    async def _try_widgets_endpoint(self, pin: PinterestPin) -> PinterestPin:
        """Try Pinterest's widgets endpoint as a fallback for getting pin images."""
        try:
            # Pinterest widgets endpoint provides embedded content
            widgets_url = f"https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids={pin.pin_id}"
            logger.info(f"Pinterest: Trying widgets endpoint: {widgets_url}")

            async with httpx.AsyncClient(timeout=self.timeout, headers=self.headers) as client:
                response = await client.get(widgets_url)
                if response.status_code == 200:
                    data = response.json()
                    logger.info(f"Pinterest widgets response: {list(data.keys()) if isinstance(data, dict) else 'not dict'}")

                    # Extract pin data from response
                    pins_data = data.get("data", [])
                    if pins_data and len(pins_data) > 0:
                        pin_data = pins_data[0]
                        # Get images dict
                        images = pin_data.get("images", {})
                        # Look for the highest resolution image available
                        for size_key in ["orig", "736x", "564x", "474x", "236x"]:
                            if size_key in images:
                                img_url = images[size_key].get("url")
                                if img_url:
                                    pin.image_url = img_url
                                    logger.info(f"Pinterest: Found image from widgets ({size_key}): {pin.image_url}")
                                    break

                        # Get title/description if not set
                        if not pin.title:
                            pin.title = pin_data.get("description", "")[:100]
                        if not pin.description:
                            pin.description = pin_data.get("description")
                else:
                    logger.warning(f"Pinterest widgets failed: {response.status_code}")

        except Exception as e:
            logger.warning(f"Pinterest widgets endpoint failed: {e}")

        return pin

    async def _get_board_pins(self, url: str, limit: int = 20) -> List[PinterestPin]:
        """
        Get pins from a Pinterest board.

        Note: This is a simplified implementation that scrapes the board page.
        For production use, consider using Pinterest API with OAuth.
        """
        pins = []

        try:
            async with httpx.AsyncClient(
                timeout=self.timeout,
                headers=self.headers,
                follow_redirects=True,
            ) as client:
                response = await client.get(url)
                html = response.text

                # Look for pin IDs in the page
                # Pinterest pages often have data in JSON format
                pin_ids = set()

                # Find pin URLs/IDs in the HTML
                pin_patterns = [
                    r'/pin/(\d+)',  # Standard pin URL format
                    r'"id":"(\d+)"',  # JSON format
                ]

                for pattern in pin_patterns:
                    matches = re.findall(pattern, html)
                    for match in matches:
                        if len(match) > 5:  # Valid pin IDs are longer
                            pin_ids.add(match)

                # Also look for image URLs with pin references
                image_urls = re.findall(r'(https://i\.pinimg\.com/(?:originals|736x)/[^"\'\\s]+\.(?:jpg|jpeg|png|webp))', html)

                # Create pins from found data
                for idx, pin_id in enumerate(list(pin_ids)[:limit]):
                    pin = PinterestPin(
                        pin_id=pin_id,
                        original_url=f"https://www.pinterest.com/pin/{pin_id}/",
                    )

                    # Try to match with an image URL
                    if idx < len(image_urls):
                        pin.image_url = image_urls[idx]

                    pins.append(pin)

                # If we have more image URLs than pin IDs, create pins for them
                if len(image_urls) > len(pins) and len(pins) < limit:
                    for idx, img_url in enumerate(image_urls[len(pins):limit-len(pins)]):
                        pin = PinterestPin(
                            pin_id=f"img_{idx}",
                            image_url=img_url,
                            original_url=url,
                        )
                        pins.append(pin)

        except Exception as e:
            logger.warning(f"Failed to get board pins: {e}")

        return pins[:limit]

    async def _download_image(self, url: str) -> Optional[bytes]:
        """Download image from URL."""
        try:
            headers = {
                **self.headers,
                "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
                "Referer": "https://www.pinterest.com/",
            }

            async with httpx.AsyncClient(
                timeout=self.timeout,
                headers=headers,
                follow_redirects=True,
            ) as client:
                response = await client.get(url)

                if response.status_code == 200:
                    content_type = response.headers.get("content-type", "")
                    if "image" in content_type or len(response.content) > 1000:
                        return response.content

                logger.warning(f"Failed to download image: HTTP {response.status_code}")
                return None

        except Exception as e:
            logger.warning(f"Failed to download image from {url}: {e}")
            return None

    def _upgrade_image_url(self, url: str) -> str:
        """
        Try to get higher resolution version of Pinterest image.

        Pinterest image URLs follow patterns like:
        - https://i.pinimg.com/236x/...  (small)
        - https://i.pinimg.com/474x/...  (medium)
        - https://i.pinimg.com/564x/...  (large)
        - https://i.pinimg.com/736x/...  (larger)
        - https://i.pinimg.com/originals/... (original, highest quality)
        """
        if "pinimg.com" not in url:
            return url

        # Try to upgrade to originals (highest quality)
        # Pattern: /236x/, /474x/, /564x/, /736x/ -> /originals/
        upgraded = re.sub(r'/\d+x/', '/originals/', url)

        # If the URL changed, we upgraded it
        if upgraded != url:
            logger.debug(f"Pinterest: Upgraded image URL: {url} -> {upgraded}")
            return upgraded

        return url


# Convenience functions
async def ingest_pinterest_url(
    url: str,
    limit: int = 1,
    vision_model: str = "gpt-4o-mini",
) -> PinterestIngestResult:
    """
    Ingest workout(s) from a Pinterest URL.

    Automatically detects if URL is a single pin or board.

    Args:
        url: Pinterest URL (pin or board)
        limit: Max pins to process (for boards)
        vision_model: Vision model for extraction

    Returns:
        PinterestIngestResult with extracted workouts
    """
    service = PinterestService()

    url_type = service.get_url_type(url)

    if url_type == "board":
        return await service.ingest_board(url, limit=limit, vision_model=vision_model)
    elif url_type == "pin":
        return await service.ingest_pin(url, vision_model=vision_model)
    else:
        return PinterestIngestResult(
            success=False,
            source_url=url,
            errors=[f"Unsupported Pinterest URL type: {url_type}. Please provide a pin or board URL."],
        )


def is_pinterest_url(url: str) -> bool:
    """Check if URL is a Pinterest URL."""
    return PinterestService.is_pinterest_url(url)
