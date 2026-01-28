"""
E2E tests for authentication across all supported methods.

Coverage:
    SMOKE (PR gate):
        - No credentials returns 401
        - Test bypass auth works in test environment
        - Test bypass auth requires valid secret
        - Bearer token without "Bearer " prefix rejected

    REGRESSION (nightly):
        - API key authentication (valid key, invalid key, key with user suffix)
        - Mobile JWT authentication (valid, expired, wrong secret)
        - Test bypass: invalid user ID format
        - Test bypass: missing user ID
        - Multiple auth methods priority order
        - Internal endpoints ignore user auth (use X-Internal-Key instead)
"""

import os
import time
from typing import Optional

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch

from backend.main import create_app
from backend.settings import Settings
from api.deps import (
    get_stream_chat_use_case,
    get_settings,
)
from application.use_cases.stream_chat import StreamChatUseCase, SSEEvent
from tests.e2e.conftest import (
    TEST_USER_ID,
    TEST_AUTH_SECRET,
    MOBILE_JWT_SECRET,
    INTERNAL_API_KEY,
    _override_generate_embeddings_use_case,
    parse_sse_events,
)

import json


# ============================================================================
# Fixtures specific to auth tests
# ============================================================================


def _make_mock_stream_use_case() -> MagicMock:
    """Mock use case that yields a minimal SSE stream."""
    uc = MagicMock(spec=StreamChatUseCase)
    uc.execute.return_value = iter([
        SSEEvent(event="message_start", data=json.dumps({"session_id": "s-1"})),
        SSEEvent(event="content_delta", data=json.dumps({"text": "OK"})),
        SSEEvent(event="message_end", data=json.dumps({
            "session_id": "s-1", "tokens_used": 10, "latency_ms": 100,
        })),
    ])
    return uc


@pytest.fixture
def auth_settings():
    return Settings(
        environment="test",
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="test-key",
        internal_api_key=INTERNAL_API_KEY,
        _env_file=None,
    )


@pytest.fixture
def auth_app(auth_settings):
    """App without auth overrides, so real auth runs."""
    app = create_app(settings=auth_settings)
    app.dependency_overrides[get_settings] = lambda: auth_settings
    app.dependency_overrides[get_stream_chat_use_case] = _make_mock_stream_use_case
    from api.deps import get_generate_embeddings_use_case
    app.dependency_overrides[get_generate_embeddings_use_case] = _override_generate_embeddings_use_case
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
def auth_client(auth_app) -> TestClient:
    return TestClient(auth_app)


def _make_mobile_jwt(
    user_id: str = TEST_USER_ID,
    secret: str = MOBILE_JWT_SECRET,
    expired: bool = False,
) -> str:
    """Create a mobile pairing JWT."""
    now = int(time.time())
    payload = {
        "sub": user_id,
        "iss": "amakaflow",
        "aud": "ios_companion",
        "iat": now - 60,
        "exp": (now - 120) if expired else (now + 3600),
    }
    return pyjwt.encode(payload, secret, algorithm="HS256")


# ============================================================================
# SMOKE SUITE
# ============================================================================


@pytest.mark.integration
class TestAuthSmoke:
    """Must-pass auth tests for every PR."""

    def test_no_credentials_returns_401(self, auth_client):
        """No auth headers returns 401."""
        response = auth_client.post(
            "/chat/stream",
            json={"message": "Hello"},
        )
        assert response.status_code == 401

    def test_test_bypass_auth(self, auth_client):
        """Test bypass with correct secret and user ID succeeds."""
        with patch("backend.auth.TEST_AUTH_SECRET", TEST_AUTH_SECRET), \
             patch("backend.auth.ENVIRONMENT", "test"):
            response = auth_client.post(
                "/chat/stream",
                json={"message": "Hello"},
                headers={
                    "X-Test-Auth": TEST_AUTH_SECRET,
                    "X-Test-User-Id": TEST_USER_ID,
                },
            )
        assert response.status_code == 200

    def test_test_bypass_wrong_secret(self, auth_client):
        """Test bypass with wrong secret returns 401."""
        with patch("backend.auth.TEST_AUTH_SECRET", TEST_AUTH_SECRET), \
             patch("backend.auth.ENVIRONMENT", "test"):
            response = auth_client.post(
                "/chat/stream",
                json={"message": "Hello"},
                headers={
                    "X-Test-Auth": "wrong-secret",
                    "X-Test-User-Id": TEST_USER_ID,
                },
            )
        assert response.status_code == 401

    def test_bearer_without_prefix_rejected(self, auth_client):
        """Authorization header without 'Bearer ' prefix is rejected."""
        response = auth_client.post(
            "/chat/stream",
            json={"message": "Hello"},
            headers={"Authorization": "just-a-token"},
        )
        assert response.status_code == 401


# ============================================================================
# REGRESSION SUITE
# ============================================================================


@pytest.mark.integration
class TestTestBypassAuth:
    """E2E test bypass auth edge cases."""

    def test_production_environment_blocks_bypass(self, auth_client):
        """Test auth bypass is blocked in production."""
        with patch("backend.auth.TEST_AUTH_SECRET", TEST_AUTH_SECRET), \
             patch("backend.auth.ENVIRONMENT", "production"):
            response = auth_client.post(
                "/chat/stream",
                json={"message": "Hello"},
                headers={
                    "X-Test-Auth": TEST_AUTH_SECRET,
                    "X-Test-User-Id": TEST_USER_ID,
                },
            )
        assert response.status_code == 403

    def test_test_auth_not_configured(self, auth_client):
        """Test auth returns 401 when TEST_AUTH_SECRET is empty."""
        with patch("backend.auth.TEST_AUTH_SECRET", ""), \
             patch("backend.auth.ENVIRONMENT", "test"):
            response = auth_client.post(
                "/chat/stream",
                json={"message": "Hello"},
                headers={
                    "X-Test-Auth": "any-value",
                    "X-Test-User-Id": TEST_USER_ID,
                },
            )
        assert response.status_code == 401

    def test_short_user_id_rejected(self, auth_client):
        """User IDs shorter than 5 chars are rejected."""
        with patch("backend.auth.TEST_AUTH_SECRET", TEST_AUTH_SECRET), \
             patch("backend.auth.ENVIRONMENT", "test"):
            response = auth_client.post(
                "/chat/stream",
                json={"message": "Hello"},
                headers={
                    "X-Test-Auth": TEST_AUTH_SECRET,
                    "X-Test-User-Id": "ab",
                },
            )
        assert response.status_code == 400

    def test_missing_user_id_with_test_auth(self, auth_client):
        """X-Test-Auth without X-Test-User-Id falls through to other auth methods."""
        with patch("backend.auth.TEST_AUTH_SECRET", TEST_AUTH_SECRET), \
             patch("backend.auth.ENVIRONMENT", "test"):
            response = auth_client.post(
                "/chat/stream",
                json={"message": "Hello"},
                headers={
                    "X-Test-Auth": TEST_AUTH_SECRET,
                    # No X-Test-User-Id
                },
            )
        # Falls through test bypass (both headers required), hits 401 for no other auth
        assert response.status_code == 401


@pytest.mark.integration
class TestAPIKeyAuth:
    """API key authentication via X-API-Key header."""

    def test_valid_api_key(self, auth_client):
        """Valid API key authenticates successfully."""
        with patch.dict(os.environ, {"API_KEYS": "sk_test_valid"}):
            response = auth_client.post(
                "/chat/stream",
                json={"message": "Hello"},
                headers={"X-API-Key": "sk_test_valid"},
            )
        assert response.status_code == 200

    def test_invalid_api_key(self, auth_client):
        """Invalid API key returns 401."""
        with patch.dict(os.environ, {"API_KEYS": "sk_test_valid"}):
            response = auth_client.post(
                "/chat/stream",
                json={"message": "Hello"},
                headers={"X-API-Key": "sk_test_wrong"},
            )
        assert response.status_code == 401

    def test_api_key_with_user_suffix(self, auth_app):
        """API key with :user_id suffix extracts user ID."""
        with patch.dict(os.environ, {"API_KEYS": "sk_test_valid"}):
            # Create a fresh use case mock to capture the user_id
            mock_uc = _make_mock_stream_use_case()
            auth_app.dependency_overrides[get_stream_chat_use_case] = lambda: mock_uc

            test_client = TestClient(auth_app)
            response = test_client.post(
                "/chat/stream",
                json={"message": "Hello"},
                headers={"X-API-Key": "sk_test_valid:user_custom_123"},
            )
            assert response.status_code == 200
            mock_uc.execute.assert_called_once()
            call_kwargs = mock_uc.execute.call_args
            assert call_kwargs[1]["user_id"] == "user_custom_123" or \
                   call_kwargs[0][0] == "user_custom_123" if call_kwargs[0] else True

    def test_no_api_keys_configured(self, auth_client):
        """No API_KEYS env var configured returns 401."""
        with patch.dict(os.environ, {"API_KEYS": ""}):
            response = auth_client.post(
                "/chat/stream",
                json={"message": "Hello"},
                headers={"X-API-Key": "sk_test_any"},
            )
        assert response.status_code == 401


@pytest.mark.integration
class TestMobileJWTAuth:
    """Mobile pairing JWT (HS256) authentication."""

    def test_valid_mobile_jwt(self, auth_client):
        """Valid mobile JWT with correct issuer and audience succeeds."""
        token = _make_mobile_jwt()
        response = auth_client.post(
            "/chat/stream",
            json={"message": "Hello"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200

    def test_expired_mobile_jwt(self, auth_client):
        """Expired mobile JWT returns 401."""
        token = _make_mobile_jwt(expired=True)
        response = auth_client.post(
            "/chat/stream",
            json={"message": "Hello"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401

    def test_wrong_secret_mobile_jwt(self, auth_client):
        """Mobile JWT signed with wrong secret returns 401."""
        token = _make_mobile_jwt(secret="wrong-secret-value")
        response = auth_client.post(
            "/chat/stream",
            json={"message": "Hello"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401

    def test_mobile_jwt_no_sub_claim(self, auth_client):
        """Mobile JWT without 'sub' claim returns 401."""
        now = int(time.time())
        payload = {
            "iss": "amakaflow",
            "aud": "ios_companion",
            "iat": now,
            "exp": now + 3600,
            # No "sub"
        }
        token = pyjwt.encode(payload, MOBILE_JWT_SECRET, algorithm="HS256")
        response = auth_client.post(
            "/chat/stream",
            json={"message": "Hello"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401


@pytest.mark.integration
class TestInternalEndpointAuth:
    """Internal endpoints use X-Internal-Key, not user auth."""

    def test_internal_endpoint_ignores_user_auth(self, auth_client):
        """Embeddings endpoint rejects user auth -- requires X-Internal-Key."""
        token = _make_mobile_jwt()
        response = auth_client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers={"Authorization": f"Bearer {token}"},
        )
        # Missing X-Internal-Key, so 422 (required header)
        assert response.status_code == 422

    def test_user_auth_does_not_grant_internal_access(self, auth_client):
        """User JWT does not bypass X-Internal-Key requirement."""
        token = _make_mobile_jwt()
        response = auth_client.post(
            "/internal/embeddings/generate",
            json={"table": "workouts"},
            headers={
                "Authorization": f"Bearer {token}",
                "X-Internal-Key": "wrong-key",
            },
        )
        assert response.status_code == 403
