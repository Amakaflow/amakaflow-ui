"""
YouTube ingest implementation with LLM-powered parsing.
Replaces regex-based parsing with intelligent LLM extraction.

Includes caching support to avoid redundant API calls for previously
processed videos.
"""

import json
import logging
import os
import re
import uuid
from typing import Any, Dict, List, Optional

import requests
from fastapi import HTTPException
from fastapi.responses import JSONResponse

from workout_ingestor_api.ai import AIClientFactory, AIRequestContext, retry_sync_call
from workout_ingestor_api.models import Block, Exercise, Workout
from workout_ingestor_api.services.url_normalizer import (
    extract_youtube_video_id,
    normalize_youtube_url,
    parse_youtube_url,
)
from workout_ingestor_api.services.workout_sanitizer import sanitize_workout_data
from workout_ingestor_api.services.youtube_cache_service import YouTubeCacheService


logger = logging.getLogger(__name__)

# Static system prompt for Anthropic transcript parsing — cached via prompt caching.
# Keep dynamic content (title, transcript, duration) in the user message only.
_ANTHROPIC_SYSTEM_PROMPT = """You are a fitness expert who extracts structured workout information from video transcripts.

Extract workout routines focusing on:
1. Exercise names (standardize to common names like "Incline Barbell Bench Press", "Pull-Up", "Lateral Raise")
2. Sets and reps (extract specific numbers when mentioned)
3. Important form cues and technique notes
4. Rest periods if mentioned
5. Distinguishing STRENGTH from CIRCUIT via rest periods — see rules below (check FIRST)
6. Detecting SUPERSETS — see rules below (check SECOND, only if not a circuit)
7. Approximate timestamp in the video where each exercise is discussed

STRENGTH vs CIRCUIT — THE KEY SIGNAL IS REST BETWEEN EXERCISES:
The word "rounds" or "sets" does NOT automatically mean circuit. Use rest periods to decide:

STRENGTH indicators (classify block as straight-sets or superset, workout_type = "strength"):
- Exercises have explicit rest periods (60+ seconds between sets, e.g. "rest 2 min", "rest 90 seconds")
- Heavy compound lifts: squat, bench press, deadlift, barbell/dumbbell rows, overhead press
- "3 rounds of this superset" with rest = STRENGTH SUPERSET (not a circuit)
- Each exercise is done for its full sets before moving on (or paired with one other exercise)

CIRCUIT indicators (classify block as circuit, workout_type may be "circuit"):
- Exercises performed BACK-TO-BACK with minimal rest (<30 seconds) between exercises
- Rest only comes AFTER completing the full round of all exercises
- Explicit circuit keywords: "circuit", "AMRAP", "EMOM", "For Time", "WOD"
- Workout styles like HYROX, CrossFit WODs are almost always circuits

CIRCUIT / ROUNDS DETECTION:
Detect a CIRCUIT block when:
- Text uses "circuit", "AMRAP", "EMOM", "For Time", or CrossFit/HYROX workout style
- Exercises are performed consecutively with minimal rest between them
- 3+ exercises done back-to-back per round WITH minimal inter-exercise rest

NOT a circuit (even when "rounds" is mentioned):
- "3 rounds of this superset" with 90s rest = STRENGTH SUPERSET
- "4 sets of squats, rest 2 min, then bench press" = STRENGTH straight sets
- Multiple strength exercises with explicit rest periods between each = STRENGTH

When you detect a circuit:
- Set structure to "circuit" (or "amrap"/"emom"/"for-time" if applicable)
- Put ALL exercises in the "exercises" array (NOT in supersets)
- Set "rounds" to the number of rounds
- Set "sets" on each exercise to null (rounds handle repetition)
- Use "distance_m" for distance-based exercises (e.g. 500m ski = distance_m: 500)
- "supersets" MUST be [] (empty)

SUPERSET DETECTION — CHECK ONLY IF NOT A CIRCUIT:
Supersets are EXACTLY 2 exercises paired back-to-back. Detect when:
- Two exercises appear on the SAME LINE separated by "and", "&", "/", or "+"
- Exercises are labeled A1/A2, B1/B2, etc.
- Exercises are explicitly called "superset" or "paired with"
- ONLY use superset when exercises come in pairs of 2 — never for 3+ exercises in a round

CRITICAL RULE — DO NOT VIOLATE:
When structure is "superset", the "exercises" array MUST be empty []. ALL exercises go inside "supersets" only.
NEVER put the same exercise in both "exercises" and "supersets".

Return ONLY a valid JSON object with this structure:

STRUCTURE FOR CIRCUIT / ROUNDS BLOCKS (3+ exercises, repeated):
{
  "label": "HYROX Conditioning",
  "structure": "circuit",
  "rounds": 5,
  "exercises": [
    {"name": "Ski Erg", "sets": null, "reps": null, "distance_m": 500, "type": "cardio", "notes": "Steady pace"},
    {"name": "Wall Balls", "sets": null, "reps": 20, "type": "strength", "notes": "9kg ball"}
  ],
  "supersets": []
}

STRUCTURE FOR NON-SUPERSET, NON-CIRCUIT BLOCKS (straight sets):
{
  "label": "Main Workout",
  "structure": null,
  "exercises": [
    {
      "name": "Exercise Name",
      "sets": 3, "reps": 10, "reps_range": null, "duration_sec": null,
      "rest_sec": null, "distance_m": null, "type": "strength",
      "notes": "Form cues and tips here",
      "video_start_sec": 60, "video_end_sec": 120
    }
  ],
  "supersets": []
}

STRUCTURE FOR SUPERSET BLOCKS (exactly 2 exercises paired):
{
  "label": "Strength Supersets",
  "structure": "superset",
  "exercises": [],
  "supersets": [
    {"exercises": [
      {"name": "Exercise A", "sets": 5, "reps": 5, "type": "strength"},
      {"name": "Exercise B", "sets": 5, "reps": 5, "type": "strength"}
    ]}
  ]
}
NOTE: "exercises" is [] (empty) above. This is mandatory when structure is "superset".

Workout Type Detection (applies to the entire workout session, not individual blocks):
- "strength": Weight training, bodybuilding, powerlifting. Barbell/dumbbell exercises with rest periods between sets (60+ seconds). May use supersets or "rounds" language but has structured rest. Default for standard gym lifting workouts.
- "circuit": Exercises performed back-to-back with minimal rest (<30s) between exercises, then rest after the full round. CrossFit WODs, HYROX, bodyweight circuits.
- "hiit": High-intensity intervals with explicit timed work/rest periods (e.g. 40s on / 20s off, Tabata). Cardio or plyometric focus.
- "cardio": Running, cycling, rowing, swimming focused. Steady-state or interval cardio.
- "follow_along": Real-time video workouts to follow along with the trainer.
- "mixed": Workout clearly combines both strength (with rest) AND circuit/cardio sections in the same session.

IMPORTANT: If the workout has barbell or dumbbell exercises with rest periods between sets, classify as "strength" even if the trainer uses "rounds" language.

Rules:
- Only include actual exercises mentioned, not random sentences
- If sets/reps aren't explicitly stated, use reasonable defaults (3-4 sets, 8-12 reps for strength)
- Use "strength" for weight exercises, "cardio" for running/cycling, "interval" for timed work
- Include helpful notes from the transcript about form, tempo, or technique
- Standardize exercise names
- FIRST check rest periods — long rest = strength, no rest between exercises = circuit
- THEN check for circuits/rounds (back-to-back exercises, minimal inter-exercise rest)
- THEN check for supersets (exactly 2 exercises paired on same line)
- For circuits: put ALL exercises in "exercises", set "rounds", leave "supersets" empty
- For supersets: put ALL exercises in "supersets", leave "exercises" empty
- NEVER put exercises in BOTH "exercises" and "supersets" — pick one or the other per block
- Use "distance_m" for distance-based exercises (500m, 25m, 2.5km = 2500, etc.)
- For video_start_sec: estimate when each exercise is first discussed/demonstrated in the video
- For video_end_sec: estimate when the discussion of that exercise ends

Return ONLY the JSON, no markdown formatting, no code blocks, just pure JSON."""


def _extract_youtube_id(url: Optional[str]) -> Optional[str]:
    """Extract YouTube video ID from various URL formats."""
    from urllib.parse import urlparse, parse_qs

    if not url:
        return None

    parsed = urlparse(url)

    if parsed.hostname in {"youtu.be"}:
        video_id = parsed.path.lstrip("/")
        return video_id or None

    if parsed.hostname and "youtube" in parsed.hostname:
        query = parse_qs(parsed.query)
        if "v" in query and query["v"]:
            return query["v"][0]
        path_parts = parsed.path.split("/")
        if "embed" in path_parts and len(path_parts) >= 3:
            return path_parts[path_parts.index("embed") + 1] or None

    if url and len(url) == 11 and " " not in url:
        return url

    return None


def _generate_id() -> str:
    """Generate a unique ID for exercises and blocks."""
    return f"{int(__import__('time').time() * 1000)}-{uuid.uuid4().hex[:8]}"


def _parse_with_openai(
    transcript: str,
    title: str,
    video_duration_sec: Optional[int] = None,
    chapter_info: str = "",
    user_id: Optional[str] = None,
) -> Dict:
    """Parse transcript using OpenAI GPT-4."""
    try:
        import openai
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="OpenAI library not installed. Run: pip install openai"
        )

    # Create context for tracking
    context = AIRequestContext(
        user_id=user_id,
        feature_name="youtube_parse_transcript",
        custom_properties={"model": "gpt-4o-mini"},
    )

    try:
        client = AIClientFactory.create_openai_client(context=context)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    # Build duration context for timestamp estimation
    duration_context = ""
    if video_duration_sec:
        duration_context = f"\nThe video is {video_duration_sec} seconds long ({video_duration_sec // 60} minutes {video_duration_sec % 60} seconds)."
    
    # Add chapter info if available
    if chapter_info:
        duration_context += chapter_info + "\nUse these chapter timestamps for video_start_sec values."
    elif video_duration_sec:
        duration_context += " Estimate the approximate start time in seconds for each exercise based on when it's discussed in the transcript."
    
    prompt = f"""You are a fitness expert who extracts structured workout information from video transcripts.

Analyze this transcript and extract the workout routine being described. Focus on:
1. Exercise names (standardize to common names like "Incline Barbell Bench Press", "Pull-Up", "Lateral Raise")
2. Sets and reps (extract specific numbers when mentioned)
3. Important form cues and technique notes
4. Rest periods if mentioned
5. Distinguishing STRENGTH from CIRCUIT via rest periods — see rules below (check FIRST)
6. Detecting SUPERSETS — see rules below (check SECOND, only if not a circuit)
7. Approximate timestamp in the video where each exercise is discussed{duration_context}

Transcript from video titled "{title}":
---
{transcript}
---

STRENGTH vs CIRCUIT — THE KEY SIGNAL IS REST BETWEEN EXERCISES:
The word "rounds" or "sets" does NOT automatically mean circuit. Use rest periods to decide:

STRENGTH indicators (classify block as straight-sets or superset, workout_type = "strength"):
- Exercises have explicit rest periods (60+ seconds between sets, e.g. "rest 2 min", "rest 90 seconds")
- Heavy compound lifts: squat, bench press, deadlift, barbell/dumbbell rows, overhead press
- "3 rounds of this superset" with rest = STRENGTH SUPERSET (not a circuit)
- Each exercise is done for its full sets before moving on (or paired with one other exercise)

CIRCUIT indicators (classify block as circuit, workout_type may be "circuit"):
- Exercises performed BACK-TO-BACK with minimal rest (<30 seconds) between exercises
- Rest only comes AFTER completing the full round of all exercises
- Explicit circuit keywords: "circuit", "AMRAP", "EMOM", "For Time", "WOD"
- Workout styles like HYROX, CrossFit WODs are almost always circuits

CIRCUIT / ROUNDS DETECTION:
Detect a CIRCUIT block when:
- Text uses "circuit", "AMRAP", "EMOM", "For Time", or CrossFit/HYROX workout style
- Exercises are performed consecutively with minimal rest between them (not long rest between each)
- 3+ exercises done back-to-back per round WITH minimal inter-exercise rest

NOT a circuit (even when "rounds" is mentioned):
- "3 rounds of this superset" with 90s rest = STRENGTH SUPERSET
- "4 sets of squats, rest 2 min, then bench press" = STRENGTH straight sets
- Multiple strength exercises with explicit rest periods between each = STRENGTH

When you detect a circuit:
- Set structure to "circuit" (or "amrap"/"emom"/"for-time" if applicable)
- Put ALL exercises in the "exercises" array (NOT in supersets)
- Set "rounds" to the number of rounds
- Set "sets" on each exercise to null (rounds handle repetition)
- Use "distance_m" for distance-based exercises (e.g. 500m ski = distance_m: 500)
- "supersets" MUST be [] (empty)

SUPERSET DETECTION — CHECK ONLY IF NOT A CIRCUIT:
Supersets are EXACTLY 2 exercises paired back-to-back. Detect when:
- Two exercises appear on the SAME LINE separated by "and", "&", "/", or "+"
- Exercises are labeled A1/A2, B1/B2, etc.
- Exercises are explicitly called "superset" or "paired with"
- ONLY use superset when exercises come in pairs of 2 — never for 3+ exercises in a round

CRITICAL RULE — DO NOT VIOLATE:
When structure is "superset", the "exercises" array MUST be empty []. ALL exercises go inside "supersets" only.
NEVER put the same exercise in both "exercises" and "supersets".

Return ONLY a valid JSON object.

STRUCTURE FOR CIRCUIT / ROUNDS BLOCKS (3+ exercises, repeated):
{{
  "label": "HYROX Conditioning",
  "structure": "circuit",
  "rounds": 5,
  "exercises": [
    {{
      "name": "Ski Erg",
      "sets": null,
      "reps": null,
      "distance_m": 500,
      "type": "cardio",
      "notes": "Steady pace"
    }},
    {{
      "name": "Wall Balls",
      "sets": null,
      "reps": 20,
      "type": "strength",
      "notes": "9kg ball"
    }}
  ],
  "supersets": []
}}

STRUCTURE FOR NON-SUPERSET, NON-CIRCUIT BLOCKS (straight sets):
{{
  "label": "Main Workout",
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
      "notes": "Form cues and tips here",
      "video_start_sec": 60,
      "video_end_sec": 120
    }}
  ],
  "supersets": []
}}

STRUCTURE FOR SUPERSET BLOCKS (exactly 2 exercises paired):
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

Full response format:
{{
  "title": "{title}",
  "workout_type": "strength | circuit | hiit | cardio | follow_along | mixed",
  "workout_type_confidence": 0.0-1.0,
  "video_duration_sec": {video_duration_sec if video_duration_sec else 'null'},
  "blocks": [ ... ]
}}

Workout Type Detection (applies to the entire workout session, not individual blocks):
- "strength": Weight training, bodybuilding, powerlifting. Barbell/dumbbell exercises with rest periods between sets (60+ seconds). May use supersets or "rounds" language but has structured rest. Default for standard gym lifting workouts.
- "circuit": Exercises performed back-to-back with minimal rest (<30s) between exercises, then rest after the full round. CrossFit WODs, HYROX, bodyweight circuits, Tabata-style strength circuits.
- "hiit": High-intensity intervals with explicit timed work/rest periods (e.g. 40s on / 20s off, Tabata). Cardio or plyometric focus.
- "cardio": Running, cycling, rowing, swimming focused. Steady-state or interval cardio.
- "follow_along": Real-time video workouts to follow along with the trainer.
- "mixed": Workout clearly combines both strength (with rest) AND circuit/cardio sections in the same session.

IMPORTANT: If the workout has barbell or dumbbell exercises with rest periods between sets, classify as "strength" even if the trainer uses "rounds" language.

Set workout_type_confidence (0.0-1.0) based on clarity.

Rules:
- Only include actual exercises mentioned, not random sentences
- If sets/reps aren't explicitly stated, use reasonable defaults (3-4 sets, 8-12 reps for strength)
- Use "strength" for weight exercises, "cardio" for running/cycling, "interval" for timed work
- Include helpful notes from the transcript about form, tempo, or technique
- Standardize exercise names (e.g., "Beijing curl" should be normalized to a proper exercise name if it's a variation)
- FIRST check rest periods — long rest = strength, no rest between exercises = circuit
- THEN check for circuits/rounds (back-to-back exercises, minimal inter-exercise rest) — these are NOT supersets
- THEN check for supersets (exactly 2 exercises paired on same line)
- For circuits: put ALL exercises in "exercises", set "rounds", leave "supersets" empty
- For supersets: put ALL exercises in "supersets", leave "exercises" empty
- NEVER put exercises in BOTH "exercises" and "supersets" — pick one or the other per block
- Use "distance_m" for distance-based exercises (500m, 25m, 2.5km = 2500, etc.)
- For video_start_sec: estimate when each exercise is first discussed/demonstrated in the video
- For video_end_sec: estimate when the discussion of that exercise ends (before the next exercise starts)

Return ONLY the JSON, no other text."""

    def _make_api_call() -> Dict:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a fitness expert that extracts workout data from transcripts. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            response_format={"type": "json_object"},
            timeout=60.0
        )
        result_text = response.choices[0].message.content
        return json.loads(result_text)

    try:
        return retry_sync_call(_make_api_call)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse LLM response as JSON: {e}"
        )
    except Exception as e:
        logger.error(f"OpenAI API call failed after retries: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"OpenAI API call failed: {e}"
        )


def _parse_with_anthropic(
    transcript: str,
    title: str,
    video_duration_sec: Optional[int] = None,
    chapter_info: str = "",
    user_id: Optional[str] = None,
) -> Dict:
    """Parse transcript using Anthropic Claude."""
    try:
        from anthropic import Anthropic
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="Anthropic library not installed. Run: pip install anthropic"
        )

    # Create context for tracking
    context = AIRequestContext(
        user_id=user_id,
        feature_name="youtube_parse_transcript_anthropic",
        custom_properties={"model": "claude-3-5-sonnet-20241022"},
    )

    try:
        client = AIClientFactory.create_anthropic_client(context=context)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    # Build duration context for timestamp estimation
    duration_context = ""
    if video_duration_sec:
        duration_context = f"\nThe video is {video_duration_sec} seconds long ({video_duration_sec // 60} minutes {video_duration_sec % 60} seconds)."
    
    # Add chapter info if available
    if chapter_info:
        duration_context += chapter_info + "\nUse these chapter timestamps for video_start_sec values."
    elif video_duration_sec:
        duration_context += " Estimate the approximate start time in seconds for each exercise based on when it's discussed in the transcript."
    
    user_message = (
        f'Analyze this transcript from video titled "{title}":{duration_context}\n'
        f"---\n{transcript}\n---\n\n"
        f'Return JSON with "title": "{title}", '
        f'"video_duration_sec": {video_duration_sec if video_duration_sec else "null"}, '
        f'and "blocks" array.'
    )

    def _make_api_call() -> Dict:
        message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4096,
            system=[{"type": "text", "text": _ANTHROPIC_SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user_message}],
            temperature=0.1,
        )
        cache_read = getattr(message.usage, "cache_read_input_tokens", 0)
        cache_write = getattr(message.usage, "cache_creation_input_tokens", 0)
        if cache_read or cache_write:
            logger.debug("Anthropic prompt cache: read=%d write=%d", cache_read, cache_write)
        result_text = message.content[0].text

        # Extract JSON from response (Claude may add markdown formatting)
        json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(0))
        return json.loads(result_text)

    try:
        return retry_sync_call(_make_api_call)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse LLM response as JSON: {e}"
        )
    except Exception as e:
        logger.error(f"Anthropic API call failed after retries: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Anthropic API call failed: {e}"
        )


def _add_ids_to_workout(workout_dict: Dict) -> Dict:
    """Add unique IDs to blocks and exercises."""
    for block in workout_dict.get("blocks", []):
        if not block.get("id"):
            block["id"] = _generate_id()
        
        for exercise in block.get("exercises", []):
            if not exercise.get("id"):
                exercise["id"] = _generate_id()
        
        # Handle supersets if present
        for superset in block.get("supersets", []):
            if not superset.get("id"):
                superset["id"] = _generate_id()
            for exercise in superset.get("exercises", []):
                if not exercise.get("id"):
                    exercise["id"] = _generate_id()
    
    return workout_dict


async def ingest_youtube_impl(video_url: str, user_id: Optional[str] = None, skip_cache: bool = False) -> JSONResponse:
    """
    Core implementation for YouTube ingestion with LLM parsing and caching.

    - Checks cache first for previously processed videos
    - If not cached, fetches transcript via youtube-transcript.io
    - Uses OpenAI or Anthropic to intelligently parse the workout
    - Caches successful results for future lookups
    - Returns structured workout JSON

    Args:
        video_url: YouTube video URL
        user_id: Optional user ID for tracking who ingested the workout
        skip_cache: If True, bypass cache lookup (still saves to cache)
    """

    import time
    start_time = time.time()

    video_url = video_url.strip()
    if not video_url:
        raise HTTPException(status_code=400, detail="URL is required")

    logger.info(f"YouTube ingest started: url={video_url[:100]}, user_id={user_id}, skip_cache={skip_cache}")

    # Use the new URL normalizer for consistent video ID extraction
    video_id, normalized_url, original_url = parse_youtube_url(video_url)

    if not video_id:
        # Fall back to old extractor for backwards compatibility
        video_id = _extract_youtube_id(video_url)
        normalized_url = normalize_youtube_url(video_url) if video_id else None

    if not video_id:
        raise HTTPException(
            status_code=400,
            detail="Could not extract YouTube video ID from URL",
        )

    # =========================================================================
    # CACHE CHECK: Return cached workout if available
    # =========================================================================
    if not skip_cache:
        cached = YouTubeCacheService.get_cached_workout(video_id)
        if cached:
            logger.info(f"Returning cached workout for video_id: {video_id}")

            # Increment cache hit counter (non-blocking, fire-and-forget)
            YouTubeCacheService.increment_cache_hit(video_id)

            # Build response from cached data
            workout_data = cached.get("workout_data", {})
            video_metadata = cached.get("video_metadata", {})

            # Ensure workout has required fields
            if not workout_data.get("source"):
                workout_data["source"] = video_url

            response_payload = workout_data.copy()
            response_payload.setdefault("_provenance", {})
            response_payload["_provenance"].update({
                "mode": "cached",
                "source_url": video_url,
                "video_id": video_id,
                "cached_at": cached.get("ingested_at"),
                "cache_hits": (cached.get("cache_hits", 0) or 0) + 1,
                "original_processing_method": cached.get("processing_method"),
                "video_duration_sec": video_metadata.get("duration_seconds"),
            })

            return JSONResponse(response_payload)

    # Get transcript API token
    api_token = os.getenv("YT_TRANSCRIPT_API_TOKEN")
    if not api_token:
        raise HTTPException(
            status_code=500,
            detail="Transcript API token not configured (set YT_TRANSCRIPT_API_TOKEN)",
        )

    # Fetch transcript with retry logic
    TRANSCRIPT_API_URL = "https://www.youtube-transcript.io/api/transcripts"
    TRANSCRIPT_API_TIMEOUT = 30  # seconds (increased from 15 for reliability)
    MAX_RETRIES = 2

    logger.info(f"Fetching transcript for video_id: {video_id}")

    last_error = None
    for attempt in range(MAX_RETRIES):
        try:
            logger.debug(f"Transcript API attempt {attempt + 1}/{MAX_RETRIES} for video_id: {video_id}")
            resp = requests.post(
                TRANSCRIPT_API_URL,
                headers={
                    "Authorization": f"Basic {api_token}",
                    "Content-Type": "application/json",
                },
                json={"ids": [video_id]},
                timeout=TRANSCRIPT_API_TIMEOUT,
            )
            # Success - break out of retry loop
            break
        except requests.Timeout as exc:
            last_error = exc
            logger.warning(
                f"Transcript API timeout (attempt {attempt + 1}/{MAX_RETRIES}) "
                f"for video_id: {video_id}, timeout: {TRANSCRIPT_API_TIMEOUT}s"
            )
            if attempt < MAX_RETRIES - 1:
                import time
                time.sleep(2)  # Brief delay before retry
                continue
            logger.error(f"Transcript API timeout after {MAX_RETRIES} attempts for video_id: {video_id}")
            raise HTTPException(
                status_code=502,
                detail=f"Transcript API timed out after {MAX_RETRIES} attempts ({TRANSCRIPT_API_TIMEOUT}s each). "
                       f"The youtube-transcript.io service may be slow or unavailable.",
            ) from exc
        except requests.RequestException as exc:
            last_error = exc
            logger.error(f"Transcript API request failed for video_id: {video_id}: {exc}")
            raise HTTPException(
                status_code=502,
                detail=f"Transcript API request failed: {exc}",
            ) from exc

    # Log response status for debugging
    logger.info(f"Transcript API response status: {resp.status_code} for video_id: {video_id}")

    if resp.status_code == 401:
        logger.error(f"Transcript API token rejected (401) for video_id: {video_id}")
        raise HTTPException(
            status_code=500,
            detail="[AMA-242] Transcript API token rejected (401). Check YT_TRANSCRIPT_API_TOKEN.",
            headers={"X-Failure-Category": "api_auth_error"},
        )
    if resp.status_code == 403:
        # 403 can mean: age-restricted, region-locked, private, or API block
        logger.warning(f"Transcript API access denied (403) for video_id: {video_id}")
        # Try to extract more specific error from response
        error_detail = "Transcript API access denied (403). Possible causes: age-restricted video, region-locked content, private/unlisted video, or video removed."
        raise HTTPException(
            status_code=403,
            detail=f"[AMA-242] {error_detail}",
            headers={"X-Failure-Category": "access_denied_403"},
        )
    if resp.status_code == 404:
        logger.warning(f"Transcript not found (404) for video_id: {video_id}")
        raise HTTPException(
            status_code=404,
            detail="[AMA-242] Transcript not found for provided video. Possible causes: video has no captions, video is too short (<30s), video is a live stream, or video was removed.",
            headers={"X-Failure-Category": "transcript_not_found_404"},
        )
    if resp.status_code == 429:
        logger.warning(f"Transcript API rate limited (429) for video_id: {video_id}")
        raise HTTPException(
            status_code=429,
            detail="[AMA-242] Transcript API rate limited (429). Too many requests. Try again later.",
            headers={"X-Failure-Category": "rate_limited_429"},
        )
    if resp.status_code >= 400:
        logger.error(f"Transcript API error ({resp.status_code}) for video_id: {video_id}: {resp.text[:500]}")
        raise HTTPException(
            status_code=502,
            detail=f"[AMA-242] Transcript API error ({resp.status_code}): {resp.text[:200]}",
            headers={"X-Failure-Category": "api_error"},
        )

    data: Any = resp.json()
    entry: Optional[Dict[str, Any]] = None

    if isinstance(data, dict):
        entry = data.get(video_id)
    elif isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and item.get("id") == video_id:
                entry = item
                break

    if not entry:
        logger.warning(f"Transcript API returned no entry for video_id: {video_id}")
        raise HTTPException(
            status_code=502,
            detail="[AMA-242] Transcript API returned no data for video. Video may not exist or may have been removed.",
            headers={"X-Failure-Category": "no_entry_in_response"},
        )

    # Extract transcript text
    transcript_segments = []
    if isinstance(entry, dict):
        if entry.get("transcript"):
            transcript_segments = entry["transcript"]
        elif entry.get("tracks"):
            for track in entry["tracks"]:
                if isinstance(track, dict) and track.get("transcript"):
                    transcript_segments = track["transcript"]
                    break

    if not transcript_segments:
        logger.warning(f"No transcript segments found for video_id: {video_id}")
        raise HTTPException(
            status_code=502,
            detail="[AMA-242] No transcript segments found. Video may not have captions enabled or auto-captions may not be available.",
            headers={"X-Failure-Category": "no_transcript_segments"},
        )

    transcript_text = "\n".join(
        seg.get("text", "") for seg in transcript_segments if isinstance(seg, dict)
    ).strip()

    if not transcript_text:
        logger.warning(f"Transcript text is empty for video_id: {video_id}")
        raise HTTPException(
            status_code=502,
            detail="[AMA-242] Transcript text is empty. Video may have captions disabled or only have auto-generated captions that couldn't be processed.",
            headers={"X-Failure-Category": "empty_transcript_text"},
        )

    # Get video title
    title = entry.get("title") or "Imported Workout"
    
    # Extract video duration from microformat
    video_duration_sec = None
    try:
        microformat = entry.get("microformat", {})
        renderer = microformat.get("playerMicroformatRenderer", {})
        length_str = renderer.get("lengthSeconds")
        if length_str:
            video_duration_sec = int(length_str)
    except Exception:
        pass
    
    # Fallback: estimate from last transcript segment
    if not video_duration_sec:
        try:
            tracks = entry.get("tracks", [])
            if tracks:
                transcript = tracks[0].get("transcript", [])
                if transcript:
                    last_seg = transcript[-1]
                    start = float(last_seg.get("start", 0))
                    dur = float(last_seg.get("dur", 0))
                    video_duration_sec = int(start + dur)
        except Exception:
            pass
    
    # Extract chapters if available (these have exact timestamps!)
    chapters = entry.get("chapters", [])
    chapter_info = ""
    if chapters:
        chapter_info = "\n\nVideo Chapters with timestamps:\n"
        for ch in chapters:
            mins = ch.get("start_time", 0) // 60
            secs = ch.get("start_time", 0) % 60
            chapter_info += f"- {ch.get('title', 'Unknown')} at {mins}:{secs:02d} ({ch.get('start_time', 0)} seconds)\n"

    # Check if video seems to be about fitness
    lower = transcript_text.lower()
    EXERCISE_WORDS = [
        "squat", "lunge", "press", "bench", "push", "pull", "row",
        "deadlift", "curl", "extension", "raise", "burpee", "reps", "sets",
        "workout", "exercise", "training", "gym", "muscle", "strength",
    ]
    has_workout_words = any(kw in lower for kw in EXERCISE_WORDS)

    if not has_workout_words:
        # Not a workout video
        wk = Workout(
            title=title[:80],
            source=video_url,
            blocks=[],
        )
        payload = wk.model_dump()
        payload.setdefault("_provenance", {})
        payload["_provenance"].update({
            "mode": "transcript_only",
            "source_url": video_url,
            "has_captions": True,
            "has_asr": False,
            "has_ocr": False,
            "youtube_strategy": "transcript_not_usable",
            "reason": "No workout-related keywords found in transcript",
            "video_duration_sec": video_duration_sec,
        })
        return JSONResponse(payload)

    # Try LLM parsing
    llm_provider = None
    workout_dict = None
    llm_error = None

    logger.info(f"Starting LLM parsing for video_id: {video_id}, transcript_length: {len(transcript_text)}")

    # Try OpenAI first if available
    if os.getenv("OPENAI_API_KEY"):
        try:
            logger.debug(f"Attempting OpenAI parsing for video_id: {video_id}")
            llm_start = time.time()
            workout_dict = _parse_with_openai(transcript_text, title, video_duration_sec, chapter_info)
            llm_provider = "openai"
            logger.info(f"OpenAI parsing successful for video_id: {video_id} in {time.time() - llm_start:.2f}s")
        except Exception as e:
            llm_error = f"OpenAI: {str(e)}"
            logger.warning(f"OpenAI parsing failed for video_id: {video_id}: {e}")

    # Fall back to Anthropic if OpenAI failed or not configured
    if workout_dict is None and os.getenv("ANTHROPIC_API_KEY"):
        try:
            logger.debug(f"Attempting Anthropic parsing for video_id: {video_id}")
            llm_start = time.time()
            workout_dict = _parse_with_anthropic(transcript_text, title, video_duration_sec, chapter_info)
            llm_provider = "anthropic"
            logger.info(f"Anthropic parsing successful for video_id: {video_id} in {time.time() - llm_start:.2f}s")
        except Exception as e:
            if llm_error:
                llm_error += f"; Anthropic: {str(e)}"
            else:
                llm_error = f"Anthropic: {str(e)}"
            logger.warning(f"Anthropic parsing failed for video_id: {video_id}: {e}")

    # Sanitize LLM output to fix common structural mistakes (same as Instagram path)
    if workout_dict is not None:
        workout_dict = sanitize_workout_data(workout_dict)

    # If no LLM available, fall back to basic parsing
    if workout_dict is None:
        from workout_ingestor_api.services.parser_service import ParserService
        
        try:
            wk = ParserService.parse_free_text_to_workout(transcript_text, source=video_url)
            wk.title = title[:80]
            wk = wk.convert_to_new_structure()
            
            payload = wk.model_dump()
            payload.setdefault("_provenance", {})
            payload["_provenance"].update({
                "mode": "transcript_only",
                "source_url": video_url,
                "has_captions": True,
                "has_asr": False,
                "has_ocr": False,
                "youtube_strategy": "regex_fallback",
                "llm_error": llm_error or "No LLM API keys configured",
                "recommendation": "Configure OPENAI_API_KEY or ANTHROPIC_API_KEY for better parsing"
            })
            return JSONResponse(payload)
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Parsing failed: {str(e)}"
            )

    # Add IDs to workout
    workout_dict = _add_ids_to_workout(workout_dict)
    workout_dict["source"] = video_url

    # Validate and convert to Workout model
    try:
        wk = Workout(**workout_dict)
        wk = wk.convert_to_new_structure()
    except Exception as e:
        # If validation fails, return raw dict with error info
        workout_dict.setdefault("_provenance", {})
        workout_dict["_provenance"].update({
            "mode": "transcript_only",
            "source_url": video_url,
            "has_captions": True,
            "has_asr": False,
            "has_ocr": False,
            "youtube_strategy": f"llm_{llm_provider}",
            "validation_warning": str(e),
            "video_duration_sec": video_duration_sec,
        })
        return JSONResponse(workout_dict)

    # Build response
    response_payload = wk.model_dump()
    response_payload.setdefault("_provenance", {})
    response_payload["_provenance"].update({
        "mode": "transcript_only",
        "source_url": video_url,
        "has_captions": True,
        "has_asr": False,
        "has_ocr": False,
        "youtube_strategy": f"llm_{llm_provider}",
        "llm_provider": llm_provider,
        "video_duration_sec": video_duration_sec,
    })

    # =========================================================================
    # CACHE SAVE: Store successful workout for future lookups
    # =========================================================================
    if normalized_url and video_id:
        try:
            # Build video metadata for caching
            video_metadata = {
                "title": title,
                "duration_seconds": video_duration_sec,
                # Additional metadata can be added here when available
                # "channel": channel_name,
                # "thumbnail_url": thumbnail,
                # "published_at": published_date,
            }

            # Save to cache (non-blocking, continues even if cache fails)
            YouTubeCacheService.save_cached_workout(
                video_id=video_id,
                source_url=video_url,
                normalized_url=normalized_url,
                video_metadata=video_metadata,
                workout_data=response_payload,
                processing_method=f"llm_{llm_provider}",
                ingested_by=user_id
            )
            logger.info(f"Cached workout for video_id: {video_id}")
        except Exception as e:
            # Cache save failure should not fail the request
            logger.warning(f"Failed to cache workout for video_id {video_id}: {e}")

    # Log completion with timing
    total_time = time.time() - start_time
    exercise_count = sum(len(block.get("exercises", [])) for block in response_payload.get("blocks", []))
    logger.info(
        f"YouTube ingest completed: video_id={video_id}, "
        f"exercises={exercise_count}, llm={llm_provider}, "
        f"duration={total_time:.2f}s"
    )

    return JSONResponse(response_payload)