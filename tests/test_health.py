"""
Health endpoint tests.

Part of AMA-429: Chat API service skeleton
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
