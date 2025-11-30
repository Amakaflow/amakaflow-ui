"""
YouTube ingest implementation with LLM-powered parsing.
Replaces regex-based parsing with intelligent LLM extraction.
"""

import os
import json
import re
import uuid
from typing import Optional, Dict, Any, List

import requests
from fastapi import HTTPException
from fastapi.responses import JSONResponse

from workout_ingestor_api.models import Workout, Block, Exercise


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


def _parse_with_openai(transcript: str, title: str) -> Dict:
    """Parse transcript using OpenAI GPT-4."""
    try:
        import openai
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="OpenAI library not installed. Run: pip install openai"
        )
    
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="OpenAI API key not configured. Set OPENAI_API_KEY environment variable."
        )
    
    client = openai.OpenAI(api_key=api_key, timeout=60.0)
    
    prompt = f"""You are a fitness expert who extracts structured workout information from video transcripts.

Analyze this transcript and extract the workout routine being described. Focus on:
1. Exercise names (standardize to common names like "Incline Barbell Bench Press", "Pull-Up", "Lateral Raise")
2. Sets and reps (extract specific numbers when mentioned)
3. Important form cues and technique notes
4. Rest periods if mentioned
5. Any workout structure (supersets, circuits, etc.)

Transcript from video titled "{title}":
---
{transcript}
---

Return ONLY a valid JSON object with this exact structure:
{{
  "title": "{title}",
  "blocks": [
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
          "notes": "Form cues and tips here"
        }}
      ]
    }}
  ]
}}

Rules:
- Only include actual exercises mentioned, not random sentences
- If sets/reps aren't explicitly stated, use reasonable defaults (3-4 sets, 8-12 reps for strength)
- Use "strength" for weight exercises, "cardio" for running/cycling, "interval" for timed work
- Include helpful notes from the transcript about form, tempo, or technique
- Standardize exercise names (e.g., "Beijing curl" should be normalized to a proper exercise name if it's a variation)
- Group related exercises together if the video describes them as supersets or circuits

Return ONLY the JSON, no other text."""

    try:
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
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse LLM response as JSON: {e}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"OpenAI API call failed: {e}"
        )


def _parse_with_anthropic(transcript: str, title: str) -> Dict:
    """Parse transcript using Anthropic Claude."""
    try:
        from anthropic import Anthropic
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="Anthropic library not installed. Run: pip install anthropic"
        )
    
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable."
        )
    
    client = Anthropic(api_key=api_key, timeout=60.0)
    
    prompt = f"""You are a fitness expert who extracts structured workout information from video transcripts.

Analyze this transcript and extract the workout routine being described. Focus on:
1. Exercise names (standardize to common names like "Incline Barbell Bench Press", "Pull-Up", "Lateral Raise")
2. Sets and reps (extract specific numbers when mentioned)
3. Important form cues and technique notes
4. Rest periods if mentioned
5. Any workout structure (supersets, circuits, etc.)

Transcript from video titled "{title}":
---
{transcript}
---

Return ONLY a valid JSON object with this exact structure:
{{
  "title": "{title}",
  "blocks": [
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
          "notes": "Form cues and tips here"
        }}
      ]
    }}
  ]
}}

Rules:
- Only include actual exercises mentioned, not random sentences
- If sets/reps aren't explicitly stated, use reasonable defaults (3-4 sets, 8-12 reps for strength)
- Use "strength" for weight exercises, "cardio" for running/cycling, "interval" for timed work
- Include helpful notes from the transcript about form, tempo, or technique
- Standardize exercise names
- Group related exercises together if the video describes them as supersets or circuits

Return ONLY the JSON, no markdown formatting, no code blocks, just pure JSON."""

    try:
        message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4096,
            messages=[
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
        )
        
        result_text = message.content[0].text
        
        # Extract JSON from response (Claude may add markdown formatting)
        json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(0))
        return json.loads(result_text)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse LLM response as JSON: {e}"
        )
    except Exception as e:
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


async def ingest_youtube_impl(video_url: str) -> JSONResponse:
    """
    Core implementation for YouTube ingestion with LLM parsing.
    
    - Fetches transcript via youtube-transcript.io
    - Uses OpenAI or Anthropic to intelligently parse the workout
    - Returns structured workout JSON
    """

    video_url = video_url.strip()
    if not video_url:
        raise HTTPException(status_code=400, detail="URL is required")

    video_id = _extract_youtube_id(video_url)
    if not video_id:
        raise HTTPException(
            status_code=400,
            detail="Could not extract YouTube video ID from URL",
        )

    # Get transcript API token
    api_token = os.getenv("YT_TRANSCRIPT_API_TOKEN")
    if not api_token:
        raise HTTPException(
            status_code=500,
            detail="Transcript API token not configured (set YT_TRANSCRIPT_API_TOKEN)",
        )

    # Fetch transcript
    try:
        resp = requests.post(
            "https://www.youtube-transcript.io/api/transcripts",
            headers={
                "Authorization": f"Basic {api_token}",
                "Content-Type": "application/json",
            },
            json={"ids": [video_id]},
            timeout=15,
        )
    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Transcript API request failed: {exc}",
        ) from exc

    if resp.status_code == 401:
        raise HTTPException(status_code=500, detail="Transcript API token rejected (401)")
    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Transcript not found for provided video")
    if resp.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Transcript API error ({resp.status_code}): {resp.text}",
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
        raise HTTPException(
            status_code=502,
            detail="Transcript API returned no data for video",
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
        raise HTTPException(
            status_code=502,
            detail="Transcript API response did not include text",
        )

    transcript_text = "\n".join(
        seg.get("text", "") for seg in transcript_segments if isinstance(seg, dict)
    ).strip()

    if not transcript_text:
        raise HTTPException(
            status_code=502,
            detail="Transcript API response did not include text",
        )

    # Get video title
    title = entry.get("title") or "Imported Workout"

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
            "reason": "No workout-related keywords found in transcript"
        })
        return JSONResponse(payload)

    # Try LLM parsing
    llm_provider = None
    workout_dict = None
    llm_error = None

    # Try OpenAI first if available
    if os.getenv("OPENAI_API_KEY"):
        try:
            workout_dict = _parse_with_openai(transcript_text, title)
            llm_provider = "openai"
        except Exception as e:
            llm_error = f"OpenAI: {str(e)}"

    # Fall back to Anthropic if OpenAI failed or not configured
    if workout_dict is None and os.getenv("ANTHROPIC_API_KEY"):
        try:
            workout_dict = _parse_with_anthropic(transcript_text, title)
            llm_provider = "anthropic"
        except Exception as e:
            if llm_error:
                llm_error += f"; Anthropic: {str(e)}"
            else:
                llm_error = f"Anthropic: {str(e)}"

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
            "validation_warning": str(e)
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
    })

    return JSONResponse(response_payload)
