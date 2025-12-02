"""API routes for workout ingestion."""

import os
import shutil
import subprocess
import tempfile
import json
from datetime import datetime
from typing import Optional, Dict, List

import re
import requests
from urllib.parse import urlparse, parse_qs

from fastapi import (
    APIRouter,
    UploadFile,
    File,
    Form,
    Body,
    HTTPException,
    Query,
)
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from workout_ingestor_api.models import Workout, Block, Exercise
from workout_ingestor_api.services.ocr_service import OCRService
from workout_ingestor_api.services.parser_service import ParserService
from workout_ingestor_api.services.video_service import VideoService
from workout_ingestor_api.services.export_service import ExportService
from workout_ingestor_api.services.instagram_service import (
    InstagramService,
    InstagramServiceError,
)
from workout_ingestor_api.services.tiktok_service import (
    TikTokService,
    TikTokServiceError,
)
from workout_ingestor_api.services.vision_service import VisionService
from workout_ingestor_api.services.llm_service import LLMService
from workout_ingestor_api.services.feedback_service import FeedbackService
from workout_ingestor_api.api.youtube_ingest import ingest_youtube_impl
# ---------------------------------------------------------------------------
# Build / git metadata
# ---------------------------------------------------------------------------

BUILD_TIMESTAMP = datetime.now().isoformat()


def get_git_info():
    """Get git commit hash and timestamp if available."""
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--format=%H|%ci", "--date=iso"],
            cwd=os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            capture_output=True,
            text=True,
            timeout=2,
        )
        if result.returncode == 0 and result.stdout.strip():
            commit, date = result.stdout.strip().split("|", 1)
            return {
                "commit": commit,
                "commit_short": commit[:7],
                "commit_date": date,
            }
    except Exception:
        pass
    return None


GIT_INFO = get_git_info()

router = APIRouter()

# ---------------------------------------------------------------------------
# Small helper models
# ---------------------------------------------------------------------------


class YouTubeTranscriptRequest(BaseModel):
    url: str


class InstagramTestRequest(BaseModel):
    url: str
    username: Optional[str] = None
    password: Optional[str] = None


class TikTokIngestRequest(BaseModel):
    url: str
    use_vision: bool = True  # Use GPT-4o Vision by default
    vision_provider: str = "openai"
    vision_model: Optional[str] = "gpt-4o-mini"


class NotWorkoutFeedback(BaseModel):
    text: str
    block_label: Optional[str] = None
    source: Optional[str] = None


class JunkPatternFeedback(BaseModel):
    text: str
    reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------


def _extract_youtube_id(url: Optional[str]) -> Optional[str]:
    """Extract YouTube video ID from a full URL or a bare ID."""
    if not url:
        return None

    parsed = urlparse(url)

    # youtu.be/<id>
    if parsed.hostname in {"youtu.be"}:
        video_id = parsed.path.lstrip("/")
        return video_id or None

    # youtube.com/watch?v=<id> or embed URLs
    if parsed.hostname and "youtube" in parsed.hostname:
        query = parse_qs(parsed.query)
        if "v" in query and query["v"]:
            return query["v"][0]

        # /embed/<id>
        parts = parsed.path.split("/")
        if "embed" in parts and len(parts) >= 3:
            idx = parts.index("embed")
            if idx + 1 < len(parts):
                return parts[idx + 1] or None

    # Already looks like an ID?
    if len(url) == 11 and " " not in url:
        return url

    return None


def _filter_transcript_for_workout(text: str) -> str:
    """
    Heuristic filter to keep only workout-looking lines from a transcript.

    This is deliberately strict to avoid turning lyrics into 'interval' exercises.
    A line is kept only if:
      - it does NOT contain music/applause markers
      AND
      - it has at least one digit OR
      - it contains an obvious exercise keyword OR
      - it contains a programming keyword (sets, reps, rounds, rest, etc.)
    """

    EXERCISE_KEYWORDS = [
        "squat",
        "lunges",
        "lunge",
        "press",
        "bench",
        "push-up",
        "pushup",
        "pull-up",
        "pullup",
        "row",
        "deadlift",
        "rdl",
        "curl",
        "extension",
        "raise",
        "plank",
        "crunch",
        "situp",
        "sit-up",
        "burpee",
        "jumping jack",
        "jumping jacks",
        "mountain climber",
        "kettlebell",
        "dumbbell",
        "barbell",
        "hip thrust",
        "step up",
        "wall ball",
        "sled",
        "farmer carry",
        "carry",
        "run",
        "jog",
        "treadmill",
        "push press",
        "snatch",
        "clean",
    ]

    PROGRAMMING_KEYWORDS = [
        "set",
        "sets",
        "rep",
        "reps",
        "round",
        "rounds",
        "interval",
        "tabata",
        "emom",
        "amrap",
        "for time",
        "rest",
        "recover",
        "seconds",
        "second",
        "sec",
        "minute",
        "minutes",
        "min",
    ]

    NOISE_MARKERS = [
        "[music",
        "music]",
        "music [",
        "applause",
        "[applause",
        "applause]",
        "[laughter",
        "laughter]",
    ]

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    kept: list[str] = []

    for ln in lines:
        lower = ln.lower()

        # Skip obvious noise (music / applause / laughter)
        if any(marker in lower for marker in NOISE_MARKERS):
            continue

        has_digit = any(ch.isdigit() for ch in ln)
        has_exercise_kw = any(kw in lower for kw in EXERCISE_KEYWORDS)
        has_programming_kw = any(kw in lower for kw in PROGRAMMING_KEYWORDS)

        # STRICT filter: only keep if it looks at least a bit like a workout line
        if not (has_digit or has_exercise_kw or has_programming_kw):
            # Likely lyrics or random chatter
            continue

        kept.append(ln)

    return "\n".join(kept)


# ---------------------------------------------------------------------------
# Version / health
# ---------------------------------------------------------------------------


@router.get("/version")
async def get_version():
    """Get API version and build information."""
    version_info = {
        "service": "workout-ingestor-api",
        "build_timestamp": BUILD_TIMESTAMP,
        "build_date": BUILD_TIMESTAMP,
    }
    if GIT_INFO:
        version_info.update(
            {
                "git_commit": GIT_INFO["commit"],
                "git_commit_short": GIT_INFO["commit_short"],
                "git_commit_date": GIT_INFO["commit_date"],
            }
        )
    return JSONResponse(version_info)


@router.get("/health")
def health():
    """Health check endpoint."""
    return {"ok": True}


# ---------------------------------------------------------------------------
# Basic helpers / WGER / manual workout
# ---------------------------------------------------------------------------


@router.post("/workouts/create-empty")
def create_empty_workout():
    """Create an empty workout structure for manual creation."""
    empty_workout = Workout(
        title="New Workout",
        source="manual",
        blocks=[
            Block(
                label="Workout",
                structure=None,
                exercises=[],
                rounds=None,
                sets=None,
                time_cap_sec=None,
                time_work_sec=None,
                time_rest_sec=None,
                rest_between_rounds_sec=None,
                rest_between_sets_sec=None,
            )
        ],
    )
    return empty_workout.model_dump()


@router.get("/exercises/wger")
def get_wger_exercises():
    """Get all exercises from WGER API with disk caching."""
    from workout_ingestor_api.services.wger_service import get_all_exercises
    import traceback

    try:
        exercises = get_all_exercises()
        return {"exercises": exercises, "count": len(exercises)}
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"Error fetching WGER exercises: {error_trace}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch WGER exercises: {str(e)}",
        )


# ---------------------------------------------------------------------------
# Ingest: text / json / AI-workout / freeform → canonical
# ---------------------------------------------------------------------------


@router.post("/ingest/text")
async def ingest_text(
    text: str = Form(...),
    source: Optional[str] = Form(None),
    return_filtered: bool = Form(False),
):
    """Ingest workout from plain text."""
    result = ParserService.parse_free_text_to_workout(
        text, source, return_filtered=return_filtered
    )
    if return_filtered:
        workout, filtered_items = result
        workout = workout.convert_to_new_structure()
        response = workout.model_dump()
        response["_filtered_items"] = filtered_items
        return JSONResponse(response)
    else:
        workout = result.convert_to_new_structure()
        return JSONResponse(workout.model_dump())


@router.post("/ingest/json")
async def ingest_json(workout_data: Dict = Body(...)):
    """
    Ingest workout directly from JSON format (bypasses text parsing).
    """
    try:
        parsed = ParserService.parse_json_workout(json.dumps(workout_data))
        workout = Workout.model_validate(parsed, strict=False)
        workout = workout.convert_to_new_structure()

        response_dict = workout.model_dump()
        response_dict.setdefault("_provenance", {})
        response_dict["_provenance"].update(
            {
                "mode": "json_direct",
                "api_build_timestamp": BUILD_TIMESTAMP,
            }
        )
        if GIT_INFO:
            response_dict["_provenance"]["api_git_commit"] = GIT_INFO["commit_short"]

        return JSONResponse(response_dict)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error processing JSON workout: {str(e)}"
        )


@router.post("/ingest/ai_workout")
async def ingest_ai_workout(text: str = Body(..., media_type="text/plain")):
    """Ingest AI/ChatGPT-generated workout with formatted structure."""
    wk = ParserService.parse_ai_workout(text, "ai_generated")
    wk = wk.convert_to_new_structure()
    return JSONResponse(content=wk.model_dump(), media_type="application/json")


@router.post("/transform/freeform-to-canonical")
async def transform_freeform_to_canonical(text: str = Body(..., media_type="text/plain")):
    """Transform free-form workout text into canonical format."""
    try:
        canonical_text = ParserService.transformFreeformToCanonical(text)
        return JSONResponse(content={"canonical_text": canonical_text})
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to transform free-form text: {str(e)}",
        )


# ---------------------------------------------------------------------------
# Ingest: images (OCR or Vision)
# ---------------------------------------------------------------------------


@router.post("/ingest/image")
async def ingest_image(
    file: UploadFile = File(...),
    return_filtered: bool = Form(False),
):
    """Ingest workout from image using OCR."""
    b = await file.read()
    text = OCRService.ocr_image_bytes(b, fast_mode=True)

    print("=== OCR TEXT DEBUG ===")
    print(f"Full OCR text ({len(text)} chars):")
    print(text)
    print("=== END OCR TEXT ===")

    result = ParserService.parse_free_text_to_workout(
        text, source=f"image:{file.filename}", return_filtered=return_filtered
    )
    if return_filtered:
        workout, filtered_items = result
        workout = workout.convert_to_new_structure()
        response = workout.model_dump()
        response["_filtered_items"] = filtered_items
        return JSONResponse(response)
    else:
        workout = result.convert_to_new_structure()
        return JSONResponse(workout.model_dump())


@router.post("/ingest/image_vision")
async def ingest_image_vision(
    file: UploadFile = File(...),
    vision_provider: str = Form("openai"),
    vision_model: Optional[str] = Form(None),
    openai_api_key: Optional[str] = Form(None),
):
    """
    Ingest workout from image using a Vision model (OpenAI/Anthropic).
    """
    tmpdir = tempfile.mkdtemp(prefix="ingest_image_vision_")

    try:
        image_path = os.path.join(tmpdir, file.filename or "image.jpg")
        b = await file.read()
        with open(image_path, "wb") as f:
            f.write(b)

        provider = (vision_provider or "openai").lower()

        if provider == "openai":
            api_key = (
                openai_api_key.strip()
                if openai_api_key and openai_api_key.strip()
                else os.getenv("OPENAI_API_KEY")
            )
            if not api_key:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "OpenAI API key required. Set OPENAI_API_KEY or pass "
                        "openai_api_key parameter."
                    ),
                )

            model = (
                vision_model.strip()
                if vision_model and vision_model.strip()
                else "gpt-4o-mini"
            )

            workout_dict = VisionService.extract_and_structure_workout_openai(
                [image_path],
                model=model,
                api_key=api_key,
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown vision provider: {provider}. Use 'openai'.",
            )

        # Normalize a few fields
        for block in workout_dict.get("blocks", []):
            structure = block.get("structure")
            if structure:
                sl = str(structure).lower().strip()
                mapping = {
                    "for time": "for-time",
                    "for-time": "for-time",
                    "for_time": "for-time",
                    "fortime": "for-time",
                    "superset": "superset",
                    "circuit": "circuit",
                    "tabata": "tabata",
                    "emom": "emom",
                    "amrap": "amrap",
                    "rounds": "rounds",
                    "sets": "sets",
                    "regular": "regular",
                }
                block["structure"] = mapping.get(sl, structure)

            for ex in block.get("exercises", []):
                if not ex.get("type"):
                    ex["type"] = "strength"

        workout = Workout(**workout_dict)
        workout = workout.convert_to_new_structure()
        workout.source = f"image:{file.filename}"

        response_dict = workout.model_dump()
        response_dict.setdefault("_provenance", {})
        response_dict["_provenance"].update(
            {
                "mode": "image_vision",
                "provider": provider,
                "model": vision_model or "gpt-4o-mini",
                "source_file": file.filename,
                "api_build_timestamp": BUILD_TIMESTAMP,
            }
        )
        if GIT_INFO:
            response_dict["_provenance"]["api_git_commit"] = GIT_INFO["commit_short"]

        return JSONResponse(response_dict)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Vision model extraction failed: {str(exc)}",
        ) from exc
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


# ---------------------------------------------------------------------------
# Ingest: generic URL (non-YouTube)
# ---------------------------------------------------------------------------


@router.post("/ingest/url")
async def ingest_url(url: str = Body(..., embed=True)):
    """Ingest workout from generic video URL."""
    instagram_post_pattern = re.compile(r"instagram\.com/p/([A-Za-z0-9_-]+)")
    instagram_reel_pattern = re.compile(r"instagram\.com/reel/([A-Za-z0-9_-]+)")
    instagram_tv_pattern = re.compile(r"instagram\.com/tv/([A-Za-z0-9_-]+)")

    is_instagram_post = bool(instagram_post_pattern.search(url))
    is_instagram_video = bool(
        instagram_reel_pattern.search(url) or instagram_tv_pattern.search(url)
    )

    try:
        title, desc, dl_url = VideoService.extract_video_info(url)
    except Exception as e:
        error_str = str(e)
        if (
            is_instagram_post
            and not is_instagram_video
            and ("no video" in error_str.lower() or "instagram" in error_str.lower())
        ):
            raise HTTPException(
                status_code=400,
                detail=(
                    "Instagram image posts are not supported by this endpoint. "
                    "Use /ingest/instagram_test instead."
                ),
            )
        raise HTTPException(status_code=400, detail=f"Could not read URL: {e}")

    collected_text = f"{title}\n{desc}".strip()
    ocr_text = ""

    if dl_url:
        tmpdir = tempfile.mkdtemp(prefix="ingest_url_")
        try:
            video_path = os.path.join(tmpdir, "video.mp4")
            subprocess.run(
                [
                    "ffmpeg",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-y",
                    "-i",
                    dl_url,
                    "-t",
                    "30",
                    "-an",
                    video_path,
                ],
                check=True,
            )
            VideoService.sample_frames(video_path, tmpdir, fps=0.75, max_secs=25)
            ocr_text = OCRService.ocr_many_images_to_text(tmpdir, fast_mode=True)
        except subprocess.CalledProcessError:
            pass
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    merged_text = "\n".join(t for t in [collected_text, ocr_text] if t).strip()
    if not merged_text:
        raise HTTPException(
            status_code=422, detail="No text found in video or description"
        )

    wk = ParserService.parse_free_text_to_workout(merged_text, source=url)
    if title:
        wk.title = title[:80]
    return JSONResponse(wk.convert_to_new_structure().model_dump())


# ---------------------------------------------------------------------------
# Ingest: Instagram image posts
# ---------------------------------------------------------------------------


@router.post("/ingest/instagram_test")
async def ingest_instagram_test(payload: InstagramTestRequest):
    """Instagram ingestion endpoint using OCR on images."""
    tmpdir = tempfile.mkdtemp(prefix="instagram_ingest_")

    try:
        username_valid = payload.username and payload.username.strip()
        password_valid = payload.password and payload.password.strip()
        use_login = bool(username_valid and password_valid)

        if use_login:
            image_paths = InstagramService.download_post_images(
                username=payload.username,
                password=payload.password,
                url=payload.url,
                target_dir=tmpdir,
            )
        else:
            image_paths = InstagramService.download_post_images_no_login(
                url=payload.url,
                target_dir=tmpdir,
            )
    except InstagramServiceError as exc:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(
            status_code=500, detail=f"Instagram ingestion failed: {exc}"
        ) from exc

    from concurrent.futures import ThreadPoolExecutor, as_completed

    def process_image(image_path: str) -> Optional[str]:
        try:
            with open(image_path, "rb") as f:
                extracted = OCRService.ocr_image_bytes(f.read(), fast_mode=True).strip()
                return extracted or None
        except Exception:
            return None

    text_segments = []
    try:
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {executor.submit(process_image, p): p for p in image_paths}
            for future in as_completed(futures, timeout=90):
                try:
                    result = future.result(timeout=30)
                    if result:
                        text_segments.append(result)
                except Exception:
                    continue
    except Exception:
        # Timeout or other issue: just use whatever we have
        pass

    if not text_segments:
        shutil.rmtree(tmpdir, ignore_errors=True)
        raise HTTPException(
            status_code=422,
            detail=(
                "OCR could not extract text from Instagram images. "
                "The images may be too low quality or contain no readable text."
            ),
        )

    shutil.rmtree(tmpdir, ignore_errors=True)

    merged = "\n".join(text_segments)
    workout, filtered_items = ParserService.parse_free_text_to_workout(
        merged, source=payload.url, return_filtered=True
    )

    response_payload = workout.convert_to_new_structure().model_dump()
    response_payload.setdefault("_provenance", {})
    response_payload["_provenance"].update(
        {
            "mode": "instagram_image_test",
            "source_url": payload.url,
            "image_count": len(image_paths),
            "extraction_method": "ocr",
        }
    )
    response_payload["_filtered_items"] = filtered_items

    return JSONResponse(response_payload)


# ---------------------------------------------------------------------------
# Export routes
# ---------------------------------------------------------------------------


@router.post("/export/tp_text")
async def export_tp_text(workout: Workout):
    """Export workout as TrainingPeaks text format."""
    txt = ExportService.render_text_for_tp(workout)
    return Response(
        content=txt,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="workout.txt"'},
    )


@router.post("/export/tcx")
async def export_tcx(workout: Workout):
    """Export workout as TCX format."""
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


# ---------------------------------------------------------------------------
# YouTube ingest – NEW logic
# ---------------------------------------------------------------------------

@router.post("/ingest/youtube")
async def ingest_youtube(payload: YouTubeTranscriptRequest):
    """Thin wrapper that delegates to youtube_ingest.ingest_youtube_impl."""
    return await ingest_youtube_impl(payload.url)


# ---------------------------------------------------------------------------
# TikTok ingest with Vision AI support
# ---------------------------------------------------------------------------

@router.post("/ingest/tiktok")
async def ingest_tiktok(payload: TikTokIngestRequest):
    """Ingest workout from TikTok video using Vision AI only."""
    url = payload.url
    
    if not TikTokService.is_tiktok_url(url):
        raise HTTPException(status_code=400, detail="Invalid TikTok URL")
    
    tmpdir = tempfile.mkdtemp(prefix="tiktok_ingest_")
    
    try:
        metadata = TikTokService.extract_metadata(url)
        
        video_path = TikTokService.download_video(url, tmpdir)
        if not video_path:
            raise HTTPException(status_code=400, detail="Could not download video")
        
        VideoService.sample_frames(video_path, tmpdir, fps=0.2, max_secs=30)
        
        frame_files = sorted([
            os.path.join(tmpdir, f) for f in os.listdir(tmpdir)
            if f.endswith('.png')
        ])[:5]
        
        api_key = os.getenv("OPENAI_API_KEY")
        
        workout_dict = VisionService.extract_and_structure_workout_openai(
            frame_files, model="gpt-4o-mini", api_key=api_key
        )
        
        for block in workout_dict.get("blocks", []):
            block["structure"] = block.get("structure") or "regular"
            for ex in block.get("exercises", []):
                ex["type"] = ex.get("type") or "strength"
        
        workout_dict["title"] = workout_dict.get("title") or metadata.title or "TikTok Workout"
        workout = Workout(**workout_dict)
        workout.source = url
        
        if metadata.title:
            clean_title = re.sub(r'#\w+\s*', '', metadata.title).strip()
            if clean_title and (not workout.title or workout.title == "Imported Workout"):
                workout.title = clean_title[:80]
        
        response = workout.convert_to_new_structure().model_dump()
        response["_provenance"] = {
            "mode": "tiktok_vision",
            "video_id": metadata.video_id,
            "author": metadata.author_name,
            "frames": len(frame_files)
        }
        return JSONResponse(response)
        
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


@router.get("/tiktok/metadata")
async def get_tiktok_metadata(url: str):
    """
    Get metadata for a TikTok video without full ingestion.
    
    Useful for previewing video info before ingesting.
    
    Args:
        url: TikTok video URL
        
    Returns:
        Video metadata (title, author, thumbnail, etc.)
    """
    if not TikTokService.is_tiktok_url(url):
        raise HTTPException(
            status_code=400,
            detail="Invalid TikTok URL"
        )
    
    try:
        metadata = TikTokService.extract_metadata(url)
        return JSONResponse(metadata.to_dict())
    except TikTokServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))