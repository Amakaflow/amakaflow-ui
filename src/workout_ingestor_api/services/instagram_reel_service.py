"""Instagram Reel ingestion service using Apify for transcript extraction."""

import logging
import re
from typing import Any, Dict, Optional

from workout_ingestor_api.ai import AIClientFactory, AIRequestContext, retry_sync_call
from workout_ingestor_api.services.apify_service import ApifyService, ApifyServiceError

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
            custom_properties={"model": "gpt-4o-mini"},
        )
        client = AIClientFactory.create_openai_client(context=context)

        duration_context = ""
        if video_duration_sec:
            duration_context = (
                f"\nThe video is {video_duration_sec} seconds long "
                f"({video_duration_sec // 60} minutes {video_duration_sec % 60} seconds). "
                f"Estimate the approximate start time in seconds for each exercise "
                f"based on when it's discussed in the transcript."
            )

        prompt = f"""You are a fitness expert who extracts structured workout information from Instagram Reel captions and transcripts.

Analyze this text and extract the workout routine being described. Focus on:
1. Exercise names (standardize to common names)
2. Sets and reps (extract specific numbers when mentioned)
3. Important form cues and technique notes
4. Rest periods if mentioned
5. Detecting SUPERSETS — see rules below
6. Approximate timestamp in the video where each exercise is discussed{duration_context}

Text from Instagram Reel titled "{title}":
---
{transcript}
---

SUPERSET DETECTION — THIS IS CRITICAL:
Exercises are supersets (paired exercises done back-to-back) when:
- Two exercises appear on the SAME LINE separated by "and", "&", "/", or "+"
- Exercises are labeled A1/A2, B1/B2, etc.
- Exercises are explicitly called "superset" or "paired with"

CRITICAL RULE — DO NOT VIOLATE:
When structure is "superset", the "exercises" array MUST be empty []. ALL exercises go inside "supersets" only.
NEVER put the same exercise in both "exercises" and "supersets". This is the #1 most common mistake.
If ALL lines in the text are exercise pairs (e.g. "A and B", "C and D"), use a SINGLE block with structure "superset" containing ALL pairs in the "supersets" array.

Return ONLY a valid JSON object.

STRUCTURE FOR NON-SUPERSET BLOCKS (no pairs detected):
{{
  "label": "Block Name",
  "structure": null,
  "exercises": [
    {{
      "name": "Exercise Name",
      "sets": 3,
      "reps": 10,
      "reps_range": null,
      "duration_sec": null,
      "rest_sec": null,
      "distance_m": null,
      "type": "strength",
      "notes": "Form cues here",
      "video_start_sec": 5,
      "video_end_sec": 30
    }}
  ],
  "supersets": []
}}

STRUCTURE FOR SUPERSET BLOCKS (pairs detected):
{{
  "label": "Strength Supersets",
  "structure": "superset",
  "exercises": [],
  "supersets": [
    {{
      "exercises": [
        {{"name": "Exercise A", "sets": 5, "reps": 5, "type": "strength"}},
        {{"name": "Exercise B", "sets": 5, "reps": 5, "type": "strength"}}
      ]
    }}
  ]
}}
NOTE: "exercises" is [] (empty) above. This is mandatory when structure is "superset".

CONCRETE EXAMPLE — follow this exactly for paired exercises:
Input: "Squats (5x5) and box jumps (5x5)\nSeated jumps (5x5) and hip thrusts (5x8)"
Output block:
{{
  "label": "Supersets",
  "structure": "superset",
  "exercises": [],
  "supersets": [
    {{
      "exercises": [
        {{"name": "Squats", "sets": 5, "reps": 5, "type": "strength"}},
        {{"name": "Box Jumps", "sets": 5, "reps": 5, "type": "plyometric"}}
      ]
    }},
    {{
      "exercises": [
        {{"name": "Seated Jumps", "sets": 5, "reps": 5, "type": "plyometric"}},
        {{"name": "Hip Thrusts", "sets": 5, "reps": 8, "type": "strength"}}
      ]
    }}
  ]
}}
Notice: "exercises" is [] and ALL exercises are inside "supersets" only. One superset per paired line.

Full response format:
{{
  "title": "{title}",
  "workout_type": "strength | circuit | hiit | cardio | follow_along | mixed",
  "workout_type_confidence": 0.0-1.0,
  "video_duration_sec": {video_duration_sec if video_duration_sec else 'null'},
  "blocks": [ ... ]
}}

Rules:
- Only include actual exercises mentioned, not random sentences
- If sets/reps aren't stated, use reasonable defaults (3-4 sets, 8-12 reps for strength)
- Include helpful notes from the transcript about form, tempo, or technique
- Standardize exercise names (e.g. "RDLS" → "Romanian Deadlifts")
- ALWAYS detect supersets: two exercises on the same line = superset pair
- When ALL lines are pairs, use ONE block with structure "superset" — do NOT split into multiple blocks
- NEVER put exercises in BOTH "exercises" and "supersets" — pick one or the other per block
- Use multiple blocks only if the text describes truly distinct sections (e.g. "Warm-up" vs "Main work")
- For video_start_sec/video_end_sec: estimate when each exercise is discussed
- Return ONLY JSON, no markdown, no code blocks"""

        def _make_api_call() -> Dict:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
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

        Fixes:
        1. If supersets is non-empty: set structure to "superset", clear exercises[]
        2. If structure == "superset" but supersets is empty: reset structure to null
        3. Validates blocks is a list and superset entries have exercises
        """
        blocks = workout_data.get("blocks")
        if not isinstance(blocks, list):
            return workout_data

        for block in blocks:
            supersets = block.get("supersets", [])
            # Filter out malformed superset entries (must have exercises list)
            valid_supersets = [
                s for s in supersets
                if isinstance(s, dict) and isinstance(s.get("exercises"), list) and len(s["exercises"]) > 0
            ]
            block["supersets"] = valid_supersets

            if valid_supersets:
                block["structure"] = "superset"
                block["exercises"] = []
            elif block.get("structure") == "superset":
                # Structure says superset but no valid supersets — reset
                block["structure"] = None
        return workout_data

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
        reel = InstagramReelService._fetch_reel_data(url)

        shortcode = InstagramReelService._extract_shortcode(url) or reel.get("shortCode", "unknown")
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
        })

        return workout_data
