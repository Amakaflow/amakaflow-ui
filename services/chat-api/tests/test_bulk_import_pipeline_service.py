"""Tests for BulkImportPipelineService parallel import pipeline."""

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from backend.services.bulk_import_pipeline_service import BulkImportPipelineService
from backend.services.workout_pipeline_service import PipelineEvent


@pytest.fixture
def service():
    return BulkImportPipelineService(
        ingestor_url="http://test:8004",
        auth_token="Bearer test",
        mapper_api_url="http://test:8003",
        max_concurrent=2,
    )


async def _collect_events(gen) -> list[PipelineEvent]:
    events = []
    async for event in gen:
        events.append(event)
    return events


@pytest.mark.asyncio
async def test_validates_urls(service):
    """Empty URL list yields error."""
    events = await _collect_events(service.bulk_import(urls=[], user_id="u-1"))
    assert events[-1].event == "error"
    assert "no urls" in json.loads(events[-1].data)["message"].lower()


@pytest.mark.asyncio
async def test_parallel_import_two_urls(service):
    """Two URLs run concurrently, each producing sub_pipeline events."""
    mock_workout = {
        "success": True,
        "workout": {"name": "Test", "exercises": [{"name": "Squat", "sets": 3, "reps": 10}]},
    }
    with patch("backend.services.bulk_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post.return_value = MagicMock(status_code=200, json=MagicMock(return_value=mock_workout))
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service.bulk_import(
                urls=["https://youtube.com/watch?v=1", "https://youtube.com/watch?v=2"],
                user_id="u-1",
            )
        )

    stage_events = [e for e in events if e.event == "stage"]
    assert any("validating" in json.loads(e.data).get("stage", "") for e in stage_events)
    preview_events = [e for e in events if e.event == "preview"]
    assert len(preview_events) == 1
    preview = json.loads(preview_events[0].data)
    assert len(preview["workouts"]) == 2


@pytest.mark.asyncio
async def test_respects_concurrency_limit(service):
    """With max_concurrent=2 and 4 URLs, only 2 run at a time."""
    active = {"count": 0, "max_seen": 0}

    async def slow_post(*args, **kwargs):
        active["count"] += 1
        active["max_seen"] = max(active["max_seen"], active["count"])
        await asyncio.sleep(0.05)
        active["count"] -= 1
        resp = MagicMock(status_code=200)
        resp.json.return_value = {"success": True, "workout": {"name": "T", "exercises": []}}
        return resp

    with patch("backend.services.bulk_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post.side_effect = slow_post
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        await _collect_events(
            service.bulk_import(
                urls=[f"https://youtube.com/watch?v={i}" for i in range(4)],
                user_id="u-1",
            )
        )

    assert active["max_seen"] <= 2


# --------------------------------------------------------------------------- #
# Error-path tests
# --------------------------------------------------------------------------- #


@pytest.mark.asyncio
async def test_unsupported_urls_yield_sub_pipeline_errors(service):
    """All-unsupported URLs produce per-URL sub_pipeline_error events and a final error."""
    events = await _collect_events(
        service.bulk_import(
            urls=["https://example.com/workout", "https://unknown.site/video"],
            user_id="u-1",
        )
    )

    sub_errors = [e for e in events if e.event == "sub_pipeline_error"]
    assert len(sub_errors) == 2
    for se in sub_errors:
        data = json.loads(se.data)
        assert "Unsupported URL" in data["message"]

    # Final event should be an error because no valid URLs remain
    assert events[-1].event == "error"
    assert "no valid urls" in json.loads(events[-1].data)["message"].lower()


@pytest.mark.asyncio
async def test_mixed_valid_and_unsupported_urls(service):
    """One valid + one unsupported URL: sub_pipeline_error for bad, preview for good."""
    mock_workout = {
        "success": True,
        "workout": {"name": "Push Day", "exercises": [{"name": "Bench Press", "sets": 3, "reps": 8}]},
    }
    with patch("backend.services.bulk_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post.return_value = MagicMock(
            status_code=200, json=MagicMock(return_value=mock_workout)
        )
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service.bulk_import(
                urls=["https://youtube.com/watch?v=1", "https://example.com/bad"],
                user_id="u-1",
            )
        )

    # One sub_pipeline_error for the unsupported URL
    sub_errors = [e for e in events if e.event == "sub_pipeline_error"]
    assert len(sub_errors) == 1
    assert "Unsupported URL" in json.loads(sub_errors[0].data)["message"]
    assert json.loads(sub_errors[0].data)["url"] == "https://example.com/bad"

    # Preview should reflect: total_urls=2, successful=1, failed=0
    # (unsupported URLs are filtered before import, so they aren't counted as "failed")
    preview_events = [e for e in events if e.event == "preview"]
    assert len(preview_events) == 1
    preview = json.loads(preview_events[0].data)
    assert preview["total_urls"] == 2
    assert preview["successful"] == 1
    assert preview["failed"] == 0


@pytest.mark.asyncio
async def test_http_timeout_yields_sub_pipeline_error(service):
    """httpx.TimeoutException results in a sub_pipeline_error with 'timed out'."""
    with patch("backend.services.bulk_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post.side_effect = httpx.TimeoutException("timeout")
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service.bulk_import(
                urls=["https://youtube.com/watch?v=timeout"],
                user_id="u-1",
            )
        )

    sub_errors = [e for e in events if e.event == "sub_pipeline_error"]
    assert len(sub_errors) == 1
    assert "timed out" in json.loads(sub_errors[0].data)["message"].lower()

    preview = json.loads([e for e in events if e.event == "preview"][0].data)
    assert preview["successful"] == 0
    assert preview["failed"] == 1


@pytest.mark.asyncio
async def test_connection_error_yields_sub_pipeline_error(service):
    """httpx.ConnectError results in a sub_pipeline_error with 'Connection failed'."""
    with patch("backend.services.bulk_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post.side_effect = httpx.ConnectError("connection refused")
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service.bulk_import(
                urls=["https://youtube.com/watch?v=fail"],
                user_id="u-1",
            )
        )

    sub_errors = [e for e in events if e.event == "sub_pipeline_error"]
    assert len(sub_errors) == 1
    assert "Connection failed" in json.loads(sub_errors[0].data)["message"]

    preview = json.loads([e for e in events if e.event == "preview"][0].data)
    assert preview["successful"] == 0
    assert preview["failed"] == 1


@pytest.mark.asyncio
async def test_cancel_event_stops_import(service):
    """Setting cancel_event before import prevents any HTTP calls."""
    cancel = asyncio.Event()
    cancel.set()  # pre-cancelled

    with patch("backend.services.bulk_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service.bulk_import(
                urls=["https://youtube.com/watch?v=1", "https://youtube.com/watch?v=2"],
                user_id="u-1",
                cancel_event=cancel,
            )
        )

    # No HTTP calls should have been made
    mock_client.post.assert_not_called()

    # Both URLs should be failed in preview (results[idx] = None for cancelled)
    preview = json.loads([e for e in events if e.event == "preview"][0].data)
    assert preview["successful"] == 0
    assert preview["failed"] == 2


@pytest.mark.asyncio
async def test_invalid_json_response_yields_sub_pipeline_error(service):
    """Non-JSON response body yields sub_pipeline_error with 'Invalid response'."""
    with patch("backend.services.bulk_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        bad_response = MagicMock(status_code=200)
        bad_response.json.side_effect = ValueError("No JSON")
        mock_client.post.return_value = bad_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service.bulk_import(
                urls=["https://youtube.com/watch?v=badjson"],
                user_id="u-1",
            )
        )

    sub_errors = [e for e in events if e.event == "sub_pipeline_error"]
    assert len(sub_errors) == 1
    assert "Invalid response" in json.loads(sub_errors[0].data)["message"]

    preview = json.loads([e for e in events if e.event == "preview"][0].data)
    assert preview["successful"] == 0
    assert preview["failed"] == 1


@pytest.mark.asyncio
async def test_ingestor_returns_error_status(service):
    """Ingestor 500 with error payload yields sub_pipeline_error with the message."""
    with patch("backend.services.bulk_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        error_body = {"success": False, "error": "Internal server error"}
        mock_client.post.return_value = MagicMock(
            status_code=500, json=MagicMock(return_value=error_body)
        )
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service.bulk_import(
                urls=["https://youtube.com/watch?v=servererr"],
                user_id="u-1",
            )
        )

    sub_errors = [e for e in events if e.event == "sub_pipeline_error"]
    assert len(sub_errors) == 1
    assert "Internal server error" in json.loads(sub_errors[0].data)["message"]

    preview = json.loads([e for e in events if e.event == "preview"][0].data)
    assert preview["successful"] == 0
    assert preview["failed"] == 1
