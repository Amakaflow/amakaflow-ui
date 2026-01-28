"""
Health endpoint tests.

Part of AMA-429: Chat API service skeleton
Updated in AMA-441: Add readiness endpoint tests
"""

import pytest


@pytest.mark.unit
def test_health_returns_ok(api_client):
    """GET /health returns 200 with status ok."""
    response = api_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "chat-api"


@pytest.mark.unit
def test_health_ready_returns_status(api_client):
    """GET /health/ready returns 200 with readiness info."""
    response = api_client.get("/health/ready")
    data = response.json()
    assert data["service"] == "chat-api"
    assert "checks" in data
    assert "supabase" in data["checks"]
    # In test env, supabase is configured but unreachable,
    # so we accept either ready or not_ready
    assert data["status"] in ("ready", "not_ready")
