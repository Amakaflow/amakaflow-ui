"""Tests for WorkoutPipelineService async generator."""

import asyncio
import json
from unittest.mock import AsyncMock, patch, MagicMock

import httpx
import pytest

from backend.services.preview_store import PreviewStore
from backend.services.workout_pipeline_service import (
    PipelineEvent,
    WorkoutPipelineService,
)


@pytest.fixture
def service():
    return WorkoutPipelineService(
        ingestor_url="http://test-ingestor:8004",
        auth_token="Bearer test-token",  # Raw header value from deps.py (already includes Bearer prefix)
    )


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


@pytest.mark.asyncio
async def test_successful_generation(service):
    """Happy path: stage(analyzing) → stage(creating) → stage(complete) → preview."""
    mock_workout = {
        "success": True,
        "workout": {
            "name": "Push Day",
            "exercises": [
                {"name": "Bench Press", "sets": 3, "reps": 10, "muscle_group": "chest"},
                {"name": "Shoulder Press", "sets": 3, "reps": 8, "muscle_group": "shoulders"},
            ],
            "duration_minutes": 45,
            "difficulty": "intermediate",
        },
    }

    with patch("backend.services.workout_pipeline_service.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.post.return_value = _mock_response(200, mock_workout)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        events = await _collect_events(
            service.generate(description="push day workout", difficulty="intermediate")
        )

    assert len(events) == 4

    # Stage: analyzing
    assert events[0].event == "stage"
    assert json.loads(events[0].data)["stage"] == "analyzing"

    # Stage: creating
    assert events[1].event == "stage"
    assert json.loads(events[1].data)["stage"] == "creating"

    # Stage: complete
    assert events[2].event == "stage"
    assert json.loads(events[2].data)["stage"] == "complete"

    # Preview
    assert events[3].event == "preview"
    preview = json.loads(events[3].data)
    assert "preview_id" in preview
    assert preview["workout"]["name"] == "Push Day"
    assert len(preview["workout"]["exercises"]) == 2
    assert preview["workout"]["exercises"][0]["name"] == "Bench Press"
    assert preview["workout"]["duration_minutes"] == 45
    assert preview["workout"]["difficulty"] == "intermediate"


@pytest.mark.asyncio
async def test_api_returns_error_status(service):
    """Non-200 response yields error event."""
    with patch("backend.services.workout_pipeline_service.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.post.return_value = _mock_response(500, {})
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        events = await _collect_events(service.generate(description="bad request"))

    assert len(events) == 3  # analyzing, creating, error
    assert events[2].event == "error"
    error_data = json.loads(events[2].data)
    assert error_data["recoverable"] is True


@pytest.mark.asyncio
async def test_api_returns_not_success(service):
    """success=false in response body yields error event."""
    with patch("backend.services.workout_pipeline_service.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.post.return_value = _mock_response(200, {"success": False})
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        events = await _collect_events(service.generate(description="bad request"))

    assert len(events) == 3
    assert events[2].event == "error"


@pytest.mark.asyncio
async def test_http_connection_error(service):
    """Network error yields error event."""
    with patch("backend.services.workout_pipeline_service.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.post.side_effect = httpx.ConnectError("Connection refused")
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        events = await _collect_events(service.generate(description="test"))

    assert len(events) == 3
    assert events[2].event == "error"
    error_data = json.loads(events[2].data)
    assert "connect" in error_data["message"].lower()


@pytest.mark.asyncio
async def test_request_body_includes_optional_fields(service):
    """Optional fields are included in the request body when provided."""
    mock_workout = {
        "success": True,
        "workout": {"name": "Test", "exercises": []},
    }

    with patch("backend.services.workout_pipeline_service.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.post.return_value = _mock_response(200, mock_workout)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client_cls.return_value = mock_client

        await _collect_events(
            service.generate(
                description="test",
                difficulty="hard",
                duration_minutes=60,
                equipment=["barbell", "dumbbells"],
            )
        )

        call_kwargs = mock_client.post.call_args
        body = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
        assert body["transcription"] == "test"
        assert body["difficulty"] == "hard"
        assert body["duration_minutes"] == 60
        assert body["equipment"] == ["barbell", "dumbbells"]


# =============================================================================
# save_and_push Tests
# =============================================================================


@pytest.fixture
def preview_store():
    return PreviewStore(ttl_seconds=60)


@pytest.fixture
def service_with_save(preview_store):
    return WorkoutPipelineService(
        ingestor_url="http://test-ingestor:8004",
        auth_token="Bearer test-token",
        mapper_api_url="http://test-mapper:8003",
        calendar_api_url="http://test-calendar:8006",
        preview_store=preview_store,
    )


@pytest.mark.asyncio
async def test_save_and_push_no_preview_store():
    """save_and_push yields error when preview store is not configured."""
    svc = WorkoutPipelineService(
        ingestor_url="http://test-ingestor:8004",
        auth_token="Bearer test-token",
    )
    events = await _collect_events(svc.save_and_push("p-1", "user-1"))

    assert len(events) == 2  # stage(validating) + error
    assert events[1].event == "error"
    error = json.loads(events[1].data)
    assert "not configured" in error["message"].lower()
    assert error["recoverable"] is False


@pytest.mark.asyncio
async def test_save_and_push_missing_preview(service_with_save, preview_store):
    """save_and_push yields error when preview ID doesn't exist."""
    events = await _collect_events(
        service_with_save.save_and_push("nonexistent", "user-1")
    )

    assert len(events) == 2
    assert events[1].event == "error"
    error = json.loads(events[1].data)
    assert "not found" in error["message"].lower()


@pytest.mark.asyncio
async def test_save_and_push_success(service_with_save, preview_store):
    """Happy path: save_and_push saves workout and yields complete event."""
    preview_store.put("p-1", "user-1", {"name": "Leg Day", "exercises": []})

    with patch("backend.services.workout_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_save_resp = _mock_response(200, {
            "workout": {"id": "w-saved-1", "name": "Leg Day"},
        })
        mock_client.post.return_value = mock_save_resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service_with_save.save_and_push("p-1", "user-1")
        )

    # stage(validating) → stage(saving) → stage(complete) → complete
    assert len(events) == 4
    assert events[0].event == "stage"
    assert json.loads(events[0].data)["stage"] == "validating"
    assert events[1].event == "stage"
    assert json.loads(events[1].data)["stage"] == "saving"
    assert events[2].event == "stage"
    assert json.loads(events[2].data)["stage"] == "complete"
    assert events[3].event == "complete"

    complete = json.loads(events[3].data)
    assert complete["workout_id"] == "w-saved-1"
    assert complete["title"] == "Leg Day"

    # Preview should be consumed
    assert preview_store.get("p-1", "user-1") is None


@pytest.mark.asyncio
async def test_save_and_push_mapper_api_failure(service_with_save, preview_store):
    """save_and_push yields error when mapper-api returns non-200."""
    preview_store.put("p-1", "user-1", {"name": "Fail Workout"})

    with patch("backend.services.workout_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post.return_value = _mock_response(500, {})
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service_with_save.save_and_push("p-1", "user-1")
        )

    # stage(validating) → stage(saving) → error
    assert len(events) == 3
    assert events[2].event == "error"
    error = json.loads(events[2].data)
    assert error["stage"] == "saving"
    assert error["recoverable"] is True


@pytest.mark.asyncio
async def test_save_and_push_with_calendar(service_with_save, preview_store):
    """save_and_push schedules workout when schedule_date provided."""
    preview_store.put("p-2", "user-1", {"name": "Push Day"})

    call_count = 0

    async def mock_post(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return _mock_response(200, {"workout": {"id": "w-2"}})
        return _mock_response(200, {"event_id": "evt-1"})

    with patch("backend.services.workout_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post.side_effect = mock_post
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service_with_save.save_and_push("p-2", "user-1", schedule_date="2026-03-01")
        )

    # stage(validating) → stage(saving) → stage(scheduling) → stage(complete) → complete
    assert len(events) == 5
    stages = [json.loads(e.data).get("stage") for e in events if e.event == "stage"]
    assert "scheduling" in stages

    complete = json.loads(events[4].data)
    assert complete["workout_id"] == "w-2"
    assert complete["scheduled_date"] == "2026-03-01"
    assert call_count == 2


@pytest.mark.asyncio
async def test_save_and_push_calendar_failure_still_succeeds(service_with_save, preview_store):
    """Calendar failure doesn't block save — workout still saved, scheduled_date is None."""
    preview_store.put("p-3", "user-1", {"name": "HIIT"})

    call_count = 0

    async def mock_post(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return _mock_response(200, {"workout": {"id": "w-3"}})
        return _mock_response(500, {})  # calendar fails

    with patch("backend.services.workout_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post.side_effect = mock_post
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service_with_save.save_and_push("p-3", "user-1", schedule_date="2026-03-01")
        )

    # Should still complete — calendar failure is non-fatal
    complete_events = [e for e in events if e.event == "complete"]
    assert len(complete_events) == 1

    complete = json.loads(complete_events[0].data)
    assert complete["workout_id"] == "w-3"
    assert complete["scheduled_date"] is None  # calendar failed


# =============================================================================
# Cancellation Tests
# =============================================================================


@pytest.mark.asyncio
async def test_generate_cancellation_before_api_call(service):
    """Cancellation before ingestor API call yields error and stops."""
    cancel = asyncio.Event()
    cancel.set()  # Already cancelled

    events = await _collect_events(
        service.generate(description="test", cancel_event=cancel)
    )

    # stage(analyzing) + error(cancelled)
    assert len(events) == 2
    assert events[1].event == "error"
    error = json.loads(events[1].data)
    assert error["message"] == "Cancelled"
    assert error["recoverable"] is False


@pytest.mark.asyncio
async def test_save_and_push_cancellation_before_save(service_with_save, preview_store):
    """Cancellation before mapper-api call yields error and stops."""
    preview_store.put("p-cancel", "user-1", {"name": "Cancel Test"})
    cancel = asyncio.Event()
    cancel.set()

    events = await _collect_events(
        service_with_save.save_and_push("p-cancel", "user-1", cancel_event=cancel)
    )

    # stage(validating) + error(cancelled)
    assert len(events) == 2
    assert events[1].event == "error"
    error = json.loads(events[1].data)
    assert error["message"] == "Cancelled"

    # Preview should NOT be consumed (not saved)
    assert preview_store.get("p-cancel", "user-1") is not None
