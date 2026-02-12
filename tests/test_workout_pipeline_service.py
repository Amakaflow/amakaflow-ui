"""Tests for WorkoutPipelineService async generator."""

import json
from unittest.mock import AsyncMock, patch, MagicMock

import httpx
import pytest

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
