"""Unified LLM parser — single prompt for all platforms."""
from __future__ import annotations

import json
import logging
from typing import Any

from workout_ingestor_api.ai import AIClientFactory, AIRequestContext, retry_sync_call
from workout_ingestor_api.services.adapters.base import MediaContent
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
            custom_properties={"model": "gpt-4o-mini"},
        )
        client = AIClientFactory.create_openai_client(context=context)

        logger.info(f"[unified_parser] primary_text ({len(media.primary_text)} chars): {media.primary_text[:500]!r}")
        logger.info(f"[unified_parser] title: {media.title!r}")

        video_duration_sec = media.media_metadata.get("video_duration_sec")
        duration_context = ""
        if video_duration_sec:
            duration_context = (
                f"\nThe video is {video_duration_sec} seconds long "
                f"({int(video_duration_sec) // 60} minutes {int(video_duration_sec) % 60} seconds). "
                f"Estimate the approximate start time in seconds for each exercise "
                f"based on when it's discussed in the transcript."
            )

        # Prompt copied verbatim from instagram_reel_service.py::_parse_transcript
        # with Platform: prefix added for context.
        prompt = f"""Platform: {platform}
You are a fitness expert who extracts structured workout information from Instagram Reel captions and transcripts.

Analyze this text and extract the workout routine being described. Focus on:
1. Exercise names (standardize to common names)
2. Sets and reps (extract specific numbers when mentioned)
3. Important form cues and technique notes
4. Rest periods if mentioned
5. Detecting CIRCUITS and ROUNDS — see rules below (check FIRST)
6. Detecting SUPERSETS — see rules below (check SECOND, only if not a circuit)
7. Approximate timestamp in the video where each exercise is discussed{duration_context}

Text from Instagram Reel titled "{media.title}":
---
{media.primary_text}
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
- "time_cap_sec": total workout time in seconds, if a total duration is stated (e.g. "30 min EMOM" → 1800)
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
- "structure_options": list[str] — required when structure_confidence < 0.8; list the plausible alternatives (e.g. ["circuit", "straight_sets"]); empty list [] when confidence >= 0.8

Confidence scale:
- 1.0   : unambiguous keyword signal ("AMRAP", "EMOM", "For Time", "Tabata", "3 rounds", "repeat N times", explicit round count like "x4")
- 0.85–0.99: exercises with explicit sets and reps but no grouping/round signal — clearly straight sets
- 0.8   : moderately confident — use for borderline cases where structure is likely correct but not certain
- 0.5–0.79: ambiguous — two structures are plausible (e.g. could be circuit or superset; set structure_options accordingly)
- 0.3–0.49: very ambiguous — exercises listed with no sets, no reps, and no round/repeat signal
- 0.0–0.29: reserved for extreme ambiguity; use sparingly

When structure_confidence < 0.8, you MUST populate structure_options with the plausible alternative structure values.

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
- If reps are given as a specific number (e.g. "10 reps", "do 8"), set "reps" to that number and "reps_range" to null
- If reps are given as a range (e.g. "6-8 reps", "8-12", "6-8 each leg", "6 to 8"), set "reps" to null and "reps_range" to the exact range string as written (e.g. "6-8 each leg")
- Never guess a reps number — if unclear, set both "reps" and "reps_range" to null
- "X4 Rounds", "x4", "x 4" shorthand means rounds: 4 on the block — not sets on exercises

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
        {{"name": "Exercise A", "sets": 5, "reps": 5, "type": "strength"}},
        {{"name": "Exercise B", "sets": 5, "reps": 5, "type": "strength"}}
      ]
    }}
  ]
}}
NOTE: "exercises" is [] (empty) above. This is mandatory when structure is "superset".

Full response format:
{{
  "title": "{media.title}",
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
- FIRST check for circuits/rounds (3+ exercises repeated) — these are NOT supersets
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

        def _call() -> dict:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
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
