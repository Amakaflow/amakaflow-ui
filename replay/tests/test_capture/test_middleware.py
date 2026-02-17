"""Tests for capture middleware using FastAPI TestClient."""

import json
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from httpx import ASGITransport, AsyncClient

from replay.capture.middleware import CaptureMiddleware
from replay.capture.session import CAPTURE_HEADER, CAPTURE_ENV_VAR


def _make_app(capture_dir: Path, **kwargs) -> FastAPI:
    """Create a test FastAPI app with capture middleware."""
    app = FastAPI()

    app.add_middleware(CaptureMiddleware, capture_dir=str(capture_dir), **kwargs)

    @app.post("/api/workouts/import/stream")
    async def import_stream(request: Request):
        body = await request.json()
        return JSONResponse({"status": "ok", "url": body.get("url")})

    @app.post("/api/workouts/save/stream")
    async def save_stream(request: Request):
        body = await request.json()
        return JSONResponse({"saved": True, "preview_id": body.get("preview_id")})

    @app.get("/health")
    async def health():
        return {"status": "healthy"}

    @app.get("/workouts/incoming")
    async def incoming():
        return {"workouts": []}

    return app


@pytest.fixture
def capture_dir(tmp_path: Path) -> Path:
    return tmp_path / "captures"


@pytest.fixture
def app(capture_dir: Path) -> FastAPI:
    return _make_app(capture_dir)


@pytest.fixture
def client(app: FastAPI):
    transport = ASGITransport(app=app)
    return AsyncClient(transport=transport, base_url="http://test")


class TestCaptureMiddleware:
    async def test_non_matched_endpoint_passes_through(
        self, client: AsyncClient, capture_dir: Path
    ):
        """Non-capture endpoints should work normally with no snapshots."""
        resp = await client.get(
            "/health",
            headers={CAPTURE_HEADER: "session-name=test"},
        )
        assert resp.status_code == 200
        assert resp.json() == {"status": "healthy"}

        if capture_dir.exists():
            assert list(capture_dir.rglob("*.json")) == []

    async def test_capture_with_header(
        self, client: AsyncClient, capture_dir: Path
    ):
        """Header-activated capture should write a snapshot."""
        resp = await client.post(
            "/api/workouts/import/stream",
            json={"url": "https://youtube.com/watch?v=abc"},
            headers={CAPTURE_HEADER: "session-name=my-test"},
        )
        assert resp.status_code == 200

        snapshots = list(capture_dir.rglob("*.json"))
        assert len(snapshots) == 1

        data = json.loads(snapshots[0].read_text())
        assert data["capture_point"] == "web-ingest"
        assert data["session"] == "my-test"
        assert data["endpoint"] == "/api/workouts/import/stream"
        assert data["method"] == "POST"
        assert data["request_payload"] == {"url": "https://youtube.com/watch?v=abc"}
        assert data["response_status"] == 200
        assert data["streaming"] is True  # SSE path

    async def test_capture_with_env_var(
        self, client: AsyncClient, capture_dir: Path, monkeypatch: pytest.MonkeyPatch
    ):
        """Env var activation should capture to 'default' session with response body."""
        monkeypatch.setenv(CAPTURE_ENV_VAR, "true")

        resp = await client.get("/workouts/incoming")
        assert resp.status_code == 200

        snapshots = list(capture_dir.rglob("*.json"))
        assert len(snapshots) == 1

        data = json.loads(snapshots[0].read_text())
        assert data["capture_point"] == "phone-sync-request"
        assert data["session"] == "default"
        assert data["response_payload"] == {"workouts": []}
        assert data["streaming"] is False

    async def test_no_capture_without_activation(
        self, client: AsyncClient, capture_dir: Path, monkeypatch: pytest.MonkeyPatch
    ):
        """Without header or env var, no capture should happen."""
        monkeypatch.delenv(CAPTURE_ENV_VAR, raising=False)

        resp = await client.post(
            "/api/workouts/import/stream",
            json={"url": "https://youtube.com/watch?v=abc"},
        )
        assert resp.status_code == 200

        if capture_dir.exists():
            assert list(capture_dir.rglob("*.json")) == []

    async def test_multiple_captures_sequential(
        self, client: AsyncClient, capture_dir: Path
    ):
        """Multiple requests in same session produce sequential snapshots."""
        headers = {CAPTURE_HEADER: "session-name=multi-test"}

        await client.post(
            "/api/workouts/import/stream",
            json={"url": "https://youtube.com/1"},
            headers=headers,
        )
        await client.post(
            "/api/workouts/save/stream",
            json={"preview_id": "p1"},
            headers=headers,
        )

        snapshots = sorted(capture_dir.rglob("*.json"))
        assert len(snapshots) == 2

        # Session is cached, so filenames are truly sequential
        names = sorted(s.name for s in snapshots)
        assert names[0] == "001_web-ingest.json"
        assert names[1] == "002_backend-stored.json"

    async def test_same_capture_point_no_overwrite(
        self, client: AsyncClient, capture_dir: Path
    ):
        """Two requests to the same capture point should not overwrite each other."""
        headers = {CAPTURE_HEADER: "session-name=dup-test"}

        await client.post(
            "/api/workouts/import/stream",
            json={"url": "https://youtube.com/1"},
            headers=headers,
        )
        await client.post(
            "/api/workouts/import/stream",
            json={"url": "https://youtube.com/2"},
            headers=headers,
        )

        snapshots = sorted(capture_dir.rglob("*.json"))
        assert len(snapshots) == 2
        assert snapshots[0].name == "001_web-ingest.json"
        assert snapshots[1].name == "002_web-ingest.json"

        data1 = json.loads(snapshots[0].read_text())
        data2 = json.loads(snapshots[1].read_text())
        assert data1["request_payload"]["url"] == "https://youtube.com/1"
        assert data2["request_payload"]["url"] == "https://youtube.com/2"

    async def test_sensitive_headers_sanitized(
        self, client: AsyncClient, capture_dir: Path
    ):
        """Auth headers should be masked in snapshots."""
        resp = await client.post(
            "/api/workouts/import/stream",
            json={"url": "https://example.com"},
            headers={
                CAPTURE_HEADER: "session-name=auth-test",
                "Authorization": "Bearer secret-token",
            },
        )
        assert resp.status_code == 200

        snapshots = list(capture_dir.rglob("*.json"))
        assert len(snapshots) == 1

        data = json.loads(snapshots[0].read_text())
        assert data["request_headers"]["authorization"] == "***"

    async def test_save_endpoint_captured(
        self, client: AsyncClient, capture_dir: Path
    ):
        """The save endpoint should be captured as 'backend-stored'."""
        resp = await client.post(
            "/api/workouts/save/stream",
            json={"preview_id": "preview_abc"},
            headers={CAPTURE_HEADER: "session-name=save-test"},
        )
        assert resp.status_code == 200

        snapshots = list(capture_dir.rglob("*.json"))
        assert len(snapshots) == 1

        data = json.loads(snapshots[0].read_text())
        assert data["capture_point"] == "backend-stored"
        assert data["request_payload"] == {"preview_id": "preview_abc"}

    async def test_write_failure_does_not_break_response(
        self, client: AsyncClient, capture_dir: Path
    ):
        """If snapshot writing fails, the response should still be returned."""
        with patch(
            "replay.capture.middleware.write_snapshot", side_effect=OSError("disk full")
        ):
            resp = await client.post(
                "/api/workouts/import/stream",
                json={"url": "https://example.com"},
                headers={CAPTURE_HEADER: "session-name=fail-test"},
            )
            assert resp.status_code == 200
            assert resp.json()["status"] == "ok"

    async def test_custom_capture_points(self, capture_dir: Path):
        """Custom capture_points mapping should override defaults."""
        custom_points = {("GET", "/health"): "health-check"}
        app = _make_app(capture_dir, capture_points=custom_points)
        transport = ASGITransport(app=app)
        client = AsyncClient(transport=transport, base_url="http://test")

        resp = await client.get(
            "/health",
            headers={CAPTURE_HEADER: "session-name=custom-test"},
        )
        assert resp.status_code == 200

        snapshots = list(capture_dir.rglob("*.json"))
        assert len(snapshots) == 1

        data = json.loads(snapshots[0].read_text())
        assert data["capture_point"] == "health-check"
