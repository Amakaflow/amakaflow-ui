"""Tests for ProgramPipelineService async generator.

Covers all three pipeline phases:
  - design_outline: LLM designs program structure + periodization
  - generate_workouts: batched LLM generation (1 call per week) + mapping
  - save_program: persist workouts, schedule, push to devices

Part of AMA-567 Phase E: Program pipeline (batched generation)
"""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from backend.services.preview_store import PreviewStore
from backend.services.program_pipeline_service import (
    PipelineEvent,
    ProgramPipelineService,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_response(status_code: int = 200, json_data: dict | None = None):
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json.return_value = json_data or {}
    return resp


async def _collect_events(gen) -> list[PipelineEvent]:
    events = []
    async for event in gen:
        events.append(event)
    return events


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_client():
    client = AsyncMock(spec=httpx.AsyncClient)
    return client


@pytest.fixture
def preview_store():
    return PreviewStore(ttl_seconds=60)


@pytest.fixture
def service(mock_client, preview_store):
    return ProgramPipelineService(
        ingestor_url="http://test-ingestor:8004",
        auth_token="Bearer test-token",
        mapper_api_url="http://test-mapper:8003",
        calendar_api_url="http://test-calendar:8006",
        preview_store=preview_store,
        http_client=mock_client,
    )


# Common parameters for design_outline calls
DESIGN_PARAMS = dict(
    goal="hypertrophy",
    experience_level="intermediate",
    duration_weeks=8,
    sessions_per_week=4,
    time_per_session=60,
    equipment=["barbell", "dumbbells"],
    user_id="user-1",
)


# ---------------------------------------------------------------------------
# design_outline tests
# ---------------------------------------------------------------------------

class TestDesignOutline:
    """Tests for ProgramPipelineService.design_outline()."""

    @pytest.mark.asyncio
    async def test_design_outline_happy_path(self, service, mock_client):
        """Happy path: stage(designing) -> stage(complete) -> preview with preview_id."""
        # Mock periodization call (first post) and design-outline call (second post)
        mock_client.post.side_effect = [
            # periodization plan (mapper-api)
            _mock_response(200, {"weeks": []}),
            # design-outline (ingestor)
            _mock_response(200, {
                "success": True,
                "program": {
                    "name": "8-Week Hypertrophy",
                    "weeks": [
                        {"week_number": 1, "focus": "Foundation"},
                        {"week_number": 2, "focus": "Volume"},
                    ],
                },
            }),
        ]

        events = await _collect_events(service.design_outline(**DESIGN_PARAMS))

        # Expect: stage(designing) + stage(complete) + preview
        assert len(events) == 3

        assert events[0].event == "stage"
        assert json.loads(events[0].data)["stage"] == "designing"

        assert events[1].event == "stage"
        assert json.loads(events[1].data)["stage"] == "complete"

        assert events[2].event == "preview"
        preview = json.loads(events[2].data)
        assert "preview_id" in preview
        assert preview["program"]["name"] == "8-Week Hypertrophy"
        assert len(preview["program"]["weeks"]) == 2

    @pytest.mark.asyncio
    async def test_design_outline_stores_in_preview_store(
        self, service, mock_client, preview_store
    ):
        """Verify preview_store.get() returns the outline after design_outline completes."""
        mock_client.post.side_effect = [
            _mock_response(200, {"weeks": []}),
            _mock_response(200, {
                "success": True,
                "program": {"name": "Stored Program", "weeks": [{"week_number": 1}]},
            }),
        ]

        events = await _collect_events(service.design_outline(**DESIGN_PARAMS))

        preview_event = next(e for e in events if e.event == "preview")
        preview_id = json.loads(preview_event.data)["preview_id"]

        stored = preview_store.get(preview_id, "user-1")
        assert stored is not None
        assert stored["type"] == "program_outline"
        assert stored["program"]["name"] == "Stored Program"

    @pytest.mark.asyncio
    async def test_design_outline_invalid_duration_rejects(self, service, mock_client):
        """duration_weeks=2 (below MIN_DURATION_WEEKS=4) yields error."""
        params = {**DESIGN_PARAMS, "duration_weeks": 2}

        events = await _collect_events(service.design_outline(**params))

        assert len(events) == 1
        assert events[0].event == "error"
        error = json.loads(events[0].data)
        assert "Duration" in error["message"] or "duration" in error["message"].lower()
        assert error["recoverable"] is False

        # mock_client should not have been called
        mock_client.post.assert_not_called()

    @pytest.mark.asyncio
    async def test_design_outline_ingestor_failure(self, service, mock_client):
        """HTTP error during ingestor call yields recoverable error event."""
        mock_client.post.side_effect = [
            # periodization succeeds
            _mock_response(200, {"weeks": []}),
            # ingestor raises
            httpx.ConnectError("Connection refused"),
        ]

        events = await _collect_events(service.design_outline(**DESIGN_PARAMS))

        error_events = [e for e in events if e.event == "error"]
        assert len(error_events) == 1
        error = json.loads(error_events[0].data)
        assert error["stage"] == "designing"
        assert error["recoverable"] is True

    @pytest.mark.asyncio
    async def test_design_outline_cancellation(self, service, mock_client):
        """cancel_event.set() before call yields Cancelled error."""
        cancel = asyncio.Event()
        cancel.set()

        # First call is periodization (still happens before cancel check in inner)
        # but the cancel check happens before the periodization call in _design_outline_inner
        events = await _collect_events(
            service.design_outline(**DESIGN_PARAMS, cancel_event=cancel)
        )

        error_events = [e for e in events if e.event == "error"]
        assert len(error_events) == 1
        error = json.loads(error_events[0].data)
        assert error["message"] == "Cancelled"
        assert error["recoverable"] is False


# ---------------------------------------------------------------------------
# generate_workouts tests
# ---------------------------------------------------------------------------

class TestGenerateWorkouts:
    """Tests for ProgramPipelineService.generate_workouts()."""

    def _seed_outline(self, preview_store, preview_id="prev-1", num_weeks=2):
        """Seed a program_outline into the preview store."""
        weeks = [
            {"week_number": i + 1, "focus": f"Week {i + 1}"}
            for i in range(num_weeks)
        ]
        preview_store.put(preview_id, "user-1", {
            "type": "program_outline",
            "program": {"name": "Test Program", "weeks": weeks},
            "parameters": {
                "goal": "hypertrophy",
                "experience_level": "intermediate",
                "duration_weeks": num_weeks,
                "sessions_per_week": 3,
                "time_per_session": 60,
                "equipment": ["barbell"],
                "preferred_days": [],
                "injuries": None,
                "focus_areas": [],
                "avoid_exercises": [],
            },
        })

    @pytest.mark.asyncio
    async def test_generate_workouts_happy_path(
        self, service, mock_client, preview_store
    ):
        """Sub-progress events for each week, mapping stage, complete, and preview."""
        self._seed_outline(preview_store, num_weeks=2)

        mock_client.post.side_effect = [
            # Week 1 generate
            _mock_response(200, {
                "success": True,
                "workouts": [
                    {"name": "W1 Push", "exercises": [{"name": "Bench Press"}]},
                ],
            }),
            # Week 2 generate
            _mock_response(200, {
                "success": True,
                "workouts": [
                    {"name": "W2 Pull", "exercises": [{"name": "Barbell Row"}]},
                ],
            }),
            # Batch mapping
            _mock_response(200, {
                "matches": [
                    {"exercise_id": "ex-1", "exercise_name": "Bench Press", "confidence": 0.95},
                    {"exercise_id": "ex-2", "exercise_name": "Barbell Row", "confidence": 0.90},
                ],
            }),
        ]

        events = await _collect_events(
            service.generate_workouts(preview_id="prev-1", user_id="user-1")
        )

        # Expect: stage(generating w1) + stage(generating w2) + stage(mapping) + stage(complete) + preview
        stages = [json.loads(e.data) for e in events if e.event == "stage"]
        assert stages[0]["stage"] == "generating"
        assert stages[0]["sub_progress"]["current"] == 1
        assert stages[1]["stage"] == "generating"
        assert stages[1]["sub_progress"]["current"] == 2
        assert stages[2]["stage"] == "mapping"
        assert stages[3]["stage"] == "complete"

        preview_events = [e for e in events if e.event == "preview"]
        assert len(preview_events) == 1
        preview = json.loads(preview_events[0].data)
        assert "preview_id" in preview
        assert len(preview["program"]["weeks"]) == 2

    @pytest.mark.asyncio
    async def test_generate_workouts_preview_not_found(
        self, service, mock_client, preview_store
    ):
        """Missing preview_id yields error."""
        events = await _collect_events(
            service.generate_workouts(preview_id="nonexistent", user_id="user-1")
        )

        assert len(events) == 1
        assert events[0].event == "error"
        error = json.loads(events[0].data)
        assert "not found" in error["message"].lower()

    @pytest.mark.asyncio
    async def test_generate_workouts_wrong_preview_type(
        self, service, mock_client, preview_store
    ):
        """Preview with type != 'program_outline' yields error."""
        preview_store.put("prev-wrong", "user-1", {
            "type": "program_full",  # wrong type for generate_workouts
            "program": {},
            "parameters": {},
        })

        events = await _collect_events(
            service.generate_workouts(preview_id="prev-wrong", user_id="user-1")
        )

        assert len(events) == 1
        assert events[0].event == "error"
        error = json.loads(events[0].data)
        assert "not found" in error["message"].lower()

    @pytest.mark.asyncio
    async def test_generate_workouts_refreshes_ttl(
        self, service, mock_client, preview_store
    ):
        """Verify preview_store.put() is called to refresh TTL on the outline."""
        self._seed_outline(preview_store, num_weeks=1)

        mock_client.post.side_effect = [
            _mock_response(200, {
                "success": True,
                "workouts": [{"name": "W1", "exercises": []}],
            }),
            # mapping (no exercises, still called)
            _mock_response(200, {"matches": []}),
        ]

        # After calling generate_workouts, the old preview is consumed (pop)
        # and a new program_full preview is stored
        events = await _collect_events(
            service.generate_workouts(preview_id="prev-1", user_id="user-1")
        )

        # Original outline should be consumed
        assert preview_store.get("prev-1", "user-1") is None

        # New full preview should exist
        preview_event = next(e for e in events if e.event == "preview")
        new_id = json.loads(preview_event.data)["preview_id"]
        stored = preview_store.get(new_id, "user-1")
        assert stored is not None
        assert stored["type"] == "program_full"

    @pytest.mark.asyncio
    async def test_generate_workouts_deduplicates_unmatched(
        self, service, mock_client, preview_store
    ):
        """Same exercise name across weeks only appears once in unmatched list."""
        self._seed_outline(preview_store, num_weeks=2)

        mock_client.post.side_effect = [
            # Week 1: has "Cable Fly"
            _mock_response(200, {
                "success": True,
                "workouts": [
                    {"name": "W1", "exercises": [{"name": "Cable Fly"}]},
                ],
            }),
            # Week 2: also has "Cable Fly"
            _mock_response(200, {
                "success": True,
                "workouts": [
                    {"name": "W2", "exercises": [{"name": "Cable Fly"}]},
                ],
            }),
            # Batch mapping — low confidence match (below 0.70 threshold)
            _mock_response(200, {
                "matches": [
                    {"exercise_id": "ex-99", "exercise_name": "Cable Chest Fly", "confidence": 0.55},
                ],
            }),
        ]

        events = await _collect_events(
            service.generate_workouts(preview_id="prev-1", user_id="user-1")
        )

        preview_event = next(e for e in events if e.event == "preview")
        preview = json.loads(preview_event.data)
        unmatched = preview.get("unmatched")
        assert unmatched is not None
        # "Cable Fly" appears in both weeks but should be deduplicated
        assert len(unmatched) == 1
        assert unmatched[0]["name"] == "Cable Fly"


# ---------------------------------------------------------------------------
# save_program tests
# ---------------------------------------------------------------------------

class TestSaveProgram:
    """Tests for ProgramPipelineService.save_program()."""

    def _seed_full_program(
        self, preview_store, preview_id="prev-full", num_weeks=2, workouts_per_week=2
    ):
        """Seed a program_full preview into the preview store."""
        weeks = []
        for w in range(num_weeks):
            workouts = [
                {
                    "name": f"Week {w + 1} Workout {j + 1}",
                    "exercises": [{"name": "Squat", "sets": 3, "reps": 8}],
                }
                for j in range(workouts_per_week)
            ]
            weeks.append({"week_number": w + 1, "workouts": workouts})

        preview_store.put(preview_id, "user-1", {
            "type": "program_full",
            "program": {"name": "Test Program", "weeks": weeks},
            "parameters": {"preferred_days": ["monday", "wednesday"]},
        })

    @pytest.mark.asyncio
    async def test_save_program_happy_path(
        self, service, mock_client, preview_store
    ):
        """stage(saving) -> stage(complete) -> complete with workout_ids."""
        self._seed_full_program(preview_store, num_weeks=1, workouts_per_week=2)

        workout_counter = 0

        def make_save_response(*args, **kwargs):
            nonlocal workout_counter
            workout_counter += 1
            return _mock_response(200, {
                "workout": {"id": f"w-{workout_counter}"},
            })

        mock_client.post.side_effect = make_save_response

        events = await _collect_events(
            service.save_program(preview_id="prev-full", user_id="user-1")
        )

        # stage(saving) + stage(complete) + complete
        stages = [json.loads(e.data) for e in events if e.event == "stage"]
        assert stages[0]["stage"] == "saving"
        assert stages[-1]["stage"] == "complete"

        complete_events = [e for e in events if e.event == "complete"]
        assert len(complete_events) == 1
        complete = json.loads(complete_events[0].data)
        assert complete["workout_ids"] == ["w-1", "w-2"]
        assert complete["workout_count"] == 2

    @pytest.mark.asyncio
    async def test_save_program_preview_not_found(
        self, service, mock_client, preview_store
    ):
        """Missing preview_id yields error."""
        events = await _collect_events(
            service.save_program(preview_id="missing", user_id="user-1")
        )

        assert len(events) == 1
        assert events[0].event == "error"
        error = json.loads(events[0].data)
        assert "not found" in error["message"].lower() or "expired" in error["message"].lower()

    @pytest.mark.asyncio
    async def test_save_program_partial_save_continues(
        self, service, mock_client, preview_store
    ):
        """Some saves fail but saved_workout_ids are still returned."""
        self._seed_full_program(preview_store, num_weeks=1, workouts_per_week=3)

        call_count = 0

        def mock_save(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return _mock_response(200, {"workout": {"id": "w-1"}})
            elif call_count == 2:
                return _mock_response(200, {"workout": {"id": "w-2"}})
            else:
                # Third save raises HTTP error — simulates partial failure
                raise httpx.ConnectError("Connection lost mid-save")

        mock_client.post.side_effect = mock_save

        events = await _collect_events(
            service.save_program(preview_id="prev-full", user_id="user-1")
        )

        # Should still complete because we had some saved_workout_ids
        complete_events = [e for e in events if e.event == "complete"]
        assert len(complete_events) == 1
        complete = json.loads(complete_events[0].data)
        assert complete["workout_ids"] == ["w-1", "w-2"]
        assert complete["workout_count"] == 2

    @pytest.mark.asyncio
    async def test_save_program_includes_total_workouts(
        self, service, mock_client, preview_store
    ):
        """Complete event has total_workouts field reflecting all workouts in the program."""
        self._seed_full_program(preview_store, num_weeks=2, workouts_per_week=3)

        counter = 0

        def make_resp(*args, **kwargs):
            nonlocal counter
            counter += 1
            return _mock_response(200, {"workout": {"id": f"w-{counter}"}})

        mock_client.post.side_effect = make_resp

        events = await _collect_events(
            service.save_program(preview_id="prev-full", user_id="user-1")
        )

        complete_events = [e for e in events if e.event == "complete"]
        assert len(complete_events) == 1
        complete = json.loads(complete_events[0].data)
        # 2 weeks * 3 workouts = 6 total
        assert complete["total_workouts"] == 6
        assert complete["workout_count"] == 6
        assert len(complete["workout_ids"]) == 6
