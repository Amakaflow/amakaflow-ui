"""Unified LLM parser — single prompt for all platforms."""
from __future__ import annotations

import json
import logging
from typing import Any

from workout_ingestor_api.ai import AIClientFactory, AIRequestContext, retry_sync_call
from workout_ingestor_api.config import settings
from workout_ingestor_api.services.adapters.base import MediaContent
from workout_ingestor_api.services.prompts import build_prompt
from workout_ingestor_api.services.workout_sanitizer import sanitize_workout_data
from workout_ingestor_api.services.spacy_corrector import SpacyCorrector

logger = logging.getLogger(__name__)

_corrector = SpacyCorrector()


class UnifiedParserError(RuntimeError):
    """Raised when unified parsing fails."""


class UnifiedParser:
    """Parse any MediaContent into a structured workout dict."""

    def parse(
        self,
        media: MediaContent,
        platform: str,
        user_id: str | None = None,
    ) -> dict[str, Any]:
        """Run the full parse pipeline: LLM → sanitize → SpacyCorrector.

        Args:
            media: Normalised content from a PlatformAdapter.
            platform: Platform name (e.g. "instagram", "youtube").
            user_id: Optional Clerk user ID for Helicone tracking.

        Returns:
            Dict with blocks, title, workout_type, etc.

        Raises:
            UnifiedParserError: If the LLM returns invalid JSON.
        """
        context = AIRequestContext(
            user_id=user_id,
            feature_name=f"{platform}_parse_workout",
            custom_properties={"model": settings.PARSE_MODEL},
        )
        client = AIClientFactory.create_openai_client(context=context)

        logger.info(f"[unified_parser] primary_text ({len(media.primary_text)} chars): {media.primary_text[:500]!r}")
        logger.info(f"[unified_parser] title: {media.title!r}")

        video_duration_sec = media.media_metadata.get("video_duration_sec")

        prompt = build_prompt(
            platform=platform,
            video_duration_sec=video_duration_sec,
            raw_text=media.primary_text,
            secondary_texts=media.secondary_texts or None,
            title=media.title,
        )

        def _call() -> dict:
            response = client.chat.completions.create(
                model=settings.PARSE_MODEL,
                messages=[
                    # Note: "from content" (not "from transcripts") is intentional — this parser
                    # handles multi-platform content including captions, descriptions, and audio transcripts.
                    {"role": "system", "content": "You are a fitness expert that extracts workout data from content. Return only valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                response_format={"type": "json_object"},
                timeout=60.0,
            )
            raw = response.choices[0].message.content
            try:
                return json.loads(raw)
            except json.JSONDecodeError as exc:
                raise UnifiedParserError(f"LLM returned invalid JSON: {exc}") from exc

        # wrap in try/except to honour the public exception contract
        try:
            workout_data = retry_sync_call(_call)
        except UnifiedParserError:
            raise  # Already the right type — re-raise without wrapping
        except Exception as exc:
            raise UnifiedParserError(f"LLM call failed: {exc}") from exc
        workout_data = sanitize_workout_data(workout_data)
        workout_data = _corrector.correct(workout_data, raw_text=media.primary_text)
        return workout_data
