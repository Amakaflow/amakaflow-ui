"""Program generation pipeline that yields SSE events.

Implements a multi-checkpoint program pipeline:
  Phase 1a: design_outline() — LLM designs program structure + periodization
  Phase 1b: generate_workouts() — batched LLM generation (1 call per week) + mapping
  Phase 2:  save_program() — save all workouts, schedule, push to devices

Part of AMA-567 Phase E: Program pipeline (batched generation)
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
    from backend.services.pipeline_concurrency import PipelineConcurrencyLimiter
    from infrastructure.db.async_pipeline_run_repository import AsyncPipelineRunRepository

from backend.services.workout_pipeline_service import PipelineEvent

logger = logging.getLogger(__name__)

# Stage constants
DESIGN_STAGES = ["designing"]
GENERATE_STAGES = ["generating", "mapping"]
SAVE_STAGES = ["saving", "scheduling", "pushing"]

# Server-side bounds for duration_weeks (tool schema may use tighter LLM-facing range)
MIN_DURATION_WEEKS = 4
MAX_DURATION_WEEKS = 52


class ProgramPipelineService:
    """Generates multi-week training programs via batched LLM calls and yields SSE events."""

    def __init__(
        self,
        ingestor_url: str,
        auth_token: str,
        mapper_api_url: str = "",
        calendar_api_url: str = "",
        preview_store: Optional["PreviewStore"] = None,
        pipeline_run_repo: Optional["AsyncPipelineRunRepository"] = None,
        apns_service: Optional["APNsService"] = None,
        concurrency_limiter: Optional["PipelineConcurrencyLimiter"] = None,
        http_client: Optional[httpx.AsyncClient] = None,
    ):
        self._ingestor_url = ingestor_url
        self._auth_token = auth_token
        self._mapper_url = mapper_api_url
        self._calendar_url = calendar_api_url
        self._preview_store = preview_store
        self._run_repo = pipeline_run_repo
        self._apns = apns_service
        self._concurrency = concurrency_limiter
        self._client = http_client

    def _get_client(self, timeout: float = 30.0) -> httpx.AsyncClient:
        """Return the shared client or create a new one with the given timeout."""
        if self._client is not None:
            return self._client
        return httpx.AsyncClient(timeout=timeout)

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

    # =========================================================================
    # Phase 1a: Design outline
    # =========================================================================

    async def design_outline(
        self,
        goal: str,
        experience_level: str,
        duration_weeks: int,
        sessions_per_week: int,
        time_per_session: int = 60,
        equipment: list[str] | None = None,
        preferred_days: Optional[list[str]] = None,
        injuries: Optional[str] = None,
        focus_areas: Optional[list[str]] = None,
        avoid_exercises: Optional[list[str]] = None,
        user_id: Optional[str] = None,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> AsyncGenerator[PipelineEvent, None]:
        """Design a program outline with periodization and yield SSE events.

        Returns a preview with the program structure for user approval.
        """
        equipment = equipment or []

        # Server-side validation
        if not (MIN_DURATION_WEEKS <= duration_weeks <= MAX_DURATION_WEEKS):
            yield PipelineEvent(
                "error",
                json.dumps({
                    "stage": "designing",
                    "message": f"Duration must be {MIN_DURATION_WEEKS}-{MAX_DURATION_WEEKS} weeks",
                    "recoverable": False,
                }),
            )
            return

        # Concurrency check
        run_id_for_concurrency = str(uuid.uuid4())
        if self._concurrency and user_id:
            acquired = await self._concurrency.acquire(user_id, run_id_for_concurrency)
            if not acquired:
                yield PipelineEvent(
                    "error",
                    json.dumps({
                        "stage": "designing",
                        "message": "Too many active pipelines. Please wait for one to complete.",
                        "recoverable": True,
                    }),
                )
                return

        # Create pipeline run record (best-effort)
        run_id: Optional[str] = None
        if self._run_repo and user_id:
            try:
                row = await self._run_repo.create(
                    user_id=user_id,
                    pipeline="program_design",
                    input_data={
                        "goal": goal,
                        "experience_level": experience_level,
                        "duration_weeks": duration_weeks,
                        "sessions_per_week": sessions_per_week,
                    },
                )
                run_id = row.get("id")
                await self._record_status(run_id, "running")
            except Exception:
                logger.warning("Failed to create pipeline run record")

        try:
            async for event in self._design_outline_inner(
                goal=goal,
                experience_level=experience_level,
                duration_weeks=duration_weeks,
                sessions_per_week=sessions_per_week,
                time_per_session=time_per_session,
                equipment=equipment,
                preferred_days=preferred_days,
                injuries=injuries,
                focus_areas=focus_areas,
                avoid_exercises=avoid_exercises,
                user_id=user_id,
                cancel_event=cancel_event,
                run_id=run_id,
            ):
                yield event
        finally:
            if self._concurrency and user_id:
                await self._concurrency.release(user_id, run_id_for_concurrency)

    async def _design_outline_inner(
        self,
        goal: str,
        experience_level: str,
        duration_weeks: int,
        sessions_per_week: int,
        time_per_session: int,
        equipment: list[str],
        preferred_days: Optional[list[str]],
        injuries: Optional[str],
        focus_areas: Optional[list[str]],
        avoid_exercises: Optional[list[str]],
        user_id: Optional[str],
        cancel_event: Optional[asyncio.Event],
        run_id: Optional[str],
    ) -> AsyncGenerator[PipelineEvent, None]:
        """Inner implementation of design_outline (concurrency wrapper is in the outer method)."""
        yield PipelineEvent(
            "stage",
            json.dumps({
                "stage": "designing",
                "message": f"Designing your {duration_weeks}-week program...",
            }),
        )

        if cancel_event and cancel_event.is_set():
            await self._record_status(run_id, "cancelled")
            yield PipelineEvent("error", json.dumps({"stage": "designing", "message": "Cancelled", "recoverable": False}))
            return

        # Step 1: Get periodization parameters from mapper-api
        week_params = None
        if self._mapper_url:
            try:
                client = self._get_client(timeout=15.0)
                resp = await client.post(
                    f"{self._mapper_url}/programs/periodization-plan",
                    json={
                        "duration_weeks": duration_weeks,
                        "goal": goal,
                        "experience_level": experience_level,
                    },
                    headers={"Authorization": self._auth_token},
                )
                if resp.status_code == 200:
                    week_params = resp.json().get("weeks", [])
            except httpx.HTTPError:
                logger.warning("Failed to fetch periodization plan from mapper-api")

        if cancel_event and cancel_event.is_set():
            await self._record_status(run_id, "cancelled")
            yield PipelineEvent("error", json.dumps({"stage": "designing", "message": "Cancelled", "recoverable": False}))
            return

        # Step 2: LLM call to design program outline
        outline_prompt = self._build_outline_prompt(
            goal=goal,
            experience_level=experience_level,
            duration_weeks=duration_weeks,
            sessions_per_week=sessions_per_week,
            time_per_session=time_per_session,
            equipment=equipment,
            preferred_days=preferred_days,
            injuries=injuries,
            focus_areas=focus_areas,
            avoid_exercises=avoid_exercises,
            week_params=week_params,
        )

        try:
            client = self._get_client(timeout=60.0)
            response = await client.post(
                f"{self._ingestor_url}/programs/design-outline",
                json={"prompt": outline_prompt, "parameters": {
                    "goal": goal,
                    "experience_level": experience_level,
                    "duration_weeks": duration_weeks,
                    "sessions_per_week": sessions_per_week,
                    "time_per_session": time_per_session,
                    "equipment": equipment,
                    "preferred_days": preferred_days or [],
                    "injuries": injuries,
                    "focus_areas": focus_areas or [],
                    "avoid_exercises": avoid_exercises or [],
                    "week_params": week_params,
                }},
                headers={"Authorization": self._auth_token},
            )
        except httpx.HTTPError:
            await self._record_status(run_id, "failed", error="Failed to connect to program design service")
            yield PipelineEvent(
                "error",
                json.dumps({"stage": "designing", "message": "Failed to connect to program design service", "recoverable": True}),
            )
            return

        try:
            result = response.json()
        except Exception:
            await self._record_status(run_id, "failed", error="Invalid response from design service")
            yield PipelineEvent(
                "error",
                json.dumps({"stage": "designing", "message": "Received an invalid response from the design service.", "recoverable": True}),
            )
            return

        if response.status_code != 200 or not result.get("success"):
            error_msg = result.get("error", "Failed to design program")
            await self._record_status(run_id, "failed", error=error_msg)
            yield PipelineEvent(
                "error",
                json.dumps({"stage": "designing", "message": error_msg, "recoverable": True}),
            )
            return

        program_outline = result.get("program", {})

        # Merge periodization parameters into outline if available
        if week_params:
            program_outline = self._merge_periodization(program_outline, week_params)

        preview_id = str(uuid.uuid4())

        # Store outline in preview store for next phase
        if self._preview_store and user_id:
            self._preview_store.put(preview_id, user_id, {
                "type": "program_outline",
                "program": program_outline,
                "parameters": {
                    "goal": goal,
                    "experience_level": experience_level,
                    "duration_weeks": duration_weeks,
                    "sessions_per_week": sessions_per_week,
                    "time_per_session": time_per_session,
                    "equipment": equipment,
                    "preferred_days": preferred_days or [],
                    "injuries": injuries,
                    "focus_areas": focus_areas or [],
                    "avoid_exercises": avoid_exercises or [],
                },
            })

        await self._record_status(run_id, "completed", result_data={"preview_id": preview_id})

        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "complete", "message": "Program outline ready!"}),
        )

        yield PipelineEvent(
            "preview",
            json.dumps({
                "preview_id": preview_id,
                "program": program_outline,
            }),
        )

    # =========================================================================
    # Phase 1b: Generate workouts (batched by week)
    # =========================================================================

    async def generate_workouts(
        self,
        preview_id: str,
        user_id: str,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> AsyncGenerator[PipelineEvent, None]:
        """Generate detailed workouts for each week of an approved program outline.

        Batched generation: 1 LLM call per week with prior week context for variety.
        After all weeks, batch-maps exercises to library.
        """
        # Create pipeline run record (best-effort)
        run_id: Optional[str] = None
        if self._run_repo:
            try:
                row = await self._run_repo.create(
                    user_id=user_id,
                    pipeline="program_generate",
                    preview_id=preview_id,
                    input_data={"preview_id": preview_id},
                )
                run_id = row.get("id")
                await self._record_status(run_id, "running")
            except Exception:
                logger.warning("Failed to create pipeline run record")

        # Validate preview
        if not self._preview_store:
            await self._record_status(run_id, "failed", error="Preview store not configured")
            yield PipelineEvent(
                "error",
                json.dumps({"stage": "generating", "message": "Preview store not configured", "recoverable": False}),
            )
            return

        outline_data = self._preview_store.get(preview_id, user_id)
        if outline_data is None or outline_data.get("type") != "program_outline":
            await self._record_status(run_id, "failed", error="Program outline not found or expired")
            yield PipelineEvent(
                "error",
                json.dumps({"stage": "generating", "message": "Program outline not found or expired", "recoverable": False}),
            )
            return

        # Refresh TTL — batched generation can take many minutes for long programs
        self._preview_store.put(preview_id, user_id, outline_data)

        program = outline_data["program"]
        params = outline_data["parameters"]
        weeks = program.get("weeks", [])
        total_weeks = len(weeks)

        if total_weeks == 0:
            await self._record_status(run_id, "failed", error="Program has no weeks")
            yield PipelineEvent(
                "error",
                json.dumps({"stage": "generating", "message": "Program outline has no weeks defined", "recoverable": False}),
            )
            return

        # Generate workouts week by week
        all_exercises_names: list[str] = []
        generated_weeks: list[dict] = []
        prior_week_exercises: list[str] = []

        for i, week in enumerate(weeks):
            week_num = i + 1

            if cancel_event and cancel_event.is_set():
                await self._record_status(run_id, "cancelled")
                yield PipelineEvent("error", json.dumps({"stage": "generating", "message": "Cancelled", "recoverable": False}))
                return

            yield PipelineEvent(
                "stage",
                json.dumps({
                    "stage": "generating",
                    "message": f"Creating Week {week_num} workouts...",
                    "sub_progress": {"current": week_num, "total": total_weeks},
                }),
            )

            # Build prompt with week context + prior week exercises for variety
            try:
                client = self._get_client(timeout=90.0)
                response = await client.post(
                    f"{self._ingestor_url}/programs/generate-week",
                    json={
                        "week": week,
                        "week_number": week_num,
                        "total_weeks": total_weeks,
                        "parameters": params,
                        "prior_week_exercises": prior_week_exercises,
                    },
                    headers={"Authorization": self._auth_token},
                )
            except httpx.HTTPError:
                await self._record_status(run_id, "failed", error=f"Failed generating Week {week_num}")
                yield PipelineEvent(
                    "error",
                    json.dumps({"stage": "generating", "message": f"Failed to generate Week {week_num} workouts", "recoverable": True}),
                )
                return

            try:
                week_result = response.json()
            except Exception:
                await self._record_status(run_id, "failed", error=f"Invalid response for Week {week_num}")
                yield PipelineEvent(
                    "error",
                    json.dumps({"stage": "generating", "message": f"Invalid response for Week {week_num}", "recoverable": True}),
                )
                return

            if response.status_code != 200 or not week_result.get("success"):
                error_msg = week_result.get("error", f"Failed to generate Week {week_num}")
                await self._record_status(run_id, "failed", error=error_msg)
                yield PipelineEvent(
                    "error",
                    json.dumps({"stage": "generating", "message": error_msg, "recoverable": True}),
                )
                return

            week_workouts = week_result.get("workouts", [])
            generated_week = {**week, "workouts": week_workouts}
            generated_weeks.append(generated_week)

            # Collect exercise names for batch mapping
            week_exercise_names = []
            for workout in week_workouts:
                for exercise in workout.get("exercises", []):
                    name = exercise.get("name", "")
                    if name:
                        week_exercise_names.append(name)
                        all_exercises_names.append(name)

            # Track prior week exercises for variety in next call
            prior_week_exercises = week_exercise_names

        if cancel_event and cancel_event.is_set():
            await self._record_status(run_id, "cancelled")
            yield PipelineEvent("error", json.dumps({"stage": "generating", "message": "Cancelled", "recoverable": False}))
            return

        # Batch exercise mapping
        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "mapping", "message": "Matching exercises to your library..."}),
        )

        unmatched_map: dict[str, dict] = {}
        unique_names = list(set(all_exercises_names))

        if unique_names and self._mapper_url:
            try:
                client = self._get_client(timeout=30.0)
                match_resp = await client.post(
                    f"{self._mapper_url}/exercises/canonical/match/batch",
                    json={"planned_names": unique_names},
                    headers={"Authorization": self._auth_token},
                )

                if match_resp.status_code == 200:
                    match_data = match_resp.json()
                    matches = match_data.get("matches", [])

                    # Build name→match lookup with defensive length check
                    name_to_match: dict[str, dict] = {}
                    if len(matches) != len(unique_names):
                        logger.warning(
                            "Batch match response length mismatch: %d vs %d",
                            len(matches), len(unique_names),
                        )
                    for name, match in zip(unique_names, matches):
                        name_to_match[name] = match

                    # Apply matches to generated workouts and collect unmatched (deduplicated)
                    for week in generated_weeks:
                        for workout in week.get("workouts", []):
                            for exercise in workout.get("exercises", []):
                                name = exercise.get("name", "")
                                match = name_to_match.get(name)
                                if match and match.get("confidence", 0) >= 0.70:
                                    exercise["matched_exercise_id"] = match.get("exercise_id")
                                    exercise["matched_exercise_name"] = match.get("exercise_name")
                                elif match and name and name not in unmatched_map:
                                    unmatched_map[name] = {
                                        "name": name,
                                        "suggestions": [match.get("exercise_name")] if match.get("exercise_name") else [],
                                    }
            except httpx.HTTPError:
                logger.warning("Batch exercise matching failed, continuing without matches")

        # Consume old preview, store new full program
        self._preview_store.pop(preview_id, user_id)

        full_program = {**program, "weeks": generated_weeks}
        new_preview_id = str(uuid.uuid4())

        if self._preview_store:
            self._preview_store.put(new_preview_id, user_id, {
                "type": "program_full",
                "program": full_program,
                "parameters": params,
            })

        await self._record_status(run_id, "completed", result_data={"preview_id": new_preview_id})

        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "complete", "message": "Program workouts ready!"}),
        )

        yield PipelineEvent(
            "preview",
            json.dumps({
                "preview_id": new_preview_id,
                "program": full_program,
                "unmatched": list(unmatched_map.values()) if unmatched_map else None,
            }),
        )

    # =========================================================================
    # Phase 2: Save program
    # =========================================================================

    async def save_program(
        self,
        preview_id: str,
        user_id: str,
        schedule_start_date: Optional[str] = None,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> AsyncGenerator[PipelineEvent, None]:
        """Save a fully generated program: persist workouts, schedule, push to devices."""
        # Create pipeline run record (best-effort)
        run_id: Optional[str] = None
        if self._run_repo:
            try:
                row = await self._run_repo.create(
                    user_id=user_id,
                    pipeline="program_save",
                    preview_id=preview_id,
                    input_data={"preview_id": preview_id, "schedule_start_date": schedule_start_date},
                )
                run_id = row.get("id")
                await self._record_status(run_id, "running")
            except Exception:
                logger.warning("Failed to create pipeline run record")

        # Validate preview
        if not self._preview_store:
            await self._record_status(run_id, "failed", error="Preview store not configured")
            yield PipelineEvent(
                "error",
                json.dumps({"stage": "saving", "message": "Preview store not configured", "recoverable": False}),
            )
            return

        program_data = self._preview_store.get(preview_id, user_id)
        if program_data is None or program_data.get("type") != "program_full":
            await self._record_status(run_id, "failed", error="Full program not found or expired")
            yield PipelineEvent(
                "error",
                json.dumps({"stage": "saving", "message": "Program not found or expired. Please regenerate.", "recoverable": False}),
            )
            return

        program = program_data["program"]
        params = program_data["parameters"]
        weeks = program.get("weeks", [])

        if cancel_event and cancel_event.is_set():
            await self._record_status(run_id, "cancelled")
            yield PipelineEvent("error", json.dumps({"stage": "saving", "message": "Cancelled", "recoverable": False}))
            return

        # Stage: saving
        total_workouts = sum(len(w.get("workouts", [])) for w in weeks)
        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "saving", "message": f"Saving {total_workouts} workouts to library..."}),
        )

        saved_workout_ids: list[str] = []

        try:
            client = self._get_client(timeout=30.0)
            for week in weeks:
                for workout in week.get("workouts", []):
                    save_resp = await client.post(
                        f"{self._mapper_url}/workouts/save",
                        json={
                            "profile_id": user_id,
                            "workout_data": workout,
                            "device": "web",
                            "title": workout.get("name", "Program Workout"),
                        },
                        headers={"Authorization": self._auth_token},
                    )
                    if save_resp.status_code == 200:
                        save_result = save_resp.json()
                        saved = save_result.get("workout", save_result)
                        wid = saved.get("id") or saved.get("workout_id")
                        if wid:
                            saved_workout_ids.append(wid)
        except httpx.HTTPError:
            if saved_workout_ids:
                logger.warning(
                    "Partial save: %d of %d workouts saved before HTTP error",
                    len(saved_workout_ids), total_workouts,
                )
            else:
                await self._record_status(run_id, "failed", error="Failed to save workouts")
                yield PipelineEvent(
                    "error",
                    json.dumps({"stage": "saving", "message": "Failed to save program workouts", "recoverable": True}),
                )
                return

        if not saved_workout_ids:
            await self._record_status(run_id, "failed", error="No workouts were saved")
            yield PipelineEvent(
                "error",
                json.dumps({"stage": "saving", "message": "No workouts were saved successfully", "recoverable": True}),
            )
            return

        # Consume preview
        self._preview_store.pop(preview_id, user_id)

        if cancel_event and cancel_event.is_set():
            await self._record_status(run_id, "cancelled")
            yield PipelineEvent("error", json.dumps({"stage": "saving", "message": "Cancelled", "recoverable": False}))
            return

        # Stage: scheduling (optional)
        scheduled_count = 0
        if schedule_start_date and self._calendar_url:
            yield PipelineEvent(
                "stage",
                json.dumps({"stage": "scheduling", "message": f"Adding {total_workouts} sessions to calendar..."}),
            )

            preferred_days = params.get("preferred_days", [])
            day_map = {
                "sunday": 0, "monday": 1, "tuesday": 2, "wednesday": 3,
                "thursday": 4, "friday": 5, "saturday": 6,
            }

            try:
                from datetime import datetime, timedelta
                start = datetime.strptime(schedule_start_date, "%Y-%m-%d")

                workout_idx = 0
                client = self._get_client(timeout=15.0)
                for week_idx, week in enumerate(weeks):
                    week_start = start + timedelta(weeks=week_idx)
                    for workout in week.get("workouts", []):
                        if workout_idx >= len(saved_workout_ids):
                            break

                        # Calculate date from preferred day or day_of_week
                        day_of_week = workout.get("day_of_week")
                        if day_of_week is not None:
                            # day_of_week is 0=Sunday .. 6=Saturday
                            # Python weekday: 0=Monday .. 6=Sunday
                            python_weekday = (day_of_week - 1) % 7
                            # Schedules the next occurrence of this weekday from week_start.
                            # If day_of_week matches week_start's weekday, days_ahead=0 (same day).
                            # This may place workouts past the 7-day window if the target day
                            # has already passed relative to week_start.
                            days_ahead = (python_weekday - week_start.weekday()) % 7
                            workout_date = week_start + timedelta(days=days_ahead)
                        else:
                            workout_date = week_start

                        try:
                            cal_resp = await client.post(
                                f"{self._calendar_url}/calendar",
                                json={
                                    "workout_id": saved_workout_ids[workout_idx],
                                    "scheduled_date": workout_date.strftime("%Y-%m-%d"),
                                },
                                headers={"Authorization": self._auth_token},
                            )
                            if cal_resp.status_code == 200:
                                scheduled_count += 1
                        except httpx.HTTPError:
                            logger.warning("Calendar scheduling failed for workout %s", saved_workout_ids[workout_idx])

                        workout_idx += 1
            except Exception:
                logger.warning("Calendar scheduling failed for program")

        # Stage: pushing (non-fatal)
        device_push_sent = 0
        if self._apns and self._apns.enabled:
            yield PipelineEvent(
                "stage",
                json.dumps({"stage": "pushing", "message": "Syncing to your devices..."}),
            )

            try:
                results = await self._apns.send_to_user(
                    user_id=user_id,
                    payload={"program_workout_ids": saved_workout_ids[:5]},  # Send first few IDs
                    auth_token=self._auth_token,
                )
                device_push_sent = sum(1 for r in results if r.success)
            except Exception:
                logger.warning("APNs push failed for program")

        await self._record_status(run_id, "completed", result_data={
            "workout_ids": saved_workout_ids,
            "scheduled_count": scheduled_count,
        })

        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "complete", "message": "Program saved!"}),
        )

        yield PipelineEvent(
            "complete",
            json.dumps({
                "program_name": program.get("name", "Training Program"),
                "workout_count": len(saved_workout_ids),
                "total_workouts": total_workouts,
                "workout_ids": saved_workout_ids,
                "scheduled_count": scheduled_count,
                "schedule_start_date": schedule_start_date if scheduled_count > 0 else None,
                "devices_notified": device_push_sent,
            }),
        )

    # =========================================================================
    # Helpers
    # =========================================================================

    def _build_outline_prompt(
        self,
        goal: str,
        experience_level: str,
        duration_weeks: int,
        sessions_per_week: int,
        time_per_session: int,
        equipment: list[str],
        preferred_days: Optional[list[str]] = None,
        injuries: Optional[str] = None,
        focus_areas: Optional[list[str]] = None,
        avoid_exercises: Optional[list[str]] = None,
        week_params: Optional[list[dict]] = None,
    ) -> str:
        """Build the LLM prompt for program outline generation."""
        parts = [
            f"Design a {duration_weeks}-week training program outline.",
            f"Goal: {goal}",
            f"Experience level: {experience_level}",
            f"Sessions per week: {sessions_per_week}",
            f"Time per session: {time_per_session} minutes",
            f"Equipment: {', '.join(equipment)}",
        ]
        if preferred_days:
            parts.append(f"Preferred training days: {', '.join(preferred_days)}")
        if injuries:
            parts.append(f"Injuries/limitations: {injuries}")
        if focus_areas:
            parts.append(f"Focus areas: {', '.join(focus_areas)}")
        if avoid_exercises:
            parts.append(f"Avoid exercises: {', '.join(avoid_exercises)}")
        if week_params:
            parts.append("\nPeriodization parameters per week:")
            for wp in week_params:
                week_num = wp.get("week_number", "?")
                focus = wp.get("focus", "")
                intensity = wp.get("intensity_percent", 0)
                volume = wp.get("volume_modifier", 1.0)
                deload = wp.get("is_deload", False)
                notes = wp.get("notes", "")
                line = f"  Week {week_num}: focus={focus}, intensity={intensity:.0%}, volume_mod={volume:.1f}"
                if deload:
                    line += " [DELOAD]"
                if notes:
                    line += f" — {notes}"
                parts.append(line)

        return "\n".join(parts)

    @staticmethod
    def _merge_periodization(program: dict, week_params: list[dict]) -> dict:
        """Merge periodization parameters into program outline weeks."""
        weeks = program.get("weeks", [])
        for i, week in enumerate(weeks):
            if i < len(week_params):
                wp = week_params[i]
                week.setdefault("intensity_percentage", int(wp.get("intensity_percent", 0.7) * 100))
                week.setdefault("volume_modifier", wp.get("volume_modifier", 1.0))
                week.setdefault("is_deload", wp.get("is_deload", False))
                week.setdefault("focus", wp.get("focus", ""))
                if wp.get("notes"):
                    week.setdefault("notes", wp["notes"])
        return program
