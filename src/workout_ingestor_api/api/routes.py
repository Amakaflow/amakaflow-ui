"""API routes for workout ingestion."""

import logging
import os
import shutil
import subprocess
import tempfile
import json
from datetime import datetime
from typing import Optional, Dict, List

import re

logger = logging.getLogger(__name__)
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
    Depends,
)
from fastapi.responses import JSONResponse, Response
from workout_ingestor_api.auth import get_current_user, get_optional_user
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
from workout_ingestor_api.services.pinterest_service import (
    PinterestService,
    PinterestServiceError,
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
    user_id: Optional[str] = None  # Optional user ID for tracking who ingested
    skip_cache: bool = False  # If True, bypass cache lookup (still saves to cache)


class InstagramTestRequest(BaseModel):
    url: str
    username: Optional[str] = None
    password: Optional[str] = None


class TikTokIngestRequest(BaseModel):
    url: str
    use_vision: bool = True  # Use GPT-4o Vision by default
    vision_provider: str = "openai"
    vision_model: Optional[str] = "gpt-4o-mini"
    mode: str = "oembed"  # "oembed" (default) | "auto" | "hybrid" | "audio_only" | "vision_only"


class PinterestIngestRequest(BaseModel):
    url: str
    vision_model: str = "gpt-4o-mini"  # Vision model for OCR + extraction


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
    user_id: Optional[str] = Depends(get_optional_user),
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

        # Ensure title is not None (Vision API may return null)
        if not workout_dict.get("title"):
            workout_dict["title"] = "Untitled Workout"

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
        logger.exception(f"Vision model extraction failed for {file.filename}: {exc}")
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


@router.post("/export/csv")
async def export_csv(
    workout: Workout,
    style: str = "strong",
):
    """
    Export workout as CSV format.

    Args:
        workout: Workout data to export
        style: CSV format style
            - "strong": Strong-compatible format for Hevy/HeavySet import (default)
            - "extended": AmakaFlow extended format with additional metadata

    Returns:
        CSV file download
    """
    try:
        if style == "extended":
            csv_bytes = ExportService.render_csv_extended(workout)
            filename = "workout_extended.csv"
        else:
            csv_bytes = ExportService.render_csv_strong(workout)
            filename = "workout_strong.csv"

        return Response(
            content=csv_bytes,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export/csv/bulk")
async def export_csv_bulk(
    workouts: list[Workout],
    style: str = "strong",
):
    """
    Export multiple workouts as a single CSV file.

    Args:
        workouts: List of workout data to export
        style: CSV format style ("strong" or "extended")

    Returns:
        CSV file download with all workouts merged
    """
    try:
        csv_bytes = ExportService.render_csv_bulk(workouts, style=style)
        filename = f"workouts_{style}.csv"

        return Response(
            content=csv_bytes,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export/json")
async def export_json(
    workout: Workout,
    include_metadata: bool = True,
    pretty: bool = True,
):
    """
    Export workout as JSON format.

    Args:
        workout: Workout data to export
        include_metadata: Include export metadata (timestamp, version)
        pretty: Pretty-print with indentation

    Returns:
        JSON file download
    """
    try:
        json_bytes = ExportService.render_json(
            workout,
            include_metadata=include_metadata,
            pretty=pretty,
        )
        return Response(
            content=json_bytes,
            media_type="application/json",
            headers={"Content-Disposition": 'attachment; filename="workout.json"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export/json/bulk")
async def export_json_bulk(
    workouts: list[Workout],
    include_metadata: bool = True,
    pretty: bool = True,
):
    """
    Export multiple workouts as a single JSON file.

    Args:
        workouts: List of workout data to export
        include_metadata: Include export metadata
        pretty: Pretty-print with indentation

    Returns:
        JSON file download with all workouts
    """
    try:
        json_bytes = ExportService.render_json_bulk(
            workouts,
            include_metadata=include_metadata,
            pretty=pretty,
        )
        return Response(
            content=json_bytes,
            media_type="application/json",
            headers={"Content-Disposition": 'attachment; filename="workouts.json"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export/pdf")
async def export_pdf(workout: Workout):
    """
    Export workout as PDF format.

    Requires reportlab to be installed.

    Returns:
        PDF file download
    """
    try:
        pdf_bytes = ExportService.render_pdf(workout)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="workout.pdf"'},
        )
    except RuntimeError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export/bulk/zip")
async def export_bulk_zip(
    workouts: list[Workout],
    formats: list[str] = None,
    csv_style: str = "strong",
):
    """
    Export multiple workouts as a ZIP archive.

    Args:
        workouts: List of workout data to export
        formats: List of formats to include (default: json, csv, text)
                 Options: json, csv, tcx, text, fit, pdf
        csv_style: CSV format style ('strong' or 'extended')

    Returns:
        ZIP file download with all workouts in specified formats
    """
    try:
        # Default formats if not specified
        if formats is None:
            formats = ["json", "csv", "text"]

        zip_bytes = ExportService.render_bulk_zip(
            workouts,
            formats=formats,
            csv_style=csv_style,
        )
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={"Content-Disposition": 'attachment; filename="workouts.zip"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# YouTube ingest – NEW logic
# ---------------------------------------------------------------------------

@router.post("/ingest/youtube")
async def ingest_youtube(payload: YouTubeTranscriptRequest):
    """
    Ingest workout from YouTube video with caching support.

    - Checks cache first for previously processed videos
    - If not cached, fetches transcript and processes with LLM
    - Caches successful results for future lookups

    Args:
        payload.url: YouTube video URL
        payload.user_id: Optional user ID for tracking who ingested
        payload.skip_cache: If True, bypass cache lookup (still saves to cache)
    """
    return await ingest_youtube_impl(
        video_url=payload.url,
        user_id=payload.user_id,
        skip_cache=payload.skip_cache
    )


@router.get("/youtube/cache/stats")
async def get_youtube_cache_stats():
    """
    Get YouTube workout cache statistics.

    Returns:
        total_cached: Number of cached workouts
        total_cache_hits: Total cache hits across all workouts
    """
    from workout_ingestor_api.services.youtube_cache_service import YouTubeCacheService

    stats = YouTubeCacheService.get_cache_stats()
    return JSONResponse(stats)


@router.get("/youtube/cache/{video_id}")
async def get_cached_youtube_workout(video_id: str):
    """
    Get a specific cached YouTube workout by video ID.

    Args:
        video_id: YouTube video ID (11 characters)

    Returns:
        Cached workout data or 404 if not found
    """
    from workout_ingestor_api.services.youtube_cache_service import YouTubeCacheService

    cached = YouTubeCacheService.get_cached_workout(video_id)
    if not cached:
        raise HTTPException(status_code=404, detail="Workout not found in cache")

    return JSONResponse(cached)


# ---------------------------------------------------------------------------
# TikTok ingest with Audio Transcription + Vision AI support
# ---------------------------------------------------------------------------


def _normalize_exercise_name(name: str) -> str:
    """Normalize exercise name for matching (lowercase, remove extra spaces)."""
    return re.sub(r'\s+', ' ', name.lower().strip())


def _merge_audio_and_vision_workouts(audio_dict: Dict, vision_dict: Dict) -> Dict:
    """
    Merge audio transcription and vision extraction results.

    Strategy:
    - Audio gives us: detailed notes/tips from narration
    - Vision gives us: on-screen reps, sets, exercise names

    We use audio as the base (better notes) and supplement with vision data
    for reps/sets when audio doesn't have them.
    """
    if not audio_dict or not audio_dict.get("blocks"):
        return vision_dict
    if not vision_dict or not vision_dict.get("blocks"):
        return audio_dict

    # Build a lookup of vision exercises by normalized name
    vision_exercises = {}
    for block in vision_dict.get("blocks", []):
        for ex in block.get("exercises", []):
            name = ex.get("name", "")
            if name:
                norm_name = _normalize_exercise_name(name)
                vision_exercises[norm_name] = ex

    # Merge: use audio as base, supplement with vision reps/sets
    merged_blocks = []
    for audio_block in audio_dict.get("blocks", []):
        merged_exercises = []
        for audio_ex in audio_block.get("exercises", []):
            merged_ex = dict(audio_ex)  # Copy audio exercise
            audio_name = audio_ex.get("name", "")

            # Try to find matching vision exercise
            norm_name = _normalize_exercise_name(audio_name)
            vision_ex = vision_exercises.get(norm_name)

            # Also try partial matches (e.g., "Incline Press" matches "Incline Smith Machine Press")
            if not vision_ex:
                for vname, vex in vision_exercises.items():
                    # Check if either name contains the other
                    if norm_name in vname or vname in norm_name:
                        vision_ex = vex
                        break
                    # Check word overlap
                    audio_words = set(norm_name.split())
                    vision_words = set(vname.split())
                    overlap = audio_words & vision_words
                    if len(overlap) >= 2:  # At least 2 words in common
                        vision_ex = vex
                        break

            if vision_ex:
                # Supplement with vision data if audio is missing it
                if merged_ex.get("reps") is None and vision_ex.get("reps") is not None:
                    merged_ex["reps"] = vision_ex["reps"]
                if merged_ex.get("reps_range") is None and vision_ex.get("reps_range") is not None:
                    merged_ex["reps_range"] = vision_ex["reps_range"]
                if merged_ex.get("sets") is None and vision_ex.get("sets") is not None:
                    merged_ex["sets"] = vision_ex["sets"]
                if merged_ex.get("duration_sec") is None and vision_ex.get("duration_sec") is not None:
                    merged_ex["duration_sec"] = vision_ex["duration_sec"]
                if merged_ex.get("distance_m") is None and vision_ex.get("distance_m") is not None:
                    merged_ex["distance_m"] = vision_ex["distance_m"]

            merged_exercises.append(merged_ex)

        merged_block = dict(audio_block)
        merged_block["exercises"] = merged_exercises
        merged_blocks.append(merged_block)

    result = dict(audio_dict)
    result["blocks"] = merged_blocks
    return result


def _extract_frames_for_vision(video_path: str, tmpdir: str) -> List[str]:
    """Extract and select frames for vision analysis."""
    # Use lower fps to spread frames across the entire video
    # 0.5fps (1 frame every 2 seconds) for up to 180 seconds = max 90 frames
    VideoService.sample_frames(video_path, tmpdir, fps=0.5, max_secs=180)

    all_frames = sorted([
        os.path.join(tmpdir, f) for f in os.listdir(tmpdir)
        if f.endswith('.png')
    ])

    # Sample evenly across the entire video (not just first N frames)
    # This ensures we capture exercises at the end of the video too
    max_frames = 25  # Limited by OpenAI token limits
    if len(all_frames) <= max_frames:
        return all_frames
    else:
        # Take evenly spaced frames from start to end
        step = len(all_frames) / max_frames
        return [all_frames[int(i * step)] for i in range(max_frames)]


@router.post("/ingest/tiktok")
async def ingest_tiktok(payload: TikTokIngestRequest):
    """
    Ingest workout from TikTok video.

    Modes:
    - "oembed" (default): Parse workout from oEmbed title/description (no video download)
    - "auto": Audio transcription first, vision fallback if no exercises found
    - "hybrid": Run both audio AND vision, merge results (best for on-screen text + narration)
    - "audio_only": Only use audio transcription
    - "vision_only": Only use vision frame analysis
    """
    from workout_ingestor_api.services.asr_service import ASRService
    from workout_ingestor_api.api.youtube_ingest import _parse_with_openai

    url = payload.url
    ingest_mode = payload.mode

    if not TikTokService.is_tiktok_url(url):
        raise HTTPException(status_code=400, detail="Invalid TikTok URL")

    # Get metadata via oEmbed (works for all modes)
    try:
        metadata = TikTokService.extract_metadata(url)
    except TikTokServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))

    api_key = os.getenv("OPENAI_API_KEY")

    # --- oEmbed mode: Parse title text without video download ---
    if ingest_mode == "oembed":
        workout_text = TikTokService.extract_text_from_description(metadata)

        if not workout_text or len(workout_text) < 20:
            raise HTTPException(
                status_code=400,
                detail="TikTok description doesn't contain enough workout information. Try mode='auto' for video analysis."
            )

        # Parse with LLM
        title = metadata.title.split('#')[0].strip() if metadata.title else "TikTok Workout"
        workout_dict = _parse_with_openai(workout_text, title[:80])

        # If LLM didn't find exercises and we have a thumbnail, try vision on thumbnail
        def has_exercises(wd):
            if not wd or not wd.get("blocks"):
                return False
            for block in wd.get("blocks", []):
                if block.get("exercises") and len(block.get("exercises", [])) > 0:
                    return True
            return False

        mode = "tiktok_oembed"

        if not has_exercises(workout_dict) and metadata.thumbnail_url and payload.use_vision:
            # Try vision on thumbnail as fallback
            tmpdir = tempfile.mkdtemp(prefix="tiktok_thumb_")
            try:
                thumb_path = TikTokService.download_thumbnail(
                    metadata.thumbnail_url, tmpdir, metadata.video_id
                )
                if thumb_path:
                    vision_dict = VisionService.extract_and_structure_workout_openai(
                        [thumb_path], model=payload.vision_model or "gpt-4o-mini", api_key=api_key
                    )
                    if has_exercises(vision_dict):
                        workout_dict = vision_dict
                        mode = "tiktok_oembed_vision"
            finally:
                shutil.rmtree(tmpdir, ignore_errors=True)

        # Post-process
        for block in workout_dict.get("blocks", []):
            block["structure"] = block.get("structure") or "regular"
            for ex in block.get("exercises", []):
                ex["type"] = ex.get("type") or "strength"

        workout_dict["title"] = workout_dict.get("title") or title or "TikTok Workout"
        workout = Workout(**workout_dict)
        workout.source = url

        response = workout.convert_to_new_structure().model_dump()
        response["_provenance"] = {
            "mode": mode,
            "video_id": metadata.video_id,
            "author": metadata.author_name,
        }
        return JSONResponse(response)

    # --- Video-based modes (auto, hybrid, audio_only, vision_only) ---
    tmpdir = tempfile.mkdtemp(prefix="tiktok_ingest_")

    try:
        video_path = TikTokService.download_video(url, tmpdir)
        if not video_path:
            raise HTTPException(status_code=400, detail="Could not download video. Try mode='oembed' instead.")

        audio_dict = None
        vision_dict = None
        mode = "tiktok_vision"

        # Helper to check if workout has exercises
        def has_exercises(wd):
            if not wd or not wd.get("blocks"):
                return False
            for block in wd.get("blocks", []):
                if block.get("exercises") and len(block.get("exercises", [])) > 0:
                    return True
            return False

        # --- Audio Transcription ---
        if ingest_mode in ("auto", "hybrid", "audio_only"):
            try:
                audio_path = ASRService.extract_audio(video_path)
                transcript_result = ASRService.transcribe_with_openai_api(audio_path, api_key)
                transcript = transcript_result.get("text", "")

                if transcript and len(transcript) > 50:  # Meaningful transcript
                    # Use the same LLM parsing as YouTube
                    title = metadata.title or "TikTok Workout"
                    audio_dict = _parse_with_openai(transcript, title)

                # Clean up audio file
                if os.path.exists(audio_path):
                    os.remove(audio_path)
            except Exception as e:
                # Audio transcription failed
                if ingest_mode == "audio_only":
                    raise HTTPException(status_code=500, detail=f"Audio transcription failed: {e}")

        # --- Vision Analysis ---
        run_vision = (
            ingest_mode == "vision_only" or
            ingest_mode == "hybrid" or
            (ingest_mode == "auto" and not has_exercises(audio_dict))
        )

        if run_vision:
            frame_files = _extract_frames_for_vision(video_path, tmpdir)
            if frame_files:
                # Use gpt-4o for better vision capabilities
                vision_dict = VisionService.extract_and_structure_workout_openai(
                    frame_files, model="gpt-4o", api_key=api_key
                )

        # --- Determine final workout and mode ---
        if ingest_mode == "hybrid" and has_exercises(audio_dict) and has_exercises(vision_dict):
            # Merge audio and vision results
            workout_dict = _merge_audio_and_vision_workouts(audio_dict, vision_dict)
            mode = "tiktok_hybrid"
        elif ingest_mode == "audio_only" or (ingest_mode == "auto" and has_exercises(audio_dict)):
            workout_dict = audio_dict
            mode = "tiktok_transcript"
        elif has_exercises(vision_dict):
            workout_dict = vision_dict
            mode = "tiktok_vision"
        elif has_exercises(audio_dict):
            workout_dict = audio_dict
            mode = "tiktok_transcript"
        else:
            # No exercises found from either source
            workout_dict = {"title": metadata.title or "TikTok Workout", "blocks": []}
            mode = "tiktok_empty"

        # Post-process
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
            "mode": mode,
            "video_id": metadata.video_id,
            "author": metadata.author_name,
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


# ---------------------------------------------------------------------------
# Multi-workout plan detection and splitting
# ---------------------------------------------------------------------------

# Patterns that indicate a block is a separate workout day
DAY_OF_WEEK_PATTERN = re.compile(
    r'^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$',
    re.IGNORECASE
)
DAY_NUMBER_PATTERN = re.compile(
    r'^day\s*\d+$',
    re.IGNORECASE
)
WEEK_DAY_PATTERN = re.compile(
    r'^week\s*\d+.*day\s*\d+$',
    re.IGNORECASE
)


def detect_multi_workout_plan(workout_dict: dict) -> dict:
    """
    Detect if a workout contains multiple separate workouts (e.g., a weekly plan).

    Returns:
        dict with:
        - is_multi_workout_plan: bool
        - workout_count: int (number of separate workouts detected)
        - split_reason: str (why it was detected as multi-workout)
        - block_labels: list of detected day/workout labels
    """
    blocks = workout_dict.get("blocks", [])

    if len(blocks) <= 1:
        return {
            "is_multi_workout_plan": False,
            "workout_count": 1,
            "split_reason": None,
            "block_labels": [],
        }

    day_labels = []
    for block in blocks:
        label = block.get("label", "").strip()
        if DAY_OF_WEEK_PATTERN.match(label):
            day_labels.append(("day_of_week", label))
        elif DAY_NUMBER_PATTERN.match(label):
            day_labels.append(("day_number", label))
        elif WEEK_DAY_PATTERN.match(label):
            day_labels.append(("week_day", label))

    # If most blocks have day-like labels, it's a multi-workout plan
    if len(day_labels) >= len(blocks) * 0.7:  # 70% threshold
        pattern_type = day_labels[0][0] if day_labels else "unknown"
        return {
            "is_multi_workout_plan": True,
            "workout_count": len(day_labels),
            "split_reason": f"Detected {pattern_type} pattern in block labels",
            "block_labels": [label for _, label in day_labels],
        }

    return {
        "is_multi_workout_plan": False,
        "workout_count": 1,
        "split_reason": None,
        "block_labels": [],
    }


def split_multi_workout_plan(workout_dict: dict, base_title: str, source_url: str) -> list:
    """
    Split a multi-workout plan into individual workouts.

    Each block becomes its own workout with the block label as part of the title.

    Returns:
        list of individual workout dicts
    """
    blocks = workout_dict.get("blocks", [])
    provenance = workout_dict.get("_provenance", {})

    individual_workouts = []
    for i, block in enumerate(blocks):
        block_label = block.get("label", f"Day {i + 1}")

        # Create a new workout from this single block
        # Change the block label to "Workout" since it's now standalone
        new_block = block.copy()
        new_block["label"] = "Workout"

        individual_workout = {
            "title": f"{base_title} - {block_label}",
            "source": source_url,
            "blocks": [new_block],
            "_provenance": {
                **provenance,
                "original_title": base_title,
                "split_from_multi_workout": True,
                "original_block_label": block_label,
                "workout_index": i + 1,
                "total_workouts": len(blocks),
            }
        }
        individual_workouts.append(individual_workout)

    return individual_workouts


# ---------------------------------------------------------------------------
# Pinterest ingest with Vision AI for workout infographics
# ---------------------------------------------------------------------------


@router.post("/ingest/pinterest")
async def ingest_pinterest(payload: PinterestIngestRequest):
    """
    Ingest workout from Pinterest pin or board URL.

    Supports:
    - Single pin URLs: pinterest.com/pin/xxxxx, pin.it/xxxxx
    - Board URLs: pinterest.com/username/boardname (processes up to 20 pins)

    Uses Vision AI (GPT-4o-mini by default) to extract workout data
    from fitness infographic images.

    Args:
        payload.url: Pinterest pin or board URL
        payload.vision_model: Vision model to use (default: gpt-4o-mini)

    Returns:
        Extracted workout(s) with provenance metadata
    """
    url = payload.url
    vision_model = payload.vision_model

    service = PinterestService()

    try:
        # Determine if this is a board or single pin
        if service.is_board_url(url):
            result = await service.ingest_board(url, limit=20, vision_model=vision_model)
        else:
            result = await service.ingest_pin(url, vision_model=vision_model)

        if not result.success:
            error_msg = result.errors[0] if result.errors else "Failed to ingest Pinterest content"
            raise HTTPException(
                status_code=400,
                detail=error_msg
            )

        # Build response with all workouts
        workouts = []
        for workout_data in result.workouts:
            try:
                # Get metadata from workout data
                pin_id = workout_data.get("pin_id", "")
                source_url = workout_data.get("source_url", url)
                confidence = workout_data.get("confidence", 0)
                metadata = workout_data.get("metadata", {})

                # Create Workout object with only valid fields
                workout = Workout(
                    title=workout_data.get("title", "Pinterest Workout"),
                    source=source_url,
                    blocks=workout_data.get("blocks", []),
                )
                workout_dict = workout.convert_to_new_structure().model_dump()
                workout_dict["_provenance"] = {
                    "mode": "pinterest_vision",
                    "pin_id": pin_id,
                    "pin_url": source_url,
                    "title": workout_data.get("title"),
                    "description": metadata.get("pin_description"),
                    "vision_model": vision_model,
                    "confidence": confidence,
                    "extraction_method": metadata.get("extraction_method"),
                    "is_carousel": metadata.get("is_carousel", False),
                    "carousel_index": metadata.get("carousel_index"),
                    "carousel_total": metadata.get("carousel_total"),
                }
                workouts.append(workout_dict)
            except Exception as e:
                logger.warning(f"Failed to process workout: {e}", exc_info=True)
                logger.debug(f"Workout data that failed: {workout_data}")
                continue

        if len(workouts) == 1:
            workout = workouts[0]
            # Check if this single workout contains multiple separate workouts (e.g., weekly plan)
            multi_workout_info = detect_multi_workout_plan(workout)

            if multi_workout_info["is_multi_workout_plan"]:
                # Split into individual workouts
                base_title = workout.get("title", "Pinterest Workout")
                individual_workouts = split_multi_workout_plan(workout, base_title, url)

                logger.info(
                    f"Pinterest: Detected multi-workout plan with {len(individual_workouts)} workouts "
                    f"({multi_workout_info['split_reason']})"
                )

                return JSONResponse({
                    "workouts": individual_workouts,
                    "total": len(individual_workouts),
                    "source_url": url,
                    "_provenance": {
                        "mode": "pinterest_multi_workout",
                        "pin_id": workout.get("_provenance", {}).get("pin_id"),
                        "original_title": base_title,
                        "split_reason": multi_workout_info["split_reason"],
                        "workout_labels": multi_workout_info["block_labels"],
                    }
                })
            else:
                # Single workout from single pin - return directly
                return JSONResponse(workout)
        elif len(workouts) > 1:
            # Board - return array of workouts
            return JSONResponse({
                "workouts": workouts,
                "total": len(workouts),
                "source_url": url,
                "_provenance": {
                    "mode": "pinterest_board",
                    "pins_processed": result.pins_processed,
                    "pins_with_workouts": len(workouts),
                }
            })
        else:
            # No workouts found
            raise HTTPException(
                status_code=422,
                detail="No workout content could be extracted from the Pinterest image(s)"
            )

    except PinterestServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Pinterest ingestion failed: {str(e)}"
        )


@router.get("/pinterest/metadata")
async def get_pinterest_metadata(url: str):
    """
    Get metadata for a Pinterest pin without full workout extraction.

    Useful for previewing pin info before ingesting.

    Args:
        url: Pinterest pin URL

    Returns:
        Pin metadata (title, description, image_url, etc.)
    """
    service = PinterestService()

    try:
        # Resolve short URL if needed
        resolved_url = await service._resolve_short_url(url)

        # Get pin metadata (returns PinterestPin dataclass)
        pin = await service._get_pin_metadata(resolved_url)

        if not pin:
            raise HTTPException(
                status_code=404,
                detail="Could not fetch Pinterest pin metadata"
            )

        return JSONResponse({
            "url": url,
            "resolved_url": resolved_url,
            "pin_id": pin.pin_id,
            "title": pin.title,
            "description": pin.description,
            "image_url": pin.image_url,
        })

    except PinterestServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))