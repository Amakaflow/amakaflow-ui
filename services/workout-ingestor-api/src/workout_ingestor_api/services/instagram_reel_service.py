"""Instagram Reel ingestion service using Apify for transcript extraction."""

import logging
import re
from typing import Any, Dict, Optional

from workout_ingestor_api.ai import AIClientFactory, AIRequestContext, retry_sync_call
from workout_ingestor_api.config import settings
from workout_ingestor_api.services.apify_service import ApifyService
from workout_ingestor_api.services.instagram_reel_cache_service import InstagramApifyRawCacheService
from workout_ingestor_api.services.prompts import build_prompt
from workout_ingestor_api.services.workout_sanitizer import sanitize_workout_data

logger = logging.getLogger(__name__)

SHORTCODE_RE = re.compile(r"instagram\.com/(?:p|reel|tv)/([A-Za-z0-9_-]+)")


class InstagramReelServiceError(RuntimeError):
    """Raised when Instagram Reel ingestion fails."""


class InstagramReelService:
    """Orchestrates Instagram Reel ingestion: Apify fetch -> LLM parse -> structured workout."""

    @staticmethod
    def _extract_shortcode(url: str) -> Optional[str]:
        match = SHORTCODE_RE.search(url)
        return match.group(1) if match else None

    @staticmethod
    def _fetch_reel_data(url: str) -> Dict[str, Any]:
        """Fetch reel metadata and transcript via Apify."""
        return ApifyService.fetch_reel_data(url)

    @staticmethod
    def _parse_transcript(
        transcript: str,
        title: str,
        video_duration_sec: Optional[int] = None,
        user_id: Optional[str] = None,
    ) -> Dict:
        """Parse transcript into structured workout using LLM (same approach as YouTube)."""
        import json

        context = AIRequestContext(
            user_id=user_id,
            feature_name="instagram_reel_parse_transcript",
            custom_properties={"model": settings.PARSE_MODEL},
        )
        client = AIClientFactory.create_openai_client(context=context)

        prompt = build_prompt(
            platform="instagram",
            video_duration_sec=video_duration_sec,
            raw_text=transcript,
            title=title,
        )

        def _make_api_call() -> Dict:
            response = client.chat.completions.create(
                model=settings.PARSE_MODEL,
                messages=[
                    {"role": "system", "content": "You are a fitness expert that extracts workout data from transcripts. Return only valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                response_format={"type": "json_object"},
                timeout=60.0,
            )
            return json.loads(response.choices[0].message.content)

        return retry_sync_call(_make_api_call)

    @staticmethod
    def _sanitize_workout_data(workout_data: Dict) -> Dict:
        """Sanitize LLM output to fix common structural mistakes.

        This is a wrapper that delegates to the shared sanitize_workout_data function
        from workout_sanitizer module.

        Args:
            workout_data: Raw workout dict from LLM parsing

        Returns:
            Sanitized workout dict with fixed structure
        """
        return sanitize_workout_data(workout_data)

    @staticmethod
    def ingest_reel(
        url: str,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Full ingestion pipeline for an Instagram Reel.

        1. Fetch reel metadata + transcript via Apify
        2. Parse transcript (or caption fallback) with LLM
        3. Return structured workout with provenance

        Args:
            url: Instagram Reel URL
            user_id: Optional user ID for tracking

        Returns:
            Workout dict with _provenance metadata
        """
        shortcode = InstagramReelService._extract_shortcode(url) or "unknown"

        # Check Apify raw cache first — avoids paid API call when only the prompt has changed
        reel = InstagramApifyRawCacheService.get_cached_raw(shortcode)
        apify_cache_hit = reel is not None

        if not apify_cache_hit:
            reel = InstagramReelService._fetch_reel_data(url)
            # Persist raw response so future re-extractions skip the Apify call
            InstagramApifyRawCacheService.save_raw(shortcode, url, reel)

        # Log raw Apify response at WARNING level for debugging
        reel_caption = reel.get("caption", "")
        reel_transcript = reel.get("transcript", "")
        reel_duration = reel.get("videoDuration")
        logger.warning(
            f"[apify_raw] shortcode={shortcode} apify_cache={'HIT' if apify_cache_hit else 'MISS'} "
            f"keys={list(reel.keys())} caption={reel_caption!r:.500} "
            f"transcript={reel_transcript!r:.500} videoDuration={reel_duration}"
        )

        caption = reel.get("caption", "") or ""
        transcript = reel.get("transcript", "") or ""
        duration = reel.get("videoDuration")
        creator = reel.get("ownerUsername", "unknown")

        # Use transcript if available, otherwise fall back to caption
        text_to_parse = transcript if transcript.strip() else caption
        if not text_to_parse.strip():
            raise InstagramReelServiceError(
                "Reel has no transcript or caption to extract a workout from."
            )

        # Build title from caption (first line, truncated)
        title_line = caption.split("\n")[0] if caption else f"Instagram Reel by @{creator}"
        title = title_line[:80]

        workout_data = InstagramReelService._parse_transcript(
            transcript=text_to_parse,
            title=title,
            video_duration_sec=duration,
            user_id=user_id,
        )

        workout_data = InstagramReelService._sanitize_workout_data(workout_data)

        # Ensure source is set
        workout_data.setdefault("source", url)

        # Add provenance metadata
        workout_data.setdefault("_provenance", {})
        workout_data["_provenance"].update({
            "mode": "instagram_reel",
            "source_url": url,
            "shortcode": shortcode,
            "creator": creator,
            "video_duration_sec": duration,
            "had_transcript": bool(transcript.strip()),
            "extraction_method": "apify_transcript" if transcript.strip() else "apify_caption",
            "apify_cache_hit": apify_cache_hit,
        })

        return workout_data
