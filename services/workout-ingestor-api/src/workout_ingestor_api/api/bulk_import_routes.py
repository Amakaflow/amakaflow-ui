"""
Bulk Import API Routes

Handles the 5-step bulk import workflow:
1. Detect - Parse sources and detect workout items
2. Map - Apply column mappings (for files)
3. Match - Match exercises to Garmin database
4. Preview - Generate preview of workouts
5. Import - Execute the import
"""

import base64
import os
from typing import Optional, List

import httpx
from fastapi import APIRouter, UploadFile, File as FastAPIFile, Form, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Mapper API URL for exercise search
MAPPER_API_URL = os.getenv("MAPPER_API_URL", "http://localhost:8001")

from workout_ingestor_api.services.bulk_import import (
    BulkImportService,
    BulkDetectRequest,
    BulkDetectResponse,
    BulkMapRequest,
    BulkMapResponse,
    BulkMatchRequest,
    BulkMatchResponse,
    BulkPreviewRequest,
    BulkPreviewResponse,
    BulkExecuteRequest,
    BulkExecuteResponse,
    BulkStatusResponse,
    ColumnMapping,
)

router = APIRouter(prefix="/import", tags=["Bulk Import"])

# Initialize service
bulk_import_service = BulkImportService()


# ============================================================================
# Step 1: Detect
# ============================================================================

@router.post("/detect", response_model=BulkDetectResponse)
async def bulk_import_detect(request: BulkDetectRequest):
    """
    Detect and parse workout items from sources.

    Step 1 of the bulk import workflow.

    Accepts:
    - file: Base64-encoded file content (Excel, CSV, JSON, Text)
    - urls: List of URLs (YouTube, Instagram, TikTok, Pinterest)
    - images: Base64-encoded image data for OCR

    Returns detected items with confidence scores and any parsing errors.
    """
    return await bulk_import_service.detect_items(
        profile_id=request.profile_id,
        source_type=request.source_type,
        sources=request.sources,
    )


@router.post("/detect/file", response_model=BulkDetectResponse)
async def bulk_import_detect_file(
    file: UploadFile = FastAPIFile(...),
    profile_id: str = Form(..., description="User profile ID"),
):
    """
    Detect and parse workout items from an uploaded file.

    Step 1 of the bulk import workflow (file upload variant).

    Accepts file uploads via multipart/form-data:
    - Excel (.xlsx, .xls)
    - CSV (.csv)
    - JSON (.json)
    - Text (.txt)

    Returns detected items with confidence scores and any parsing errors.
    """
    # Read file content
    content = await file.read()
    filename = file.filename or "upload.txt"

    # Encode as base64 with filename prefix for the parser
    base64_content = f"{filename}:{base64.b64encode(content).decode('utf-8')}"

    return await bulk_import_service.detect_items(
        profile_id=profile_id,
        source_type="file",
        sources=[base64_content],
    )


@router.post("/detect/urls", response_model=BulkDetectResponse)
async def bulk_import_detect_urls(
    profile_id: str = Form(..., description="User profile ID"),
    urls: str = Form(..., description="Newline or comma-separated URLs"),
):
    """
    Detect and parse workout items from URLs.

    Step 1 of the bulk import workflow (URL variant).

    Accepts URLs via form data (newline or comma-separated):
    - YouTube (youtube.com, youtu.be)
    - Instagram (instagram.com/p/, /reel/, /tv/)
    - TikTok (tiktok.com, vm.tiktok.com)
    - Pinterest (pinterest.com/pin/, pin.it/) - supports multi-workout plans

    Fetches metadata using oEmbed APIs for quick preview.
    Full workout extraction happens during the import step.
    """
    # Parse URLs from form input (newline or comma-separated)
    url_list = []
    for line in urls.replace(",", "\n").split("\n"):
        url = line.strip()
        if url:
            url_list.append(url)

    if not url_list:
        return BulkDetectResponse(
            success=False,
            job_id="",
            items=[],
            metadata={"error": "No valid URLs provided"},
            total=0,
            success_count=0,
            error_count=0,
        )

    return await bulk_import_service.detect_items(
        profile_id=profile_id,
        source_type="urls",
        sources=url_list,
    )


@router.post("/detect/images", response_model=BulkDetectResponse)
async def bulk_import_detect_images(
    profile_id: str = Form(..., description="User profile ID"),
    files: list[UploadFile] = FastAPIFile(..., description="Image files to process"),
):
    """
    Detect and parse workout items from images.

    Step 1 of the bulk import workflow (Image variant).

    Accepts image uploads:
    - PNG, JPG, JPEG, WebP, HEIC, GIF
    - Max 20 images per request

    Uses Vision AI (GPT-4o-mini by default) to extract workout data.
    Returns structured workout data with confidence scores.
    """
    if not files:
        return BulkDetectResponse(
            success=False,
            job_id="",
            items=[],
            metadata={"error": "No images provided"},
            total=0,
            success_count=0,
            error_count=0,
        )

    # Read and encode images
    image_data = []
    for f in files[:20]:  # Limit to 20 images
        content = await f.read()
        b64 = base64.b64encode(content).decode("utf-8")
        image_data.append({"data": b64, "filename": f.filename or "image.jpg"})

    return await bulk_import_service.detect_items(
        profile_id=profile_id,
        source_type="images",
        sources=image_data,
    )


# ============================================================================
# Step 2: Map Columns
# ============================================================================

@router.post("/map", response_model=BulkMapResponse)
async def bulk_import_map(request: BulkMapRequest):
    """
    Apply column mappings to detected file data.

    Step 2 of the bulk import workflow (only for file imports).

    Transforms raw CSV/Excel data into structured workout data
    based on user-provided column mappings.
    """
    column_mappings = [
        ColumnMapping(**m) if isinstance(m, dict) else m
        for m in request.column_mappings
    ]
    return await bulk_import_service.apply_column_mappings(
        job_id=request.job_id,
        profile_id=request.profile_id,
        column_mappings=column_mappings,
    )


# ============================================================================
# Step 3: Match Exercises
# ============================================================================

@router.post("/match", response_model=BulkMatchResponse)
async def bulk_import_match(request: BulkMatchRequest):
    """
    Match exercises to Garmin exercise database.

    Step 3 of the bulk import workflow.

    Uses fuzzy matching to find Garmin equivalents for exercise names.
    Returns confidence scores and suggestions for ambiguous matches.
    """
    return await bulk_import_service.match_exercises(
        job_id=request.job_id,
        profile_id=request.profile_id,
        user_mappings=request.user_mappings,
    )


# ============================================================================
# Step 4: Preview
# ============================================================================

@router.post("/preview", response_model=BulkPreviewResponse)
async def bulk_import_preview(request: BulkPreviewRequest):
    """
    Generate preview of workouts to be imported.

    Step 4 of the bulk import workflow.

    Shows final workout structures, validation issues,
    and statistics before committing the import.
    """
    return await bulk_import_service.generate_preview(
        job_id=request.job_id,
        profile_id=request.profile_id,
        selected_ids=request.selected_ids,
    )


# ============================================================================
# Step 5: Execute Import
# ============================================================================

@router.post("/execute", response_model=BulkExecuteResponse)
async def bulk_import_execute(request: BulkExecuteRequest):
    """
    Execute the bulk import of workouts.

    Step 5 of the bulk import workflow.

    In async_mode (default), starts a background job and returns immediately.
    Use GET /import/status/{job_id} to track progress.
    """
    return await bulk_import_service.execute_import(
        job_id=request.job_id,
        profile_id=request.profile_id,
        workout_ids=request.workout_ids,
        device=request.device,
        async_mode=request.async_mode,
    )


# ============================================================================
# Status & Control
# ============================================================================

@router.get("/status/{job_id}", response_model=BulkStatusResponse)
async def bulk_import_status(
    job_id: str,
    profile_id: str = Query(..., description="User profile ID"),
):
    """
    Get status of a bulk import job.

    Returns progress percentage, current item being processed,
    and results for completed items.
    """
    return await bulk_import_service.get_import_status(
        job_id=job_id,
        profile_id=profile_id,
    )


@router.post("/cancel/{job_id}")
async def bulk_import_cancel(
    job_id: str,
    profile_id: str = Query(..., description="User profile ID"),
):
    """
    Cancel a running bulk import job.

    Only works for jobs with status 'running'.
    Completed imports cannot be cancelled.
    """
    success = await bulk_import_service.cancel_import(
        job_id=job_id,
        profile_id=profile_id,
    )
    return {
        "success": success,
        "message": "Import cancelled" if success else "Failed to cancel import",
    }


# ============================================================================
# Exercise Search
# ============================================================================

class ExerciseSearchResult(BaseModel):
    """Single exercise search result"""
    name: str
    score: float  # 0-100 confidence score


class ExerciseSearchResponse(BaseModel):
    """Response from exercise search"""
    query: str
    results: List[ExerciseSearchResult]
    total: int


@router.get("/exercises/search", response_model=ExerciseSearchResponse)
async def search_exercises(
    query: str = Query(..., min_length=1, description="Search query for exercise name"),
    limit: int = Query(default=10, ge=1, le=50, description="Max number of results"),
):
    """
    Search the Garmin exercise database.

    Returns matching exercises with confidence scores.
    Used for manual exercise matching in the bulk import workflow.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{MAPPER_API_URL}/exercise/similar/{query}",
                params={"limit": limit}
            )

            if response.status_code == 200:
                data = response.json()
                similar = data.get("similar", [])

                results = []
                for item in similar:
                    name = item.get("name") or item.get("garmin_name")
                    score = item.get("score", 0)
                    # Convert score to 0-100 if it's 0-1
                    if score <= 1:
                        score = score * 100
                    if name:
                        results.append(ExerciseSearchResult(name=name, score=round(score, 1)))

                return ExerciseSearchResponse(
                    query=query,
                    results=results,
                    total=len(results),
                )

    except Exception as e:
        # Log error but return empty results
        import logging
        logging.getLogger(__name__).warning(f"Exercise search failed: {e}")

    return ExerciseSearchResponse(
        query=query,
        results=[],
        total=0,
    )
