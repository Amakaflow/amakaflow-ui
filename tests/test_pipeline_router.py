"""Router-level tests for pipeline status polling endpoint.

Tests for:
- GET /api/pipelines/{run_id}/status — poll pipeline run status
- 404 for missing runs
- UUID validation on path parameter
- Auth requirement
"""

from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app
from backend.settings import Settings
from backend.auth import get_current_user as backend_get_current_user
from api.deps import (
    get_current_user as deps_get_current_user,
    get_auth_context,
    get_async_pipeline_run_repository,
    AuthContext,
)
from infrastructure.db.async_pipeline_run_repository import AsyncPipelineRunRepository


TEST_USER_ID = "test-user-pipeline"
VALID_RUN_ID = "550e8400-e29b-41d4-a716-446655440000"


async def mock_auth():
    return TEST_USER_ID


async def mock_auth_context():
    return AuthContext(user_id=TEST_USER_ID, auth_token="Bearer test-token")


@pytest.fixture
def pipeline_app():
    settings = Settings(
        environment="test",
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="test-key",
        _env_file=None,
    )
    return create_app(settings=settings)


@pytest.fixture
def mock_repo():
    repo = AsyncMock(spec=AsyncPipelineRunRepository)
    repo.get.return_value = {
        "id": VALID_RUN_ID,
        "pipeline": "generate",
        "status": "completed",
        "preview_id": "p-123",
        "result": {"preview_id": "p-123"},
        "error": None,
        "created_at": "2026-02-11T10:00:00Z",
        "updated_at": "2026-02-11T10:00:05Z",
    }
    return repo


@pytest.fixture
def pipeline_client(pipeline_app, mock_repo):
    pipeline_app.dependency_overrides[backend_get_current_user] = mock_auth
    pipeline_app.dependency_overrides[deps_get_current_user] = mock_auth
    pipeline_app.dependency_overrides[get_auth_context] = mock_auth_context
    pipeline_app.dependency_overrides[get_async_pipeline_run_repository] = lambda: mock_repo
    yield TestClient(pipeline_app)
    pipeline_app.dependency_overrides.clear()


class TestGetPipelineStatus:
    def test_returns_pipeline_run(self, pipeline_client):
        response = pipeline_client.get(f"/api/pipelines/{VALID_RUN_ID}/status")
        assert response.status_code == 200

        data = response.json()
        assert data["id"] == VALID_RUN_ID
        assert data["pipeline"] == "generate"
        assert data["status"] == "completed"
        assert data["preview_id"] == "p-123"
        assert data["result"] == {"preview_id": "p-123"}
        assert data["error"] is None

    def test_not_found_returns_404(self, pipeline_client, mock_repo):
        mock_repo.get.return_value = None

        response = pipeline_client.get(f"/api/pipelines/{VALID_RUN_ID}/status")
        assert response.status_code == 404
        assert response.json()["detail"] == "Pipeline run not found"

    def test_invalid_uuid_returns_422(self, pipeline_client):
        response = pipeline_client.get("/api/pipelines/not-a-uuid/status")
        assert response.status_code == 422

    def test_unauthenticated_returns_401(self, pipeline_app, mock_repo):
        pipeline_app.dependency_overrides[get_async_pipeline_run_repository] = lambda: mock_repo
        client = TestClient(pipeline_app)
        response = client.get(f"/api/pipelines/{VALID_RUN_ID}/status")
        assert response.status_code == 401
        pipeline_app.dependency_overrides.clear()

    def test_running_status(self, pipeline_client, mock_repo):
        mock_repo.get.return_value = {
            "id": VALID_RUN_ID,
            "pipeline": "save_and_push",
            "status": "running",
            "preview_id": "p-456",
            "result": None,
            "error": None,
            "created_at": "2026-02-11T10:00:00Z",
            "updated_at": "2026-02-11T10:00:02Z",
        }

        response = pipeline_client.get(f"/api/pipelines/{VALID_RUN_ID}/status")
        assert response.status_code == 200
        assert response.json()["status"] == "running"
        assert response.json()["pipeline"] == "save_and_push"

    def test_failed_status_includes_error(self, pipeline_client, mock_repo):
        mock_repo.get.return_value = {
            "id": VALID_RUN_ID,
            "pipeline": "generate",
            "status": "failed",
            "preview_id": None,
            "result": None,
            "error": "Failed to connect to workout service",
            "created_at": "2026-02-11T10:00:00Z",
            "updated_at": "2026-02-11T10:00:03Z",
        }

        response = pipeline_client.get(f"/api/pipelines/{VALID_RUN_ID}/status")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "failed"
        assert data["error"] == "Failed to connect to workout service"
