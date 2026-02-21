"""Standalone URL import pipeline that yields SSE events.

Wraps the same ingestor-api endpoints used by AsyncFunctionDispatcher's Phase 2
import handlers, but as an async generator producing typed PipelineEvent objects
for SSE streaming.

Stages: fetching → extracting → parsing → mapping → preview [CHECKPOINT]

Part of AMA-567 Phase C: Import Pipelines
"""

import asyncio
import json
import logging
import uuid
from typing import AsyncGenerator, Any, Dict, Optional, Set, TYPE_CHECKING
from urllib.parse import urlparse

import httpx

from backend.services.workout_pipeline_service import PipelineEvent

if TYPE_CHECKING:
    from backend.services.preview_store import PreviewStore
    from infrastructure.db.async_pipeline_run_repository import AsyncPipelineRunRepository

logger = logging.getLogger(__name__)

# Allowed domains per platform (SSRF prevention)
_PLATFORM_DOMAINS: Dict[str, Set[str]] = {
    "youtube": {"youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"},
    "tiktok": {"tiktok.com", "www.tiktok.com", "vm.tiktok.com", "m.tiktok.com"},
    "instagram": {"instagram.com", "www.instagram.com", "m.instagram.com"},
    "pinterest": {"pinterest.com", "www.pinterest.com", "pin.it", "m.pinterest.com"},
}

# Platform → ingestor endpoint path
_PLATFORM_ENDPOINTS: Dict[str, str] = {
    "youtube": "/ingest/youtube",
    "tiktok": "/ingest/tiktok",
    "instagram": "/ingest/instagram_test",
    "pinterest": "/ingest/pinterest",
}

# Human-readable names for stage messages
_PLATFORM_LABELS: Dict[str, str] = {
    "youtube": "YouTube video",
    "tiktok": "TikTok video",
    "instagram": "Instagram post",
    "pinterest": "Pinterest pin",
}


def detect_platform(url: str) -> Optional[str]:
    """Detect platform from URL domain. Returns None if unsupported."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return None
        domain = parsed.netloc.lower().replace("www.", "")
    except Exception:
        return None

    for platform, domains in _PLATFORM_DOMAINS.items():
        for allowed in domains:
            if domain == allowed or domain == f"www.{allowed}":
                return platform
    return None


class URLImportPipelineService:
    """Imports workouts from URLs via ingestor-api and yields streaming SSE events."""

    def __init__(
        self,
        ingestor_url: str,
        auth_token: str,
        mapper_api_url: str = "",
        preview_store: Optional["PreviewStore"] = None,
        pipeline_run_repo: Optional["AsyncPipelineRunRepository"] = None,
    ):
        self._ingestor_url = ingestor_url
        self._auth_token = auth_token
        self._mapper_url = mapper_api_url
        self._preview_store = preview_store
        self._run_repo = pipeline_run_repo

    async def _record_status(
        self,
        run_id: Optional[str],
        status: str,
        result_data: Optional[dict] = None,
        error: Optional[str] = None,
    ) -> None:
        """Best-effort update of pipeline_runs row. Never raises."""
        if not self._run_repo or not run_id:
            return
        try:
            await self._run_repo.update_status(run_id, status, result_data, error)
        except Exception:
            logger.warning("Failed to update pipeline run %s to %s", run_id, status)

    async def ingest(
        self,
        url: str,
        platform: Optional[str] = None,
        user_id: Optional[str] = None,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> AsyncGenerator[PipelineEvent, None]:
        """Import a workout from a URL and yield SSE events as stages progress.

        Stages: fetching → extracting → parsing → mapping → preview [CHECKPOINT]
        """
        # Auto-detect platform if not provided
        if not platform:
            platform = detect_platform(url)
        if not platform or platform not in _PLATFORM_ENDPOINTS:
            yield PipelineEvent(
                "error",
                json.dumps({
                    "stage": "fetching",
                    "message": "Unsupported URL. Supported platforms: YouTube, TikTok, Instagram, Pinterest.",
                    "recoverable": False,
                }),
            )
            return

        label = _PLATFORM_LABELS[platform]

        # Validate URL scheme and domain (SSRF prevention)
        allowed = _PLATFORM_DOMAINS[platform]
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
        except Exception:
            yield PipelineEvent(
                "error",
                json.dumps({"stage": "fetching", "message": "Invalid URL format.", "recoverable": False}),
            )
            return

        if parsed.scheme not in ("http", "https"):
            yield PipelineEvent(
                "error",
                json.dumps({
                    "stage": "fetching",
                    "message": "Only HTTP/HTTPS URLs are supported.",
                    "recoverable": False,
                }),
            )
            return

        stripped = domain.replace("www.", "")
        if stripped not in allowed and domain not in allowed:
            yield PipelineEvent(
                "error",
                json.dumps({
                    "stage": "fetching",
                    "message": f"URL domain not allowed for {label} import.",
                    "recoverable": False,
                }),
            )
            return

        # Create pipeline run record (best-effort)
        run_id: Optional[str] = None
        if self._run_repo and user_id:
            try:
                row = await self._run_repo.create(
                    user_id=user_id,
                    pipeline="url_import",
                    input_data={"url": url, "platform": platform},
                )
                run_id = row.get("id")
                await self._record_status(run_id, "running")
            except Exception:
                logger.warning("Failed to create pipeline run record")

        # Stage 1: Fetching
        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "fetching", "message": f"Fetching {label}..."}),
        )

        if cancel_event and cancel_event.is_set():
            await self._record_status(run_id, "cancelled")
            yield PipelineEvent(
                "error",
                json.dumps({"stage": "fetching", "message": "Cancelled", "recoverable": False}),
            )
            return

        # Stage 2: Extracting
        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "extracting", "message": f"Extracting content from {label}..."}),
        )

        # Build request body
        body: Dict[str, Any] = {"url": url.strip()}
        if platform == "tiktok":
            body["mode"] = "auto"

        # Call ingestor (covers fetching + extracting + parsing internally)
        endpoint = _PLATFORM_ENDPOINTS[platform]
        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                response = await client.post(
                    f"{self._ingestor_url}{endpoint}",
                    json=body,
                    headers={"Authorization": self._auth_token},
                )
        except httpx.TimeoutException:
            await self._record_status(run_id, "failed", error="Import timed out")
            yield PipelineEvent(
                "error",
                json.dumps({
                    "stage": "extracting",
                    "message": "Import timed out. The video may be too long.",
                    "recoverable": True,
                }),
            )
            return
        except httpx.HTTPError:
            await self._record_status(run_id, "failed", error="Failed to connect to import service")
            yield PipelineEvent(
                "error",
                json.dumps({
                    "stage": "extracting",
                    "message": "Failed to connect to import service.",
                    "recoverable": True,
                }),
            )
            return

        if cancel_event and cancel_event.is_set():
            await self._record_status(run_id, "cancelled")
            yield PipelineEvent(
                "error",
                json.dumps({"stage": "extracting", "message": "Cancelled", "recoverable": False}),
            )
            return

        try:
            result = response.json()
        except Exception:
            await self._record_status(run_id, "failed", error="Invalid response from import service")
            yield PipelineEvent(
                "error",
                json.dumps({
                    "stage": "extracting",
                    "message": "Received an invalid response from the import service.",
                    "recoverable": True,
                }),
            )
            return

        if response.status_code != 200 or not result.get("success", True):
            error_msg = result.get("error", "Failed to extract workout from URL.")
            await self._record_status(run_id, "failed", error=error_msg)
            yield PipelineEvent(
                "error",
                json.dumps({"stage": "extracting", "message": error_msg, "recoverable": True}),
            )
            return

        # Stage 3: Parsing
        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "parsing", "message": "Identifying exercises..."}),
        )

        # Extract workout data (handle both response formats from ingestor)
        if "workout" in result:
            workout = result["workout"]
        elif "title" in result or "blocks" in result:
            workout = {k: v for k, v in result.items() if k not in ("success", "error", "_provenance")}
        else:
            await self._record_status(run_id, "failed", error="No workout data in response")
            yield PipelineEvent(
                "error",
                json.dumps({
                    "stage": "parsing",
                    "message": "Could not extract workout data from this URL.",
                    "recoverable": True,
                }),
            )
            return

        # Build exercise list from blocks or direct exercises
        exercises = workout.get("exercises", [])
        if not exercises:
            blocks = workout.get("blocks", [])
            for block in blocks:
                exercises.extend(block.get("exercises", []))

        if cancel_event and cancel_event.is_set():
            await self._record_status(run_id, "cancelled")
            yield PipelineEvent("error", json.dumps({"stage": "parsing", "message": "Cancelled", "recoverable": False}))
            return

        # Stage 4: Mapping
        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "mapping", "message": "Matching to your exercise library..."}),
        )

        # TODO: Call mapper-api for exercise matching when available.
        # For now, exercises pass through directly (same as Phase 2 chat handlers).
        unmatched: list = []

        if cancel_event and cancel_event.is_set():
            await self._record_status(run_id, "cancelled")
            yield PipelineEvent("error", json.dumps({"stage": "mapping", "message": "Cancelled", "recoverable": False}))
            return

        # Extract clarification fields produced by the ingestor (AMA-717)
        needs_clarification = workout.get("needs_clarification", False)

        ambiguous_blocks = []
        for block in workout.get("blocks", []):
            confidence = block.get("structure_confidence", 1.0)
            options = block.get("structure_options", [])
            if confidence < 0.8 and options:
                ambiguous_blocks.append({
                    "id": block.get("id", ""),
                    "label": block.get("label"),
                    "structure": block.get("structure"),
                    "structure_confidence": confidence,
                    "structure_options": options,
                    "exercises": [
                        {"name": ex.get("name", "Unknown")}
                        for ex in block.get("exercises", [])
                    ],
                })

        # Stage 5: Preview (CHECKPOINT)
        title = workout.get("title") or workout.get("name", "Imported Workout")
        preview_id = str(uuid.uuid4())

        # Store preview data for later save_and_push
        preview_data = {
            "source_url": url.strip(),
            "platform": platform,
            "workout": workout,
            "title": title,
        }
        if self._preview_store and user_id:
            self._preview_store.put(preview_id, user_id, preview_data)

        await self._record_status(run_id, "completed", result_data={"preview_id": preview_id})

        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "complete", "message": "Workout ready for review!"}),
        )

        yield PipelineEvent(
            "preview",
            json.dumps({
                "preview_id": preview_id,
                "source_url": url.strip(),
                "platform": platform,
                "workout": {
                    "name": title,
                    "exercises": [
                        {
                            "name": ex.get("name", "Unknown"),
                            "sets": ex.get("sets"),
                            "reps": ex.get("reps"),
                            "muscle_group": ex.get("muscle_group"),
                            "notes": ex.get("notes"),
                        }
                        for ex in exercises
                    ],
                    "block_count": len(workout.get("blocks", [])),
                    "exercise_count": len(exercises),
                },
                "unmatched": unmatched,
                "needs_clarification": needs_clarification,
                "ambiguous_blocks": ambiguous_blocks,
            }),
        )

        # Non-blocking quality evaluation
        try:
            from backend.services.workout_quality_evaluator import WorkoutQualityEvaluator
            evaluator = WorkoutQualityEvaluator()
            # Use flattened exercises for evaluation (blocks already extracted above)
            eval_workout = {**workout, "exercises": exercises}
            score = evaluator.evaluate(eval_workout, requested_equipment=None)
            logger.info(
                "Workout quality score: overall=%.2f count=%.2f variety=%.2f "
                "volume=%.2f equip=%.2f hallucination=%.2f issues=%s",
                score.overall, score.exercise_count, score.variety,
                score.volume_sanity, score.equipment_match, score.hallucination,
                score.issues,
            )
        except Exception:
            logger.warning("Quality evaluation failed (non-blocking)")
