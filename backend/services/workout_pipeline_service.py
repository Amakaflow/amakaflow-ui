"""Standalone workout generation pipeline that yields SSE events.

Wraps the same ingestor-api call used by AsyncFunctionDispatcher._generate_workout,
but as an async generator producing typed PipelineEvent objects for SSE streaming.
Also provides a save_and_push() pipeline for persisting previewed workouts.
"""

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass
from typing import AsyncGenerator, Optional, TYPE_CHECKING

import httpx

if TYPE_CHECKING:
    from backend.services.preview_store import PreviewStore
    from backend.services.apns_service import APNsService
    from infrastructure.db.async_pipeline_run_repository import AsyncPipelineRunRepository

logger = logging.getLogger(__name__)


@dataclass
class PipelineEvent:
    """A single SSE event from the workout generation pipeline."""

    event: str  # "stage", "content_delta", "preview", "error", "complete"
    data: str  # JSON string


class WorkoutPipelineService:
    """Generates workouts via ingestor-api and yields streaming SSE events."""

    def __init__(
        self,
        ingestor_url: str,
        auth_token: str,
        mapper_api_url: str = "",
        calendar_api_url: str = "",
        preview_store: Optional["PreviewStore"] = None,
        pipeline_run_repo: Optional["AsyncPipelineRunRepository"] = None,
        apns_service: Optional["APNsService"] = None,
    ):
        self._ingestor_url = ingestor_url
        self._auth_token = auth_token
        self._mapper_url = mapper_api_url
        self._calendar_url = calendar_api_url
        self._preview_store = preview_store
        self._run_repo = pipeline_run_repo
        self._apns = apns_service

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

    async def _record_cost(
        self,
        run_id: Optional[str],
        input_tokens: int,
        output_tokens: int,
        model: str = "haiku",
    ) -> None:
        """Best-effort update of pipeline cost. Never raises."""
        if not self._run_repo or not run_id:
            return
        try:
            from backend.services.cost_estimator import estimate_cost
            cost = estimate_cost(model, input_tokens, output_tokens)
            await self._run_repo.update_cost(run_id, input_tokens, output_tokens, cost)
        except Exception:
            logger.warning("Failed to record cost for pipeline run %s", run_id)

    async def _record_stage(
        self,
        run_id: Optional[str],
        current_stage: str,
        completed_stages: list[str],
        stage_data: Optional[dict] = None,
    ) -> None:
        """Best-effort update of pipeline stage progress. Never raises."""
        if not self._run_repo or not run_id:
            return
        try:
            await self._run_repo.update_stage(
                run_id, current_stage, completed_stages, stage_data=stage_data,
            )
        except Exception:
            logger.warning("Failed to update stage for pipeline run %s", run_id)

    async def generate(
        self,
        description: str,
        difficulty: Optional[str] = None,
        duration_minutes: Optional[int] = None,
        equipment: Optional[list[str]] = None,
        user_id: Optional[str] = None,
        cancel_event: Optional["asyncio.Event"] = None,
        resume_from: Optional[str] = None,
    ) -> AsyncGenerator[PipelineEvent, None]:
        """Generate a workout and yield SSE events as stages progress."""
        # If resuming, load completed stages and skip them
        skip_stages: set[str] = set()
        run_id: Optional[str] = None

        if resume_from and self._run_repo and user_id:
            try:
                stage_info = await self._run_repo.get_stage_data(resume_from, user_id)
                if stage_info:
                    skip_stages = set(stage_info.get("completed_stages") or [])
                    run_id = resume_from
            except Exception:
                logger.warning("Failed to load resume data for %s", resume_from)

        # Create pipeline run record (best-effort) — only if not resuming
        if run_id is None and self._run_repo and user_id:
            try:
                row = await self._run_repo.create(
                    user_id=user_id,
                    pipeline="generate",
                    input_data={"description": description, "difficulty": difficulty,
                                "duration_minutes": duration_minutes},
                )
                run_id = row.get("id")
                await self._record_status(run_id, "running")
            except Exception:
                logger.warning("Failed to create pipeline run record")

        completed_stages: list[str] = []

        if "analyzing" not in skip_stages:
            yield PipelineEvent(
                "stage",
                json.dumps({"stage": "analyzing", "message": "Understanding your workout goals..."}),
            )

        await self._record_stage(run_id, "analyzing", completed_stages)

        if cancel_event and cancel_event.is_set():
            await self._record_status(run_id, "cancelled")
            yield PipelineEvent("error", json.dumps({"stage": "analyzing", "message": "Cancelled", "recoverable": False}))
            return

        body: dict = {"transcription": description}
        if difficulty:
            body["difficulty"] = difficulty
        if duration_minutes:
            body["duration_minutes"] = duration_minutes
        if equipment:
            body["equipment"] = equipment

        completed_stages.append("analyzing")

        if "creating" not in skip_stages:
            yield PipelineEvent(
                "stage",
                json.dumps({"stage": "creating", "message": "Generating exercises..."}),
            )

        await self._record_stage(run_id, "creating", completed_stages)

        if cancel_event and cancel_event.is_set():
            await self._record_status(run_id, "cancelled")
            yield PipelineEvent("error", json.dumps({"stage": "creating", "message": "Cancelled", "recoverable": False}))
            return

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self._ingestor_url}/workouts/parse-voice",
                    json=body,
                    headers={"Authorization": self._auth_token},
                )
        except httpx.HTTPError:
            await self._record_status(run_id, "failed", error="Failed to connect to workout service")
            yield PipelineEvent(
                "error",
                json.dumps({
                    "stage": "creating",
                    "message": "Failed to connect to workout service",
                    "recoverable": True,
                }),
            )
            return

        try:
            result = response.json()
        except Exception:
            await self._record_status(run_id, "failed", error="Invalid response from workout service")
            yield PipelineEvent(
                "error",
                json.dumps({"stage": "creating", "message": "Received an invalid response from the workout service.", "recoverable": True}),
            )
            return

        if response.status_code != 200 or not result.get("success"):
            await self._record_status(run_id, "failed", error="Failed to generate workout")
            yield PipelineEvent(
                "error",
                json.dumps({
                    "stage": "creating",
                    "message": "Failed to generate workout",
                    "recoverable": True,
                }),
            )
            return

        workout = result.get("workout", {})
        preview_id = str(uuid.uuid4())

        # Store preview for later save_and_push
        if self._preview_store and user_id:
            self._preview_store.put(preview_id, user_id, workout)

        completed_stages.append("creating")
        await self._record_status(run_id, "completed", result_data={"preview_id": preview_id})
        await self._record_cost(run_id, input_tokens=0, output_tokens=0, model="haiku")
        await self._record_stage(
            run_id, "complete", completed_stages,
            stage_data={"preview_id": preview_id},
        )

        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "complete", "message": "Workout ready!"}),
        )

        yield PipelineEvent(
            "preview",
            json.dumps({
                "preview_id": preview_id,
                "workout": {
                    "name": workout.get("name", "Generated Workout"),
                    "exercises": [
                        {
                            "name": ex.get("name"),
                            "sets": ex.get("sets"),
                            "reps": ex.get("reps"),
                            "muscle_group": ex.get("muscle_group"),
                            "notes": ex.get("notes"),
                        }
                        for ex in workout.get("exercises", [])
                    ],
                    "duration_minutes": workout.get("duration_minutes"),
                    "difficulty": workout.get("difficulty"),
                },
            }),
        )

        # Non-blocking quality evaluation
        try:
            from backend.services.workout_quality_evaluator import WorkoutQualityEvaluator
            evaluator = WorkoutQualityEvaluator()
            score = evaluator.evaluate(workout, requested_equipment=equipment)
            logger.info(
                "Workout quality score: overall=%.2f count=%.2f variety=%.2f volume=%.2f equip=%.2f hallucination=%.2f issues=%s",
                score.overall, score.exercise_count, score.variety,
                score.volume_sanity, score.equipment_match, score.hallucination,
                score.issues,
            )
        except Exception:
            logger.warning("Quality evaluation failed (non-blocking)")

    async def save_and_push(
        self,
        preview_id: str,
        user_id: str,
        schedule_date: Optional[str] = None,
        cancel_event: Optional["asyncio.Event"] = None,
    ) -> AsyncGenerator[PipelineEvent, None]:
        """Save a previewed workout to the library, push to devices, optionally schedule.

        Stages: validating → saving → (pushing) → (scheduling) → complete
        """
        # Create pipeline run record (best-effort)
        run_id: Optional[str] = None
        if self._run_repo:
            try:
                row = await self._run_repo.create(
                    user_id=user_id,
                    pipeline="save_and_push",
                    preview_id=preview_id,
                    input_data={"preview_id": preview_id, "schedule_date": schedule_date},
                )
                run_id = row.get("id")
                await self._record_status(run_id, "running")
            except Exception:
                logger.warning("Failed to create pipeline run record")

        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "validating", "message": "Validating preview..."}),
        )

        if not self._preview_store:
            await self._record_status(run_id, "failed", error="Preview store not configured")
            yield PipelineEvent(
                "error",
                json.dumps({"stage": "validating", "message": "Preview store not configured", "recoverable": False}),
            )
            return

        workout_data = self._preview_store.get(preview_id, user_id)
        if workout_data is None:
            await self._record_status(run_id, "failed", error="Preview not found or expired")
            yield PipelineEvent(
                "error",
                json.dumps({"stage": "validating", "message": "Preview not found or expired", "recoverable": False}),
            )
            return

        if cancel_event and cancel_event.is_set():
            await self._record_status(run_id, "cancelled")
            yield PipelineEvent("error", json.dumps({"stage": "validating", "message": "Cancelled", "recoverable": False}))
            return

        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "saving", "message": "Saving workout to library..."}),
        )

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                save_response = await client.post(
                    f"{self._mapper_url}/workouts/save",
                    json={
                        "profile_id": user_id,
                        "workout_data": workout_data,
                        "device": "web",
                        "title": workout_data.get("name", "Generated Workout"),
                    },
                    headers={"Authorization": self._auth_token},
                )
        except httpx.HTTPError:
            await self._record_status(run_id, "failed", error="Failed to save workout")
            yield PipelineEvent(
                "error",
                json.dumps({"stage": "saving", "message": "Failed to save workout", "recoverable": True}),
            )
            return

        if save_response.status_code != 200:
            await self._record_status(run_id, "failed", error="Failed to save workout")
            yield PipelineEvent(
                "error",
                json.dumps({"stage": "saving", "message": "Failed to save workout", "recoverable": True}),
            )
            return

        try:
            save_result = save_response.json()
        except Exception:
            await self._record_status(run_id, "failed", error="Invalid response from save service")
            yield PipelineEvent(
                "error",
                json.dumps({"stage": "saving", "message": "Received an invalid response from the save service.", "recoverable": True}),
            )
            return

        # Save succeeded — consume the preview so it can't be reused
        self._preview_store.pop(preview_id, user_id)

        saved_workout = save_result.get("workout", save_result)
        workout_id = saved_workout.get("id") or saved_workout.get("workout_id")

        if cancel_event and cancel_event.is_set():
            await self._record_status(run_id, "cancelled")
            yield PipelineEvent("error", json.dumps({"stage": "saving", "message": "Cancelled", "recoverable": False}))
            return

        # Push notification to paired devices (non-fatal)
        device_push_sent = 0
        if self._apns and self._apns.enabled:
            yield PipelineEvent(
                "stage",
                json.dumps({"stage": "pushing", "message": "Syncing to your devices..."}),
            )

            try:
                results = await self._apns.send_to_user(
                    user_id=user_id,
                    payload={"workout_id": workout_id},
                    auth_token=self._auth_token,
                )
                device_push_sent = sum(1 for r in results if r.success)
            except Exception:
                logger.warning("APNs push failed for workout %s", workout_id)

        # Optional calendar scheduling
        scheduled = False
        if schedule_date and self._calendar_url and workout_id:
            yield PipelineEvent(
                "stage",
                json.dumps({"stage": "scheduling", "message": "Adding to calendar..."}),
            )

            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    cal_response = await client.post(
                        f"{self._calendar_url}/calendar",
                        json={"workout_id": workout_id, "scheduled_date": schedule_date},
                        headers={"Authorization": self._auth_token},
                    )
                    scheduled = cal_response.status_code == 200
            except httpx.HTTPError:
                logger.warning("Calendar scheduling failed for workout %s", workout_id)

        await self._record_status(run_id, "completed", result_data={"workout_id": workout_id})
        await self._record_cost(run_id, input_tokens=0, output_tokens=0, model="haiku")

        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "complete", "message": "Workout saved!"}),
        )

        yield PipelineEvent(
            "complete",
            json.dumps({
                "workout_id": workout_id,
                "title": workout_data.get("name", "Generated Workout"),
                "scheduled_date": schedule_date if scheduled else None,
                "devices_notified": device_push_sent,
            }),
        )
