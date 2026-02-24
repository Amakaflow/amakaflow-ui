"""Tests for get_user_with_metadata auth dependency.

Verifies:
- API key auth returns user_id + empty metadata
- JWT auth returns user_id + metadata from token
- Missing auth raises 401
- Invalid auth raises 401

AMA-564: Tier enforcement requires metadata extraction from JWT.
"""

import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException

from workout_ingestor_api.auth import (
    get_user_with_metadata,
    _validate_jwt_with_metadata,
    validate_api_key,
)


# ---------------------------------------------------------------------------
# API Key Auth
# ---------------------------------------------------------------------------


class TestApiKeyMetadata:
    """get_user_with_metadata with API key auth."""

    @pytest.mark.asyncio
    async def test_api_key_returns_user_id_and_admin_metadata(self, monkeypatch):
        monkeypatch.setenv("API_KEYS", "sk_test_key1")
        result = await get_user_with_metadata(
            authorization=None,
            x_api_key="sk_test_key1",
        )
        assert result["user_id"] == "admin"
        # API key auth sets subscription to "admin" to bypass tier gates
        assert result["metadata"] == {"subscription": "admin"}

    @pytest.mark.asyncio
    async def test_api_key_with_user_suffix(self, monkeypatch):
        monkeypatch.setenv("API_KEYS", "sk_test_key1")
        result = await get_user_with_metadata(
            authorization=None,
            x_api_key="sk_test_key1:user_12345",
        )
        assert result["user_id"] == "user_12345"
        assert result["metadata"] == {"subscription": "admin"}

    @pytest.mark.asyncio
    async def test_invalid_api_key_raises_401(self, monkeypatch):
        monkeypatch.setenv("API_KEYS", "sk_test_key1")
        with pytest.raises(HTTPException) as exc_info:
            await get_user_with_metadata(
                authorization=None,
                x_api_key="sk_wrong_key",
            )
        assert exc_info.value.status_code == 401


# ---------------------------------------------------------------------------
# Missing Auth
# ---------------------------------------------------------------------------


class TestMissingAuth:
    """Missing both auth methods should return 401."""

    @pytest.mark.asyncio
    async def test_no_auth_raises_401(self):
        with pytest.raises(HTTPException) as exc_info:
            await get_user_with_metadata(authorization=None, x_api_key=None)
        assert exc_info.value.status_code == 401
        assert "Missing authentication" in exc_info.value.detail


# ---------------------------------------------------------------------------
# JWT Auth (mocked)
# ---------------------------------------------------------------------------


class TestJwtMetadata:
    """_validate_jwt_with_metadata extracts user_id + metadata."""

    def test_valid_jwt_returns_user_id_and_metadata(self, monkeypatch):
        """Mock JWKS to test metadata extraction."""
        mock_signing_key = MagicMock()
        mock_signing_key.key = "mock-key"

        mock_jwks_client = MagicMock()
        mock_jwks_client.get_signing_key_from_jwt.return_value = mock_signing_key

        monkeypatch.setattr(
            "workout_ingestor_api.auth.get_jwks_client",
            lambda: mock_jwks_client,
        )

        decoded_payload = {
            "sub": "user_abc123",
            "metadata": {"subscription": "pro"},
            "iat": 1700000000,
            "exp": 1700099999,
        }

        with patch("jwt.decode", return_value=decoded_payload):
            result = _validate_jwt_with_metadata("Bearer mock-token")

        assert result["user_id"] == "user_abc123"
        assert result["metadata"]["subscription"] == "pro"

    def test_jwt_without_metadata_returns_empty_dict(self, monkeypatch):
        """JWT token without 'metadata' claim returns empty dict."""
        mock_signing_key = MagicMock()
        mock_signing_key.key = "mock-key"

        mock_jwks_client = MagicMock()
        mock_jwks_client.get_signing_key_from_jwt.return_value = mock_signing_key

        monkeypatch.setattr(
            "workout_ingestor_api.auth.get_jwks_client",
            lambda: mock_jwks_client,
        )

        decoded_payload = {
            "sub": "user_abc123",
            "iat": 1700000000,
            "exp": 1700099999,
        }

        with patch("jwt.decode", return_value=decoded_payload):
            result = _validate_jwt_with_metadata("Bearer mock-token")

        assert result["user_id"] == "user_abc123"
        assert result["metadata"] == {}

    def test_jwt_without_sub_raises_401(self, monkeypatch):
        """Token missing 'sub' claim should raise 401."""
        mock_signing_key = MagicMock()
        mock_signing_key.key = "mock-key"

        mock_jwks_client = MagicMock()
        mock_jwks_client.get_signing_key_from_jwt.return_value = mock_signing_key

        monkeypatch.setattr(
            "workout_ingestor_api.auth.get_jwks_client",
            lambda: mock_jwks_client,
        )

        decoded_payload = {
            "metadata": {"subscription": "pro"},
            "iat": 1700000000,
            "exp": 1700099999,
        }

        with patch("jwt.decode", return_value=decoded_payload):
            with pytest.raises(HTTPException) as exc_info:
                _validate_jwt_with_metadata("Bearer mock-token")
            assert exc_info.value.status_code == 401

    def test_invalid_authorization_format_raises_401(self):
        """Authorization header without 'Bearer ' prefix -> 401."""
        with pytest.raises(HTTPException) as exc_info:
            _validate_jwt_with_metadata("Token mock-token")
        assert exc_info.value.status_code == 401
        assert "Invalid authorization header format" in exc_info.value.detail
