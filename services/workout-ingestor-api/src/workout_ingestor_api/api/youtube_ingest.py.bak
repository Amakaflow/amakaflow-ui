"""
YouTube ingest implementation, separated from FastAPI routing.
"""

import os
from typing import Optional, Dict, Any, List

import requests
from fastapi import HTTPException
from fastapi.responses import JSONResponse

from workout_ingestor_api.models import Workout
from workout_ingestor_api.services.parser_service import ParserService


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


def _filter_transcript_for_workout(text: str) -> str:
    """
    Heuristic filter to keep only workout-relevant lines before sending
    to ParserService. This avoids turning random sentences/lyrics into exercises.
    """
    EXERCISE_KEYWORDS = [
        "squat", "lunges", "lunge", "press", "bench", "push-up", "pushup",
        "pull-up", "pullup", "row", "deadlift", "rdl", "curl", "extension",
        "raise", "plank", "crunch", "situp", "sit-up", "burpee",
        "jumping jack", "jumping jacks", "mountain climber", "hip thrust",
        "kettlebell", "dumbbell", "barbell", "step up", "wall ball",
        "sled", "farmer carry", "carry", "run", "jog", "treadmill",
        "push press", "snatch", "clean",
    ]
    PROGRAMMING_KEYWORDS = [
        "set", "sets", "rep", "reps", "round", "rounds", "interval",
        "tabata", "emom", "amrap", "for time", "rest", "recover",
        "seconds", "second", "sec", "minute", "minutes", "min",
    ]
    NOISE_MARKERS = [
        "[music", "music]", "music [", "applause", "[applause", "applause]",
        "[laughter", "laughter]",
    ]

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    kept: List[str] = []

    for ln in lines:
        lower = ln.lower()

        if any(marker in lower for marker in NOISE_MARKERS):
            continue

        has_digit = any(ch.isdigit() for ch in ln)
        has_exercise_kw = any(kw in lower for kw in EXERCISE_KEYWORDS)
        has_programming_kw = any(kw in lower for kw in PROGRAMMING_KEYWORDS)

        if not (has_digit or has_exercise_kw or has_programming_kw):
            continue

        kept.append(ln)

    return "\n".join(kept)


async def ingest_youtube_impl(video_url: str) -> JSONResponse:
    """
    Core implementation used by the FastAPI route.

    - Fetches transcript via youtube-transcript.io
    - If transcript clearly isn't a workout → returns empty workout
    - Otherwise runs filtered transcript through ParserService
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

    api_token = os.getenv("YT_TRANSCRIPT_API_TOKEN")
    if not api_token:
        raise HTTPException(
            status_code=500,
            detail="Transcript API token not configured (set YT_TRANSCRIPT_API_TOKEN)",
        )

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

    lower = transcript_text.lower()
    EXERCISE_WORDS = [
        "squat", "lunge", "press", "bench", "push", "pull", "row",
        "deadlift", "curl", "extension", "raise", "burpee", "reps", "sets",
    ]
    has_workout_words = any(kw in lower for kw in EXERCISE_WORDS)

    if not has_workout_words:
        wk = Workout(
            title=entry.get("title") or "Imported Workout",
            source=video_url,
            blocks=[],
        )
        try:
            wk = wk.convert_to_new_structure()
        except Exception:
            pass

        payload = wk.model_dump()
        payload.setdefault("_provenance", {})
        payload["_provenance"].update({
            "mode": "transcript_only",
            "source_url": video_url,
            "has_captions": True,
            "has_asr": False,
            "has_ocr": False,
            "youtube_strategy": "transcript_not_usable",
        })
        return JSONResponse(payload)

    filtered_text = _filter_transcript_for_workout(transcript_text)
    text_for_parser = filtered_text.strip() or transcript_text

    try:
        wk = ParserService.parse_free_text_to_workout(text_for_parser, source=video_url)
    except Exception as exc:
        wk = Workout(
            title=entry.get("title") or "Imported Workout",
            source=video_url,
            blocks=[],
        )
        try:
            wk = wk.convert_to_new_structure()
        except Exception:
            pass

        payload = wk.model_dump()
        payload.setdefault("_provenance", {})
        payload["_provenance"].update({
            "mode": "transcript_only",
            "source_url": video_url,
            "has_captions": True,
            "has_asr": False,
            "has_ocr": False,
            "youtube_strategy": "parser_error",
            "parser_error": str(exc),
        })
        return JSONResponse(payload)

    title = entry.get("title")
    if title:
        wk.title = title[:80]

    try:
        wk = wk.convert_to_new_structure()
    except Exception:
        pass

    response_payload = wk.model_dump()
    response_payload.setdefault("_provenance", {})
    response_payload["_provenance"].update({
        "mode": "transcript_only",
        "source_url": video_url,
        "has_captions": True,
        "has_asr": False,
        "has_ocr": False,
        "youtube_strategy": (
            "filtered_transcript_parser"
            if filtered_text.strip() else "full_transcript_parser"
        ),
    })

    return JSONResponse(response_payload)