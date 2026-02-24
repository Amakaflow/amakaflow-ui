"""Tests for URLImportPipelineService async generator."""

import asyncio
import json
from unittest.mock import AsyncMock, patch, MagicMock

import httpx
import pytest

from backend.services.preview_store import PreviewStore
from backend.services.workout_pipeline_service import PipelineEvent
from backend.services.url_import_pipeline_service import (
    URLImportPipelineService,
    detect_platform,
)


@pytest.fixture
def service():
    return URLImportPipelineService(
        ingestor_url="http://test-ingestor:8004",
        auth_token="Bearer test-token",
    )


@pytest.fixture
def preview_store():
    return PreviewStore(ttl_seconds=60)


@pytest.fixture
def service_with_store(preview_store):
    return URLImportPipelineService(
        ingestor_url="http://test-ingestor:8004",
        auth_token="Bearer test-token",
        mapper_api_url="http://test-mapper:8003",
        preview_store=preview_store,
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


# =============================================================================
# detect_platform Tests
# =============================================================================


class TestDetectPlatform:
    def test_youtube_url(self):
        assert detect_platform("https://www.youtube.com/watch?v=abc123") == "youtube"

    def test_youtube_short_url(self):
        assert detect_platform("https://youtu.be/abc123") == "youtube"

    def test_tiktok_url(self):
        assert detect_platform("https://www.tiktok.com/@user/video/123") == "tiktok"

    def test_tiktok_vm_url(self):
        assert detect_platform("https://vm.tiktok.com/abc") == "tiktok"

    def test_instagram_url(self):
        assert detect_platform("https://www.instagram.com/p/abc123/") == "instagram"

    def test_pinterest_url(self):
        assert detect_platform("https://www.pinterest.com/pin/123/") == "pinterest"

    def test_pinterest_short_url(self):
        assert detect_platform("https://pin.it/abc") == "pinterest"

    def test_unsupported_url(self):
        assert detect_platform("https://example.com/workout") is None

    def test_invalid_url(self):
        assert detect_platform("not a url") is None


# =============================================================================
# Successful Import Tests
# =============================================================================


@pytest.mark.asyncio
async def test_youtube_import_success(service_with_store, preview_store):
    """Happy path: stages (fetching → extracting → parsing → mapping → complete) → preview."""
    mock_result = {
        "success": True,
        "workout": {
            "title": "Full Body HIIT",
            "exercises": [
                {"name": "Burpees", "sets": 3, "reps": 10, "muscle_group": "full_body"},
                {"name": "Mountain Climbers", "sets": 3, "reps": 20, "muscle_group": "core"},
            ],
            "blocks": [{"exercises": []}],
        },
    }

    with patch("backend.services.url_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post.return_value = _mock_response(200, mock_result)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service_with_store.ingest(
                url="https://www.youtube.com/watch?v=abc123",
                user_id="user-1",
            )
        )

    # 5 stage events + 1 preview
    assert len(events) == 6

    stages = [json.loads(e.data)["stage"] for e in events if e.event == "stage"]
    assert stages == ["fetching", "extracting", "parsing", "mapping", "complete"]

    # Preview
    preview_event = [e for e in events if e.event == "preview"][0]
    preview = json.loads(preview_event.data)
    assert "preview_id" in preview
    assert preview["platform"] == "youtube"
    assert preview["workout"]["name"] == "Full Body HIIT"
    assert len(preview["workout"]["exercises"]) == 2
    assert preview["workout"]["exercises"][0]["name"] == "Burpees"

    # Preview stored for later save
    stored = preview_store.get(preview["preview_id"], "user-1")
    assert stored is not None
    assert stored["title"] == "Full Body HIIT"

    # Correct ingestor endpoint called
    call_args = mock_client.post.call_args
    assert "/ingest/youtube" in call_args[0][0]


@pytest.mark.asyncio
async def test_tiktok_import_includes_mode(service):
    """TikTok imports include mode=auto in request body."""
    mock_result = {
        "success": True,
        "workout": {"title": "Quick HIIT", "exercises": []},
    }

    with patch("backend.services.url_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post.return_value = _mock_response(200, mock_result)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        await _collect_events(
            service.ingest(url="https://www.tiktok.com/@user/video/123")
        )

        call_kwargs = mock_client.post.call_args
        body = call_kwargs.kwargs.get("json") or call_kwargs[1].get("json")
        assert body["mode"] == "auto"
        assert "/ingest/tiktok" in call_kwargs[0][0]


@pytest.mark.asyncio
async def test_instagram_import_success(service):
    """Instagram import uses correct endpoint."""
    mock_result = {
        "success": True,
        "workout": {"title": "Core Circuit", "exercises": [{"name": "Plank"}]},
    }

    with patch("backend.services.url_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post.return_value = _mock_response(200, mock_result)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service.ingest(url="https://www.instagram.com/p/abc123/")
        )

    assert any(e.event == "preview" for e in events)
    call_args = mock_client.post.call_args
    assert "/ingest/instagram_test" in call_args[0][0]


@pytest.mark.asyncio
async def test_exercises_extracted_from_blocks(service):
    """Exercises are extracted from blocks when not at root level."""
    mock_result = {
        "success": True,
        "workout": {
            "title": "Block Workout",
            "blocks": [
                {"exercises": [{"name": "Squat", "sets": 4, "reps": 8}]},
                {"exercises": [{"name": "Lunge", "sets": 3, "reps": 12}]},
            ],
        },
    }

    with patch("backend.services.url_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post.return_value = _mock_response(200, mock_result)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service.ingest(url="https://www.youtube.com/watch?v=test")
        )

    preview = json.loads([e for e in events if e.event == "preview"][0].data)
    assert preview["workout"]["exercise_count"] == 2
    assert preview["workout"]["exercises"][0]["name"] == "Squat"
    assert preview["workout"]["exercises"][1]["name"] == "Lunge"


# =============================================================================
# Error Handling Tests
# =============================================================================


@pytest.mark.asyncio
async def test_unsupported_url(service):
    """Unsupported URL yields error immediately."""
    events = await _collect_events(
        service.ingest(url="https://example.com/workout")
    )

    assert len(events) == 1
    assert events[0].event == "error"
    error = json.loads(events[0].data)
    assert "unsupported" in error["message"].lower()
    assert error["recoverable"] is False


@pytest.mark.asyncio
async def test_invalid_domain_for_platform(service):
    """URL with wrong domain yields error."""
    events = await _collect_events(
        service.ingest(url="https://evil.com/watch?v=abc", platform="youtube")
    )

    assert len(events) == 1
    assert events[0].event == "error"
    assert "not allowed" in json.loads(events[0].data)["message"].lower()


@pytest.mark.asyncio
async def test_non_http_scheme_rejected(service):
    """Non-HTTP/HTTPS scheme (e.g., file://) is rejected."""
    events = await _collect_events(
        service.ingest(url="file://www.youtube.com/etc/passwd", platform="youtube")
    )

    assert len(events) == 1
    assert events[0].event == "error"
    error = json.loads(events[0].data)
    assert "http" in error["message"].lower()
    assert error["recoverable"] is False


@pytest.mark.asyncio
async def test_ftp_scheme_rejected(service):
    """FTP scheme is rejected."""
    events = await _collect_events(
        service.ingest(url="ftp://www.youtube.com/video", platform="youtube")
    )

    assert len(events) == 1
    assert events[0].event == "error"
    assert json.loads(events[0].data)["recoverable"] is False


@pytest.mark.asyncio
async def test_api_timeout(service):
    """Timeout yields recoverable error."""
    with patch("backend.services.url_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post.side_effect = httpx.TimeoutException("timed out")
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service.ingest(url="https://www.youtube.com/watch?v=long")
        )

    error_events = [e for e in events if e.event == "error"]
    assert len(error_events) == 1
    error = json.loads(error_events[0].data)
    assert "timed out" in error["message"].lower()
    assert error["recoverable"] is True


@pytest.mark.asyncio
async def test_api_connection_error(service):
    """Connection error yields recoverable error."""
    with patch("backend.services.url_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post.side_effect = httpx.ConnectError("Connection refused")
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service.ingest(url="https://www.youtube.com/watch?v=abc")
        )

    error_events = [e for e in events if e.event == "error"]
    assert len(error_events) == 1
    error = json.loads(error_events[0].data)
    assert "connect" in error["message"].lower()
    assert error["recoverable"] is True


@pytest.mark.asyncio
async def test_api_returns_error_status(service):
    """Non-200 response yields error."""
    with patch("backend.services.url_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post.return_value = _mock_response(500, {"error": "Internal error"})
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service.ingest(url="https://www.youtube.com/watch?v=abc")
        )

    error_events = [e for e in events if e.event == "error"]
    assert len(error_events) == 1
    assert json.loads(error_events[0].data)["recoverable"] is True


@pytest.mark.asyncio
async def test_non_json_response(service):
    """Non-JSON response (e.g., HTML error page) yields recoverable error."""
    with patch("backend.services.url_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        resp = MagicMock(spec=httpx.Response)
        resp.status_code = 200
        resp.json.side_effect = ValueError("No JSON object could be decoded")
        mock_client.post.return_value = resp
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service.ingest(url="https://www.youtube.com/watch?v=abc")
        )

    error_events = [e for e in events if e.event == "error"]
    assert len(error_events) == 1
    error = json.loads(error_events[0].data)
    assert "invalid response" in error["message"].lower()
    assert error["recoverable"] is True


@pytest.mark.asyncio
async def test_api_returns_no_workout_data(service):
    """Response with no workout data yields error at parsing stage."""
    with patch("backend.services.url_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post.return_value = _mock_response(200, {"success": True})
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service.ingest(url="https://www.youtube.com/watch?v=abc")
        )

    error_events = [e for e in events if e.event == "error"]
    assert len(error_events) == 1
    error = json.loads(error_events[0].data)
    assert error["stage"] == "parsing"


# =============================================================================
# Cancellation Tests
# =============================================================================


@pytest.mark.asyncio
async def test_cancellation_before_ingestor_call(service):
    """Cancellation before ingestor API call yields error and stops."""
    cancel = asyncio.Event()
    cancel.set()

    events = await _collect_events(
        service.ingest(
            url="https://www.youtube.com/watch?v=abc",
            cancel_event=cancel,
        )
    )

    # stage(fetching) + error(cancelled)
    assert len(events) == 2
    assert events[0].event == "stage"
    assert events[1].event == "error"
    error = json.loads(events[1].data)
    assert error["message"] == "Cancelled"
    assert error["recoverable"] is False


@pytest.mark.asyncio
async def test_cancellation_after_ingestor_call(service):
    """Cancellation after ingestor returns stops at next check."""
    cancel = asyncio.Event()

    mock_result = {
        "success": True,
        "workout": {"title": "Test", "exercises": [{"name": "Push-up"}]},
    }

    async def mock_post(*args, **kwargs):
        # Set cancel after the API call returns
        cancel.set()
        return _mock_response(200, mock_result)

    with patch("backend.services.url_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post.side_effect = mock_post
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service.ingest(
                url="https://www.youtube.com/watch?v=abc",
                cancel_event=cancel,
            )
        )

    # Should have some stages then a cancellation error
    error_events = [e for e in events if e.event == "error"]
    assert len(error_events) == 1
    assert json.loads(error_events[0].data)["message"] == "Cancelled"

    # Should NOT have a preview (cancelled before that stage)
    assert not any(e.event == "preview" for e in events)


# =============================================================================
# Pipeline Run Recording Tests
# =============================================================================


@pytest.mark.asyncio
async def test_pipeline_run_recorded_on_success(preview_store):
    """Pipeline run is created and updated on successful import."""
    mock_repo = AsyncMock()
    mock_repo.create.return_value = {"id": "run-1"}

    svc = URLImportPipelineService(
        ingestor_url="http://test-ingestor:8004",
        auth_token="Bearer test-token",
        preview_store=preview_store,
        pipeline_run_repo=mock_repo,
    )

    mock_result = {
        "success": True,
        "workout": {"title": "Test", "exercises": []},
    }

    with patch("backend.services.url_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post.return_value = _mock_response(200, mock_result)
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        await _collect_events(
            svc.ingest(url="https://www.youtube.com/watch?v=abc", user_id="user-1")
        )

    mock_repo.create.assert_called_once()
    create_kwargs = mock_repo.create.call_args.kwargs
    assert create_kwargs["pipeline"] == "url_import"
    assert create_kwargs["user_id"] == "user-1"

    # Should have running + completed status updates
    status_calls = mock_repo.update_status.call_args_list
    statuses = [c.args[1] for c in status_calls]
    assert "running" in statuses
    assert "completed" in statuses


@pytest.mark.asyncio
async def test_pipeline_run_recorded_on_failure(preview_store):
    """Pipeline run status set to failed on error."""
    mock_repo = AsyncMock()
    mock_repo.create.return_value = {"id": "run-2"}

    svc = URLImportPipelineService(
        ingestor_url="http://test-ingestor:8004",
        auth_token="Bearer test-token",
        preview_store=preview_store,
        pipeline_run_repo=mock_repo,
    )

    with patch("backend.services.url_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = AsyncMock()
        mock_client.post.side_effect = httpx.ConnectError("refused")
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_cls.return_value = mock_client

        await _collect_events(
            svc.ingest(url="https://www.youtube.com/watch?v=abc", user_id="user-1")
        )

    status_calls = mock_repo.update_status.call_args_list
    statuses = [c.args[1] for c in status_calls]
    assert "failed" in statuses


# =============================================================================
# AMA-717: Clarification Fields in Preview SSE Event Tests
# =============================================================================


def _make_ingestor_mock(json_data: dict):
    """Helper to build a patched AsyncClient that returns the given JSON."""
    mock_client = AsyncMock()
    mock_client.post.return_value = _mock_response(200, json_data)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    return mock_client


@pytest.mark.asyncio
async def test_preview_contains_needs_clarification_true_and_ambiguous_blocks(service):
    """When ingestor returns needs_clarification=True and blocks with low confidence
    and non-empty options, preview SSE event contains both fields with correct shape."""
    mock_result = {
        "success": True,
        "workout": {
            "title": "Ambiguous Circuit",
            "needs_clarification": True,
            "blocks": [
                {
                    "id": "block-1",
                    "label": "Block A",
                    "structure": "circuit",
                    "structure_confidence": 0.6,
                    "structure_options": ["circuit", "straight_sets"],
                    "exercises": [
                        {"name": "Push-up"},
                        {"name": "Squat"},
                    ],
                },
                {
                    "id": "block-2",
                    "label": "Block B",
                    "structure": "superset",
                    "structure_confidence": 0.5,
                    "structure_options": ["superset", "circuit"],
                    "exercises": [
                        {"name": "Pull-up"},
                    ],
                },
            ],
        },
    }

    with patch("backend.services.url_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = _make_ingestor_mock(mock_result)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service.ingest(url="https://www.youtube.com/watch?v=abc")
        )

    preview_event = next(e for e in events if e.event == "preview")
    preview = json.loads(preview_event.data)

    assert preview["needs_clarification"] is True
    assert len(preview["ambiguous_blocks"]) == 2

    block = preview["ambiguous_blocks"][0]
    assert block["id"] == "block-1"
    assert block["label"] == "Block A"
    assert block["structure"] == "circuit"
    assert block["structure_confidence"] == 0.6
    assert block["structure_options"] == ["circuit", "straight_sets"]
    assert block["exercises"] == [{"name": "Push-up"}, {"name": "Squat"}]

    block2 = preview["ambiguous_blocks"][1]
    assert block2["id"] == "block-2"
    assert block2["exercises"] == [{"name": "Pull-up"}]


@pytest.mark.asyncio
async def test_preview_needs_clarification_false_yields_empty_ambiguous_blocks(service):
    """When ingestor returns needs_clarification=False, preview contains
    needs_clarification=False and ambiguous_blocks=[]."""
    mock_result = {
        "success": True,
        "workout": {
            "title": "Clear Workout",
            "needs_clarification": False,
            "blocks": [
                {
                    "id": "block-1",
                    "label": "Block A",
                    "structure": "straight_sets",
                    "structure_confidence": 0.95,
                    "structure_options": ["straight_sets"],
                    "exercises": [{"name": "Bench Press"}],
                }
            ],
        },
    }

    with patch("backend.services.url_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = _make_ingestor_mock(mock_result)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service.ingest(url="https://www.youtube.com/watch?v=abc")
        )

    preview_event = next(e for e in events if e.event == "preview")
    preview = json.loads(preview_event.data)

    assert preview["needs_clarification"] is False
    assert preview["ambiguous_blocks"] == []


@pytest.mark.asyncio
async def test_high_confidence_blocks_excluded_from_ambiguous_blocks(service):
    """Blocks with structure_confidence >= 0.8 are excluded from ambiguous_blocks
    even when needs_clarification=True."""
    mock_result = {
        "success": True,
        "workout": {
            "title": "Mixed Confidence",
            "needs_clarification": True,
            "blocks": [
                {
                    "id": "block-low",
                    "label": "Low Confidence",
                    "structure": "circuit",
                    "structure_confidence": 0.7,
                    "structure_options": ["circuit", "straight_sets"],
                    "exercises": [{"name": "Burpee"}],
                },
                {
                    "id": "block-high",
                    "label": "High Confidence",
                    "structure": "straight_sets",
                    "structure_confidence": 0.9,
                    "structure_options": ["straight_sets", "circuit"],
                    "exercises": [{"name": "Deadlift"}],
                },
                {
                    "id": "block-exact",
                    "label": "Exactly 0.8",
                    "structure": "superset",
                    "structure_confidence": 0.8,
                    "structure_options": ["superset", "circuit"],
                    "exercises": [{"name": "Curl"}],
                },
            ],
        },
    }

    with patch("backend.services.url_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = _make_ingestor_mock(mock_result)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service.ingest(url="https://www.youtube.com/watch?v=abc")
        )

    preview_event = next(e for e in events if e.event == "preview")
    preview = json.loads(preview_event.data)

    assert preview["needs_clarification"] is True
    # Only the block with confidence 0.7 should appear; 0.9 and 0.8 are excluded
    assert len(preview["ambiguous_blocks"]) == 1
    assert preview["ambiguous_blocks"][0]["id"] == "block-low"


@pytest.mark.asyncio
async def test_blocks_with_empty_structure_options_excluded_from_ambiguous_blocks(service):
    """Blocks with empty structure_options list are excluded from ambiguous_blocks
    even when confidence is low."""
    mock_result = {
        "success": True,
        "workout": {
            "title": "No Options Workout",
            "needs_clarification": True,
            "blocks": [
                {
                    "id": "block-no-opts",
                    "label": "No Options",
                    "structure": "circuit",
                    "structure_confidence": 0.5,
                    "structure_options": [],
                    "exercises": [{"name": "Jump Rope"}],
                },
                {
                    "id": "block-with-opts",
                    "label": "With Options",
                    "structure": "superset",
                    "structure_confidence": 0.6,
                    "structure_options": ["superset", "circuit"],
                    "exercises": [{"name": "Row"}],
                },
            ],
        },
    }

    with patch("backend.services.url_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = _make_ingestor_mock(mock_result)
        mock_cls.return_value = mock_client

        events = await _collect_events(
            service.ingest(url="https://www.youtube.com/watch?v=abc")
        )

    preview_event = next(e for e in events if e.event == "preview")
    preview = json.loads(preview_event.data)

    # Only the block with non-empty options should be in ambiguous_blocks
    assert len(preview["ambiguous_blocks"]) == 1
    assert preview["ambiguous_blocks"][0]["id"] == "block-with-opts"


@pytest.mark.asyncio
async def test_missing_needs_clarification_key_defaults_to_false(service):
    """When ingestor response has no needs_clarification key, preview defaults to
    needs_clarification=False without raising a KeyError."""
    mock_result = {
        "success": True,
        "workout": {
            "title": "No Clarification Key",
            "blocks": [
                {
                    "id": "block-1",
                    "structure_confidence": 0.6,
                    "structure_options": ["circuit"],
                    "exercises": [{"name": "Squat"}],
                }
            ],
        },
    }

    with patch("backend.services.url_import_pipeline_service.httpx.AsyncClient") as mock_cls:
        mock_client = _make_ingestor_mock(mock_result)
        mock_cls.return_value = mock_client

        # Should not raise KeyError
        events = await _collect_events(
            service.ingest(url="https://www.youtube.com/watch?v=abc")
        )

    preview_event = next(e for e in events if e.event == "preview")
    preview = json.loads(preview_event.data)

    assert preview["needs_clarification"] is False
