"""Integration tests for embeddings router: auth guard, response shape."""

import pytest
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from backend.main import create_app
from backend.settings import Settings
from api.deps import get_generate_embeddings_use_case, get_settings
from application.use_cases.generate_embeddings import (
    GenerateEmbeddingsUseCase,
    EmbeddingResult,
    SingleEmbeddingResult,
)


INTERNAL_KEY = "test-internal-key-12345"


@pytest.fixture
def test_settings_with_key():
    return Settings(
        environment="test",
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="test-key",
        internal_api_key=INTERNAL_KEY,
        _env_file=None,
    )


@pytest.fixture
def embeddings_app(test_settings_with_key):
    """App with internal key configured."""
    return create_app(settings=test_settings_with_key)


@pytest.fixture
def mock_use_case():
    uc = MagicMock(spec=GenerateEmbeddingsUseCase)
    uc.execute.return_value = EmbeddingResult(
        total_processed=10,
        total_embedded=8,
        total_skipped=2,
        errors=[],
        duration_seconds=1.5,
    )
    uc.get_progress.return_value = {"total": 100, "embedded": 50, "remaining": 50}
    return uc


@pytest.fixture
def embeddings_client(embeddings_app, mock_use_case, test_settings_with_key):
    embeddings_app.dependency_overrides[get_generate_embeddings_use_case] = lambda: mock_use_case
    embeddings_app.dependency_overrides[get_settings] = lambda: test_settings_with_key
    yield TestClient(embeddings_app)
    embeddings_app.dependency_overrides.clear()


class TestEmbeddingsAuth:
    def test_missing_key_returns_422(self, embeddings_client):
        """Missing X-Internal-Key returns 422 (FastAPI requires it)."""
        response = embeddings_client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
        )
        assert response.status_code == 422

    def test_invalid_key_returns_403(self, embeddings_client):
        response = embeddings_client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers={"X-Internal-Key": "wrong-key"},
        )
        assert response.status_code == 403

    def test_valid_key_succeeds(self, embeddings_client):
        response = embeddings_client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers={"X-Internal-Key": INTERNAL_KEY},
        )
        assert response.status_code == 200


class TestGenerateEndpoint:
    def test_response_shape(self, embeddings_client):
        response = embeddings_client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers={"X-Internal-Key": INTERNAL_KEY},
        )
        data = response.json()
        assert data["total_processed"] == 10
        assert data["total_embedded"] == 8
        assert data["total_skipped"] == 2
        assert data["errors"] == []
        assert data["duration_seconds"] == 1.5

    def test_with_workout_ids(self, embeddings_client, mock_use_case):
        response = embeddings_client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts", "workout_ids": ["w1", "w2"]},
            headers={"X-Internal-Key": INTERNAL_KEY},
        )
        assert response.status_code == 200
        mock_use_case.execute.assert_called_once_with(
            table="workouts",
            workout_ids=["w1", "w2"],
        )


class TestProgressEndpoint:
    def test_progress_response(self, embeddings_client):
        response = embeddings_client.get(
            "/internal/embeddings/progress/workouts",
            headers={"X-Internal-Key": INTERNAL_KEY},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["table"] == "workouts"
        assert data["total"] == 100
        assert data["embedded"] == 50
        assert data["remaining"] == 50

    def test_invalid_table_returns_422(self, embeddings_client):
        response = embeddings_client.get(
            "/internal/embeddings/progress/invalid_table",
            headers={"X-Internal-Key": INTERNAL_KEY},
        )
        assert response.status_code == 422


class TestTableValidation:
    def test_generate_rejects_invalid_table(self, embeddings_client):
        response = embeddings_client.post(
            "/internal/embeddings/generate",
            json={"table": "users"},
            headers={"X-Internal-Key": INTERNAL_KEY},
        )
        assert response.status_code == 422

    def test_generate_accepts_follow_along(self, embeddings_client):
        response = embeddings_client.post(
            "/internal/embeddings/generate",
            json={"table": "follow_along_workouts"},
            headers={"X-Internal-Key": INTERNAL_KEY},
        )
        assert response.status_code == 200


class TestWebhookEndpoint:
    def test_missing_key_returns_422(self, embeddings_client):
        response = embeddings_client.post(
            "/internal/embeddings/webhook",
            json={"table": "workouts", "workout_id": "w1"},
        )
        assert response.status_code == 422

    def test_invalid_key_returns_403(self, embeddings_client):
        response = embeddings_client.post(
            "/internal/embeddings/webhook",
            json={"table": "workouts", "workout_id": "w1"},
            headers={"X-Internal-Key": "wrong-key"},
        )
        assert response.status_code == 403

    def test_happy_path(self, embeddings_client, mock_use_case):
        mock_use_case.execute_single.return_value = SingleEmbeddingResult(
            status="embedded",
            workout_id="w1",
        )
        response = embeddings_client.post(
            "/internal/embeddings/webhook",
            json={"table": "workouts", "workout_id": "w1"},
            headers={"X-Internal-Key": INTERNAL_KEY},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "embedded"
        assert data["workout_id"] == "w1"
        assert data["error"] is None
        mock_use_case.execute_single.assert_called_once_with(
            table="workouts",
            workout_id="w1",
        )

    def test_unchanged_returns_200(self, embeddings_client, mock_use_case):
        mock_use_case.execute_single.return_value = SingleEmbeddingResult(
            status="unchanged",
            workout_id="w1",
        )
        response = embeddings_client.post(
            "/internal/embeddings/webhook",
            json={"table": "workouts", "workout_id": "w1"},
            headers={"X-Internal-Key": INTERNAL_KEY},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "unchanged"

    def test_not_found_returns_404(self, embeddings_client, mock_use_case):
        mock_use_case.execute_single.return_value = SingleEmbeddingResult(
            status="not_found",
            workout_id="w999",
        )
        response = embeddings_client.post(
            "/internal/embeddings/webhook",
            json={"table": "workouts", "workout_id": "w999"},
            headers={"X-Internal-Key": INTERNAL_KEY},
        )
        assert response.status_code == 404

    def test_invalid_table_returns_422(self, embeddings_client):
        response = embeddings_client.post(
            "/internal/embeddings/webhook",
            json={"table": "users", "workout_id": "w1"},
            headers={"X-Internal-Key": INTERNAL_KEY},
        )
        assert response.status_code == 422

    def test_error_result_returns_502(self, embeddings_client, mock_use_case):
        mock_use_case.execute_single.return_value = SingleEmbeddingResult(
            status="error",
            workout_id="w1",
            error="API error",
        )
        response = embeddings_client.post(
            "/internal/embeddings/webhook",
            json={"table": "workouts", "workout_id": "w1"},
            headers={"X-Internal-Key": INTERNAL_KEY},
        )
        assert response.status_code == 502
        assert "API error" in response.json()["detail"]
