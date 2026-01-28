"""Unit tests for AIClient: Helicone header construction and configuration."""

from unittest.mock import MagicMock, patch

import pytest

from backend.services.ai_client import AIClient, HELICONE_BASE_URL


class TestAIClientConfiguration:
    @patch("backend.services.ai_client.anthropic.Anthropic")
    def test_basic_client(self, mock_anthropic_cls):
        """Client without Helicone uses standard config."""
        client = AIClient(api_key="sk-test-123")

        mock_anthropic_cls.assert_called_once_with(api_key="sk-test-123")

    @patch("backend.services.ai_client.anthropic.Anthropic")
    def test_helicone_disabled(self, mock_anthropic_cls):
        """Helicone disabled doesn't add proxy headers."""
        client = AIClient(
            api_key="sk-test-123",
            helicone_api_key="hl-test",
            helicone_enabled=False,
        )

        mock_anthropic_cls.assert_called_once_with(api_key="sk-test-123")

    @patch("backend.services.ai_client.anthropic.Anthropic")
    def test_helicone_enabled(self, mock_anthropic_cls):
        """Helicone enabled adds base_url and auth header."""
        client = AIClient(
            api_key="sk-test-123",
            helicone_api_key="hl-test-key",
            helicone_enabled=True,
        )

        call_kwargs = mock_anthropic_cls.call_args[1]
        assert call_kwargs["api_key"] == "sk-test-123"
        assert call_kwargs["base_url"] == HELICONE_BASE_URL
        assert call_kwargs["default_headers"]["Helicone-Auth"] == "Bearer hl-test-key"

    @patch("backend.services.ai_client.anthropic.Anthropic")
    def test_helicone_enabled_no_key(self, mock_anthropic_cls):
        """Helicone enabled but no key doesn't add proxy."""
        client = AIClient(
            api_key="sk-test-123",
            helicone_api_key=None,
            helicone_enabled=True,
        )

        mock_anthropic_cls.assert_called_once_with(api_key="sk-test-123")

    @patch("backend.services.ai_client.anthropic.Anthropic")
    def test_default_model(self, mock_anthropic_cls):
        """Default model is set correctly."""
        client = AIClient(api_key="sk-test", default_model="claude-opus-4-20250514")
        assert client._default_model == "claude-opus-4-20250514"

    @patch("backend.services.ai_client.anthropic.Anthropic")
    def test_default_model_fallback(self, mock_anthropic_cls):
        """Default model fallback is claude-sonnet-4-20250514."""
        client = AIClient(api_key="sk-test")
        assert client._default_model == "claude-sonnet-4-20250514"
