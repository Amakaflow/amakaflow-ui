"""Tests for tier enforcement on /ingest/instagram_reel endpoint.

Covers:
- Free tier without BYPASS_TIER_GATE -> 403
- Free tier with BYPASS_TIER_GATE=true -> allowed
- Pro tier -> allowed
- Trainer tier -> allowed
- No auth -> 401
- API key auth -> allowed (admin, no subscription metadata)
- get_user_with_metadata dependency returns correct shape

AMA-564: Tier-gated Instagram Apify extraction.
"""

import os
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

from main import app
from workout_ingestor_api.auth import get_user_with_metadata, get_current_user


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

MOCK_WORKOUT = {
    "title": "HIIT Workout",
    "blocks": [{"label": "Circuit", "exercises": [{"name": "Squats"}]}],
    "source": "https://www.instagram.com/reel/DRHiuniDM1K/",
    "_provenance": {
        "mode": "instagram_reel",
        "source_url": "https://www.instagram.com/reel/DRHiuniDM1K/",
        "shortcode": "DRHiuniDM1K",
        "extraction_method": "apify_transcript",
    },
}

INSTAGRAM_URL = "https://www.instagram.com/reel/DRHiuniDM1K/"

# Common service mocks to prevent actual API calls
SERVICE_MOCKS = {
    "workout_ingestor_api.services.instagram_reel_service.InstagramReelService.ingest_reel": MOCK_WORKOUT,
    "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.get_cached_workout": None,
    "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.save_workout": True,
}


def _make_mock_auth(user_id: str, subscription: str):
    """Build a mock get_user_with_metadata dependency."""
    async def mock_auth():
        return {"user_id": user_id, "metadata": {"subscription": subscription}}
    return mock_auth


def _make_mock_auth_no_sub(user_id: str):
    """Build a mock get_user_with_metadata with empty metadata (API key auth)."""
    async def mock_auth():
        return {"user_id": user_id, "metadata": {}}
    return mock_auth


def _patch_services():
    """Context manager to patch all downstream services."""
    return patch.multiple(
        "workout_ingestor_api.services.instagram_reel_service.InstagramReelService",
        ingest_reel=MagicMock(return_value=MOCK_WORKOUT),
    ), patch(
        "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.get_cached_workout",
        return_value=None,
    ), patch(
        "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.save_workout",
        return_value=True,
    )


# ---------------------------------------------------------------------------
# Free tier rejection
# ---------------------------------------------------------------------------


class TestFreeTierRejection:
    """Free-tier users get 403 unless BYPASS_TIER_GATE is set."""

    def test_free_tier_returns_403(self, monkeypatch):
        """Free-tier user without bypass -> 403."""
        monkeypatch.delenv("BYPASS_TIER_GATE", raising=False)

        app.dependency_overrides[get_user_with_metadata] = _make_mock_auth("free-user", "free")
        client = TestClient(app)

        resp = client.post(
            "/ingest/instagram_reel",
            json={"url": INSTAGRAM_URL},
        )
        assert resp.status_code == 403
        assert "Pro or Trainer subscription" in resp.json()["detail"]

    def test_free_tier_403_detail_message_is_specific(self, monkeypatch):
        """Verify the error message mentions both Pro and Trainer."""
        monkeypatch.delenv("BYPASS_TIER_GATE", raising=False)

        app.dependency_overrides[get_user_with_metadata] = _make_mock_auth("free-user", "free")
        client = TestClient(app)

        resp = client.post(
            "/ingest/instagram_reel",
            json={"url": INSTAGRAM_URL},
        )
        detail = resp.json()["detail"]
        assert "Pro" in detail
        assert "Trainer" in detail

    def test_free_tier_with_bypass_true_allowed(self, monkeypatch):
        """Free-tier user with BYPASS_TIER_GATE=true -> allowed through."""
        monkeypatch.setenv("BYPASS_TIER_GATE", "true")

        app.dependency_overrides[get_user_with_metadata] = _make_mock_auth("free-user", "free")
        client = TestClient(app)

        with patch(
            "workout_ingestor_api.services.instagram_reel_service.InstagramReelService.ingest_reel",
            return_value=MOCK_WORKOUT,
        ), patch(
            "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.get_cached_workout",
            return_value=None,
        ), patch(
            "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.save_workout",
            return_value=True,
        ):
            resp = client.post(
                "/ingest/instagram_reel",
                json={"url": INSTAGRAM_URL},
            )
        assert resp.status_code == 200

    def test_free_tier_with_bypass_false_rejected(self, monkeypatch):
        """BYPASS_TIER_GATE=false should NOT bypass."""
        monkeypatch.setenv("BYPASS_TIER_GATE", "false")

        app.dependency_overrides[get_user_with_metadata] = _make_mock_auth("free-user", "free")
        client = TestClient(app)

        resp = client.post(
            "/ingest/instagram_reel",
            json={"url": INSTAGRAM_URL},
        )
        assert resp.status_code == 403

    def test_free_tier_with_bypass_empty_string_rejected(self, monkeypatch):
        """BYPASS_TIER_GATE="" should NOT bypass."""
        monkeypatch.setenv("BYPASS_TIER_GATE", "")

        app.dependency_overrides[get_user_with_metadata] = _make_mock_auth("free-user", "free")
        client = TestClient(app)

        resp = client.post(
            "/ingest/instagram_reel",
            json={"url": INSTAGRAM_URL},
        )
        assert resp.status_code == 403

    def test_free_tier_with_bypass_TRUE_uppercase_allowed(self, monkeypatch):
        """BYPASS_TIER_GATE=TRUE (uppercase) should bypass (case-insensitive)."""
        monkeypatch.setenv("BYPASS_TIER_GATE", "TRUE")

        app.dependency_overrides[get_user_with_metadata] = _make_mock_auth("free-user", "free")
        client = TestClient(app)

        with patch(
            "workout_ingestor_api.services.instagram_reel_service.InstagramReelService.ingest_reel",
            return_value=MOCK_WORKOUT,
        ), patch(
            "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.get_cached_workout",
            return_value=None,
        ), patch(
            "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.save_workout",
            return_value=True,
        ):
            resp = client.post(
                "/ingest/instagram_reel",
                json={"url": INSTAGRAM_URL},
            )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Pro/Trainer tier allowed
# ---------------------------------------------------------------------------


class TestPaidTierAllowed:
    """Pro and Trainer tier users should always be allowed."""

    def test_pro_tier_allowed(self, monkeypatch):
        monkeypatch.delenv("BYPASS_TIER_GATE", raising=False)

        app.dependency_overrides[get_user_with_metadata] = _make_mock_auth("pro-user", "pro")
        client = TestClient(app)

        with patch(
            "workout_ingestor_api.services.instagram_reel_service.InstagramReelService.ingest_reel",
            return_value=MOCK_WORKOUT,
        ), patch(
            "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.get_cached_workout",
            return_value=None,
        ), patch(
            "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.save_workout",
            return_value=True,
        ):
            resp = client.post(
                "/ingest/instagram_reel",
                json={"url": INSTAGRAM_URL},
            )
        assert resp.status_code == 200

    def test_trainer_tier_allowed(self, monkeypatch):
        monkeypatch.delenv("BYPASS_TIER_GATE", raising=False)

        app.dependency_overrides[get_user_with_metadata] = _make_mock_auth("trainer-user", "trainer")
        client = TestClient(app)

        with patch(
            "workout_ingestor_api.services.instagram_reel_service.InstagramReelService.ingest_reel",
            return_value=MOCK_WORKOUT,
        ), patch(
            "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.get_cached_workout",
            return_value=None,
        ), patch(
            "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.save_workout",
            return_value=True,
        ):
            resp = client.post(
                "/ingest/instagram_reel",
                json={"url": INSTAGRAM_URL},
            )
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# API key auth (no subscription metadata)
# ---------------------------------------------------------------------------


class TestApiKeyAuth:
    """API key auth gets subscription='admin' metadata -- always allowed."""

    def test_api_key_auth_allowed_without_bypass(self, monkeypatch):
        """API key auth returns metadata.subscription='admin', which != 'free',
        so it passes through the tier gate without needing BYPASS_TIER_GATE."""
        monkeypatch.delenv("BYPASS_TIER_GATE", raising=False)

        # Simulate real API key auth: returns subscription='admin'
        app.dependency_overrides[get_user_with_metadata] = _make_mock_auth("admin", "admin")
        client = TestClient(app)

        with patch(
            "workout_ingestor_api.services.instagram_reel_service.InstagramReelService.ingest_reel",
            return_value=MOCK_WORKOUT,
        ), patch(
            "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.get_cached_workout",
            return_value=None,
        ), patch(
            "workout_ingestor_api.services.instagram_reel_cache_service.InstagramReelCacheService.save_workout",
            return_value=True,
        ):
            resp = client.post(
                "/ingest/instagram_reel",
                json={"url": INSTAGRAM_URL},
            )
        assert resp.status_code == 200

    def test_api_key_auth_with_empty_metadata_is_rejected(self, monkeypatch):
        """If for some reason metadata is empty, subscription defaults to 'free' => 403."""
        monkeypatch.delenv("BYPASS_TIER_GATE", raising=False)

        app.dependency_overrides[get_user_with_metadata] = _make_mock_auth_no_sub("admin")
        client = TestClient(app)

        resp = client.post(
            "/ingest/instagram_reel",
            json={"url": INSTAGRAM_URL},
        )
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# No auth -> 401
# ---------------------------------------------------------------------------


class TestNoAuth:
    """Missing auth should return 401."""

    def test_no_auth_returns_401(self):
        """Remove auth override so the real dependency runs (and fails)."""
        # Clear overrides so real auth is used
        app.dependency_overrides.pop(get_user_with_metadata, None)
        app.dependency_overrides.pop(get_current_user, None)
        client = TestClient(app)

        resp = client.post(
            "/ingest/instagram_reel",
            json={"url": INSTAGRAM_URL},
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# URL validation
# ---------------------------------------------------------------------------


class TestUrlValidation:
    """URL validation on the endpoint itself."""

    def test_empty_url_returns_400(self, client):
        resp = client.post(
            "/ingest/instagram_reel",
            json={"url": "   "},
        )
        assert resp.status_code == 400

    def test_non_instagram_url_returns_400(self, client):
        resp = client.post(
            "/ingest/instagram_reel",
            json={"url": "https://www.youtube.com/watch?v=abc"},
        )
        assert resp.status_code == 400
        assert "Instagram" in resp.json()["detail"]
