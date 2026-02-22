"""Instagram Reel ingestion service using Apify for transcript extraction."""

import logging
import re
from typing import Any, Dict, Optional

from workout_ingestor_api.ai import AIClientFactory, AIRequestContext, retry_sync_call
from workout_ingestor_api.services.apify_service import ApifyService, ApifyServiceError
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
5. Detecting CIRCUITS and ROUNDS — see rules below (check AFTER keyword override)
6. Detecting SUPERSETS — see rules below (check SECOND, only if not a circuit)
7. Approximate timestamp in the video where each exercise is discussed{duration_context}

Text from Instagram Reel titled "{title}":
---
{transcript}
---

KEYWORD STRUCTURE OVERRIDE — HIGHEST PRIORITY (check before everything else):
If the block label or workout title contains any of these keywords (case-insensitive), you MUST use that exact structure — it overrides all other heuristics:
- "EMOM" → structure: "emom", time_work_sec: 60 (1 min per station), set rounds to the round count if given
- "AMRAP" → structure: "amrap", time_cap_sec: the stated time in seconds if given
- "Tabata" → structure: "tabata", time_work_sec: 20, time_rest_sec: 10 unless stated otherwise
- "For Time" → structure: "for-time"
Keyword match = structure_confidence: 1.0, structure_options: []

EMOM FIELDS:
- "rounds": number of times through all exercises (e.g. 6 rounds)
- "time_cap_sec": total workout time in seconds, if a total duration is stated (e.g. "30 min EMOM" → 1800, "EMOM x 30 mins" → 1800, "EMOM x 20 minutes" → 1200). Convert any stated duration to seconds.
- "time_work_sec": 60 (one minute per station — the definition of EMOM)
- Set time_work_sec and time_cap_sec to null when not determinable

CIRCUIT / ROUNDS DETECTION — CHECK AFTER KEYWORD OVERRIDE:
A circuit or rounds-based workout is 3+ exercises done in sequence, repeated for N rounds. Detect when:
- Text mentions "N rounds", "N rounds of", "repeat N times", "x N rounds"
- Text lists 3 or more exercises to be done in order, then repeated
- Workout styles like HYROX, CrossFit WODs are often circuits — but check for EMOM/AMRAP/Tabata/For Time keywords FIRST
- If there are 3+ exercises and a round count with no EMOM/AMRAP keyword, it is a CIRCUIT

When you detect a circuit:
- Set structure to "circuit"
- Put ALL exercises in the "exercises" array (NOT in supersets)
- Set "rounds" to the number of rounds
- Set "sets" on each exercise to null (rounds handle repetition)
- Use "distance_m" for distance-based exercises (e.g. 500m ski = distance_m: 500)
- Use "calories" for calorie-target exercises (e.g. "16 cal row" = calories: 16)
- "supersets" MUST be [] (empty)

CONFIDENCE SCORING — INCLUDE IN EVERY BLOCK:
- "structure_confidence": float 0.0–1.0 — your confidence in the "structure" field
- "structure_options": list[str] — required when structure_confidence < 0.8; empty list [] when confidence >= 0.8

SUPERSET DETECTION — CHECK ONLY IF NOT A CIRCUIT:
Supersets are EXACTLY 2 exercises paired back-to-back. Detect when:
- Two exercises appear on the SAME LINE separated by "and", "&", "/", or "+"
- Exercises are labeled A1/A2, B1/B2, etc.
- Exercises are explicitly called "superset" or "paired with"
- ONLY use superset when exercises come in pairs of 2 — never for 3+ exercises in a round

CRITICAL RULE — DO NOT VIOLATE:
When structure is "superset", the "exercises" array MUST be empty []. ALL exercises go inside "supersets" only.
NEVER put the same exercise in both "exercises" and "supersets". This is the #1 most common mistake.

REPS PARSING RULES:
- If reps are given as a specific number (e.g. "10 reps"), set "reps" to that number and "reps_range" to null
- If reps are given as a range (e.g. "6-8 reps"), set "reps" to null and "reps_range" to the exact range string
- Never guess a reps number — if unclear, set both "reps" and "reps_range" to null
- When caption lines use timed-station format ("MM-MM: <exercise>"), the "MM-MM:" prefix is a minute-range timestamp — it is NEVER reps or sets. Extract metrics from the text after the colon only:
  - "35-40: 100 wall balls" -> reps: 100 (the 100 IS the rep count)
  - "0-5: 1000m Ski" -> distance_m: 1000
  - "25-30: 200m farmers carry" -> distance_m: 200
  The leading "MM-MM:" numbers must NEVER be used as reps, sets, or distance.

Return ONLY a valid JSON object.

STRUCTURE FOR CIRCUIT / ROUNDS BLOCKS (3+ exercises, repeated):
{{
  "label": "HYROX Conditioning",
  "structure": "circuit",
  "rounds": 5,
  "structure_confidence": 1.0,
  "structure_options": [],
  "exercises": [
    {{
      "name": "Ski Erg",
      "sets": null,
      "reps": null,
      "distance_m": 500,
      "calories": null,
      "type": "cardio",
      "notes": "Steady pace"
    }},
    {{
      "name": "Rowing",
      "sets": null,
      "reps": null,
      "distance_m": null,
      "calories": 16,
      "type": "cardio",
      "notes": "16 cal"
    }},
    {{
      "name": "Wall Balls",
      "sets": null,
      "reps": 20,
      "distance_m": null,
      "calories": null,
      "type": "strength",
      "notes": "9kg ball"
    }}
  ],
  "supersets": []
}}

STRUCTURE FOR NON-SUPERSET, NON-CIRCUIT BLOCKS (straight sets):
{{
  "label": "Block Name",
  "structure": null,
  "structure_confidence": 0.85,
  "structure_options": [],
  "exercises": [
    {{
      "name": "Exercise Name",
      "sets": 3,
      "reps": null,
      "reps_range": "6-8",
      "duration_sec": null,
      "rest_sec": null,
      "distance_m": null,
      "calories": null,
      "type": "strength",
      "notes": "Form cues here",
      "video_start_sec": 5,
      "video_end_sec": 30
    }}
  ],
  "supersets": []
}}

STRUCTURE FOR SUPERSET BLOCKS (exactly 2 exercises paired):
{{
  "label": "Strength Supersets",
  "structure": "superset",
  "structure_confidence": 1.0,
  "structure_options": [],
  "exercises": [],
  "supersets": [
    {{
      "exercises": [
        {{"name": "Exercise A", "sets": 5, "reps": 5, "calories": null, "type": "strength"}},
        {{"name": "Exercise B", "sets": 5, "reps": 5, "calories": null, "type": "strength"}}
      ]
    }}
  ]
}}
NOTE: "exercises" is [] (empty) above. This is mandatory when structure is "superset".

Full response format:
{{
  "title": "{title}",
  "workout_type": "strength | circuit | hiit | cardio | follow_along | mixed",
  "workout_type_confidence": 0.0-1.0,
  "video_duration_sec": {video_duration_sec if video_duration_sec else 'null'},
  "blocks": [
    {{
      "label": "...",
      "structure": "...",
      "structure_confidence": 0.0-1.0,
      "structure_options": [],
      "rounds": null,
      "exercises": [ ... ],
      "supersets": []
    }}
  ]
}}

Rules:
- Only include actual exercises mentioned, not random sentences
- If sets/reps aren't stated, use reasonable defaults (3-4 sets, 8-12 reps for strength)
- Include helpful notes from the transcript about form, tempo, or technique
- Standardize exercise names (e.g. "RDLS" → "Romanian Deadlifts")
- FIRST check for EMOM/AMRAP/Tabata/For Time keywords (highest priority)
- THEN check for circuits/rounds (3+ exercises repeated) — these are NOT supersets
- THEN check for supersets (exactly 2 exercises paired on same line)
- For circuits: put ALL exercises in "exercises", set "rounds", leave "supersets" empty
- For supersets: put ALL exercises in "supersets", leave "exercises" empty
- NEVER put exercises in BOTH "exercises" and "supersets" — pick one or the other per block
- Use multiple blocks only if the text describes truly distinct sections (e.g. "Warm-up" vs "Main work")
- Use "distance_m" for distance-based exercises (500m, 25m, 2.5km = 2500, etc.)
- Use "calories" for calorie-target exercises (rowing machine, ski erg, air bike measured in cals)
- Never put a calorie target in "distance_m" — use "calories" field instead
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
        reel = InstagramReelService._fetch_reel_data(url)

        # Log raw Apify response at WARNING level for debugging
        shortcode_for_log = InstagramReelService._extract_shortcode(url) or reel.get("shortCode", "unknown")
        reel_caption = reel.get("caption", "")
        reel_transcript = reel.get("transcript", "")
        reel_duration = reel.get("videoDuration")
        logger.warning(
            f"[apify_raw] shortcode={shortcode_for_log} keys={list(reel.keys())} "
            f"caption={reel_caption!r:.500} transcript={reel_transcript!r:.500} videoDuration={reel_duration}"
        )

        shortcode = shortcode_for_log
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
