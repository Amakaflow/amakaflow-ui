"""
E2E tests for GET /health -- liveness probe.

SMOKE: Always runs. Zero-dependency canary for the test infrastructure itself.
"""

import pytest


@pytest.mark.integration
class TestHealthSmoke:
    """Health endpoint is the canary for the test harness."""

    def test_health_returns_200(self, client):
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_response_shape(self, client):
        data = client.get("/health").json()
        assert data["status"] == "ok"
        assert data["service"] == "chat-api"

    def test_health_no_auth_required(self, noauth_client):
        """Health endpoint works without any authentication."""
        response = noauth_client.get("/health")
        assert response.status_code == 200
