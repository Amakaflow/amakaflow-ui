"""Router-level tests for workout streaming endpoints.

Tests for:
- POST /api/workouts/generate/stream — SSE generation
- POST /api/workouts/save/stream — SSE save-and-push
- Rate limiting (429 responses)
- Request validation (Pydantic models)
"""

import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app
from backend.settings import Settings
from backend.auth import get_current_user as backend_get_current_user
from api.deps import (
    get_current_user as deps_get_current_user,
    get_auth_context,
    get_pipeline_rate_limiter,
    get_workout_pipeline_service,
    AuthContext,
)
from backend.services.rate_limiter import InMemoryRateLimiter, RateLimitResult
from backend.services.workout_pipeline_service import (
    PipelineEvent,
    WorkoutPipelineService,
)


TEST_USER_ID = "test-user-workout"


async def mock_auth():
    return TEST_USER_ID


async def mock_auth_context():
    return AuthContext(user_id=TEST_USER_ID, auth_token="Bearer test-token")


def _parse_sse_events(response_text: str) -> list:
    """Parse SSE response text into list of (event, data) tuples."""
    events = []
    current_event = None
    current_data = None

    for line in response_text.strip().split("\n"):
        line = line.strip()
        if line.startswith("event:"):
            current_event = line[len("event:"):].strip()
        elif line.startswith("data:"):
            current_data = line[len("data:"):].strip()
        elif line == "" and current_event and current_data:
            events.append((current_event, json.loads(current_data)))
            current_event = None
            current_data = None

    if current_event and current_data:
        events.append((current_event, json.loads(current_data)))

    return events


@pytest.fixture
def workout_app():
    settings = Settings(
        environment="test",
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="test-key",
        _env_file=None,
    )
    return create_app(settings=settings)


@pytest.fixture
def mock_pipeline_service():
    svc = MagicMock(spec=WorkoutPipelineService)

    async def _mock_generate(**kwargs):
        yield PipelineEvent("stage", json.dumps({"stage": "analyzing", "message": "Understanding..."}))
        yield PipelineEvent("stage", json.dumps({"stage": "creating", "message": "Generating..."}))
        yield PipelineEvent("stage", json.dumps({"stage": "complete", "message": "Done!"}))
        yield PipelineEvent("preview", json.dumps({
            "preview_id": "p-test-1",
            "workout": {"name": "Test Workout", "exercises": []},
        }))

    svc.generate = _mock_generate
    return svc


@pytest.fixture
def mock_pipeline_service_save():
    svc = MagicMock(spec=WorkoutPipelineService)

    async def _mock_save_and_push(**kwargs):
        yield PipelineEvent("stage", json.dumps({"stage": "validating", "message": "Validating..."}))
        yield PipelineEvent("stage", json.dumps({"stage": "saving", "message": "Saving..."}))
        yield PipelineEvent("stage", json.dumps({"stage": "complete", "message": "Saved!"}))
        yield PipelineEvent("complete", json.dumps({
            "workout_id": "w-saved-1",
            "title": "Test Workout",
            "scheduled_date": None,
        }))

    svc.save_and_push = _mock_save_and_push
    return svc


@pytest.fixture
def rate_limiter():
    return InMemoryRateLimiter(max_requests=5, window_seconds=60)


@pytest.fixture
def generate_client(workout_app, mock_pipeline_service, rate_limiter):
    workout_app.dependency_overrides[backend_get_current_user] = mock_auth
    workout_app.dependency_overrides[deps_get_current_user] = mock_auth
    workout_app.dependency_overrides[get_auth_context] = mock_auth_context
    workout_app.dependency_overrides[get_workout_pipeline_service] = lambda: mock_pipeline_service
    workout_app.dependency_overrides[get_pipeline_rate_limiter] = lambda: rate_limiter
    yield TestClient(workout_app)
    workout_app.dependency_overrides.clear()


@pytest.fixture
def save_client(workout_app, mock_pipeline_service_save, rate_limiter):
    workout_app.dependency_overrides[backend_get_current_user] = mock_auth
    workout_app.dependency_overrides[deps_get_current_user] = mock_auth
    workout_app.dependency_overrides[get_auth_context] = mock_auth_context
    workout_app.dependency_overrides[get_workout_pipeline_service] = lambda: mock_pipeline_service_save
    workout_app.dependency_overrides[get_pipeline_rate_limiter] = lambda: rate_limiter
    yield TestClient(workout_app)
    workout_app.dependency_overrides.clear()


# =============================================================================
# POST /api/workouts/generate/stream
# =============================================================================


class TestGenerateStream:
    def test_returns_sse_events(self, generate_client):
        response = generate_client.post(
            "/api/workouts/generate/stream",
            json={"description": "30 min full body"},
        )
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")

        events = _parse_sse_events(response.text)
        event_types = [e[0] for e in events]

        assert event_types[0] == "stage"
        assert events[0][1]["stage"] == "analyzing"
        assert "preview" in event_types
        assert events[-1][0] == "preview"

    def test_preview_event_has_workout_data(self, generate_client):
        response = generate_client.post(
            "/api/workouts/generate/stream",
            json={"description": "push day"},
        )
        events = _parse_sse_events(response.text)
        preview = [e for e in events if e[0] == "preview"]
        assert len(preview) == 1
        assert "preview_id" in preview[0][1]
        assert "workout" in preview[0][1]

    def test_empty_description_returns_422(self, generate_client):
        response = generate_client.post(
            "/api/workouts/generate/stream",
            json={"description": ""},
        )
        assert response.status_code == 422

    def test_missing_description_returns_422(self, generate_client):
        response = generate_client.post(
            "/api/workouts/generate/stream",
            json={},
        )
        assert response.status_code == 422

    def test_duration_below_min_returns_422(self, generate_client):
        response = generate_client.post(
            "/api/workouts/generate/stream",
            json={"description": "test", "duration_minutes": 2},
        )
        assert response.status_code == 422

    def test_duration_above_max_returns_422(self, generate_client):
        response = generate_client.post(
            "/api/workouts/generate/stream",
            json={"description": "test", "duration_minutes": 200},
        )
        assert response.status_code == 422

    def test_unauthenticated_returns_401(self, workout_app, mock_pipeline_service, rate_limiter):
        workout_app.dependency_overrides[get_workout_pipeline_service] = lambda: mock_pipeline_service
        workout_app.dependency_overrides[get_pipeline_rate_limiter] = lambda: rate_limiter
        client = TestClient(workout_app)
        response = client.post(
            "/api/workouts/generate/stream",
            json={"description": "test"},
        )
        assert response.status_code == 401
        workout_app.dependency_overrides.clear()


class TestGenerateStreamErrorPaths:
    def test_error_event_forwarded(self, workout_app, rate_limiter):
        """Pipeline error events are forwarded to the client as SSE error events."""
        svc = MagicMock(spec=WorkoutPipelineService)

        async def _generate_with_error(**kwargs):
            yield PipelineEvent("stage", json.dumps({"stage": "analyzing", "message": "..."}))
            yield PipelineEvent("error", json.dumps({
                "stage": "creating",
                "message": "Failed to connect to workout service",
                "recoverable": True,
            }))

        svc.generate = _generate_with_error
        workout_app.dependency_overrides[backend_get_current_user] = mock_auth
        workout_app.dependency_overrides[deps_get_current_user] = mock_auth
        workout_app.dependency_overrides[get_auth_context] = mock_auth_context
        workout_app.dependency_overrides[get_workout_pipeline_service] = lambda: svc
        workout_app.dependency_overrides[get_pipeline_rate_limiter] = lambda: rate_limiter
        client = TestClient(workout_app)

        response = client.post(
            "/api/workouts/generate/stream",
            json={"description": "test"},
        )
        assert response.status_code == 200
        events = _parse_sse_events(response.text)
        error_events = [e for e in events if e[0] == "error"]

        assert len(error_events) == 1
        assert error_events[0][1]["message"] == "Failed to connect to workout service"
        assert error_events[0][1]["recoverable"] is True
        workout_app.dependency_overrides.clear()

    def test_generator_exception_terminates_stream(self, workout_app, rate_limiter):
        """Unhandled exception in pipeline generator terminates the SSE stream."""
        svc = MagicMock(spec=WorkoutPipelineService)

        async def _generate_crash(**kwargs):
            yield PipelineEvent("stage", json.dumps({"stage": "analyzing", "message": "..."}))
            raise RuntimeError("Unexpected ingestor failure")

        svc.generate = _generate_crash
        workout_app.dependency_overrides[backend_get_current_user] = mock_auth
        workout_app.dependency_overrides[deps_get_current_user] = mock_auth
        workout_app.dependency_overrides[get_auth_context] = mock_auth_context
        workout_app.dependency_overrides[get_workout_pipeline_service] = lambda: svc
        workout_app.dependency_overrides[get_pipeline_rate_limiter] = lambda: rate_limiter
        client = TestClient(workout_app, raise_server_exceptions=False)

        response = client.post(
            "/api/workouts/generate/stream",
            json={"description": "test"},
        )
        # Stream should terminate (not hang) — response completes
        # The stream had at least the first event before crashing
        assert response.status_code == 200
        events = _parse_sse_events(response.text)
        assert len(events) >= 1
        assert events[0][0] == "stage"
        workout_app.dependency_overrides.clear()


class TestGenerateStreamRateLimit:
    def test_rate_limit_returns_429(self, workout_app, mock_pipeline_service):
        exhausted_limiter = MagicMock(spec=InMemoryRateLimiter)
        exhausted_limiter.check.return_value = RateLimitResult(allowed=False, retry_after=30.0)

        workout_app.dependency_overrides[backend_get_current_user] = mock_auth
        workout_app.dependency_overrides[deps_get_current_user] = mock_auth
        workout_app.dependency_overrides[get_auth_context] = mock_auth_context
        workout_app.dependency_overrides[get_workout_pipeline_service] = lambda: mock_pipeline_service
        workout_app.dependency_overrides[get_pipeline_rate_limiter] = lambda: exhausted_limiter
        client = TestClient(workout_app)

        response = client.post(
            "/api/workouts/generate/stream",
            json={"description": "test"},
        )
        assert response.status_code == 429
        assert "Retry-After" in response.headers
        assert response.json()["detail"] == "Rate limit exceeded. Please try again shortly."
        workout_app.dependency_overrides.clear()


# =============================================================================
# POST /api/workouts/save/stream
# =============================================================================


class TestSaveStream:
    def test_returns_sse_events(self, save_client):
        response = save_client.post(
            "/api/workouts/save/stream",
            json={"preview_id": "p-test-1"},
        )
        assert response.status_code == 200
        assert "text/event-stream" in response.headers.get("content-type", "")

        events = _parse_sse_events(response.text)
        event_types = [e[0] for e in events]

        assert events[0][1]["stage"] == "validating"
        assert "complete" in event_types

    def test_complete_event_has_workout_id(self, save_client):
        response = save_client.post(
            "/api/workouts/save/stream",
            json={"preview_id": "p-test-1"},
        )
        events = _parse_sse_events(response.text)
        complete = [e for e in events if e[0] == "complete"]
        assert len(complete) == 1
        assert complete[0][1]["workout_id"] == "w-saved-1"

    def test_with_schedule_date(self, save_client):
        response = save_client.post(
            "/api/workouts/save/stream",
            json={"preview_id": "p-test-1", "schedule_date": "2026-03-01"},
        )
        assert response.status_code == 200

    def test_empty_preview_id_returns_422(self, save_client):
        response = save_client.post(
            "/api/workouts/save/stream",
            json={"preview_id": ""},
        )
        assert response.status_code == 422

    def test_missing_preview_id_returns_422(self, save_client):
        response = save_client.post(
            "/api/workouts/save/stream",
            json={},
        )
        assert response.status_code == 422

    def test_unauthenticated_returns_401(self, workout_app, mock_pipeline_service_save, rate_limiter):
        workout_app.dependency_overrides[get_workout_pipeline_service] = lambda: mock_pipeline_service_save
        workout_app.dependency_overrides[get_pipeline_rate_limiter] = lambda: rate_limiter
        client = TestClient(workout_app)
        response = client.post(
            "/api/workouts/save/stream",
            json={"preview_id": "p-1"},
        )
        assert response.status_code == 401
        workout_app.dependency_overrides.clear()


class TestSaveStreamErrorPaths:
    def test_error_event_forwarded(self, workout_app, rate_limiter):
        """Pipeline error events are forwarded to the client as SSE error events."""
        svc = MagicMock(spec=WorkoutPipelineService)

        async def _save_with_error(**kwargs):
            yield PipelineEvent("stage", json.dumps({"stage": "validating", "message": "..."}))
            yield PipelineEvent("error", json.dumps({
                "stage": "validating",
                "message": "Preview not found or expired",
                "recoverable": False,
            }))

        svc.save_and_push = _save_with_error
        workout_app.dependency_overrides[backend_get_current_user] = mock_auth
        workout_app.dependency_overrides[deps_get_current_user] = mock_auth
        workout_app.dependency_overrides[get_auth_context] = mock_auth_context
        workout_app.dependency_overrides[get_workout_pipeline_service] = lambda: svc
        workout_app.dependency_overrides[get_pipeline_rate_limiter] = lambda: rate_limiter
        client = TestClient(workout_app)

        response = client.post(
            "/api/workouts/save/stream",
            json={"preview_id": "p-expired"},
        )
        assert response.status_code == 200
        events = _parse_sse_events(response.text)
        error_events = [e for e in events if e[0] == "error"]

        assert len(error_events) == 1
        assert error_events[0][1]["message"] == "Preview not found or expired"
        assert error_events[0][1]["recoverable"] is False
        workout_app.dependency_overrides.clear()

    def test_generator_exception_terminates_stream(self, workout_app, rate_limiter):
        """Unhandled exception in pipeline generator terminates the SSE stream."""
        svc = MagicMock(spec=WorkoutPipelineService)

        async def _save_crash(**kwargs):
            yield PipelineEvent("stage", json.dumps({"stage": "validating", "message": "..."}))
            raise RuntimeError("Unexpected mapper failure")

        svc.save_and_push = _save_crash
        workout_app.dependency_overrides[backend_get_current_user] = mock_auth
        workout_app.dependency_overrides[deps_get_current_user] = mock_auth
        workout_app.dependency_overrides[get_auth_context] = mock_auth_context
        workout_app.dependency_overrides[get_workout_pipeline_service] = lambda: svc
        workout_app.dependency_overrides[get_pipeline_rate_limiter] = lambda: rate_limiter
        client = TestClient(workout_app, raise_server_exceptions=False)

        response = client.post(
            "/api/workouts/save/stream",
            json={"preview_id": "p-1"},
        )
        assert response.status_code == 200
        events = _parse_sse_events(response.text)
        assert len(events) >= 1
        assert events[0][0] == "stage"
        workout_app.dependency_overrides.clear()


class TestSaveStreamRateLimit:
    def test_rate_limit_returns_429(self, workout_app, mock_pipeline_service_save):
        exhausted_limiter = MagicMock(spec=InMemoryRateLimiter)
        exhausted_limiter.check.return_value = RateLimitResult(allowed=False, retry_after=15.0)

        workout_app.dependency_overrides[backend_get_current_user] = mock_auth
        workout_app.dependency_overrides[deps_get_current_user] = mock_auth
        workout_app.dependency_overrides[get_auth_context] = mock_auth_context
        workout_app.dependency_overrides[get_workout_pipeline_service] = lambda: mock_pipeline_service_save
        workout_app.dependency_overrides[get_pipeline_rate_limiter] = lambda: exhausted_limiter
        client = TestClient(workout_app)

        response = client.post(
            "/api/workouts/save/stream",
            json={"preview_id": "p-1"},
        )
        assert response.status_code == 429
        assert "Retry-After" in response.headers
        workout_app.dependency_overrides.clear()
