"""Parallel bulk import pipeline that imports multiple URLs concurrently.

Wraps the same ingestor-api endpoints used by URLImportPipelineService, but
processes a list of URLs in parallel with bounded concurrency via
asyncio.Semaphore.  Events from individual sub-pipelines are funnelled through
an asyncio.Queue so the caller can yield them as they arrive.

Part of AMA-567 Phase F: Bulk Import
"""

import asyncio
import json
import logging
import uuid
from typing import Any, AsyncGenerator, Dict, Optional, TYPE_CHECKING

import httpx

from backend.services.workout_pipeline_service import PipelineEvent
from backend.services.url_import_pipeline_service import (
    detect_platform,
    _PLATFORM_ENDPOINTS,
    _PLATFORM_LABELS,
)

if TYPE_CHECKING:
    from backend.services.preview_store import PreviewStore
    from infrastructure.db.async_pipeline_run_repository import AsyncPipelineRunRepository

logger = logging.getLogger(__name__)

# Sentinel value pushed into the queue to signal that all tasks are done.
_SENTINEL = object()


class BulkImportPipelineService:
    """Imports multiple workout URLs in parallel with bounded concurrency."""

    def __init__(
        self,
        ingestor_url: str,
        auth_token: str,
        mapper_api_url: str = "",
        preview_store: Optional["PreviewStore"] = None,
        pipeline_run_repo: Optional["AsyncPipelineRunRepository"] = None,
        max_concurrent: int = 3,
    ):
        self._ingestor_url = ingestor_url
        self._auth_token = auth_token
        self._mapper_url = mapper_api_url
        self._preview_store = preview_store
        self._run_repo = pipeline_run_repo
        self._max_concurrent = max_concurrent

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def bulk_import(
        self,
        urls: list[str],
        user_id: Optional[str] = None,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> AsyncGenerator[PipelineEvent, None]:
        """Import multiple URLs in parallel, yielding SSE events as they arrive.

        Events carry ``sub_pipeline_index`` and ``sub_pipeline_status`` fields
        so the frontend can render per-URL progress.  A final ``preview`` event
        aggregates all successful workouts.
        """
        # Validation
        if not urls:
            yield PipelineEvent(
                "error",
                json.dumps({"message": "No URLs provided. Please supply at least one URL."}),
            )
            return

        # Stage: validating
        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "validating", "message": f"Validating {len(urls)} URL(s)..."}),
        )

        # Validate each URL and collect (index, url, platform) triples
        valid_items: list[tuple[int, str, str]] = []
        for idx, url in enumerate(urls):
            platform = detect_platform(url)
            if platform is None or platform not in _PLATFORM_ENDPOINTS:
                yield PipelineEvent(
                    "sub_pipeline_error",
                    json.dumps({
                        "sub_pipeline_index": idx,
                        "url": url,
                        "message": "Unsupported URL. Supported platforms: YouTube, TikTok, Instagram, Pinterest.",
                    }),
                )
            else:
                valid_items.append((idx, url, platform))

        if not valid_items:
            yield PipelineEvent(
                "error",
                json.dumps({"message": "No valid URLs to import after validation."}),
            )
            return

        # Stage: importing
        yield PipelineEvent(
            "stage",
            json.dumps({
                "stage": "importing",
                "message": f"Importing {len(valid_items)} workout(s) (max {self._max_concurrent} at a time)...",
            }),
        )

        # Set up queue + semaphore for bounded parallel execution
        queue: asyncio.Queue[PipelineEvent | object] = asyncio.Queue()
        semaphore = asyncio.Semaphore(self._max_concurrent)
        results: Dict[int, Optional[dict]] = {idx: None for idx, _, _ in valid_items}

        async def _import_one(idx: int, url: str, platform: str) -> None:
            """Import a single URL, putting events into the shared queue."""
            async with semaphore:
                label = _PLATFORM_LABELS.get(platform, platform)

                await queue.put(PipelineEvent(
                    "stage",
                    json.dumps({
                        "stage": "fetching",
                        "sub_pipeline_index": idx,
                        "sub_pipeline_status": "running",
                        "message": f"[{idx + 1}/{len(urls)}] Fetching {label}...",
                    }),
                ))

                if cancel_event and cancel_event.is_set():
                    results[idx] = None
                    return

                # Build request
                body: Dict[str, Any] = {"url": url.strip()}
                if platform == "tiktok":
                    body["mode"] = "auto"

                endpoint = _PLATFORM_ENDPOINTS[platform]

                try:
                    async with httpx.AsyncClient(timeout=90.0) as client:
                        response = await client.post(
                            f"{self._ingestor_url}{endpoint}",
                            json=body,
                            headers={"Authorization": self._auth_token},
                        )
                except (httpx.TimeoutException, httpx.HTTPError) as exc:
                    err_msg = "Import timed out" if isinstance(exc, httpx.TimeoutException) else "Connection failed"
                    await queue.put(PipelineEvent(
                        "sub_pipeline_error",
                        json.dumps({
                            "sub_pipeline_index": idx,
                            "sub_pipeline_status": "failed",
                            "url": url,
                            "message": f"[{idx + 1}/{len(urls)}] {err_msg}.",
                        }),
                    ))
                    results[idx] = None
                    return

                try:
                    result = response.json()
                except Exception:
                    await queue.put(PipelineEvent(
                        "sub_pipeline_error",
                        json.dumps({
                            "sub_pipeline_index": idx,
                            "sub_pipeline_status": "failed",
                            "url": url,
                            "message": f"[{idx + 1}/{len(urls)}] Invalid response from import service.",
                        }),
                    ))
                    results[idx] = None
                    return

                if response.status_code != 200 or not result.get("success", True):
                    error_msg = result.get("error", "Failed to extract workout from URL.")
                    await queue.put(PipelineEvent(
                        "sub_pipeline_error",
                        json.dumps({
                            "sub_pipeline_index": idx,
                            "sub_pipeline_status": "failed",
                            "url": url,
                            "message": f"[{idx + 1}/{len(urls)}] {error_msg}",
                        }),
                    ))
                    results[idx] = None
                    return

                # Extract workout data
                workout: Optional[dict] = None
                if "workout" in result:
                    workout = result["workout"]
                elif "title" in result or "blocks" in result:
                    workout = {k: v for k, v in result.items() if k not in ("success", "error", "_provenance")}

                if workout is None:
                    await queue.put(PipelineEvent(
                        "sub_pipeline_error",
                        json.dumps({
                            "sub_pipeline_index": idx,
                            "sub_pipeline_status": "failed",
                            "url": url,
                            "message": f"[{idx + 1}/{len(urls)}] No workout data found.",
                        }),
                    ))
                    results[idx] = None
                    return

                # Normalize exercises
                exercises = workout.get("exercises", [])
                if not exercises:
                    blocks = workout.get("blocks", [])
                    for block in blocks:
                        exercises.extend(block.get("exercises", []))

                title = workout.get("title") or workout.get("name", "Imported Workout")

                results[idx] = {
                    "url": url.strip(),
                    "platform": platform,
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
                    "exercise_count": len(exercises),
                }

                await queue.put(PipelineEvent(
                    "stage",
                    json.dumps({
                        "stage": "sub_complete",
                        "sub_pipeline_index": idx,
                        "sub_pipeline_status": "completed",
                        "message": f"[{idx + 1}/{len(urls)}] Imported \"{title}\".",
                    }),
                ))

        # Coordinator task: launch all imports, then push sentinel
        async def _coordinator() -> None:
            tasks = [
                asyncio.create_task(_import_one(idx, url, platform))
                for idx, url, platform in valid_items
            ]
            await asyncio.gather(*tasks, return_exceptions=True)
            await queue.put(_SENTINEL)

        coordinator_task = asyncio.create_task(_coordinator())

        # Yield events from the queue as they arrive
        while True:
            item = await queue.get()
            if item is _SENTINEL:
                break
            yield item  # type: ignore[misc]

        # Wait for coordinator (should already be done, but be safe)
        await coordinator_task

        # Build aggregate preview
        successful_workouts = [results[idx] for idx in sorted(results) if results[idx] is not None]
        failed_count = sum(1 for v in results.values() if v is None)

        preview_id = str(uuid.uuid4())

        if self._preview_store and user_id:
            self._preview_store.put(preview_id, user_id, {
                "bulk": True,
                "workouts": successful_workouts,
            })

        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "complete", "message": "Bulk import complete!"}),
        )

        yield PipelineEvent(
            "preview",
            json.dumps({
                "preview_id": preview_id,
                "workouts": successful_workouts,
                "total_urls": len(urls),
                "successful": len(successful_workouts),
                "failed": failed_count,
            }),
        )
