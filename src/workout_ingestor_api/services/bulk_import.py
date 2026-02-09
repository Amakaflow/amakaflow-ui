"""
Bulk Import Service
AMA-100: Bulk Import Controller & State Management

Handles the 5-step bulk import workflow:
1. Detect - Parse sources and detect workout items
2. Map - Apply column mappings (for files)
3. Match - Match exercises to Garmin database
4. Preview - Generate preview of workouts
5. Import - Execute the import

This module provides:
- Pydantic models for API requests/responses
- BulkImportService class for orchestrating the workflow
- Database operations for job tracking
"""

import uuid
import base64
import asyncio
import logging
from typing import List, Dict, Any, Optional, Literal
from datetime import datetime, timezone
from pydantic import BaseModel, Field

import httpx
import os

from workout_ingestor_api.parsers import (
    FileParserFactory,
    FileInfo,
    ParseResult,
    ParsedWorkout,
    URLParser,
    fetch_url_metadata_batch,
    ImageParser,
    parse_images_batch,
    is_supported_image,
)
from workout_ingestor_api.services.pinterest_service import (
    ingest_pinterest_url,
    is_pinterest_url,
)
from workout_ingestor_api.api.routes import (
    detect_multi_workout_plan,
    split_multi_workout_plan,
)

# Mapper API URL for exercise matching
MAPPER_API_URL = os.getenv("MAPPER_API_URL", "http://localhost:8001")

logger = logging.getLogger(__name__)


async def find_garmin_exercise_async(
    exercise_name: str,
    threshold: int = 80
) -> tuple[Optional[str], float]:
    """
    Call mapper-api to find matching Garmin exercise.

    Returns:
        Tuple of (garmin_name, confidence) where confidence is 0-1.
        Returns (None, 0.0) if no match found.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{MAPPER_API_URL}/exercise/similar/{exercise_name}",
                params={"limit": 5}
            )
            if response.status_code == 200:
                data = response.json()
                similar = data.get("similar", [])
                if similar:
                    # similar is list of {name, score} dicts
                    best_match = similar[0]
                    name = best_match.get("name") or best_match.get("garmin_name")
                    score = best_match.get("score", 0)
                    # Convert score to 0-1 if it's 0-100
                    confidence = score / 100 if score > 1 else score

                    # Apply threshold (threshold is 0-100, confidence is 0-1)
                    if confidence * 100 >= threshold:
                        return name, confidence
    except Exception as e:
        logger.warning(f"Failed to call mapper-api for exercise match: {e}")
    return None, 0.0


async def get_garmin_suggestions_async(
    exercise_name: str,
    limit: int = 5,
    score_cutoff: float = 0.3
) -> List[tuple[str, float]]:
    """
    Call mapper-api to get exercise suggestions.

    Returns:
        List of (garmin_name, confidence) tuples sorted by confidence desc.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{MAPPER_API_URL}/exercise/similar/{exercise_name}",
                params={"limit": limit}
            )
            if response.status_code == 200:
                data = response.json()
                similar = data.get("similar", [])
                results = []
                for item in similar:
                    name = item.get("name") or item.get("garmin_name")
                    score = item.get("score", 0)
                    # Convert score to 0-1 if it's 0-100
                    confidence = score / 100 if score > 1 else score
                    if name and confidence >= score_cutoff:
                        results.append((name, confidence))
                return results
    except Exception as e:
        logger.warning(f"Failed to call mapper-api for suggestions: {e}")
    return []

# ============================================================================
# Exercise Matching Constants
# ============================================================================

# Confidence thresholds for exercise matching
MATCH_AUTO_THRESHOLD = 0.90      # 90%+ = auto-match
MATCH_REVIEW_THRESHOLD = 0.70    # 70-90% = needs review
MATCH_UNMAPPED_THRESHOLD = 0.50  # <50% = unmapped/new

# ============================================================================
# Pydantic Models
# ============================================================================

class DetectedItem(BaseModel):
    """Detected item from file/URL/image parsing"""
    id: str
    source_index: int
    source_type: str
    source_ref: str
    raw_data: Dict[str, Any]
    parsed_title: Optional[str] = None
    parsed_exercise_count: Optional[int] = None
    parsed_block_count: Optional[int] = None
    confidence: float = 0
    errors: Optional[List[str]] = None
    warnings: Optional[List[str]] = None


class ColumnMapping(BaseModel):
    """Column mapping for file imports"""
    source_column: str
    source_column_index: int
    target_field: str
    confidence: float = 0
    user_override: bool = False
    sample_values: List[str] = []


class DetectedPattern(BaseModel):
    """Detected pattern in the data"""
    pattern_type: str
    regex: Optional[str] = None
    confidence: float = 0
    examples: List[str] = []
    count: int = 0


class ExerciseMatch(BaseModel):
    """Exercise matching result"""
    id: str
    original_name: str
    matched_garmin_name: Optional[str] = None
    confidence: float = 0
    suggestions: List[Dict[str, Any]] = []
    status: Literal["matched", "needs_review", "unmapped", "new"] = "unmapped"
    user_selection: Optional[str] = None
    source_workout_ids: List[str] = []
    occurrence_count: int = 1


class ValidationIssue(BaseModel):
    """Validation issue found during preview"""
    id: str
    severity: Literal["error", "warning", "info"]
    field: str
    message: str
    workout_id: Optional[str] = None
    exercise_name: Optional[str] = None
    suggestion: Optional[str] = None
    auto_fixable: bool = False


class PreviewWorkout(BaseModel):
    """Preview workout before import"""
    id: str
    detected_item_id: str
    title: str
    description: Optional[str] = None
    exercise_count: int = 0
    block_count: int = 0
    estimated_duration: Optional[int] = None
    validation_issues: List[ValidationIssue] = []
    workout: Dict[str, Any] = {}
    selected: bool = True
    is_duplicate: bool = False
    duplicate_of: Optional[str] = None


class ImportStats(BaseModel):
    """Import statistics for preview"""
    total_detected: int = 0
    total_selected: int = 0
    total_skipped: int = 0
    exercises_matched: int = 0
    exercises_needing_review: int = 0
    exercises_unmapped: int = 0
    new_exercises_to_create: int = 0
    estimated_duration: int = 0
    duplicates_found: int = 0
    validation_errors: int = 0
    validation_warnings: int = 0


class ImportResult(BaseModel):
    """Import result for a single workout"""
    workout_id: str
    title: str
    status: Literal["success", "failed", "skipped"]
    error: Optional[str] = None
    saved_workout_id: Optional[str] = None
    export_formats: Optional[List[str]] = None


# API Request/Response Models

class BulkDetectRequest(BaseModel):
    """Request to detect workout items from sources"""
    profile_id: str
    source_type: Literal["file", "urls", "images"]
    sources: List[str]  # URLs, file content (base64), or image data


class BulkDetectResponse(BaseModel):
    """Response from detect endpoint"""
    success: bool
    job_id: str
    items: List[DetectedItem]
    metadata: Dict[str, Any] = {}
    total: int
    success_count: int
    error_count: int


class BulkMapRequest(BaseModel):
    """Request to apply column mappings"""
    job_id: str
    profile_id: str
    column_mappings: List[ColumnMapping]


class BulkMapResponse(BaseModel):
    """Response from map endpoint"""
    success: bool
    job_id: str
    mapped_count: int
    patterns: List[DetectedPattern] = []


class BulkMatchRequest(BaseModel):
    """Request to match exercises"""
    job_id: str
    profile_id: str
    user_mappings: Optional[Dict[str, str]] = None  # original_name -> selected_garmin_name


class BulkMatchResponse(BaseModel):
    """Response from match endpoint"""
    success: bool
    job_id: str
    exercises: List[ExerciseMatch]
    total_exercises: int
    matched: int
    needs_review: int
    unmapped: int


class BulkPreviewRequest(BaseModel):
    """Request to generate preview"""
    job_id: str
    profile_id: str
    selected_ids: List[str]


class BulkPreviewResponse(BaseModel):
    """Response from preview endpoint"""
    success: bool
    job_id: str
    workouts: List[PreviewWorkout]
    stats: ImportStats


class BulkExecuteRequest(BaseModel):
    """Request to execute import"""
    job_id: str
    profile_id: str
    workout_ids: List[str]
    device: str
    async_mode: bool = True


class BulkExecuteResponse(BaseModel):
    """Response from execute endpoint"""
    success: bool
    job_id: str
    status: str
    message: str


class BulkStatusResponse(BaseModel):
    """Response from status endpoint"""
    success: bool
    job_id: str
    status: str
    progress: int
    current_item: Optional[str] = None
    results: List[ImportResult] = []
    error: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ============================================================================
# Bulk Import Service
# ============================================================================

class BulkImportService:
    """
    Service for orchestrating the 5-step bulk import workflow.

    This service manages:
    - Job creation and tracking
    - Source detection and parsing
    - Column mapping (for file imports)
    - Exercise matching
    - Preview generation
    - Import execution with progress tracking
    """

    # In-memory storage for when Supabase is not available
    _jobs_cache: Dict[str, Dict[str, Any]] = {}
    _items_cache: Dict[str, List[Dict[str, Any]]] = {}  # job_id -> items

    def __init__(self):
        self.supabase = self._get_supabase_client()

    def _get_supabase_client(self):
        """Get Supabase client from database module"""
        try:
            from workout_ingestor_api.services.youtube_cache_service import get_supabase_client
            return get_supabase_client()
        except Exception as e:
            logger.warning(f"Could not get Supabase client: {e}")
            return None

    def _patterns_to_list(self, patterns) -> List[Dict[str, Any]]:
        """Convert DetectedPatterns object to a list of pattern dicts"""
        result = []
        if patterns:
            if patterns.supersets:
                result.append({"type": "supersets", **patterns.supersets.model_dump()})
            if patterns.complex_movements:
                result.append({"type": "complex_movements", **patterns.complex_movements.model_dump()})
            if patterns.duration_exercises:
                result.append({"type": "duration_exercises", **patterns.duration_exercises.model_dump()})
            if patterns.percentage_weights:
                result.append({"type": "percentage_weights", **patterns.percentage_weights.model_dump()})
            if patterns.warmup_sets:
                result.append({"type": "warmup_sets", **patterns.warmup_sets.model_dump()})
        return result

    # ========================================================================
    # Job Management
    # ========================================================================

    def _create_job(
        self,
        profile_id: str,
        input_type: str,
        total_items: int = 0
    ) -> str:
        """Create a new bulk import job"""
        job_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        # Always store in cache first
        job_data = {
            "id": job_id,
            "profile_id": profile_id,
            "input_type": input_type,
            "status": "pending",
            "total_items": total_items,
            "processed_items": 0,
            "results": [],
            "created_at": now,
            "updated_at": now,
        }
        BulkImportService._jobs_cache[job_id] = job_data
        logger.info(f"Created job {job_id} in cache")

        # Also try to store in Supabase
        if self.supabase:
            try:
                self.supabase.table("bulk_import_jobs").insert(job_data).execute()
            except Exception as e:
                logger.error(f"Failed to create job in database: {e}")

        return job_id

    def _update_job_status(
        self,
        job_id: str,
        profile_id: str,
        status: str,
        **kwargs
    ) -> bool:
        """Update job status and optional fields"""
        now = datetime.now(timezone.utc).isoformat()
        update_data = {
            "status": status,
            "updated_at": now,
        }
        update_data.update(kwargs)

        if status in ("complete", "failed", "cancelled"):
            update_data["completed_at"] = now

        # Always update cache first
        if job_id in BulkImportService._jobs_cache:
            BulkImportService._jobs_cache[job_id].update(update_data)
            logger.info(f"Updated job {job_id} status to {status} in cache")

        # Also try to update in Supabase
        if self.supabase:
            try:
                self.supabase.table("bulk_import_jobs").update(update_data)\
                    .eq("id", job_id)\
                    .eq("profile_id", profile_id)\
                    .execute()
            except Exception as e:
                logger.error(f"Failed to update job status in database: {e}")

        return True

    def _update_job_progress(
        self,
        job_id: str,
        profile_id: str,
        processed_items: int,
        current_item: Optional[str] = None
    ) -> bool:
        """Update job progress"""
        now = datetime.now(timezone.utc).isoformat()
        update_data = {
            "processed_items": processed_items,
            "current_item": current_item,
            "updated_at": now,
        }

        # Always update cache first
        if job_id in BulkImportService._jobs_cache:
            BulkImportService._jobs_cache[job_id].update(update_data)

        # Also try to update in Supabase
        if self.supabase:
            try:
                self.supabase.table("bulk_import_jobs").update(update_data)\
                    .eq("id", job_id).eq("profile_id", profile_id).execute()
            except Exception as e:
                logger.error(f"Failed to update job progress in database: {e}")

        return True

    def _get_job(self, job_id: str, profile_id: str) -> Optional[Dict[str, Any]]:
        """Get job by ID - checks cache first, then database"""
        # Try Supabase first if available
        if self.supabase:
            try:
                result = self.supabase.table("bulk_import_jobs")\
                    .select("*")\
                    .eq("id", job_id)\
                    .eq("profile_id", profile_id)\
                    .single()\
                    .execute()

                if result.data:
                    return result.data
            except Exception as e:
                logger.warning(f"Failed to get job from database: {e}")

        # Fall back to cache
        job = BulkImportService._jobs_cache.get(job_id)
        if job and job.get("profile_id") == profile_id:
            logger.info(f"Retrieved job {job_id} from cache")
            return job

        return None

    # ========================================================================
    # Detected Items Management
    # ========================================================================

    def _store_detected_items(
        self,
        job_id: str,
        profile_id: str,
        items: List[Dict[str, Any]]
    ) -> bool:
        """Store detected items in database or in-memory cache"""
        if not items:
            return False

        # Build records
        records = [
            {
                "id": item.get("id", str(uuid.uuid4())),
                "job_id": job_id,
                "profile_id": profile_id,
                "source_index": item.get("source_index", idx),
                "source_type": item.get("source_type", "file"),
                "source_ref": item.get("source_ref", ""),
                "raw_data": item.get("raw_data", {}),
                "parsed_workout": item.get("parsed_workout"),
                "confidence": item.get("confidence", 0),
                "errors": item.get("errors", []),
                "warnings": item.get("warnings", []),
                "selected": True,  # Default to selected
            }
            for idx, item in enumerate(items)
        ]

        # Always store in cache for fallback
        BulkImportService._items_cache[job_id] = records
        logger.info(f"Stored {len(records)} items in cache for job {job_id}")

        # Try to store in Supabase if available
        if self.supabase:
            try:
                self.supabase.table("bulk_import_detected_items").insert(records).execute()
                return True
            except Exception as e:
                logger.error(f"Failed to store detected items in DB: {e}")

        return True  # Return true since we stored in cache

    def _get_detected_items(
        self,
        job_id: str,
        profile_id: str,
        selected_only: bool = False
    ) -> List[Dict[str, Any]]:
        """Get detected items for a job from database or in-memory cache"""
        # Try Supabase first
        if self.supabase:
            try:
                query = self.supabase.table("bulk_import_detected_items")\
                    .select("*")\
                    .eq("job_id", job_id)\
                    .eq("profile_id", profile_id)\
                    .order("source_index")

                if selected_only:
                    query = query.eq("selected", True)

                result = query.execute()
                if result.data:
                    return result.data
            except Exception as e:
                logger.error(f"Failed to get detected items from DB: {e}")

        # Fallback to in-memory cache
        items = BulkImportService._items_cache.get(job_id, [])
        logger.info(f"Retrieved {len(items)} items from cache for job {job_id}")

        if selected_only:
            items = [i for i in items if i.get("selected", True)]

        return items

    def _update_detected_item(
        self,
        item_id: str,
        profile_id: str,
        **kwargs
    ) -> bool:
        """Update a detected item"""
        if not self.supabase:
            return False

        try:
            self.supabase.table("bulk_import_detected_items").update({
                **kwargs,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", item_id).eq("profile_id", profile_id).execute()

            return True
        except Exception as e:
            logger.error(f"Failed to update detected item: {e}")
            return False

    # ========================================================================
    # Step 1: Detection
    # ========================================================================

    async def detect_items(
        self,
        profile_id: str,
        source_type: str,
        sources: List[str]
    ) -> BulkDetectResponse:
        """
        Detect and parse workout items from sources.

        For files: Parse Excel/CSV/JSON/Text content
        For URLs: Fetch metadata and queue for processing (batched, max 5 concurrent)
        For images: Run OCR and extract workout data
        """
        job_id = self._create_job(profile_id, source_type, len(sources))

        detected_items = []
        success_count = 0
        error_count = 0

        # Use optimized batch processing for URLs and images
        if source_type == "urls":
            detected_items, success_count, error_count = await self._detect_urls_batch(
                sources, max_concurrent=5
            )
        elif source_type == "images":
            # Images are passed as list of (base64_data, filename) or just base64_data
            # If just base64 strings, convert to tuples
            images = []
            for idx, source in enumerate(sources):
                if isinstance(source, tuple):
                    images.append(source)
                elif isinstance(source, dict):
                    images.append((source.get("data", ""), source.get("filename", f"image_{idx}.jpg")))
                else:
                    images.append((source, f"image_{idx}.jpg"))
            detected_items, success_count, error_count = await self._detect_images_batch(
                images, max_concurrent=3
            )
        else:
            # Process files sequentially
            for idx, source in enumerate(sources):
                try:
                    item = await self._detect_single_source(
                        source_type=source_type,
                        source=source,
                        index=idx
                    )
                    detected_items.append(item)

                    if item.get("errors"):
                        error_count += 1
                    else:
                        success_count += 1

                except Exception as e:
                    logger.error(f"Error detecting source {idx}: {e}")
                    detected_items.append({
                        "id": str(uuid.uuid4()),
                        "source_index": idx,
                        "source_type": source_type,
                        "source_ref": source[:100] if source else "",
                        "raw_data": {},
                        "confidence": 0,
                        "errors": [str(e)],
                    })
                    error_count += 1

        # Store in database
        self._store_detected_items(job_id, profile_id, detected_items)

        # Update job with total items
        self._update_job_status(
            job_id, profile_id, "pending",
            total_items=len(detected_items)
        )

        return BulkDetectResponse(
            success=True,
            job_id=job_id,
            items=[DetectedItem(**item) for item in detected_items],
            metadata={},
            total=len(detected_items),
            success_count=success_count,
            error_count=error_count,
        )

    async def _detect_urls_batch(
        self,
        urls: List[str],
        max_concurrent: int = 5
    ) -> tuple:
        """
        Batch process URLs with concurrency limit.

        Uses optimized batch fetching from URL parser.
        Pinterest URLs are fully ingested to extract workout data.

        Returns:
            Tuple of (detected_items, success_count, error_count)
        """
        detected_items = []
        success_count = 0
        error_count = 0

        # Separate Pinterest URLs from other URLs
        pinterest_urls = [(idx, url) for idx, url in enumerate(urls) if is_pinterest_url(url)]
        other_urls = [(idx, url) for idx, url in enumerate(urls) if not is_pinterest_url(url)]

        # Process Pinterest URLs with full ingestion
        for idx, url in pinterest_urls:
            item_id = str(uuid.uuid4())
            try:
                logger.info(f"Ingesting Pinterest URL: {url}")
                result = await ingest_pinterest_url(url, limit=20)  # Support multi-workout pins

                if not result.success or not result.workouts:
                    detected_items.append({
                        "id": item_id,
                        "source_index": idx,
                        "source_type": "urls",
                        "source_ref": url,
                        "raw_data": {"url": url, "platform": "pinterest"},
                        "parsed_title": "Pinterest Workout",
                        "parsed_exercise_count": 0,
                        "parsed_block_count": 0,
                        "confidence": 30,
                        "errors": result.errors or ["Failed to extract workout from Pinterest"],
                    })
                    error_count += 1
                    continue

                # Process each workout, checking for multi-workout plans
                all_workouts_to_add = []
                for workout in result.workouts:
                    # Check if this workout contains multiple separate workouts (e.g., weekly plan with Mon-Fri blocks)
                    multi_workout_info = detect_multi_workout_plan(workout)

                    if multi_workout_info["is_multi_workout_plan"]:
                        # Split into individual workouts (e.g., Monday, Tuesday, etc.)
                        base_title = workout.get("title", "Pinterest Workout")
                        individual_workouts = split_multi_workout_plan(workout, base_title, url)
                        logger.info(
                            f"Pinterest: Split multi-workout plan into {len(individual_workouts)} workouts "
                            f"({multi_workout_info['split_reason']})"
                        )
                        all_workouts_to_add.extend(individual_workouts)
                    else:
                        all_workouts_to_add.append(workout)

                # Create detected items for each individual workout
                for workout_idx, workout in enumerate(all_workouts_to_add):
                    workout_item_id = str(uuid.uuid4()) if workout_idx > 0 else item_id
                    title = workout.get("title", f"Pinterest Workout {workout_idx + 1}")

                    # Count exercises in blocks
                    exercise_count = 0
                    block_count = len(workout.get("blocks", []))
                    for block in workout.get("blocks", []):
                        exercise_count += len(block.get("exercises", []))

                    detected_items.append({
                        "id": workout_item_id,
                        "source_index": idx,
                        "source_type": "urls",
                        "source_ref": url,
                        "raw_data": {
                            "url": url,
                            "platform": "pinterest",
                            "workout_index": workout_idx,
                            "total_workouts": len(all_workouts_to_add),
                        },
                        "parsed_title": title,
                        "parsed_exercise_count": exercise_count,
                        "parsed_block_count": block_count,
                        "parsed_workout": workout,  # Include full workout structure!
                        "confidence": 85,
                        "platform": "pinterest",
                    })
                    logger.info(f"Detected Pinterest workout '{title}' with {exercise_count} exercises")

                success_count += 1

            except Exception as e:
                logger.exception(f"Error ingesting Pinterest URL {url}: {e}")
                detected_items.append({
                    "id": item_id,
                    "source_index": idx,
                    "source_type": "urls",
                    "source_ref": url,
                    "raw_data": {"url": url, "platform": "pinterest"},
                    "parsed_title": "Pinterest Workout",
                    "parsed_exercise_count": 0,
                    "parsed_block_count": 0,
                    "confidence": 0,
                    "errors": [str(e)],
                })
                error_count += 1

        # Fetch metadata for other URLs in batch (non-Pinterest)
        if other_urls:
            other_url_list = [url for _, url in other_urls]
            metadata_list = await fetch_url_metadata_batch(other_url_list, max_concurrent)

            for (idx, _), metadata in zip(other_urls, metadata_list):
                item_id = str(uuid.uuid4())

                if metadata.error:
                    detected_items.append({
                        "id": item_id,
                        "source_index": idx,
                        "source_type": "urls",
                        "source_ref": metadata.url,
                        "raw_data": {
                            "url": metadata.url,
                            "platform": metadata.platform,
                            "video_id": metadata.video_id,
                        },
                        "parsed_title": f"{metadata.platform.title()} Video",
                        "parsed_exercise_count": 0,
                        "parsed_block_count": 0,
                        "confidence": 30,
                        "errors": [metadata.error],
                    })
                    error_count += 1
                else:
                    # Build title
                    title = metadata.title
                    if not title:
                        title = f"{metadata.platform.title()} Video"
                        if metadata.video_id:
                            title += f" ({metadata.video_id[:8]}...)"

                    detected_items.append({
                        "id": item_id,
                        "source_index": idx,
                        "source_type": "urls",
                        "source_ref": metadata.url,
                        "raw_data": {
                            "url": metadata.url,
                            "platform": metadata.platform,
                            "video_id": metadata.video_id,
                            "title": metadata.title,
                            "author": metadata.author,
                            "thumbnail_url": metadata.thumbnail_url,
                            "duration_seconds": metadata.duration_seconds,
                        },
                        "parsed_title": title,
                        "parsed_exercise_count": 0,
                        "parsed_block_count": 0,
                        "confidence": 70,
                        "thumbnail_url": metadata.thumbnail_url,
                        "author": metadata.author,
                        "platform": metadata.platform,
                    })
                    success_count += 1

        # Sort by source_index to maintain original order
        detected_items.sort(key=lambda x: x["source_index"])

        return detected_items, success_count, error_count

    async def _detect_images_batch(
        self,
        images: List[tuple],  # List of (base64_data, filename)
        max_concurrent: int = 3
    ) -> tuple:
        """
        Batch process images with concurrency limit.

        Uses Vision AI for workout extraction.

        Args:
            images: List of (base64_data, filename) tuples
            max_concurrent: Max concurrent requests (lower than URLs due to cost)

        Returns:
            Tuple of (detected_items, success_count, error_count)
        """
        detected_items = []
        success_count = 0
        error_count = 0

        # Decode base64 images and prepare for batch processing
        decoded_images = []
        decode_errors = []

        for idx, (b64_data, filename) in enumerate(images):
            try:
                image_data = base64.b64decode(b64_data)
                decoded_images.append((image_data, filename or f"image_{idx}.jpg", idx))
            except Exception as e:
                decode_errors.append((idx, filename, str(e)))

        # Add decode error items
        for idx, filename, error in decode_errors:
            detected_items.append({
                "id": str(uuid.uuid4()),
                "source_index": idx,
                "source_type": "images",
                "source_ref": filename or f"image_{idx}",
                "raw_data": {},
                "parsed_title": f"Image Workout {idx + 1}",
                "parsed_exercise_count": 0,
                "confidence": 0,
                "errors": [f"Invalid base64 image data: {error}"],
            })
            error_count += 1

        # Process decoded images in batch
        if decoded_images:
            batch_input = [(data, fname) for data, fname, _ in decoded_images]
            results = await parse_images_batch(
                batch_input,
                mode="vision",
                max_concurrent=max_concurrent,
            )

            for (_, filename, idx), result in zip(decoded_images, results):
                item_id = str(uuid.uuid4())

                if not result.success:
                    detected_items.append({
                        "id": item_id,
                        "source_index": idx,
                        "source_type": "images",
                        "source_ref": filename,
                        "raw_data": {
                            "extraction_method": result.extraction_method,
                        },
                        "parsed_title": f"Image Workout {idx + 1}",
                        "parsed_exercise_count": 0,
                        "confidence": result.confidence,
                        "errors": [result.error] if result.error else ["Failed to extract workout"],
                    })
                    error_count += 1
                else:
                    title = result.title or f"Image Workout {idx + 1}"
                    exercise_count = len(result.exercises)
                    block_count = len(result.blocks)

                    detected_items.append({
                        "id": item_id,
                        "source_index": idx,
                        "source_type": "images",
                        "source_ref": filename,
                        "raw_data": {
                            "extraction_method": result.extraction_method,
                            "model_used": result.model_used,
                            "exercises": result.exercises,
                            "blocks": result.blocks,
                        },
                        "parsed_title": title,
                        "parsed_exercise_count": exercise_count,
                        "parsed_block_count": block_count,
                        "parsed_workout": result.raw_workout,
                        "confidence": result.confidence,
                        "flagged_items": result.flagged_items if result.flagged_items else None,
                    })
                    success_count += 1

        # Sort by source_index to maintain order
        detected_items.sort(key=lambda x: x["source_index"])

        return detected_items, success_count, error_count

    async def _detect_single_source(
        self,
        source_type: str,
        source: str,
        index: int
    ) -> Dict[str, Any]:
        """Detect workout from a single source"""
        item_id = str(uuid.uuid4())

        if source_type == "file":
            return await self._detect_from_file(item_id, source, index)
        elif source_type == "urls":
            return await self._detect_from_url(item_id, source, index)
        elif source_type == "images":
            return await self._detect_from_image(item_id, source, index)
        else:
            return {
                "id": item_id,
                "source_index": index,
                "source_type": source_type,
                "source_ref": source[:100] if source else "",
                "raw_data": {},
                "confidence": 0,
                "errors": [f"Unknown source type: {source_type}"],
            }

    async def _detect_from_file(
        self,
        item_id: str,
        source: str,
        index: int,
        filename: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Detect workout from file content (base64 encoded).

        Args:
            item_id: Unique ID for this detected item
            source: Base64 encoded file content (optionally prefixed with "filename:")
            index: Source index in the batch
            filename: Optional filename (if not embedded in source)
        """
        try:
            # Parse source format: can be "filename:base64content" or just "base64content"
            if filename is None and ":" in source and not source.startswith("data:"):
                # Check if it looks like "filename.ext:base64..."
                parts = source.split(":", 1)
                if "." in parts[0] and len(parts[0]) < 256:
                    filename = parts[0]
                    source = parts[1]

            # Default filename if none provided
            if not filename:
                filename = f"file_{index}.txt"

            # Use the parser factory
            parse_result = await FileParserFactory.parse_base64(source, filename)

            if not parse_result.success:
                return {
                    "id": item_id,
                    "source_index": index,
                    "source_type": "file",
                    "source_ref": filename,
                    "raw_data": {"filename": filename},
                    "parsed_title": None,
                    "parsed_exercise_count": 0,
                    "parsed_block_count": 0,
                    "confidence": 0,
                    "errors": parse_result.errors,
                    "warnings": parse_result.warnings,
                }

            # Convert workouts to detected items format
            # For multi-workout files (e.g., multi-sheet Excel), we'll create multiple items
            # But since this method returns a single item, we'll aggregate
            total_exercises = 0
            total_blocks = 0
            workout_titles = []
            parsed_workouts = []

            for workout in parse_result.workouts:
                workout_titles.append(workout.name or f"Workout {len(workout_titles) + 1}")
                exercise_count = len(workout.exercises)
                total_exercises += exercise_count
                total_blocks += 1  # Each workout is considered one block

                # Convert ParsedWorkout to dict for storage
                parsed_workouts.append(workout.model_dump())

            # Generate title
            if len(workout_titles) == 1:
                title = workout_titles[0]
            elif len(workout_titles) > 1:
                title = f"{workout_titles[0]} (+{len(workout_titles) - 1} more)"
            else:
                title = filename

            return {
                "id": item_id,
                "source_index": index,
                "source_type": "file",
                "source_ref": filename,
                "raw_data": {
                    "filename": filename,
                    "detected_format": parse_result.detected_format,
                    "column_info": [c.model_dump() for c in (parse_result.columns or [])],
                },
                "parsed_title": title,
                "parsed_exercise_count": total_exercises,
                "parsed_block_count": total_blocks,
                "parsed_workout": parsed_workouts[0] if len(parsed_workouts) == 1 else {
                    "workouts": parsed_workouts
                },
                "confidence": parse_result.confidence,
                "errors": parse_result.errors if parse_result.errors else None,
                "warnings": parse_result.warnings if parse_result.warnings else None,
                "patterns": self._patterns_to_list(parse_result.patterns) if parse_result.patterns else [],
            }

        except Exception as e:
            logger.exception(f"Error parsing file: {e}")
            return {
                "id": item_id,
                "source_index": index,
                "source_type": "file",
                "source_ref": filename or f"file_{index}",
                "raw_data": {},
                "confidence": 0,
                "errors": [f"Failed to parse file: {str(e)}"],
            }

    async def _detect_from_url(
        self,
        item_id: str,
        source: str,
        index: int
    ) -> Dict[str, Any]:
        """
        Detect workout from URL (YouTube, Instagram, TikTok).

        Fetches metadata using oEmbed APIs for quick preview.
        Full workout extraction is done during the import step.
        """
        try:
            # Fetch metadata using URL parser
            metadata = await URLParser.fetch_metadata(source)

            if metadata.error:
                return {
                    "id": item_id,
                    "source_index": index,
                    "source_type": "urls",
                    "source_ref": source,
                    "raw_data": {
                        "url": source,
                        "platform": metadata.platform,
                        "video_id": metadata.video_id,
                    },
                    "parsed_title": f"{metadata.platform.title()} Video",
                    "parsed_exercise_count": 0,
                    "parsed_block_count": 0,
                    "confidence": 30,
                    "errors": [metadata.error],
                }

            # Build title
            title = metadata.title
            if not title:
                title = f"{metadata.platform.title()} Video"
                if metadata.video_id:
                    title += f" ({metadata.video_id[:8]}...)"

            return {
                "id": item_id,
                "source_index": index,
                "source_type": "urls",
                "source_ref": source,
                "raw_data": {
                    "url": source,
                    "platform": metadata.platform,
                    "video_id": metadata.video_id,
                    "title": metadata.title,
                    "author": metadata.author,
                    "thumbnail_url": metadata.thumbnail_url,
                    "duration_seconds": metadata.duration_seconds,
                },
                "parsed_title": title,
                "parsed_exercise_count": 0,  # Will be populated after ingestion
                "parsed_block_count": 0,
                "confidence": 70,  # Metadata fetched successfully
                "thumbnail_url": metadata.thumbnail_url,
                "author": metadata.author,
                "platform": metadata.platform,
            }

        except Exception as e:
            logger.exception(f"Error detecting URL: {e}")
            return {
                "id": item_id,
                "source_index": index,
                "source_type": "urls",
                "source_ref": source,
                "raw_data": {"url": source},
                "parsed_title": f"Video Workout {index + 1}",
                "parsed_exercise_count": 0,
                "confidence": 20,
                "errors": [f"Failed to fetch URL metadata: {str(e)}"],
            }

    async def _detect_from_image(
        self,
        item_id: str,
        source: str,
        index: int,
        filename: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Detect workout from image (base64 encoded).

        Uses Vision AI via workout-ingestor-api to extract workout data.
        """
        try:
            # Decode base64 image
            try:
                image_data = base64.b64decode(source)
            except Exception as e:
                return {
                    "id": item_id,
                    "source_index": index,
                    "source_type": "images",
                    "source_ref": filename or f"image_{index}",
                    "raw_data": {},
                    "parsed_title": f"Image Workout {index + 1}",
                    "parsed_exercise_count": 0,
                    "confidence": 0,
                    "errors": [f"Invalid base64 image data: {str(e)}"],
                }

            # Use filename or generate one
            fname = filename or f"image_{index}.jpg"

            # Parse using ImageParser
            result = await ImageParser.parse_image(
                image_data=image_data,
                filename=fname,
                mode="vision",
                vision_model="gpt-4o-mini",
            )

            if not result.success:
                return {
                    "id": item_id,
                    "source_index": index,
                    "source_type": "images",
                    "source_ref": fname,
                    "raw_data": {
                        "extraction_method": result.extraction_method,
                    },
                    "parsed_title": f"Image Workout {index + 1}",
                    "parsed_exercise_count": 0,
                    "confidence": result.confidence,
                    "errors": [result.error] if result.error else ["Failed to extract workout from image"],
                }

            # Build title
            title = result.title
            if not title:
                title = f"Image Workout {index + 1}"

            # Count exercises
            exercise_count = len(result.exercises)
            block_count = len(result.blocks)

            return {
                "id": item_id,
                "source_index": index,
                "source_type": "images",
                "source_ref": fname,
                "raw_data": {
                    "extraction_method": result.extraction_method,
                    "model_used": result.model_used,
                    "exercises": result.exercises,
                    "blocks": result.blocks,
                },
                "parsed_title": title,
                "parsed_exercise_count": exercise_count,
                "parsed_block_count": block_count,
                "parsed_workout": result.raw_workout,
                "confidence": result.confidence,
                "flagged_items": result.flagged_items if result.flagged_items else None,
            }

        except Exception as e:
            logger.exception(f"Error detecting image: {e}")
            return {
                "id": item_id,
                "source_index": index,
                "source_type": "images",
                "source_ref": filename or f"image_{index}",
                "raw_data": {},
                "parsed_title": f"Image Workout {index + 1}",
                "parsed_exercise_count": 0,
                "confidence": 0,
                "errors": [f"Failed to process image: {str(e)}"],
            }

    # ========================================================================
    # Step 2: Column Mapping (for files)
    # ========================================================================

    async def apply_column_mappings(
        self,
        job_id: str,
        profile_id: str,
        column_mappings: List[ColumnMapping]
    ) -> BulkMapResponse:
        """
        Apply column mappings to detected file data.
        Transforms raw CSV/Excel data into structured workout data.
        """
        # Get detected items
        detected = self._get_detected_items(job_id, profile_id)

        # TODO: Implement column mapping logic
        # This will be fully implemented in AMA-101

        # Store mappings in job
        if self.supabase:
            self.supabase.table("bulk_import_jobs").update({
                "column_mappings": [m.dict() for m in column_mappings],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", job_id).eq("profile_id", profile_id).execute()

        return BulkMapResponse(
            success=True,
            job_id=job_id,
            mapped_count=len(detected),
            patterns=[],
        )

    # ========================================================================
    # Step 3: Exercise Matching
    # ========================================================================

    async def match_exercises(
        self,
        job_id: str,
        profile_id: str,
        user_mappings: Optional[Dict[str, str]] = None
    ) -> BulkMatchResponse:
        """
        Match exercises to Garmin exercise database.

        Uses fuzzy matching with rapidfuzz to find best matches.

        Confidence thresholds:
        - 90%+ = "matched" (auto-accept)
        - 70-90% = "needs_review" (show with option to change)
        - 50-70% = "needs_review" with lower confidence
        - <50% = "unmapped" (new exercise or needs manual mapping)

        Args:
            job_id: Import job ID
            profile_id: User profile ID
            user_mappings: Optional dict of {original_name: garmin_name} overrides
        """
        detected = self._get_detected_items(job_id, profile_id, selected_only=True)

        # Collect all unique exercises with their sources
        exercise_names = set()
        exercise_sources: Dict[str, List[str]] = {}

        def add_exercise_name(name: str, item_id: str):
            """Helper to add exercise name to tracking sets"""
            if name:
                exercise_names.add(name)
                if name not in exercise_sources:
                    exercise_sources[name] = []
                exercise_sources[name].append(item_id)

        for item in detected:
            workout = item.get("parsed_workout") or {}
            item_id = item["id"]

            # Handle direct exercises on workout (from CSV parser)
            for exercise in workout.get("exercises", []):
                name = exercise.get("raw_name") or exercise.get("name", "")
                add_exercise_name(name, item_id)

            # Handle workouts array (from multi-workout files)
            for sub_workout in workout.get("workouts", []):
                for exercise in sub_workout.get("exercises", []):
                    name = exercise.get("raw_name") or exercise.get("name", "")
                    add_exercise_name(name, item_id)

            # Handle blocks structure (from URL/image parsers)
            for block in workout.get("blocks") or []:
                # Direct exercises in blocks
                for exercise in block.get("exercises", []):
                    name = exercise.get("name", "")
                    add_exercise_name(name, item_id)

                # Superset exercises
                for superset in block.get("supersets", []):
                    for exercise in superset.get("exercises", []):
                        name = exercise.get("name", "")
                        add_exercise_name(name, item_id)

        # Log what we found
        logger.info(f"Found {len(exercise_names)} unique exercises from {len(detected)} detected items")
        if exercise_names:
            logger.info(f"Exercises: {list(exercise_names)[:10]}...")  # Log first 10

        # Match each unique exercise
        exercises = []
        for name in sorted(exercise_names):
            # Check if user has provided a mapping override
            if user_mappings and name in user_mappings:
                user_choice = user_mappings[name]
                exercises.append(ExerciseMatch(
                    id=str(uuid.uuid4()),
                    original_name=name,
                    matched_garmin_name=user_choice,
                    confidence=1.0,  # User confirmed
                    suggestions=[],
                    status="matched",
                    user_selection=user_choice,
                    source_workout_ids=exercise_sources.get(name, []),
                    occurrence_count=len(exercise_sources.get(name, [])),
                ))
                continue

            # Use Garmin matcher for fuzzy matching (async call to mapper-api)
            matched_name, confidence = await find_garmin_exercise_async(name, threshold=30)

            # Get suggestions for alternatives (async call to mapper-api)
            suggestions_list = await get_garmin_suggestions_async(name, limit=5, score_cutoff=0.3)
            suggestions = [
                {"name": sugg_name, "confidence": round(sugg_conf, 2)}
                for sugg_name, sugg_conf in suggestions_list
            ]

            # Determine status based on confidence thresholds
            if matched_name and confidence >= MATCH_AUTO_THRESHOLD:
                status = "matched"
            elif matched_name and confidence >= MATCH_UNMAPPED_THRESHOLD:
                status = "needs_review"
            else:
                status = "unmapped"
                # For unmapped, still include top suggestion as potential match
                if suggestions and not matched_name:
                    matched_name = suggestions[0]["name"]
                    confidence = suggestions[0]["confidence"]

            exercises.append(ExerciseMatch(
                id=str(uuid.uuid4()),
                original_name=name,
                matched_garmin_name=matched_name,
                confidence=round(confidence, 2) if confidence else 0,
                suggestions=suggestions,
                status=status,
                source_workout_ids=exercise_sources.get(name, []),
                occurrence_count=len(exercise_sources.get(name, [])),
            ))

        # Store matches in job
        if self.supabase:
            self.supabase.table("bulk_import_jobs").update({
                "exercise_matches": [e.dict() for e in exercises],
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", job_id).eq("profile_id", profile_id).execute()

        # Calculate statistics
        matched = len([e for e in exercises if e.status == "matched"])
        needs_review = len([e for e in exercises if e.status == "needs_review"])
        unmapped = len([e for e in exercises if e.status == "unmapped"])

        return BulkMatchResponse(
            success=True,
            job_id=job_id,
            exercises=exercises,
            total_exercises=len(exercises),
            matched=matched,
            needs_review=needs_review,
            unmapped=unmapped,
        )

    # ========================================================================
    # Step 4: Preview
    # ========================================================================

    async def generate_preview(
        self,
        job_id: str,
        profile_id: str,
        selected_ids: List[str]
    ) -> BulkPreviewResponse:
        """Generate preview of workouts to be imported."""
        detected = self._get_detected_items(job_id, profile_id)
        logger.info(f"Generating preview for {len(detected)} detected items")

        previews = []
        stats = ImportStats()
        total_exercises = 0

        for item in detected:
            # If no selected_ids provided, select all by default
            is_selected = len(selected_ids) == 0 or item["id"] in selected_ids

            workout_data = item.get("parsed_workout") or {}

            # Extract workout info from parsed_workout or raw_data
            raw_data = item.get("raw_data") or {}

            # Get title from workout data or generate default
            title = (
                workout_data.get("title") or
                workout_data.get("name") or
                raw_data.get("title") or
                f"Workout {item.get('source_index', 0) + 1}"
            )

            # Count exercises from all possible structures
            exercise_count = 0
            block_count = 0

            # Handle direct exercises on workout (from CSV parser)
            direct_exercises = workout_data.get("exercises") or []
            exercise_count += len(direct_exercises)
            if direct_exercises:
                block_count = 1  # Treat as single block

            # Handle workouts array (from multi-workout files)
            for sub_workout in workout_data.get("workouts") or []:
                sub_exercises = sub_workout.get("exercises") or []
                exercise_count += len(sub_exercises)
                if sub_exercises:
                    block_count += 1

            # Handle blocks structure (from URL/image parsers)
            blocks = workout_data.get("blocks") or []
            block_count += len(blocks)
            for block in blocks:
                exercises = block.get("exercises") or []
                exercise_count += len(exercises)
                # Also count superset exercises
                for superset in block.get("supersets") or []:
                    exercise_count += len(superset.get("exercises") or [])

            if is_selected:
                stats.total_selected += 1
                total_exercises += exercise_count
            else:
                stats.total_skipped += 1

            preview = PreviewWorkout(
                id=str(uuid.uuid4()),
                detected_item_id=item["id"],
                title=title,
                description=workout_data.get("description"),
                exercise_count=exercise_count,
                block_count=block_count,
                validation_issues=[],
                workout=workout_data,
                selected=is_selected,
                is_duplicate=item.get("is_duplicate", False),
                duplicate_of=item.get("duplicate_of"),
            )

            previews.append(preview)

        stats.total_detected = len(detected)
        stats.exercises_matched = total_exercises

        logger.info(f"Preview generated: {stats.total_selected} selected, {total_exercises} exercises")

        # Debug: Log first preview workout data
        if previews:
            first_preview = previews[0]
            workout_dict = first_preview.workout if hasattr(first_preview, 'workout') else {}
            logger.info(f"First preview workout keys: {list(workout_dict.keys()) if workout_dict else 'empty'}")
            if workout_dict.get("exercises"):
                logger.info(f"  First preview has {len(workout_dict['exercises'])} exercises")

        return BulkPreviewResponse(
            success=True,
            job_id=job_id,
            workouts=previews,
            stats=stats,
        )

    # ========================================================================
    # Step 5: Import Execution
    # ========================================================================

    async def execute_import(
        self,
        job_id: str,
        profile_id: str,
        workout_ids: List[str],
        device: str,
        async_mode: bool = True
    ) -> BulkExecuteResponse:
        """
        Execute the actual import of workouts.

        In async mode, creates a background job and returns immediately.
        In sync mode, processes all workouts before returning.
        """
        # Validate job exists and has detected items
        detected = self._get_detected_items(job_id, profile_id)
        if not detected:
            logger.warning(f"Execute import failed: job {job_id} not found or has no items")
            return BulkExecuteResponse(
                success=False,
                job_id=job_id,
                status="not_found",
                message="Import session expired. Please start a new import.",
            )

        # Validate workout IDs exist in detected items
        detected_ids = {item["id"] for item in detected}
        missing_ids = [wid for wid in workout_ids if wid not in detected_ids]
        if missing_ids:
            logger.warning(f"Execute import: {len(missing_ids)} workout IDs not found in detected items")

        self._update_job_status(
            job_id, profile_id, "running",
            target_device=device,
            total_items=len(workout_ids),  # Set total for progress calculation
            processed_items=0  # Reset processed count
        )

        if async_mode:
            # Start background task
            asyncio.create_task(
                self._process_import_async(
                    job_id, profile_id, workout_ids, device
                )
            )

            return BulkExecuteResponse(
                success=True,
                job_id=job_id,
                status="running",
                message="Import started in background",
            )
        else:
            # Synchronous import
            results = await self._process_import_sync(
                job_id, profile_id, workout_ids, device
            )

            return BulkExecuteResponse(
                success=True,
                job_id=job_id,
                status="complete",
                message=f"Imported {len([r for r in results if r.status == 'success'])} workouts",
            )

    async def _process_import_async(
        self,
        job_id: str,
        profile_id: str,
        workout_ids: List[str],
        device: str
    ):
        """Background task for processing imports"""
        try:
            results = await self._process_import_sync(
                job_id, profile_id, workout_ids, device
            )

            self._update_job_status(
                job_id, profile_id, "complete",
                results=[r.dict() for r in results]
            )

        except Exception as e:
            logger.error(f"Import job {job_id} failed: {e}")
            self._update_job_status(
                job_id, profile_id, "failed",
                error=str(e)
            )

    async def _process_import_sync(
        self,
        job_id: str,
        profile_id: str,
        workout_ids: List[str],
        device: str
    ) -> List[ImportResult]:
        """Synchronous import processing"""
        detected = self._get_detected_items(job_id, profile_id)
        results = []

        total = len(workout_ids)

        for idx, workout_id in enumerate(workout_ids):
            # Check for cancellation
            job = self._get_job(job_id, profile_id)
            if job and job.get("status") == "cancelled":
                break

            # Update progress
            self._update_job_progress(job_id, profile_id, idx + 1, workout_id)

            # Find the detected item
            item = next(
                (d for d in detected if d["id"] == workout_id),
                None
            )

            if not item:
                results.append(ImportResult(
                    workout_id=workout_id,
                    title="Unknown",
                    status="failed",
                    error="Workout not found",
                ))
                continue

            try:
                # TODO: Implement actual workout saving
                # This will use database.save_workout()
                result = await self._import_single_workout(
                    item, profile_id, device
                )
                results.append(result)

            except Exception as e:
                logger.error(f"Failed to import workout {workout_id}: {e}")
                results.append(ImportResult(
                    workout_id=workout_id,
                    title=item.get("parsed_title", "Unknown"),
                    status="failed",
                    error=str(e),
                ))

        return results

    def _transform_to_workout_structure(
        self,
        item: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Transform detected item into WorkoutStructure format for mapper-api.

        The mapper-api expects workout_data in this format:
        {
            "title": "Workout Title",
            "source": "bulk_import",
            "blocks": [
                {
                    "label": "Main",
                    "structure": "3 sets" or None,
                    "exercises": [...],
                    "supersets": [...]
                }
            ]
        }

        This handles:
        - CSV parser output (flat exercises list)
        - Image/URL parser output (already has blocks)

        Note: Multi-workout files (workouts array) are handled separately
        in _import_single_workout to save each as a separate workout.
        """
        workout_data = item.get("parsed_workout") or {}
        raw_data = item.get("raw_data") or {}

        # Get title
        title = (
            workout_data.get("title") or
            workout_data.get("name") or
            raw_data.get("title") or
            item.get("parsed_title") or
            f"Workout {item.get('source_index', 0) + 1}"
        )

        # If workout already has blocks structure, use it directly
        if workout_data.get("blocks"):
            return {
                "title": title,
                "source": f"bulk_import:{item.get('source_type', 'file')}",
                "blocks": workout_data["blocks"],
            }

        # Build blocks from exercises
        blocks = []

        # Handle direct exercises on workout (from CSV parser - single workout)
        direct_exercises = workout_data.get("exercises") or []
        if direct_exercises:
            # Transform exercises to the expected format
            transformed_exercises = []
            for ex in direct_exercises:
                exercise_name = ex.get("garmin_name") or ex.get("name") or ex.get("raw_name", "Unknown Exercise")
                # Infer type if not provided
                exercise_type = ex.get("type") or self._infer_exercise_type(exercise_name)

                transformed_ex = {
                    "name": exercise_name,
                    "sets": ex.get("sets"),
                    "reps": ex.get("reps"),
                    "reps_range": ex.get("reps_range"),
                    "duration_sec": ex.get("duration_sec"),
                    "rest_sec": ex.get("rest_sec"),
                    "distance_m": ex.get("distance_m"),
                    "weight_kg": ex.get("weight_kg"),
                    "type": exercise_type,
                }
                transformed_exercises.append(transformed_ex)

            blocks.append({
                "label": "Main",
                "structure": None,
                "exercises": transformed_exercises,
                "supersets": [],
            })

        return {
            "title": title,
            "source": f"bulk_import:{item.get('source_type', 'file')}",
            "blocks": blocks,
        }

    async def _save_workout_to_api(
        self,
        workout_data: Dict[str, Any],
        profile_id: str,
        device: str,
        source_ref: str,
    ) -> Optional[str]:
        """
        Save workout to mapper-api /workouts/save endpoint.

        Args:
            workout_data: Transformed workout structure with blocks
            profile_id: User profile ID
            device: Target device (e.g., "EDGE_1040")
            source_ref: Source reference for tracking

        Returns:
            Saved workout ID if successful, None if failed
        """
        try:
            payload = {
                "profile_id": profile_id,
                "workout_data": workout_data,
                "sources": [source_ref],
                "device": device,
                "title": workout_data.get("title"),
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{MAPPER_API_URL}/workouts/save",
                    json=payload
                )

                if response.status_code == 200:
                    result = response.json()
                    if result.get("success"):
                        return result.get("workout_id")
                    else:
                        logger.error(f"Mapper API save failed: {result.get('message')}")
                else:
                    logger.error(f"Mapper API returned {response.status_code}: {response.text}")

        except Exception as e:
            logger.error(f"Failed to save workout to API: {e}")

        return None

    def _infer_exercise_type(self, exercise_name: str) -> str:
        """
        Infer exercise type based on exercise name.

        Returns:
            "cardio" for running, biking, swimming, etc.
            "strength" for weight exercises (default)
        """
        if not exercise_name:
            return "strength"

        name_lower = exercise_name.lower()

        # Cardio/running patterns
        cardio_keywords = [
            "run", "running", "jog", "jogging", "sprint",
            "bike", "biking", "cycle", "cycling",
            "swim", "swimming",
            "row", "rowing", "ski", "skiing", "erg",
            "walk", "walking", "hike", "hiking",
            "cardio", "aerobic",
            "jump rope", "skipping",
            "stair", "stairs", "stepper",
            "elliptical", "treadmill",
        ]

        # Distance/time based activities (often cardio)
        distance_keywords = [
            "m run", "km run", "mile",
            "meter", "metres", "meters",
        ]

        # Check for cardio keywords
        for keyword in cardio_keywords:
            if keyword in name_lower:
                return "cardio"

        # Check for distance keywords
        for keyword in distance_keywords:
            if keyword in name_lower:
                return "cardio"

        # Conditioning exercises (can be strength or cardio - default to cardio for HYROX-style)
        conditioning_keywords = [
            "sled push", "sled pull", "farmers carry", "farmer carry",
            "wall ball", "burpee", "box jump",
            "kettlebell swing", "kb swing",
            "battle rope", "rope climb",
            "assault bike", "airbike", "air bike",
        ]

        for keyword in conditioning_keywords:
            if keyword in name_lower:
                return "cardio"

        # Default to strength
        return "strength"

    def _transform_single_workout_to_structure(
        self,
        workout: Dict[str, Any],
        source_type: str,
        fallback_title: str,
    ) -> Dict[str, Any]:
        """
        Transform a single workout dict (from workouts array or direct) into WorkoutStructure.

        This handles the case where we have a workout with exercises directly,
        not wrapped in blocks.
        """
        title = workout.get("name") or workout.get("title") or fallback_title
        exercises = workout.get("exercises") or []

        # Transform exercises to the expected format
        transformed_exercises = []
        for ex in exercises:
            exercise_name = ex.get("garmin_name") or ex.get("name") or ex.get("raw_name", "Unknown Exercise")
            # Infer type if not provided
            exercise_type = ex.get("type") or self._infer_exercise_type(exercise_name)

            transformed_ex = {
                "name": exercise_name,
                "sets": ex.get("sets"),
                "reps": ex.get("reps"),
                "reps_range": ex.get("reps_range"),
                "duration_sec": ex.get("duration_sec"),
                "rest_sec": ex.get("rest_sec"),
                "distance_m": ex.get("distance_m"),
                "weight_kg": ex.get("weight_kg"),
                "type": exercise_type,
            }
            transformed_exercises.append(transformed_ex)

        return {
            "title": title,
            "source": f"bulk_import:{source_type}",
            "blocks": [{
                "label": "Main",
                "structure": None,
                "exercises": transformed_exercises,
                "supersets": [],
            }],
        }

    async def _import_single_workout(
        self,
        item: Dict[str, Any],
        profile_id: str,
        device: str
    ) -> ImportResult:
        """
        Import workout(s) from a detected item.

        Handles two cases:
        1. Single workout - save directly
        2. Multi-workout file (workouts array) - save each as separate workout

        Steps:
        1. Check if item has multiple workouts
        2. Transform each to WorkoutStructure format
        3. Save to mapper-api /workouts/save endpoint
        4. Return result with saved workout ID(s)
        """
        title = item.get("parsed_title", "Unknown")
        source_ref = item.get("source_ref", "")
        source_type = item.get("source_type", "file")
        workout_data = item.get("parsed_workout") or {}

        try:
            # Check if this is a multi-workout file
            workouts_array = workout_data.get("workouts") or []

            if workouts_array:
                # Multi-workout file - save each workout separately
                saved_ids = []
                failed_titles = []

                for idx, sub_workout in enumerate(workouts_array):
                    sub_title = sub_workout.get("name") or sub_workout.get("title") or f"Workout {idx + 1}"

                    # Transform this individual workout
                    workout_structure = self._transform_single_workout_to_structure(
                        workout=sub_workout,
                        source_type=source_type,
                        fallback_title=sub_title,
                    )

                    # Skip workouts with no exercises
                    total_exercises = sum(
                        len(block.get("exercises", []))
                        for block in workout_structure.get("blocks", [])
                    )
                    if total_exercises == 0:
                        logger.warning(f"Skipping workout '{sub_title}' - no exercises found")
                        continue

                    # Save to API
                    saved_id = await self._save_workout_to_api(
                        workout_data=workout_structure,
                        profile_id=profile_id,
                        device=device,
                        source_ref=f"{source_ref}:{idx}",
                    )

                    if saved_id:
                        saved_ids.append(saved_id)
                        logger.info(f"Successfully saved workout '{sub_title}' with ID {saved_id}")
                    else:
                        failed_titles.append(sub_title)
                        logger.error(f"Failed to save workout '{sub_title}'")

                # Return combined result
                if saved_ids and not failed_titles:
                    return ImportResult(
                        workout_id=item["id"],
                        title=f"{len(saved_ids)} workouts imported",
                        status="success",
                        saved_workout_id=",".join(saved_ids),
                    )
                elif saved_ids:
                    return ImportResult(
                        workout_id=item["id"],
                        title=f"{len(saved_ids)} imported, {len(failed_titles)} failed",
                        status="success",
                        saved_workout_id=",".join(saved_ids),
                        error=f"Failed: {', '.join(failed_titles)}",
                    )
                else:
                    return ImportResult(
                        workout_id=item["id"],
                        title=title,
                        status="failed",
                        error="All workouts failed to save",
                    )
            else:
                # Single workout - use existing transform method
                workout_structure = self._transform_to_workout_structure(item)

                # Skip workouts with no exercises
                total_exercises = sum(
                    len(block.get("exercises", []))
                    for block in workout_structure.get("blocks", [])
                )
                if total_exercises == 0:
                    logger.warning(f"Skipping workout '{title}' - no exercises found")
                    return ImportResult(
                        workout_id=item["id"],
                        title=title,
                        status="skipped",
                        error="No exercises found",
                    )

                # Save to API
                saved_id = await self._save_workout_to_api(
                    workout_data=workout_structure,
                    profile_id=profile_id,
                    device=device,
                    source_ref=source_ref,
                )

                if saved_id:
                    logger.info(f"Successfully saved workout '{title}' with ID {saved_id}")
                    return ImportResult(
                        workout_id=item["id"],
                        title=title,
                        status="success",
                        saved_workout_id=saved_id,
                    )
                else:
                    return ImportResult(
                        workout_id=item["id"],
                        title=title,
                        status="failed",
                        error="Failed to save workout to database",
                    )

        except Exception as e:
            logger.exception(f"Error importing workout '{title}': {e}")
            return ImportResult(
                workout_id=item["id"],
                title=title,
                status="failed",
                error=str(e),
            )

    # ========================================================================
    # Status & Control
    # ========================================================================

    async def get_import_status(
        self,
        job_id: str,
        profile_id: str
    ) -> BulkStatusResponse:
        """Get status of an import job"""
        job = self._get_job(job_id, profile_id)

        if not job:
            return BulkStatusResponse(
                success=False,
                job_id=job_id,
                status="not_found",
                progress=0,
                error="Job not found",
            )

        total = job.get("total_items", 0)
        processed = job.get("processed_items", 0)
        progress = int((processed / total * 100) if total > 0 else 0)

        return BulkStatusResponse(
            success=True,
            job_id=job_id,
            status=job.get("status", "unknown"),
            progress=progress,
            current_item=job.get("current_item"),
            results=[ImportResult(**r) for r in job.get("results", [])],
            error=job.get("error"),
            created_at=job.get("created_at"),
            updated_at=job.get("updated_at"),
        )

    async def cancel_import(
        self,
        job_id: str,
        profile_id: str
    ) -> bool:
        """Cancel a running import job"""
        job = self._get_job(job_id, profile_id)

        if not job or job.get("status") != "running":
            return False

        return self._update_job_status(job_id, profile_id, "cancelled")


# ============================================================================
# Global Service Instance
# ============================================================================

bulk_import_service = BulkImportService()
