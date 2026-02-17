"""Tests for capture session management."""

from pathlib import Path

import pytest

from replay.capture.session import (
    CAPTURE_ENV_VAR,
    CAPTURE_HEADER,
    CaptureSession,
    resolve_session,
)


class TestCaptureSession:
    def test_session_dir(self, tmp_path: Path):
        session = CaptureSession(name="test-run", capture_dir=tmp_path)
        assert session.session_dir == tmp_path / "test-run"

    def test_next_filename_sequential(self, tmp_path: Path):
        session = CaptureSession(name="s1", capture_dir=tmp_path)

        f1 = session.next_filename("web-ingest")
        f2 = session.next_filename("backend-stored")
        f3 = session.next_filename("web-ingest")

        assert f1 == tmp_path / "s1" / "001_web-ingest.json"
        assert f2 == tmp_path / "s1" / "002_backend-stored.json"
        assert f3 == tmp_path / "s1" / "003_web-ingest.json"

    def test_sequence_count(self, tmp_path: Path):
        session = CaptureSession(name="s1", capture_dir=tmp_path)
        assert session.sequence_count == 0
        session.next_filename("web-ingest")
        assert session.sequence_count == 1

    def test_started_at_set(self, tmp_path: Path):
        session = CaptureSession(name="s1", capture_dir=tmp_path)
        assert session.started_at > 0

    def test_invalid_session_name_with_slashes(self, tmp_path: Path):
        with pytest.raises(ValueError, match="Invalid session name"):
            CaptureSession(name="../../evil", capture_dir=tmp_path)

    def test_invalid_session_name_with_spaces(self, tmp_path: Path):
        with pytest.raises(ValueError, match="Invalid session name"):
            CaptureSession(name="bad name", capture_dir=tmp_path)

    def test_valid_session_name_with_dashes_underscores(self, tmp_path: Path):
        session = CaptureSession(name="my-test_session-01", capture_dir=tmp_path)
        assert session.name == "my-test_session-01"


class TestResolveSession:
    def test_header_activation(self, tmp_path: Path):
        headers = {CAPTURE_HEADER: "session-name=my-session"}
        session = resolve_session(headers, tmp_path)

        assert session is not None
        assert session.name == "my-session"
        assert session.capture_dir == tmp_path

    def test_header_missing_session_name(self, tmp_path: Path):
        headers = {CAPTURE_HEADER: "some-other-key=value"}
        session = resolve_session(headers, tmp_path)
        assert session is None

    def test_header_with_invalid_session_name(self, tmp_path: Path):
        headers = {CAPTURE_HEADER: "session-name=../../evil"}
        session = resolve_session(headers, tmp_path)
        assert session is None

    def test_header_empty_value(self, tmp_path: Path):
        headers = {CAPTURE_HEADER: ""}
        session = resolve_session(headers, tmp_path)
        assert session is None

    def test_header_garbage_value(self, tmp_path: Path):
        headers = {CAPTURE_HEADER: "not-a-key-value"}
        session = resolve_session(headers, tmp_path)
        assert session is None

    def test_env_var_activation(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv(CAPTURE_ENV_VAR, "true")
        session = resolve_session({}, tmp_path)

        assert session is not None
        assert session.name == "default"
        assert session.capture_dir == tmp_path

    def test_env_var_numeric(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv(CAPTURE_ENV_VAR, "1")
        session = resolve_session({}, tmp_path)
        assert session is not None

    def test_env_var_yes(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv(CAPTURE_ENV_VAR, "yes")
        session = resolve_session({}, tmp_path)
        assert session is not None

    def test_no_activation(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.delenv(CAPTURE_ENV_VAR, raising=False)
        session = resolve_session({}, tmp_path)
        assert session is None

    def test_header_takes_priority_over_env(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setenv(CAPTURE_ENV_VAR, "true")
        headers = {CAPTURE_HEADER: "session-name=from-header"}
        session = resolve_session(headers, tmp_path)

        assert session is not None
        assert session.name == "from-header"
