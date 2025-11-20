"""API routes for workout ingestion."""
import os
import shutil
import subprocess
import tempfile
from typing import Optional, Dict
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
from app.services.vision_service import VisionService
from app.services.llm_service import LLMService

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


def _structure_workout_from_transcript_with_llm(transcript_text: str, provider: str = "openai") -> Optional[Dict]:
    """
    Use LLM to directly structure a workout from a YouTube transcript.
    Returns a structured workout dictionary.
    """
    try:
        # Use LLMService to structure the workout directly
        structured = LLMService.structure_workout(
            transcript_text[:12000],  # Limit transcript length
            provider=provider
        )
        return structured
    except Exception as e:
        print(f"LLM structuring failed: {e}")
        return None


def _extract_workout_from_transcript_with_llm(transcript_text: str) -> Optional[str]:
    """
    Use LLM to extract a concise workout summary from a YouTube transcript.
    Returns a structured text format that can be parsed by ParserService.
    """
    extraction_prompt = """You are extracting workout exercises from a YouTube fitness video transcript.

The transcript contains conversational text mixed with actual workout information. Your task is to extract ONLY the exercises mentioned with their sets, reps, and any relevant details.

Extract exercises in this format (one per line):
Exercise Name: sets x reps
Exercise Name: sets x reps, notes

Examples:
Overhead Press: 2 sets x 4 reps
Wide Grip Pull-Up: 3 sets x 6 reps, with 30lb dumbbell
Close Grip Bench Press: 2 sets x 10-12 reps
Seated Cable Row: 3 sets x 12 reps
Incline Dumbbell Lateral Raise: 3 sets x 15 reps
Face Pulls: 3 sets x 20 reps
Supinated Dumbbell Curl: 3 sets x 12 reps

CRITICAL RULES:
1. Only extract actual EXERCISES (movements like presses, pulls, rows, curls, raises, squats, deadlifts, etc.)
2. IGNORE all conversational text, explanations, technique tips, greetings, sign-offs, and non-exercise content
3. Extract sets and reps when mentioned (e.g., "3 sets of 6 reps", "2 sets x 10 reps", "three sets of four")
4. If an exercise is mentioned multiple times, only include it once with the most complete information
5. Group exercises that are supersetted together on the same line separated by " / "
6. If sets/reps aren't mentioned, just list the exercise name
7. Do NOT include warm-up activities, stretching, or non-exercise movements unless they're part of the workout

Common exercise patterns to look for:
- "X sets of Y reps on [exercise]"
- "doing [exercise] for X sets"
- "next we're doing [exercise]"
- "[exercise]: X sets x Y reps"

Return ONLY the exercise list, one exercise per line, no additional text or explanations."""

    try:
        # Try OpenAI first if available
        if os.getenv("OPENAI_API_KEY"):
            client = __import__("openai").OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": extraction_prompt},
                    {"role": "user", "content": f"Transcript:\n\n{transcript_text[:8000]}"}  # Limit to avoid token limits
                ],
                temperature=0.1,
                max_tokens=1000,
            )
            extracted = response.choices[0].message.content.strip()
            if extracted and len(extracted) > 20:  # Basic validation
                return extracted
    except Exception as e:
        print(f"OpenAI extraction failed: {e}")
    
    # Fallback: try Anthropic if available
    try:
        if os.getenv("ANTHROPIC_API_KEY"):
            anthropic = __import__("anthropic").Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
            message = anthropic.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1000,
                messages=[
                    {"role": "user", "content": f"{extraction_prompt}\n\nTranscript:\n\n{transcript_text[:8000]}"}
                ],
                temperature=0.1,
            )
            extracted = message.content[0].text.strip()
            if extracted and len(extracted) > 20:  # Basic validation
                return extracted
    except Exception as e:
        print(f"Anthropic extraction failed: {e}")
    
    return None


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


class InstagramTestRequest(BaseModel):
    url: str
    username: Optional[str] = None
    password: Optional[str] = None


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
    workout = ParserService.parse_free_text_to_workout(text, source=f"image:{file.filename}")
    return JSONResponse(workout.model_dump())


@router.post("/ingest/image_vision")
async def ingest_image_vision(
    file: UploadFile = File(...),
    vision_provider: str = Form("openai"),  # "openai" or "anthropic"
    vision_model: Optional[str] = Form(None),  # Optional model name (default: gpt-4o-mini for openai, claude-3-5-sonnet-20241022 for anthropic)
    openai_api_key: Optional[str] = Form(None)  # Optional: Use your own OpenAI API key (or use OPENAI_API_KEY env var)
):
    """
    Ingest workout from image using Vision model (OpenAI GPT-4o-mini/GPT-4o or Claude Vision).
    
    This endpoint uses AI vision models for better accuracy than OCR, especially for:
    - Handwritten text
    - Stylized fonts
    - Complex layouts
    - Instagram/social media images
    
    Requires OpenAI API key (set OPENAI_API_KEY env var or pass openai_api_key parameter).
    ChatGPT Plus ($20/month) includes API access.
    """
    tmpdir = tempfile.mkdtemp(prefix="ingest_image_vision_")
    
    try:
        # Save uploaded file temporarily
        image_path = os.path.join(tmpdir, file.filename or "image.jpg")
        b = await file.read()
        with open(image_path, "wb") as f:
            f.write(b)
        
        try:
            provider = vision_provider.lower() if vision_provider else "openai"
            
            # Handle vision_model - ignore placeholder values from Swagger UI
            if vision_model and vision_model.strip() and vision_model.strip().lower() not in ["string", "none", ""]:
                model = vision_model.strip()
            else:
                # Use default model based on provider
                model = "gpt-4o-mini" if provider == "openai" else "claude-3-5-sonnet-20241022"
            
            # Get API key - ignore placeholder values from Swagger UI
            if openai_api_key and openai_api_key.strip() and openai_api_key.strip().lower() not in ["string", "none", ""]:
                api_key = openai_api_key.strip()
            else:
                api_key = os.getenv("OPENAI_API_KEY")
            
            if provider == "openai":
                if not api_key:
                    raise HTTPException(
                        status_code=400,
                        detail="OpenAI API key required. Set OPENAI_API_KEY environment variable or pass openai_api_key parameter."
                    )
                workout_dict = VisionService.extract_and_structure_workout_openai(
                    [image_path],
                    model=model,
                    api_key=api_key,
                )
                # Post-process: ensure exercise types have valid defaults
                for block in workout_dict.get("blocks", []):
                    for exercise in block.get("exercises", []):
                        if not exercise.get("type") or exercise.get("type") is None:
                            # Default to "strength" if type is missing/None
                            exercise["type"] = "strength"
                    for superset in block.get("supersets", []):
                        for exercise in superset.get("exercises", []):
                            if not exercise.get("type") or exercise.get("type") is None:
                                exercise["type"] = "strength"
                
                workout = Workout(**workout_dict)
                workout.source = f"image:{file.filename}"
            elif provider == "anthropic":
                anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
                if not anthropic_api_key:
                    raise HTTPException(
                        status_code=400,
                        detail="Anthropic API key required. Set ANTHROPIC_API_KEY environment variable."
                    )
                # Anthropic: extract text then structure
                text = VisionService.extract_text_from_images_anthropic(
                    [image_path],
                    model=model,
                    api_key=anthropic_api_key,
                )
                from app.services.llm_service import LLMService
                workout_dict = LLMService.structure_with_anthropic(text, model=model)
                # Post-process: ensure exercise types have valid defaults
                for block in workout_dict.get("blocks", []):
                    for exercise in block.get("exercises", []):
                        if not exercise.get("type") or exercise.get("type") is None:
                            exercise["type"] = "strength"
                    for superset in block.get("supersets", []):
                        for exercise in superset.get("exercises", []):
                            if not exercise.get("type") or exercise.get("type") is None:
                                exercise["type"] = "strength"
                
                workout = Workout(**workout_dict)
                workout.source = f"image:{file.filename}"
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unknown vision provider: {provider}. Use 'openai' or 'anthropic'."
                )
                
            # Add provenance info
            response_dict = workout.model_dump()
            response_dict.setdefault("_provenance", {})
            response_dict["_provenance"].update({
                "mode": "image_vision",
                "provider": provider,
                "model": model,
                "source_file": file.filename,
            })
            
            return JSONResponse(response_dict)
        except HTTPException:
            raise
        except Exception as exc:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Vision model extraction failed: {exc}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Vision model extraction failed: {str(exc)}"
            ) from exc
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


@router.post("/ingest/url")
async def ingest_url(url: str = Body(..., embed=True)):
    """Ingest workout from video URL."""
    # Check if URL is an Instagram post (image post, not video)
    instagram_post_pattern = re.compile(r"instagram\.com/p/([A-Za-z0-9_-]+)")
    instagram_reel_pattern = re.compile(r"instagram\.com/reel/([A-Za-z0-9_-]+)")
    instagram_tv_pattern = re.compile(r"instagram\.com/tv/([A-Za-z0-9_-]+)")
    
    is_instagram_post = bool(instagram_post_pattern.search(url))
    is_instagram_video = bool(instagram_reel_pattern.search(url) or instagram_tv_pattern.search(url))
    
    try:
        title, desc, dl_url = VideoService.extract_video_info(url)
    except Exception as e:
        error_str = str(e)
        # Check if it's an Instagram image post error
        if is_instagram_post and not is_instagram_video and ("no video" in error_str.lower() or "instagram" in error_str.lower()):
            raise HTTPException(
                status_code=400,
                detail=f"Instagram image posts are not supported by this endpoint. "
                       f"Please use /ingest/instagram_test endpoint to extract images from the post (login optional): {url}"
            )
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


@router.post("/ingest/instagram_test")
async def ingest_instagram_test(payload: InstagramTestRequest):
    """
    Instagram ingestion endpoint.
    
    If username and password are provided, uses Instaloader (requires login).
    Otherwise, extracts images without login using web scraping.
    
    Uses OCR for text extraction from images.
    
    Note: Login may be required for private posts or to avoid rate limits.
    """

    tmpdir = tempfile.mkdtemp(prefix="instagram_ingest_")

    try:
        try:
            # Only use login method if both username and password are provided, not empty, and not placeholder values
            username_valid = payload.username and payload.username.strip() and payload.username.strip().lower() != "string"
            password_valid = payload.password and payload.password.strip() and payload.password.strip().lower() != "string"
            use_login = username_valid and password_valid
            
            if use_login:
                # Use login method with Instaloader
                image_paths = InstagramService.download_post_images(
                    username=payload.username,
                    password=payload.password,
                    url=payload.url,
                    target_dir=tmpdir,
                )
            else:
                # Use no-login method (web scraping)
                image_paths = InstagramService.download_post_images_no_login(
                    url=payload.url,
                    target_dir=tmpdir,
                )
                
            # Log image info for debugging
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Downloaded {len(image_paths)} images for Instagram post")
            for i, img_path in enumerate(image_paths):
                import os
                size = os.path.getsize(img_path) if os.path.exists(img_path) else 0
                logger.info(f"Image {i+1}: {img_path} ({size} bytes)")
        except InstagramServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # pragma: no cover - unexpected runtime errors
            raise HTTPException(status_code=500, detail=f"Instagram ingestion failed: {exc}") from exc

        # Extract text from images using OCR only
        # Note: Vision models don't work well with Instagram's low-quality images
        text_segments = []
        for image_path in image_paths:
            try:
                with open(image_path, "rb") as file_obj:
                    extracted = OCRService.ocr_image_bytes(file_obj.read()).strip()
                if extracted:
                    text_segments.append(extracted)
            except Exception:
                continue

        if not text_segments:
            raise HTTPException(status_code=422, detail="OCR could not extract text from Instagram images. The images may be too low quality or contain no readable text.")

        merged = "\n".join(text_segments)
        workout = ParserService.parse_free_text_to_workout(merged, source=payload.url)

        response_payload = workout.model_dump()
        response_payload.setdefault("_provenance", {})
        response_payload["_provenance"].update({
            "mode": "instagram_image_test",
            "source_url": payload.url,
            "image_count": len(image_paths),
            "extraction_method": "ocr",
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

    The service fetches the transcript from youtube-transcript.io (https://www.youtube-transcript.io/).
    
    Free subscription: 25 transcripts per month
    Token is configured via YT_TRANSCRIPT_API_TOKEN environment variable.
    
    The transcript is converted into structured workout JSON and returned in your canonical format.
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
    wk: Optional[Workout] = None
    
    # Try rule-based extraction first (only works for known exercises)
    structured_workout = _build_workout_from_rules(transcript_text, source, title)

    if structured_workout:
        wk = structured_workout
    else:
        # Try LLM to structure workout directly (best approach for YouTube transcripts)
        try:
            if os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY"):
                provider = "openai" if os.getenv("OPENAI_API_KEY") else "anthropic"
                llm_structured = _structure_workout_from_transcript_with_llm(transcript_text, provider)
                if llm_structured and llm_structured.get("blocks"):
                    # Convert LLM structured output to Workout object
                    blocks = []
                    for block_data in llm_structured.get("blocks", []):
                        exercises = []
                        for ex_data in block_data.get("exercises", []):
                            ex_data.setdefault("type", "strength")  # Default to strength if not specified
                            exercises.append(Exercise(**ex_data))
                        block = Block(
                            label=block_data.get("label", "Block 1"),
                            structure=block_data.get("structure"),
                            exercises=exercises
                        )
                        blocks.append(block)
                    
                    if blocks:
                        wk = Workout(
                            title=llm_structured.get("title") or title or "Imported Workout",
                            source=source,
                            blocks=blocks
                        )
                        summary_text = "LLM structured"  # Mark as summarized
        except Exception as e:
            print(f"LLM structuring failed: {e}")
            # Fall through to text extraction
        
        # If LLM structuring didn't work, try text extraction and parsing
        if not wk or not wk.blocks:
            # Try rule-based summarization first (only works for known exercises)
            rule_based_summary = _summarize_transcript_to_workout(transcript_text)
            
            # Try LLM text extraction for YouTube transcripts
            llm_summary = None
            try:
                llm_summary = _extract_workout_from_transcript_with_llm(transcript_text)
            except Exception as e:
                print(f"LLM text extraction failed: {e}")
            
            # Prefer LLM summary if available, otherwise use rule-based, otherwise full transcript
            summary_text = llm_summary or rule_based_summary
            text_for_parser = summary_text or transcript_text

            wk = ParserService.parse_free_text_to_workout(text_for_parser, source=source)

    if wk and title:
        wk.title = title[:80]
    
    # Ensure we have a workout object
    if not wk:
        wk = Workout(title=title or "Imported Workout", source=source, blocks=[])

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

