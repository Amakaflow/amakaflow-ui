"""Tests for snapshot writer."""

import json
from pathlib import Path

from replay.capture.session import CaptureSession
from replay.capture.writer import write_snapshot, _sanitize_headers


class TestWriteSnapshot:
    def test_creates_directories_and_file(self, tmp_path: Path):
        session = CaptureSession(name="test-run", capture_dir=tmp_path)

        filepath = write_snapshot(
            session,
            capture_point="web-ingest",
            endpoint="/api/workouts/import/stream",
            method="POST",
            request_payload={"url": "https://youtube.com/watch?v=123"},
            response_status=200,
        )

        assert filepath.exists()
        assert filepath.parent == tmp_path / "test-run"
        assert filepath.name == "001_web-ingest.json"

    def test_snapshot_schema(self, tmp_path: Path):
        session = CaptureSession(name="s1", capture_dir=tmp_path)

        filepath = write_snapshot(
            session,
            capture_point="backend-stored",
            endpoint="/api/workouts/save/stream",
            method="POST",
            request_payload={"preview_id": "abc123"},
            request_headers={"content-type": "application/json"},
            response_status=200,
            response_payload={"id": "w_123"},
            streaming=False,
            chat_context={"thread_id": "t_1"},
        )

        data = json.loads(filepath.read_text())

        assert data["capture_point"] == "backend-stored"
        assert data["session"] == "s1"
        assert isinstance(data["timestamp"], float)
        assert data["endpoint"] == "/api/workouts/save/stream"
        assert data["method"] == "POST"
        assert data["request_payload"] == {"preview_id": "abc123"}
        assert data["request_headers"] == {"content-type": "application/json"}
        assert data["response_status"] == 200
        assert data["response_payload"] == {"id": "w_123"}
        assert data["streaming"] is False
        assert data["chat_context"] == {"thread_id": "t_1"}

    def test_streaming_flag(self, tmp_path: Path):
        session = CaptureSession(name="s1", capture_dir=tmp_path)

        filepath = write_snapshot(
            session,
            capture_point="web-ingest",
            endpoint="/api/workouts/import/stream",
            method="POST",
            streaming=True,
        )

        data = json.loads(filepath.read_text())
        assert data["streaming"] is True
        assert data["response_payload"] is None

    def test_sequential_filenames(self, tmp_path: Path):
        session = CaptureSession(name="s1", capture_dir=tmp_path)

        f1 = write_snapshot(
            session, capture_point="web-ingest",
            endpoint="/a", method="POST",
        )
        f2 = write_snapshot(
            session, capture_point="backend-stored",
            endpoint="/b", method="POST",
        )

        assert f1.name == "001_web-ingest.json"
        assert f2.name == "002_backend-stored.json"


class TestSanitizeHeaders:
    def test_removes_auth_headers(self):
        headers = {
            "Authorization": "Bearer secret-token",
            "Cookie": "session=abc",
            "X-Test-Auth": "test-secret",
            "X-Api-Key": "key-123",
            "Content-Type": "application/json",
        }

        result = _sanitize_headers(headers)

        assert result["Authorization"] == "***"
        assert result["Cookie"] == "***"
        assert result["X-Test-Auth"] == "***"
        assert result["X-Api-Key"] == "***"
        assert result["Content-Type"] == "application/json"

    def test_none_input(self):
        assert _sanitize_headers(None) is None

    def test_empty_dict(self):
        assert _sanitize_headers({}) == {}
