"""API routes for workout ingestion."""
import os
import shutil
import subprocess
import tempfile
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, Body, HTTPException
from fastapi.responses import JSONResponse, Response

from app.models import Workout
from app.services.ocr_service import OCRService
from app.services.parser_service import ParserService
from app.services.video_service import VideoService
from app.services.export_service import ExportService

router = APIRouter()


@router.get("/health")
def health():
    """Health check endpoint."""
    return {"ok": True}


@router.post("/ingest/text")
async def ingest_text(text: str = Form(...), source: Optional[str] = Form(None)):
    """Ingest workout from plain text."""
    wk = ParserService.parse_free_text_to_workout(text, source)
    return JSONResponse(wk.model_dump())


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

