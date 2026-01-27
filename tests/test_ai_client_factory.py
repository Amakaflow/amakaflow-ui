"""Tests for AIClientFactory and AIRequestContext."""

import logging

import pytest
from unittest.mock import patch, MagicMock

from backend.ai import AIClientFactory, AIRequestContext
from backend.settings import Settings


@pytest.fixture
def settings_with_keys():
    return Settings(
        environment="test",
        openai_api_key="sk-test-openai",
        anthropic_api_key="sk-test-anthropic",
        helicone_enabled=False,
        _env_file=None,
    )


@pytest.fixture
def settings_with_helicone():
    return Settings(
        environment="test",
        openai_api_key="sk-test-openai",
        anthropic_api_key="sk-test-anthropic",
        helicone_enabled=True,
        helicone_api_key="sk-helicone-test",
        _env_file=None,
    )


@pytest.fixture
def settings_helicone_no_key():
    return Settings(
        environment="test",
        openai_api_key="sk-test-openai",
        anthropic_api_key="sk-test-anthropic",
        helicone_enabled=True,
        helicone_api_key=None,
        _env_file=None,
    )


@pytest.fixture
def settings_no_keys():
    return Settings(
        environment="test",
        _env_file=None,
    )


# ---- AIRequestContext ----


class TestAIRequestContext:
    @pytest.mark.unit
    def test_to_tracking_headers_full(self):
        ctx = AIRequestContext(
            user_id="user-1",
            session_id="sess-1",
            feature_name="chat",
            request_id="req-1",
            custom_properties={"workout_type": "strength"},
        )
        headers = ctx.to_tracking_headers(environment="staging")

        assert headers["Helicone-User-Id"] == "user-1"
        assert headers["Helicone-Session-Id"] == "sess-1"
        assert headers["Helicone-Property-Feature"] == "chat"
        assert headers["Helicone-Request-Id"] == "req-1"
        assert headers["Helicone-Property-Environment"] == "staging"
        assert headers["Helicone-Property-Workout-Type"] == "strength"

    @pytest.mark.unit
    def test_to_tracking_headers_minimal(self):
        ctx = AIRequestContext()
        headers = ctx.to_tracking_headers()
        assert headers == {"Helicone-Property-Environment": "development"}

    @pytest.mark.unit
    def test_to_tracking_headers_partial(self):
        ctx = AIRequestContext(user_id="u1", feature_name="embed")
        headers = ctx.to_tracking_headers(environment="production")
        assert "Helicone-User-Id" in headers
        assert "Helicone-Property-Feature" in headers
        assert "Helicone-Session-Id" not in headers
        assert "Helicone-Request-Id" not in headers


# ---- AIClientFactory - OpenAI ----


class TestOpenAIClient:
    @pytest.mark.unit
    def test_create_openai_direct(self, settings_with_keys):
        mock_cls = MagicMock()
        with patch("backend.ai.client_factory.OpenAI", mock_cls):
            AIClientFactory.create_openai_client(settings_with_keys)
            mock_cls.assert_called_once()
            kwargs = mock_cls.call_args[1]
            assert kwargs["api_key"] == "sk-test-openai"
            assert "base_url" not in kwargs

    @pytest.mark.unit
    def test_create_openai_with_helicone(self, settings_with_helicone):
        mock_cls = MagicMock()
        with patch("backend.ai.client_factory.OpenAI", mock_cls):
            ctx = AIRequestContext(user_id="u1", feature_name="chat")
            AIClientFactory.create_openai_client(settings_with_helicone, context=ctx)
            kwargs = mock_cls.call_args[1]
            assert kwargs["base_url"] == "https://oai.helicone.ai/v1"
            assert "Helicone-Auth" in kwargs["default_headers"]
            assert kwargs["default_headers"]["Helicone-User-Id"] == "u1"

    @pytest.mark.unit
    def test_create_openai_helicone_enabled_no_key_falls_back(self, settings_helicone_no_key, caplog):
        mock_cls = MagicMock()
        with patch("backend.ai.client_factory.OpenAI", mock_cls):
            with caplog.at_level(logging.WARNING):
                AIClientFactory.create_openai_client(settings_helicone_no_key)
            mock_cls.assert_called_once()
            kwargs = mock_cls.call_args[1]
            assert "base_url" not in kwargs
            assert "default_headers" not in kwargs
            assert "HELICONE_API_KEY not set" in caplog.text

    @pytest.mark.unit
    def test_create_openai_missing_key(self, settings_no_keys):
        with pytest.raises(ValueError, match="OPENAI_API_KEY"):
            AIClientFactory.create_openai_client(settings_no_keys)


# ---- AIClientFactory - Anthropic ----


class TestAnthropicClient:
    @pytest.mark.unit
    def test_create_anthropic_direct(self, settings_with_keys):
        mock_cls = MagicMock()
        with patch("backend.ai.client_factory.Anthropic", mock_cls):
            AIClientFactory.create_anthropic_client(settings_with_keys)
            mock_cls.assert_called_once()
            kwargs = mock_cls.call_args[1]
            assert kwargs["api_key"] == "sk-test-anthropic"
            assert "base_url" not in kwargs

    @pytest.mark.unit
    def test_create_anthropic_with_helicone(self, settings_with_helicone):
        mock_cls = MagicMock()
        with patch("backend.ai.client_factory.Anthropic", mock_cls):
            ctx = AIRequestContext(user_id="u2", feature_name="embed")
            AIClientFactory.create_anthropic_client(settings_with_helicone, context=ctx)
            kwargs = mock_cls.call_args[1]
            assert kwargs["base_url"] == "https://anthropic.helicone.ai"
            assert "Helicone-Auth" in kwargs["default_headers"]
            assert kwargs["default_headers"]["Helicone-User-Id"] == "u2"

    @pytest.mark.unit
    def test_create_anthropic_helicone_enabled_no_key_falls_back(self, settings_helicone_no_key, caplog):
        mock_cls = MagicMock()
        with patch("backend.ai.client_factory.Anthropic", mock_cls):
            with caplog.at_level(logging.WARNING):
                AIClientFactory.create_anthropic_client(settings_helicone_no_key)
            mock_cls.assert_called_once()
            kwargs = mock_cls.call_args[1]
            assert "base_url" not in kwargs
            assert "default_headers" not in kwargs
            assert "HELICONE_API_KEY not set" in caplog.text

    @pytest.mark.unit
    def test_create_anthropic_missing_key(self, settings_no_keys):
        with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
            AIClientFactory.create_anthropic_client(settings_no_keys)
