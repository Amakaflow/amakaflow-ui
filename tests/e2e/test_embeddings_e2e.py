"""
E2E tests for /internal/embeddings/* -- Workout Embedding Pipeline (AMA-431).

Coverage:
    SMOKE (PR gate):
        - POST /internal/embeddings/generate with valid key succeeds
        - GET /internal/embeddings/progress/{table} with valid key succeeds
        - Missing X-Internal-Key returns 422
        - Invalid X-Internal-Key returns 403
        - Response shape matches GenerateResponse / ProgressResponse schemas

    REGRESSION (nightly):
        - Batch processing with real in-memory fakes
        - Empty content workouts are skipped
        - Specific workout_ids filter
        - Embedding API failure handling
        - Progress tracking accuracy
        - Internal key not configured yields 503
        - Default table is "workouts"
        - Multiple batches processed sequentially
"""

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app
from backend.settings import Settings
from api.deps import get_generate_embeddings_use_case, get_settings
from tests.e2e.conftest import (
    INTERNAL_API_KEY,
    FakeEmbeddingRepository,
    FakeEmbeddingService,
    _override_generate_embeddings_use_case,
)


# ============================================================================
# Helpers
# ============================================================================


def _auth_headers() -> dict:
    return {"X-Internal-Key": INTERNAL_API_KEY}


# ============================================================================
# SMOKE SUITE
# ============================================================================


@pytest.mark.integration
class TestEmbeddingsAuthSmoke:
    """Internal API key guard -- must pass on every PR."""

    def test_missing_key_returns_422(self, client):
        """Missing X-Internal-Key header returns 422 (required by FastAPI)."""
        response = client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
        )
        assert response.status_code == 422

    def test_invalid_key_returns_403(self, client):
        """Wrong X-Internal-Key returns 403 Forbidden."""
        response = client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers={"X-Internal-Key": "wrong-key-value"},
        )
        assert response.status_code == 403

    def test_valid_key_succeeds(self, client):
        """Correct X-Internal-Key returns 200."""
        response = client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers=_auth_headers(),
        )
        assert response.status_code == 200

    def test_progress_missing_key_returns_422(self, client):
        """GET progress without key returns 422."""
        response = client.get("/internal/embeddings/progress/workouts")
        assert response.status_code == 422

    def test_progress_invalid_key_returns_403(self, client):
        """GET progress with wrong key returns 403."""
        response = client.get(
            "/internal/embeddings/progress/workouts",
            headers={"X-Internal-Key": "bad-key"},
        )
        assert response.status_code == 403


@pytest.mark.integration
class TestGenerateEndpointSmoke:
    """POST /internal/embeddings/generate response contract."""

    def test_response_schema(self, client):
        """Response contains all required fields with correct types."""
        response = client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers=_auth_headers(),
        )
        data = response.json()
        assert isinstance(data["total_processed"], int)
        assert isinstance(data["total_embedded"], int)
        assert isinstance(data["total_skipped"], int)
        assert isinstance(data["errors"], list)
        assert isinstance(data["duration_seconds"], float)

    def test_empty_table_returns_zeroes(self, client):
        """No workouts to embed returns all-zero counts."""
        response = client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers=_auth_headers(),
        )
        data = response.json()
        assert data["total_processed"] == 0
        assert data["total_embedded"] == 0
        assert data["total_skipped"] == 0
        assert data["errors"] == []


@pytest.mark.integration
class TestProgressEndpointSmoke:
    """GET /internal/embeddings/progress/{table} response contract."""

    def test_response_schema(self, client):
        """Response contains table, total, embedded, remaining."""
        response = client.get(
            "/internal/embeddings/progress/workouts",
            headers=_auth_headers(),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["table"] == "workouts"
        assert isinstance(data["total"], int)
        assert isinstance(data["embedded"], int)
        assert isinstance(data["remaining"], int)

    def test_empty_table_progress(self, client):
        """Empty table shows zero progress."""
        response = client.get(
            "/internal/embeddings/progress/workouts",
            headers=_auth_headers(),
        )
        data = response.json()
        assert data["total"] == 0
        assert data["embedded"] == 0
        assert data["remaining"] == 0


# ============================================================================
# REGRESSION SUITE
# ============================================================================


@pytest.mark.integration
class TestGenerateEndpointRegression:
    """Detailed embedding generation behavior."""

    def test_processes_seeded_workouts(self, client, embedding_repo):
        """Workouts with content are embedded; counts reflect processing."""
        embedding_repo.seed_workouts([
            {"id": "w1", "title": "Push Day", "description": "Chest and triceps"},
            {"id": "w2", "title": "Pull Day", "description": "Back and biceps"},
        ])

        response = client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers=_auth_headers(),
        )
        data = response.json()
        assert data["total_processed"] == 2
        assert data["total_embedded"] == 2
        assert data["total_skipped"] == 0

    def test_skips_empty_content_workouts(self, client, embedding_repo):
        """Workouts with no title/description are skipped."""
        embedding_repo.seed_workouts([
            {"id": "w1"},  # No title, no description
            {"id": "w2", "title": "Good Workout"},
        ])

        response = client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers=_auth_headers(),
        )
        data = response.json()
        assert data["total_processed"] == 2
        assert data["total_skipped"] == 1
        assert data["total_embedded"] == 1

    def test_specific_workout_ids(self, client, embedding_repo):
        """workout_ids filter limits which workouts are processed."""
        embedding_repo.seed_workouts([
            {"id": "w1", "title": "A"},
            {"id": "w2", "title": "B"},
            {"id": "w3", "title": "C"},
        ])

        response = client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts", "workout_ids": ["w1", "w3"]},
            headers=_auth_headers(),
        )
        data = response.json()
        assert data["total_processed"] == 2
        assert data["total_embedded"] == 2

    def test_embedding_api_failure(self, client, embedding_repo, embedding_service):
        """When the embedding API fails, errors are reported."""
        embedding_repo.seed_workouts([
            {"id": "w1", "title": "Test Workout"},
        ])
        embedding_service.should_fail = True

        response = client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers=_auth_headers(),
        )
        data = response.json()
        assert data["total_processed"] == 1
        assert data["total_embedded"] == 0
        assert len(data["errors"]) == 1
        assert data["errors"][0]["workout_id"] == "w1"

    def test_default_table_is_workouts(self, client):
        """Omitting table defaults to 'workouts'."""
        response = client.post(
            "/internal/embeddings/generate",
            json={},
            headers=_auth_headers(),
        )
        assert response.status_code == 200
        # No error about missing table

    def test_duration_is_positive(self, client, embedding_repo):
        """duration_seconds is a non-negative float."""
        embedding_repo.seed_workouts([
            {"id": "w1", "title": "Workout"},
        ])

        response = client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers=_auth_headers(),
        )
        data = response.json()
        assert data["duration_seconds"] >= 0.0


@pytest.mark.integration
class TestProgressEndpointRegression:
    """Embedding progress tracking with data."""

    def test_progress_after_embedding(self, client, embedding_repo):
        """Progress reflects embedded vs total counts."""
        embedding_repo.seed_workouts([
            {"id": "w1", "title": "A"},
            {"id": "w2", "title": "B"},
            {"id": "w3", "title": "C"},
        ])

        # Generate embeddings
        client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers=_auth_headers(),
        )

        # Check progress
        response = client.get(
            "/internal/embeddings/progress/workouts",
            headers=_auth_headers(),
        )
        data = response.json()
        assert data["total"] == 3
        assert data["embedded"] == 3
        assert data["remaining"] == 0

    def test_partial_progress(self, client, embedding_repo, embedding_service):
        """Progress after partial failure shows correct remaining."""
        embedding_repo.seed_workouts([
            {"id": "w1", "title": "Good"},
            {"id": "w2"},  # Empty content, will be skipped
        ])

        client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers=_auth_headers(),
        )

        response = client.get(
            "/internal/embeddings/progress/workouts",
            headers=_auth_headers(),
        )
        data = response.json()
        assert data["total"] == 2
        assert data["embedded"] == 1
        assert data["remaining"] == 1

    def test_follow_along_workouts_table(self, client):
        """Progress endpoint accepts different table names."""
        response = client.get(
            "/internal/embeddings/progress/follow_along_workouts",
            headers=_auth_headers(),
        )
        assert response.status_code == 200
        data = response.json()
        assert data["table"] == "follow_along_workouts"


@pytest.mark.integration
class TestInternalKeyNotConfigured:
    """Behavior when internal_api_key is not set."""

    def test_returns_503_when_key_not_configured(self):
        """If internal_api_key is None, return 503."""
        settings_no_key = Settings(
            environment="test",
            supabase_url="https://test.supabase.co",
            supabase_service_role_key="test-key",
            internal_api_key=None,
            _env_file=None,
        )
        app = create_app(settings=settings_no_key)
        app.dependency_overrides[get_settings] = lambda: settings_no_key
        app.dependency_overrides[get_generate_embeddings_use_case] = _override_generate_embeddings_use_case

        test_client = TestClient(app)
        response = test_client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers={"X-Internal-Key": "any-value"},
        )
        assert response.status_code == 503
        assert "not configured" in response.json()["detail"].lower()
        app.dependency_overrides.clear()
