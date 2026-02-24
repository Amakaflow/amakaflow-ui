"""Tests for /ingest/instagram_reel endpoint."""
from unittest.mock import patch

from main import app
from workout_ingestor_api.auth import get_user_with_metadata
from fastapi.testclient import TestClient


MOCK_WORKOUT_RESPONSE = {
    "title": "HIIT Workout",
    "workout_type": "hiit",
    "blocks": [{"label": "Circuit", "exercises": [{"name": "Squats"}]}],
    "source": "https://www.instagram.com/reel/DRHiuniDM1K/",
    "_provenance": {
        "mode": "instagram_reel",
        "source_url": "https://www.instagram.com/reel/DRHiuniDM1K/",
        "shortcode": "DRHiuniDM1K",
        "extraction_method": "apify_transcript",
    },
}


def test_ingest_instagram_reel_success(client):
    """POST /ingest/instagram_reel should return structured workout."""
    with patch(
        "workout_ingestor_api.services.instagram_reel_service.InstagramReelService.ingest_reel",
        return_value=MOCK_WORKOUT_RESPONSE,
    ), patch(
        "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.get_cached_workout",
        return_value=None,
    ), patch(
        "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.save_workout",
        return_value=True,
    ):
        resp = client.post(
            "/ingest/instagram_reel",
            json={"url": "https://www.instagram.com/reel/DRHiuniDM1K/"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "HIIT Workout"
    assert data["_provenance"]["mode"] == "instagram_reel"


def test_ingest_instagram_reel_invalid_url(client):
    """Should reject non-Instagram URLs."""
    resp = client.post(
        "/ingest/instagram_reel",
        json={"url": "https://www.youtube.com/watch?v=abc"},
    )
    assert resp.status_code == 400


def test_ingest_instagram_reel_missing_url(client):
    """Should return 422 when URL is missing."""
    resp = client.post("/ingest/instagram_reel", json={})
    assert resp.status_code == 422


def test_ingest_instagram_reel_service_error(client):
    """Should return 400 when InstagramReelServiceError is raised."""
    from workout_ingestor_api.services.instagram_reel_service import InstagramReelServiceError

    with patch(
        "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.get_cached_workout",
        return_value=None,
    ), patch(
        "workout_ingestor_api.services.instagram_reel_service.InstagramReelService.ingest_reel",
        side_effect=InstagramReelServiceError("Reel has no transcript or caption"),
    ):
        resp = client.post(
            "/ingest/instagram_reel",
            json={"url": "https://www.instagram.com/reel/DRHiuniDM1K/"},
        )

    assert resp.status_code == 400
    assert "no transcript or caption" in resp.json()["detail"]


def test_ingest_instagram_reel_cache_hit(client):
    """Should return cached workout and increment cache hits."""
    cached_data = {
        "workout_data": {
            "title": "Cached Workout",
            "blocks": [],
        },
        "ingested_at": "2026-01-15T10:00:00Z",
        "cache_hits": 5,
    }

    with patch(
        "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.get_cached_workout",
        return_value=cached_data,
    ), patch(
        "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.increment_cache_hit",
    ) as mock_increment:
        resp = client.post(
            "/ingest/instagram_reel",
            json={"url": "https://www.instagram.com/reel/DRHiuniDM1K/"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Cached Workout"
    assert data["_provenance"]["mode"] == "cached"
    assert data["_provenance"]["cache_hits"] == 6
    mock_increment.assert_called_once_with("DRHiuniDM1K")


def test_ingest_instagram_reel_free_tier_rejected(monkeypatch):
    """Free-tier users should get 403 when calling Apify extraction."""
    # Ensure BYPASS_TIER_GATE is not set for this test
    monkeypatch.delenv("BYPASS_TIER_GATE", raising=False)

    async def mock_free_user() -> dict:
        return {"user_id": "free-user-456", "metadata": {"subscription": "free"}}

    app.dependency_overrides[get_user_with_metadata] = mock_free_user
    free_client = TestClient(app)

    resp = free_client.post(
        "/ingest/instagram_reel",
        json={"url": "https://www.instagram.com/reel/DRHiuniDM1K/"},
    )

    assert resp.status_code == 403
    assert "Pro or Trainer subscription" in resp.json()["detail"]


def test_ingest_instagram_reel_pro_tier_allowed(client):
    """Pro-tier users should be allowed to use Apify extraction."""
    with patch(
        "workout_ingestor_api.services.instagram_reel_service.InstagramReelService.ingest_reel",
        return_value=MOCK_WORKOUT_RESPONSE,
    ), patch(
        "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.get_cached_workout",
        return_value=None,
    ), patch(
        "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.save_workout",
        return_value=True,
    ):
        resp = client.post(
            "/ingest/instagram_reel",
            json={"url": "https://www.instagram.com/reel/DRHiuniDM1K/"},
        )

    assert resp.status_code == 200
    assert resp.json()["title"] == "HIIT Workout"
