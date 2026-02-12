"""Program generation pipeline that yields SSE events.

Multi-checkpoint pipeline for training program generation:
  Phase 1a: design_outline() -> user approves structure
  Phase 1b: generate_workouts() -> batched LLM calls per week -> user approves details
  Phase 2:  save_program() -> save, schedule, push

Part of AMA-567 Phase E.
"""

import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

import anthropic
import httpx

from backend.services.workout_pipeline_service import PipelineEvent

logger = logging.getLogger(__name__)

# LLM model for program generation (fast + structured output)
PROGRAM_LLM_MODEL = "claude-sonnet-4-20250514"


# =============================================================================
# Preview Store (in-memory with TTL)
# =============================================================================


@dataclass
class PreviewEntry:
    """A stored preview with expiry."""

    data: Dict[str, Any]
    created_at: float
    user_id: str


class PreviewStore:
    """In-memory preview store with TTL expiry and automatic eviction.

    Previews expire after `ttl_seconds` (default 30 minutes).
    Expired entries are garbage-collected on every Nth put (default 10).
    Max entries capped to prevent unbounded memory growth.
    Thread-safe via asyncio.Lock.
    """

    def __init__(
        self, ttl_seconds: int = 1800, max_entries: int = 500, gc_interval: int = 10
    ):
        self._store: Dict[str, PreviewEntry] = {}
        self._ttl = ttl_seconds
        self._max_entries = max_entries
        self._gc_interval = gc_interval
        self._put_count = 0
        self._lock = asyncio.Lock()

    def _gc_locked(self) -> int:
        """Remove expired entries. Must be called while holding self._lock."""
        now = time.time()
        expired = [k for k, v in self._store.items() if now - v.created_at > self._ttl]
        for k in expired:
            del self._store[k]
        return len(expired)

    async def put(self, preview_id: str, data: Dict[str, Any], user_id: str) -> None:
        """Store a preview. Runs GC periodically and enforces max size."""
        async with self._lock:
            self._put_count += 1
            if self._put_count % self._gc_interval == 0:
                self._gc_locked()

            # Evict oldest if at capacity
            if len(self._store) >= self._max_entries:
                oldest_key = min(self._store, key=lambda k: self._store[k].created_at)
                del self._store[oldest_key]

            self._store[preview_id] = PreviewEntry(
                data=data, created_at=time.time(), user_id=user_id
            )

    async def get(self, preview_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve and validate a preview. Returns None if expired or wrong user."""
        async with self._lock:
            entry = self._store.get(preview_id)
            if not entry:
                return None
            if entry.user_id != user_id:
                return None
            if time.time() - entry.created_at > self._ttl:
                del self._store[preview_id]
                return None
            return entry.data

    async def consume(self, preview_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve and delete a preview (one-time use)."""
        async with self._lock:
            entry = self._store.pop(preview_id, None)
            if not entry:
                return None
            if entry.user_id != user_id:
                # Put it back if wrong user
                self._store[preview_id] = entry
                return None
            if time.time() - entry.created_at > self._ttl:
                return None
            return entry.data


# =============================================================================
# Stage Constants
# =============================================================================

DESIGN_STAGES = ["designing"]
GENERATE_STAGES = ["generating", "mapping"]
SAVE_STAGES = ["saving", "scheduling", "pushing"]


# =============================================================================
# Inline Periodization (pure math, no external deps)
# =============================================================================

# Deload frequency by experience (weeks between deloads)
_DELOAD_FREQUENCY = {"beginner": 6, "intermediate": 4, "advanced": 3}

# Intensity ranges by goal
_INTENSITY_RANGES = {
    "strength": (0.75, 0.95),
    "hypertrophy": (0.65, 0.85),
    "fat_loss": (0.55, 0.75),
    "endurance": (0.50, 0.70),
    "general_fitness": (0.60, 0.80),
}

# Model recommendation
_MODEL_MAP = {
    ("strength", "advanced"): "conjugate",
    ("strength", "intermediate"): "block",
    ("strength", "beginner"): "linear",
    ("hypertrophy", "intermediate"): "undulating",
    ("hypertrophy", "advanced"): "undulating",
    ("endurance", None): "reverse_linear",
    ("fat_loss", None): "linear",
}


def _select_periodization_model(
    goal: str, experience_level: str, duration_weeks: int
) -> str:
    """Select best periodization model for goal/experience."""
    key = (goal, experience_level)
    if key in _MODEL_MAP:
        return _MODEL_MAP[key]
    key_any = (goal, None)
    if key_any in _MODEL_MAP:
        return _MODEL_MAP[key_any]
    if goal == "strength" and duration_weeks >= 8:
        return "block"
    return "linear"


def _calculate_week_params(
    week: int,
    total_weeks: int,
    goal: str,
    experience_level: str,
    model: str,
) -> Dict[str, Any]:
    """Calculate periodization parameters for a single week."""
    freq = _DELOAD_FREQUENCY.get(experience_level, 4)
    deload_weeks = set()
    w = freq
    while w <= total_weeks:
        deload_weeks.add(w)
        w += freq
    if total_weeks >= 6 and total_weeks not in deload_weeks:
        deload_weeks.add(total_weeks)

    is_deload = week in deload_weeks

    # Linear progression as default
    progress = (week - 1) / max(total_weeks - 1, 1)
    intensity = 0.65 + (0.30 * progress)
    volume_mod = 1.0 - (0.30 * progress)

    if model == "undulating":
        # Use heavy-day pattern for weekly overview
        intensity = 0.85 + min(0.02 * (week - 1), 0.10)
        intensity = min(intensity, 0.95)
        volume_mod = 0.8
    elif model == "block":
        accum_end = int(total_weeks * 0.4)
        trans_end = int(total_weeks * 0.8)
        if week <= accum_end:
            phase_p = (week - 1) / max(accum_end - 1, 1) if accum_end > 1 else 0
            intensity = 0.65 + (0.05 * phase_p)
            volume_mod = 1.2 - (0.1 * phase_p)
        elif week <= trans_end:
            phase_p = (week - accum_end - 1) / max(trans_end - accum_end - 1, 1)
            intensity = 0.75 + (0.10 * phase_p)
            volume_mod = 1.0 - (0.15 * phase_p)
        else:
            phase_p = (week - trans_end - 1) / max(total_weeks - trans_end - 1, 1)
            intensity = 0.88 + (0.07 * phase_p)
            volume_mod = 0.75 - (0.15 * phase_p)
    elif model == "reverse_linear":
        intensity = 0.90 - (0.30 * progress)
        volume_mod = 0.7 + (0.60 * progress)

    # Scale to goal range
    min_int, max_int = _INTENSITY_RANGES.get(goal, (0.60, 0.80))
    normalized = min(max((intensity - 0.50) / 0.50, 0.0), 1.0)
    scaled = min_int + normalized * (max_int - min_int)

    if is_deload:
        scaled *= 0.6
        volume_mod *= 0.5

    # Determine focus
    if is_deload:
        focus = "deload"
    elif scaled >= 0.85:
        focus = "strength"
    elif scaled >= 0.75:
        focus = "power"
    elif scaled >= 0.65:
        focus = "hypertrophy"
    else:
        focus = "endurance"

    return {
        "week_number": week,
        "intensity_percentage": round(scaled * 100),
        "volume_modifier": round(volume_mod, 2),
        "is_deload": is_deload,
        "focus": focus.capitalize(),
    }


def plan_periodization(
    duration_weeks: int, goal: str, experience_level: str, model: Optional[str] = None
) -> Tuple[str, List[Dict[str, Any]]]:
    """Plan complete periodization for a program.

    Returns (model_name, list_of_week_params).
    """
    if not model:
        model = _select_periodization_model(goal, experience_level, duration_weeks)
    weeks = [
        _calculate_week_params(w, duration_weeks, goal, experience_level, model)
        for w in range(1, duration_weeks + 1)
    ]
    return model, weeks


# =============================================================================
# LLM Prompt Builders
# =============================================================================

_OUTLINE_SYSTEM = """You are a certified strength and conditioning specialist designing training programs.

When given user preferences and periodization parameters, design a training program outline.
Return ONLY valid JSON (no markdown, no explanation) matching this schema:

{
  "name": "string - descriptive program name",
  "weeks": [
    {
      "week_number": int,
      "focus": "string - from periodization params",
      "workouts": [
        {
          "day_of_week": int (0=Monday through 6=Sunday),
          "name": "string - descriptive name like 'Upper Push' or 'Lower Power'",
          "workout_type": "string - push/pull/legs/upper/lower/full_body/cardio/hiit"
        }
      ]
    }
  ]
}

Rules:
- Distribute sessions across preferred days (or evenly if not specified)
- Vary workout types across the week for recovery
- Deload weeks should have lighter workout types
- Workout names should reflect the focus and type"""

_WORKOUT_SYSTEM = """You are a certified strength and conditioning specialist creating detailed workouts.

Given a workout outline and periodization parameters, create the exercise prescription.
Return ONLY valid JSON (no markdown, no explanation) matching this schema:

{
  "workouts": [
    {
      "day_of_week": int,
      "name": "string",
      "workout_type": "string",
      "exercises": [
        {
          "name": "string - standard exercise name",
          "sets": int,
          "reps": "string - e.g. '8-12' or '5'",
          "rest_seconds": int,
          "notes": "string or null",
          "tempo": "string or null - e.g. '3010'",
          "rpe": float or null
        }
      ]
    }
  ]
}

Rules:
- Select exercises matching equipment, type, and focus
- Adjust sets/reps to match intensity and volume parameters
- Deload weeks: reduce sets by ~40%, lower RPE
- Include warm-up notes for compound lifts
- Vary exercises from previous weeks (provided for context)
- Respect injuries and avoid_exercises constraints
- Target the specified session duration"""


# =============================================================================
# Program Pipeline Service
# =============================================================================


class ProgramPipelineService:
    """Generates training programs via multi-stage pipeline with SSE events."""

    def __init__(
        self,
        anthropic_api_key: str,
        auth_token: str,
        mapper_api_url: str,
        calendar_api_url: str,
        preview_store: PreviewStore,
        apns_service: Any = None,
    ):
        self._anthropic = anthropic.AsyncAnthropic(api_key=anthropic_api_key)
        self._auth_token = auth_token
        self._mapper_url = mapper_api_url
        self._calendar_url = calendar_api_url
        self._preview_store = preview_store
        self._apns_service = apns_service

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _auth_headers(self, user_id: str) -> Dict[str, str]:
        headers: Dict[str, str] = {"X-User-Id": user_id}
        if self._auth_token:
            headers["Authorization"] = self._auth_token
        return headers

    async def _llm_json(
        self, system: str, user_prompt: str, max_tokens: int = 4096
    ) -> Dict[str, Any]:
        """Call Claude and parse structured JSON response."""
        response = await self._anthropic.messages.create(
            model=PROGRAM_LLM_MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user_prompt}],
        )
        text = ""
        for block in response.content:
            if block.type == "text":
                text += block.text

        # Strip markdown fences if present
        text = text.strip()
        if text.startswith("```"):
            first_newline = text.find("\n")
            if first_newline != -1:
                text = text[first_newline + 1 :]
            else:
                text = text[3:]
        if text.endswith("```"):
            text = text[: -len("```")]
        text = text.strip()

        return json.loads(text)

    # ------------------------------------------------------------------
    # Phase 1a: Design Outline
    # ------------------------------------------------------------------

    async def design_outline(
        self,
        *,
        goal: str,
        experience_level: str,
        duration_weeks: int,
        sessions_per_week: int,
        equipment: List[str],
        time_per_session: Optional[int] = None,
        preferred_days: Optional[List[str]] = None,
        injuries: Optional[str] = None,
        focus_areas: Optional[List[str]] = None,
        avoid_exercises: Optional[List[str]] = None,
        user_id: str,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> AsyncGenerator[PipelineEvent, None]:
        """Phase 1a: Design program outline via LLM + periodization."""

        # --- Stage: designing ---
        yield PipelineEvent(
            "stage",
            json.dumps({
                "stage": "designing",
                "message": f"Designing your {duration_weeks}-week program...",
            }),
        )

        # 1. Compute periodization
        model_name, week_params = plan_periodization(
            duration_weeks, goal, experience_level
        )

        if cancel_event and cancel_event.is_set():
            yield PipelineEvent(
                "error",
                json.dumps({"stage": "designing", "message": "Cancelled", "recoverable": True}),
            )
            return

        # 2. Build LLM prompt
        user_prompt = (
            f"Design a {duration_weeks}-week {goal} training program.\n\n"
            f"User profile:\n"
            f"- Experience: {experience_level}\n"
            f"- Sessions per week: {sessions_per_week}\n"
            f"- Equipment: {', '.join(equipment)}\n"
        )
        if time_per_session:
            user_prompt += f"- Time per session: {time_per_session} minutes\n"
        if preferred_days:
            user_prompt += f"- Preferred days: {', '.join(preferred_days)}\n"
        if injuries:
            user_prompt += f"- Injuries/limitations: {injuries}\n"
        if focus_areas:
            user_prompt += f"- Focus areas: {', '.join(focus_areas)}\n"
        if avoid_exercises:
            user_prompt += f"- Avoid exercises: {', '.join(avoid_exercises)}\n"

        user_prompt += (
            f"\nPeriodization model: {model_name}\n"
            f"Week parameters:\n"
        )
        for wp in week_params:
            user_prompt += (
                f"  Week {wp['week_number']}: "
                f"focus={wp['focus']}, "
                f"intensity={wp['intensity_percentage']}%, "
                f"volume_modifier={wp['volume_modifier']}"
                f"{', DELOAD' if wp['is_deload'] else ''}\n"
            )

        # 3. Call LLM for outline
        try:
            outline = await self._llm_json(_OUTLINE_SYSTEM, user_prompt)
        except (json.JSONDecodeError, anthropic.APIError) as e:
            logger.error("LLM outline generation failed: %s", e)
            yield PipelineEvent(
                "error",
                json.dumps({
                    "stage": "designing",
                    "message": "Failed to design program outline. Please try again.",
                    "recoverable": True,
                }),
            )
            return

        # 4. Merge periodization data into outline
        program_name = outline.get("name", f"{duration_weeks}-Week {goal.replace('_', ' ').title()} Program")
        weeks_outline = outline.get("weeks", [])

        # Ensure week_params are merged into the outline
        for wp in week_params:
            wn = wp["week_number"]
            # Find matching outline week
            matching = [w for w in weeks_outline if w.get("week_number") == wn]
            if matching:
                matching[0]["focus"] = wp["focus"]
                matching[0]["intensity_percentage"] = wp["intensity_percentage"]
                matching[0]["volume_modifier"] = wp["volume_modifier"]
                matching[0]["is_deload"] = wp["is_deload"]
            else:
                weeks_outline.append({
                    "week_number": wn,
                    "focus": wp["focus"],
                    "intensity_percentage": wp["intensity_percentage"],
                    "volume_modifier": wp["volume_modifier"],
                    "is_deload": wp["is_deload"],
                    "workouts": [],
                })

        weeks_outline.sort(key=lambda w: w.get("week_number", 0))

        # 5. Store preview
        preview_id = str(uuid.uuid4())
        program_data = {
            "name": program_name,
            "goal": goal,
            "experience_level": experience_level,
            "duration_weeks": duration_weeks,
            "sessions_per_week": sessions_per_week,
            "periodization_model": model_name,
            "equipment": equipment,
            "time_per_session": time_per_session,
            "preferred_days": preferred_days,
            "injuries": injuries,
            "focus_areas": focus_areas,
            "avoid_exercises": avoid_exercises,
            "weeks": weeks_outline,
        }

        await self._preview_store.put(preview_id, program_data, user_id)

        # 6. Yield complete + preview
        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "complete", "message": "Program outline ready!"}),
        )

        yield PipelineEvent(
            "preview",
            json.dumps({
                "preview_id": preview_id,
                "program": {
                    "name": program_name,
                    "goal": goal,
                    "duration_weeks": duration_weeks,
                    "sessions_per_week": sessions_per_week,
                    "periodization_model": model_name,
                    "weeks": weeks_outline,
                },
            }),
        )

    # ------------------------------------------------------------------
    # Phase 1b: Generate Workouts (batched by week)
    # ------------------------------------------------------------------

    async def generate_workouts(
        self,
        *,
        preview_id: str,
        user_id: str,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> AsyncGenerator[PipelineEvent, None]:
        """Phase 1b: Generate workouts week-by-week with batched LLM calls."""

        # 1. Retrieve outline
        program_data = await self._preview_store.get(preview_id, user_id)
        if not program_data:
            yield PipelineEvent(
                "error",
                json.dumps({
                    "stage": "generating",
                    "message": "Program outline not found or expired. Please start over.",
                    "recoverable": False,
                }),
            )
            return

        weeks = program_data.get("weeks", [])
        total_weeks = len(weeks)
        equipment = program_data.get("equipment", [])
        time_per_session = program_data.get("time_per_session")
        injuries = program_data.get("injuries")
        avoid_exercises = program_data.get("avoid_exercises")
        goal = program_data.get("goal", "")

        all_exercises_by_week: List[List[Dict[str, Any]]] = []

        # 2. Batched generation — one LLM call per week
        for idx, week in enumerate(weeks):
            week_num = week.get("week_number", idx + 1)

            if cancel_event and cancel_event.is_set():
                yield PipelineEvent(
                    "error",
                    json.dumps({
                        "stage": "generating",
                        "message": "Cancelled",
                        "recoverable": True,
                    }),
                )
                return

            yield PipelineEvent(
                "stage",
                json.dumps({
                    "stage": "generating",
                    "message": f"Creating Week {week_num} workouts...",
                    "sub_progress": {"current": week_num, "total": total_weeks},
                }),
            )

            # Build per-week prompt
            user_prompt = (
                f"Create detailed workouts for Week {week_num} of a "
                f"{program_data.get('duration_weeks')}-week {goal} program.\n\n"
                f"Week outline:\n{json.dumps(week, indent=2)}\n\n"
                f"Equipment: {', '.join(equipment)}\n"
            )
            if time_per_session:
                user_prompt += f"Target session duration: {time_per_session} minutes\n"
            if injuries:
                user_prompt += f"Injuries/limitations: {injuries}\n"
            if avoid_exercises:
                user_prompt += f"Avoid exercises: {', '.join(avoid_exercises)}\n"

            # Include prior weeks' exercises for variety
            if all_exercises_by_week:
                prev_names = set()
                for prev_week_exercises in all_exercises_by_week[-2:]:  # Last 2 weeks
                    for wo in prev_week_exercises:
                        for ex in wo.get("exercises", []):
                            prev_names.add(ex.get("name", ""))
                if prev_names:
                    user_prompt += (
                        f"\nExercises used in recent weeks (vary these): "
                        f"{', '.join(sorted(prev_names)[:20])}\n"
                    )

            try:
                result = await self._llm_json(_WORKOUT_SYSTEM, user_prompt)
                week_workouts = result.get("workouts", [])
            except (json.JSONDecodeError, anthropic.APIError) as e:
                logger.error("LLM workout generation failed for week %d: %s", week_num, e)
                yield PipelineEvent(
                    "error",
                    json.dumps({
                        "stage": "generating",
                        "message": f"Failed to generate Week {week_num} workouts. Please try again.",
                        "recoverable": True,
                    }),
                )
                return

            # Merge generated workouts into outline
            week["workouts"] = week_workouts
            all_exercises_by_week.append(week_workouts)

        # 3. Exercise mapping stage
        yield PipelineEvent(
            "stage",
            json.dumps({
                "stage": "mapping",
                "message": "Matching exercises to library...",
            }),
        )

        # Collect all unique exercise names
        all_exercise_names: List[str] = []
        seen: set[str] = set()
        for week in weeks:
            for workout in week.get("workouts", []):
                for ex in workout.get("exercises", []):
                    name = ex.get("name", "")
                    if name and name not in seen:
                        all_exercise_names.append(name)
                        seen.add(name)

        # Batch match via mapper-api
        matched_map: Dict[str, Dict[str, Any]] = {}
        unmatched: List[Dict[str, Any]] = []

        if all_exercise_names:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(
                        f"{self._mapper_url}/exercises/canonical/match/batch",
                        json={"planned_names": all_exercise_names},
                        headers=self._auth_headers(user_id),
                    )
                    resp.raise_for_status()
                    match_results = resp.json().get("matches", [])

                for i, match in enumerate(match_results):
                    original = all_exercise_names[i] if i < len(all_exercise_names) else ""
                    if match.get("matched") and match.get("confidence", 0) >= 0.70:
                        matched_map[original] = {
                            "canonical_name": match.get("canonical_name", original),
                            "exercise_id": match.get("exercise_id"),
                        }
                    else:
                        suggestions = []
                        if match.get("canonical_name"):
                            suggestions.append(match["canonical_name"])
                        unmatched.append({"name": original, "suggestions": suggestions})
            except (httpx.HTTPError, KeyError) as e:
                logger.warning("Exercise batch matching failed: %s — using raw names", e)

        # Replace exercise names with canonical matches
        for week in weeks:
            for workout in week.get("workouts", []):
                for ex in workout.get("exercises", []):
                    original = ex.get("name", "")
                    if original in matched_map:
                        ex["name"] = matched_map[original]["canonical_name"]
                        if matched_map[original].get("exercise_id"):
                            ex["exercise_id"] = matched_map[original]["exercise_id"]

        # 4. Store full program with new preview_id (consume old one)
        await self._preview_store.consume(preview_id, user_id)
        new_preview_id = str(uuid.uuid4())
        await self._preview_store.put(new_preview_id, program_data, user_id)

        # 5. Yield complete + preview
        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "complete", "message": "Workouts ready for review!"}),
        )

        yield PipelineEvent(
            "preview",
            json.dumps({
                "preview_id": new_preview_id,
                "program": {
                    "name": program_data.get("name", ""),
                    "goal": program_data.get("goal"),
                    "duration_weeks": program_data.get("duration_weeks"),
                    "sessions_per_week": program_data.get("sessions_per_week"),
                    "periodization_model": program_data.get("periodization_model"),
                    "weeks": weeks,
                },
                "unmatched": unmatched if unmatched else None,
            }),
        )

    # ------------------------------------------------------------------
    # Phase 2: Save, Schedule, Push
    # ------------------------------------------------------------------

    async def save_program(
        self,
        *,
        preview_id: str,
        user_id: str,
        schedule_start_date: Optional[str] = None,
        cancel_event: Optional[asyncio.Event] = None,
    ) -> AsyncGenerator[PipelineEvent, None]:
        """Phase 2: Save program, schedule workouts, push to devices."""

        # 1. Retrieve full program
        program_data = await self._preview_store.consume(preview_id, user_id)
        if not program_data:
            yield PipelineEvent(
                "error",
                json.dumps({
                    "stage": "saving",
                    "message": "Program preview not found or expired. Please regenerate.",
                    "recoverable": False,
                }),
            )
            return

        weeks = program_data.get("weeks", [])
        program_name = program_data.get("name", "Training Program")

        # --- Stage: saving ---
        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "saving", "message": "Saving program to library..."}),
        )

        saved_workout_ids: List[str] = []
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                # Save each workout
                for week in weeks:
                    for workout in week.get("workouts", []):
                        if cancel_event and cancel_event.is_set():
                            yield PipelineEvent(
                                "error",
                                json.dumps({
                                    "stage": "saving",
                                    "message": "Cancelled",
                                    "recoverable": True,
                                }),
                            )
                            return

                        save_payload = {
                            "profile_id": user_id,
                            "workout_data": {
                                "title": workout.get("name", "Workout"),
                                "exercises": workout.get("exercises", []),
                                "tags": [
                                    program_data.get("goal", ""),
                                    f"week-{week.get('week_number', '')}",
                                    workout.get("workout_type", ""),
                                ],
                            },
                            "device": "web",
                            "title": workout.get("name", "Workout"),
                        }

                        resp = await client.post(
                            f"{self._mapper_url}/workouts/save",
                            json=save_payload,
                            headers=self._auth_headers(user_id),
                        )
                        resp.raise_for_status()
                        result = resp.json()
                        saved = result.get("workout", result)
                        wid = saved.get("id") or saved.get("workout_id")
                        if wid:
                            saved_workout_ids.append(wid)
                            workout["saved_workout_id"] = wid

        except httpx.HTTPError as e:
            logger.error("Failed to save workouts: %s", e)
            yield PipelineEvent(
                "error",
                json.dumps({
                    "stage": "saving",
                    "message": "Failed to save workouts to library. Please try again.",
                    "recoverable": True,
                }),
            )
            return

        # --- Stage: scheduling (optional) ---
        scheduled_count = 0
        if schedule_start_date:
            yield PipelineEvent(
                "stage",
                json.dumps({
                    "stage": "scheduling",
                    "message": f"Adding {len(saved_workout_ids)} sessions to calendar...",
                }),
            )

            try:
                start = date.fromisoformat(schedule_start_date)

                async with httpx.AsyncClient(timeout=30.0) as client:
                    for week in weeks:
                        week_num = week.get("week_number", 1)
                        for workout in week.get("workouts", []):
                            wid = workout.get("saved_workout_id")
                            if not wid:
                                continue

                            day_of_week = workout.get("day_of_week", 0)
                            workout_date = start + timedelta(
                                days=(week_num - 1) * 7 + day_of_week
                            )

                            cal_body = {
                                "workout_id": wid,
                                "scheduled_date": workout_date.isoformat(),
                            }
                            try:
                                resp = await client.post(
                                    f"{self._calendar_url}/calendar",
                                    json=cal_body,
                                    headers=self._auth_headers(user_id),
                                )
                                resp.raise_for_status()
                                scheduled_count += 1
                            except httpx.HTTPError:
                                logger.warning(
                                    "Failed to schedule workout %s on %s",
                                    wid,
                                    workout_date,
                                )
            except ValueError as e:
                logger.error("Scheduling failed: %s", e)

        # --- Stage: pushing (if APNs available) ---
        push_sent = False
        if self._apns_service:
            yield PipelineEvent(
                "stage",
                json.dumps({
                    "stage": "pushing",
                    "message": "Syncing to your devices...",
                }),
            )
            try:
                await self._apns_service.send_to_user(
                    user_id,
                    {
                        "type": "program_saved",
                        "program_name": program_name,
                        "workout_count": len(saved_workout_ids),
                    },
                )
                push_sent = True
            except Exception:
                logger.warning("APNs push failed for user %s (non-fatal)", user_id)

        # --- Complete ---
        yield PipelineEvent(
            "stage",
            json.dumps({"stage": "complete", "message": "Program saved!"}),
        )

        yield PipelineEvent(
            "complete",
            json.dumps({
                "program_name": program_name,
                "workout_count": len(saved_workout_ids),
                "workout_ids": saved_workout_ids,
                "scheduled_count": scheduled_count,
                "device_push_sent": push_sent,
            }),
        )
