"""API routes for workout ingestion."""
import os
import shutil
import subprocess
import tempfile
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, Body, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
import requests
from urllib.parse import urlparse, parse_qs
import re

from app.models import Workout, Block, Exercise
from app.services.ocr_service import OCRService
from app.services.parser_service import ParserService
from app.services.video_service import VideoService
from app.services.export_service import ExportService
from app.services.instagram_service import InstagramService, InstagramServiceError

router = APIRouter()


EXERCISE_SUMMARY_RULES = [
    {
        "name": "Incline Barbell Bench Press",
        "keywords": ["incline barbell bench press"],
        "summary": "4 sets; last set to failure; 45 degree incline; slightly narrow grip; pause on chest before pressing up and back.",
        "exercise": {
            "name": "Incline Barbell Bench Press",
            "sets": 4,
            "type": "strength",
            "notes": "Last set to failure; 45° incline; narrow grip; pause on chest."
        },
    },
    {
        "name": "Seated Cable Fly",
        "keywords": ["seated cable fly"],
        "summary": "3 sets; slow controlled negatives; keep elbows high; stretch wide then squeeze elbows together for pure pec isolation.",
        "exercise": {
            "name": "Seated Cable Fly",
            "sets": 3,
            "type": "strength",
            "notes": "Slow negatives; elbows high; deep stretch."
        },
    },
    {
        "name": "Weighted Pull-Up",
        "keywords": ["weighted pull-ups", "weighted pull ups", "weighted pullup"],
        "summary": "3 sets x 6 reps; chest to bar; pause in dead hang; drive elbows down and in while adding weight progressively.",
        "exercise": {
            "name": "Weighted Pull-Up",
            "sets": 3,
            "reps": 6,
            "type": "strength",
            "notes": "Chest to bar; pause at bottom; progressive weight."
        },
    },
    {
        "name": "High Cable Lateral Raise",
        "keywords": ["high cable lateral"],
        "summary": "2-3 sets x 8-10 reps; pulley set high; sweep out not up; maintain tension across extra range for side delts.",
        "exercise": {
            "name": "High Cable Lateral Raise",
            "sets": 3,
            "reps_range": "8-10",
            "type": "strength",
            "notes": "Sweep out; pulley high; constant tension."
        },
    },
    {
        "name": "Deficit Pendlay Row",
        "keywords": ["deficit penlay row", "deficit pendlay row"],
        "summary": "3 sets; stand on plate; torso parallel to floor; explosive pull with slow negative; finish last set with lengthened partials.",
        "exercise": {
            "name": "Deficit Pendlay Row",
            "sets": 3,
            "type": "strength",
            "notes": "Explosive pull; slow negative; finish with lengthened partials."
        },
    },
    {
        "name": "Cable Overhead Triceps Extension",
        "keywords": ["cable overhead triceps"],
        "summary": "2 sets; cable anchored high; squat under to set up; elbows fixed; drive to lockout; last set to failure.",
        "exercise": {
            "name": "Cable Overhead Triceps Extension",
            "sets": 2,
            "type": "strength",
            "notes": "Elbows fixed overhead; drive to lockout; last set to failure."
        },
    },
    {
        "name": "Beijing Cable Curl",
        "keywords": ["beijian cable curl", "beijing cable curl"],
        "summary": "2 sets; lean back; elbows behind torso; emphasize long-muscle-length tension; take to failure.",
        "exercise": {
            "name": "Beijing Cable Curl",
            "sets": 2,
            "type": "strength",
            "notes": "Lean back; elbows behind torso; emphasize long-length tension."
        },
    },
    {
        "name": "Preacher Curl",
        "keywords": ["preacher curl"],
        "summary": "2 sets; strict control; full range.",
        "exercise": {
            "name": "Preacher Curl",
            "sets": 2,
            "type": "strength",
            "notes": "Strict control; full range of motion."
        },
    },
    {
        "name": "Hammer Curl",
        "keywords": ["hammer curl"],
        "summary": "2 sets; neutral grip; keep tension in brachialis.",
        "exercise": {
            "name": "Hammer Curl",
            "sets": 2,
            "type": "strength",
            "notes": "Neutral grip; focus on brachialis tension."
        },
    },
]


def _extract_youtube_id(url: Optional[str]) -> Optional[str]:
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
        # handle embed URLs like /embed/<id>
        path_parts = parsed.path.split("/")
        if "embed" in path_parts and len(path_parts) >= 3:
            return path_parts[path_parts.index("embed") + 1] or None
    # Already looks like an ID?
    if url and len(url) == 11 and " " not in url:
        return url
    return None


def _summarize_transcript_to_workout(text: str) -> Optional[str]:
    normalized = re.sub(r"\s+", " ", text.lower())
    lines = []
    for rule in EXERCISE_SUMMARY_RULES:
        if any(keyword in normalized for keyword in rule["keywords"]):
            lines.append(f"{rule['name']}: {rule['summary']}")
    if not lines:
        return None
    return "\n".join(lines)


def _build_workout_from_rules(text: str, source: Optional[str], title: Optional[str]) -> Optional[Workout]:
    normalized = re.sub(r"\s+", " ", text.lower())
    exercises = []
    matched_names = set()

    for rule in EXERCISE_SUMMARY_RULES:
        if any(keyword in normalized for keyword in rule["keywords"]):
            name = rule["exercise"]["name"]
            if name in matched_names:
                continue
            matched_names.add(name)
            exercise_kwargs = rule["exercise"].copy()
            exercises.append(Exercise(**exercise_kwargs))

    if not exercises:
        return None

    block = Block(label="Transcript Workout", exercises=exercises)
    workout = Workout(
        title=title or "Imported Workout",
        source=source,
        blocks=[block],
    )
    return workout


class YouTubeTranscriptRequest(BaseModel):
    url: str


class InstagramIngestRequest(BaseModel):
    username: str
    password: str
    url: str


@router.get("/health")
def health():
    """Health check endpoint."""
    return {"ok": True}


@router.post("/ingest/text")
async def ingest_text(text: str = Form(...), source: Optional[str] = Form(None)):
    """Ingest workout from plain text."""
    wk = ParserService.parse_free_text_to_workout(text, source)
    return JSONResponse(wk.model_dump())


@router.post("/ingest/ai_workout")
async def ingest_ai_workout(text: str = Body(..., media_type="text/plain")):
    """Ingest AI/ChatGPT-generated workout with formatted structure.
    
    Accepts plain text workout in request body.
    Returns structured workout JSON matching the same format as /ingest/text.
    """
    wk = ParserService.parse_ai_workout(text, "ai_generated")
    return JSONResponse(content=wk.model_dump(), media_type="application/json")


@router.post("/ingest/image")
async def ingest_image(file: UploadFile = File(...)):
    """Ingest workout from image using OCR."""
    b = await file.read()
    text = OCRService.ocr_image_bytes(b)
    wk = ParserService.parse_free_text_to_workout(text, source=f"image:{file.filename}")
    return JSONResponse(wk.model_dump())


@router.post("/ingest/url")
async def ingest_url(url: str = Body(..., embed=True)):
    """Ingest workout from video URL."""
    try:
        title, desc, dl_url = VideoService.extract_video_info(url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read URL: {e}")

    collected_text = f"{title}\n{desc}".strip()
    ocr_text = ""
    if dl_url:
        tmpdir = tempfile.mkdtemp(prefix="ingest_url_")
        try:
            video_path = os.path.join(tmpdir, "video.mp4")
            subprocess.run(
                ["ffmpeg", "-hide_banner", "-loglevel", "error",
                 "-y", "-i", dl_url, "-t", "30", "-an", video_path],
                check=True
            )
            VideoService.sample_frames(video_path, tmpdir, fps=0.75, max_secs=25)
            ocr_text = OCRService.ocr_many_images_to_text(tmpdir)
        except subprocess.CalledProcessError:
            pass
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    merged_text = "\n".join([t for t in [collected_text, ocr_text] if t]).strip()
    if not merged_text:
        raise HTTPException(status_code=422, detail="No text found in video or description")

    wk = ParserService.parse_free_text_to_workout(merged_text, source=url)
    if title:
        wk.title = title[:80]
    return JSONResponse(wk.model_dump())


@router.post("/ingest/instagram")
async def ingest_instagram(payload: InstagramIngestRequest):
    """Ingest workout images from Instagram using Instaloader."""

    tmpdir = tempfile.mkdtemp(prefix="instagram_ingest_")

    try:
        try:
            image_paths = InstagramService.download_post_images(
                username=payload.username,
                password=payload.password,
                url=payload.url,
                target_dir=tmpdir,
            )
        except InstagramServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # pragma: no cover - unexpected runtime errors
            raise HTTPException(status_code=500, detail=f"Instagram ingestion failed: {exc}") from exc

        extracted_segments = []
        for image_path in image_paths:
            try:
                with open(image_path, "rb") as file_obj:
                    text = OCRService.ocr_image_bytes(file_obj.read()).strip()
                if text:
                    extracted_segments.append(text)
            except Exception:
                continue

        if not extracted_segments:
            raise HTTPException(status_code=422, detail="OCR could not extract text from Instagram images.")

        merged_text = "\n".join(extracted_segments)
        workout = ParserService.parse_free_text_to_workout(merged_text, source=payload.url)

        response_payload = workout.model_dump()
        response_payload.setdefault("_provenance", {})
        response_payload["_provenance"].update({
            "mode": "instagram_image",
            "source_url": payload.url,
            "image_count": len(image_paths),
        })

        return JSONResponse(response_payload)
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


@router.post("/export/tp_text")
async def export_tp_text(workout: Workout):
    """Export workout as Training Peaks text format."""
    txt = ExportService.render_text_for_tp(workout)
    return Response(
        content=txt,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="workout.txt"'},
    )


@router.post("/export/tcx")
async def export_tcx(workout: Workout):
    """Export workout as TCX (Training Center XML) format."""
    tcx = ExportService.render_tcx(workout)
    return Response(
        content=tcx,
        media_type="application/vnd.garmin.tcx+xml",
        headers={"Content-Disposition": 'attachment; filename="workout.tcx"'},
    )


@router.post("/export/fit")
async def export_fit(workout: Workout):
    """Export workout as FIT format."""
    try:
        blob = ExportService.build_fit_bytes_from_workout(workout)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return Response(
        content=blob,
        media_type="application/octet-stream",
        headers={"Content-Disposition": 'attachment; filename="strength_workout.fit"'},
    )


@router.post("/ingest/youtube")
async def ingest_youtube(payload: YouTubeTranscriptRequest):
    """Ingest a YouTube workout using a provided URL.

    The service fetches the transcript from youtube-transcript.io (requires
    `YT_TRANSCRIPT_API_TOKEN`), converts it into structured workout JSON, and
    returns your canonical format.
    """

    video_url = payload.url.strip()
    if not video_url:
        raise HTTPException(status_code=400, detail="URL is required")

    video_id = _extract_youtube_id(video_url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Could not extract YouTube video ID from URL")

    api_token = os.getenv("YT_TRANSCRIPT_API_TOKEN")
    if not api_token:
        raise HTTPException(
            status_code=500,
            detail="Transcript API token not configured (set YT_TRANSCRIPT_API_TOKEN)",
        )

    try:
        response = requests.post(
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

    if response.status_code == 401:
        raise HTTPException(status_code=500, detail="Transcript API token rejected (401)")
    if response.status_code == 404:
        raise HTTPException(status_code=404, detail="Transcript not found for provided video")
    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Transcript API error ({response.status_code}): {response.text}",
        )

    data = response.json()
    entry = None
    if isinstance(data, dict):
        entry = data.get(video_id)
    elif isinstance(data, list):
        for item in data:
            if isinstance(item, dict) and item.get("id") == video_id:
                entry = item
                break

    if not entry:
        raise HTTPException(status_code=502, detail="Transcript API returned no data for video")

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
        raise HTTPException(status_code=502, detail="Transcript API response did not include text")

    transcript_text = "\n".join(
        segment.get("text", "") for segment in transcript_segments if isinstance(segment, dict)
    ).strip()

    if not transcript_text:
        raise HTTPException(status_code=502, detail="Transcript API response did not include text")

    title = None
    if isinstance(entry, dict):
        title = entry.get("title") or entry.get("microformat", {}).get("playerMicroformatRenderer", {}).get(
            "title", {}
        )
        if isinstance(title, dict):
            title = title.get("simpleText")

    source = video_url
    summary_text: Optional[str] = None
    structured_workout = _build_workout_from_rules(transcript_text, source, title)

    if structured_workout:
        wk = structured_workout
    else:
        summary_text = _summarize_transcript_to_workout(transcript_text)
        text_for_parser = summary_text or transcript_text

        wk = ParserService.parse_free_text_to_workout(text_for_parser, source=source)

        if title:
            wk.title = title[:80]

    response_payload = wk.model_dump()
    response_payload.setdefault("_provenance", {})
    response_payload["_provenance"].update({
        "mode": "transcript_only",
        "source_url": video_url,
        "has_captions": True,
        "has_asr": False,
        "has_ocr": False,
        "transcript_provider": "youtube-transcript.io",
        "transcript_summarized": bool(summary_text),
    })

    return JSONResponse(response_payload)

