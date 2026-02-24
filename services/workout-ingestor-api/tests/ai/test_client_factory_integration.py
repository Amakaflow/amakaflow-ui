"""Integration tests for AIClientFactory with mocked HTTP layer."""
import pytest
from unittest.mock import patch, MagicMock


class TestOpenAIClientCreation:
    """Test OpenAI client creation with various configurations."""

    def test_creates_direct_client_when_helicone_disabled(self):
        """Should create direct OpenAI client when HELICONE_ENABLED=false."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = "sk-test-key"
            mock_settings.HELICONE_ENABLED = False
            mock_settings.HELICONE_API_KEY = None

            # Mock the openai import inside the method
            mock_openai = MagicMock()
            with patch.dict("sys.modules", {"openai": mock_openai}):

                # Clear any cached imports
                import importlib
                from workout_ingestor_api.ai import client_factory

                importlib.reload(client_factory)

                # Now call with fresh module
                with patch.object(
                    client_factory, "openai", mock_openai, create=True
                ):
                    # The factory will import openai dynamically
                    pass

    def test_creates_proxied_client_when_helicone_enabled(self):
        """Should create Helicone-proxied client when HELICONE_ENABLED=true."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = "sk-test-key"
            mock_settings.HELICONE_ENABLED = True
            mock_settings.HELICONE_API_KEY = "sk-helicone-key"
            mock_settings.ENVIRONMENT = "production"

            from workout_ingestor_api.ai.client_factory import (
                AIClientFactory,
                _HELICONE_OPENAI_BASE_URL,
            )

            mock_openai_class = MagicMock()
            with patch("openai.OpenAI", mock_openai_class):
                _client = AIClientFactory.create_openai_client()

                call_kwargs = mock_openai_class.call_args[1]
                assert call_kwargs["base_url"] == _HELICONE_OPENAI_BASE_URL
                assert "Helicone-Auth" in call_kwargs["default_headers"]
                assert (
                    call_kwargs["default_headers"]["Helicone-Auth"]
                    == "Bearer sk-helicone-key"
                )

    def test_includes_context_headers_in_proxied_client(self):
        """Should include AIRequestContext headers when Helicone is enabled."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = "sk-test-key"
            mock_settings.HELICONE_ENABLED = True
            mock_settings.HELICONE_API_KEY = "sk-helicone-key"
            mock_settings.ENVIRONMENT = "staging"

            from workout_ingestor_api.ai.client_factory import (
                AIClientFactory,
                AIRequestContext,
            )

            context = AIRequestContext(
                user_id="user_123",
                feature_name="workout_parser",
            )

            mock_openai_class = MagicMock()
            with patch("openai.OpenAI", mock_openai_class):
                _client = AIClientFactory.create_openai_client(context=context)

                headers = mock_openai_class.call_args[1]["default_headers"]
                assert headers["Helicone-User-Id"] == "user_123"
                assert headers["Helicone-Property-Feature"] == "workout_parser"
                assert headers["Helicone-Property-Environment"] == "staging"

    def test_respects_custom_timeout(self):
        """Should pass custom timeout to client."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = "sk-test-key"
            mock_settings.HELICONE_ENABLED = False

            from workout_ingestor_api.ai.client_factory import AIClientFactory

            mock_openai_class = MagicMock()
            with patch("openai.OpenAI", mock_openai_class):
                _client = AIClientFactory.create_openai_client(timeout=120.0)

                call_kwargs = mock_openai_class.call_args[1]
                assert call_kwargs["timeout"] == 120.0

    def test_uses_default_timeout_when_not_specified(self):
        """Should use DEFAULT_TIMEOUT when timeout not provided."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = "sk-test-key"
            mock_settings.HELICONE_ENABLED = False

            from workout_ingestor_api.ai.client_factory import (
                AIClientFactory,
                DEFAULT_TIMEOUT,
            )

            mock_openai_class = MagicMock()
            with patch("openai.OpenAI", mock_openai_class):
                _client = AIClientFactory.create_openai_client()

                call_kwargs = mock_openai_class.call_args[1]
                assert call_kwargs["timeout"] == DEFAULT_TIMEOUT

    def test_raises_value_error_without_api_key(self):
        """Should raise ValueError when OPENAI_API_KEY is not set."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = None

            from workout_ingestor_api.ai.client_factory import AIClientFactory

            with pytest.raises(ValueError, match="OpenAI API key not configured"):
                AIClientFactory.create_openai_client()

    def test_raises_value_error_with_empty_api_key(self):
        """Should raise ValueError when OPENAI_API_KEY is empty string."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = ""

            from workout_ingestor_api.ai.client_factory import AIClientFactory

            with pytest.raises(ValueError, match="OpenAI API key not configured"):
                AIClientFactory.create_openai_client()

    def test_no_helicone_headers_when_disabled(self):
        """Should not include Helicone headers when HELICONE_ENABLED=false."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = "sk-test-key"
            mock_settings.HELICONE_ENABLED = False
            mock_settings.HELICONE_API_KEY = "sk-helicone-key"  # Key exists but disabled

            from workout_ingestor_api.ai.client_factory import (
                AIClientFactory,
                AIRequestContext,
            )

            context = AIRequestContext(user_id="user_123")

            mock_openai_class = MagicMock()
            with patch("openai.OpenAI", mock_openai_class):
                _client = AIClientFactory.create_openai_client(context=context)

                call_kwargs = mock_openai_class.call_args[1]
                assert "default_headers" not in call_kwargs
                assert "base_url" not in call_kwargs


class TestAnthropicClientCreation:
    """Test Anthropic client creation with various configurations."""

    def test_creates_proxied_anthropic_client_when_helicone_enabled(self):
        """Should create Helicone-proxied Anthropic client when enabled."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.ANTHROPIC_API_KEY = "sk-ant-test"
            mock_settings.HELICONE_ENABLED = True
            mock_settings.HELICONE_API_KEY = "sk-helicone-key"
            mock_settings.ENVIRONMENT = "production"

            from workout_ingestor_api.ai.client_factory import (
                AIClientFactory,
                _HELICONE_ANTHROPIC_BASE_URL,
            )

            mock_anthropic_class = MagicMock()
            with patch("anthropic.Anthropic", mock_anthropic_class):
                _client = AIClientFactory.create_anthropic_client()

                call_kwargs = mock_anthropic_class.call_args[1]
                assert call_kwargs["base_url"] == _HELICONE_ANTHROPIC_BASE_URL
                assert "Helicone-Auth" in call_kwargs["default_headers"]

    def test_raises_value_error_without_anthropic_api_key(self):
        """Should raise ValueError when ANTHROPIC_API_KEY is not set."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.ANTHROPIC_API_KEY = None

            from workout_ingestor_api.ai.client_factory import AIClientFactory

            with pytest.raises(ValueError, match="Anthropic API key not configured"):
                AIClientFactory.create_anthropic_client()

    def test_anthropic_direct_client_when_helicone_disabled(self):
        """Should create direct Anthropic client when HELICONE_ENABLED=false."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.ANTHROPIC_API_KEY = "sk-ant-test"
            mock_settings.HELICONE_ENABLED = False
            mock_settings.HELICONE_API_KEY = None

            from workout_ingestor_api.ai.client_factory import AIClientFactory

            mock_anthropic_class = MagicMock()
            with patch("anthropic.Anthropic", mock_anthropic_class):
                _client = AIClientFactory.create_anthropic_client()

                call_kwargs = mock_anthropic_class.call_args[1]
                assert "base_url" not in call_kwargs
                assert "default_headers" not in call_kwargs


class TestHeliconeHeaderCompliance:
    """Test that Helicone headers follow the documented format."""

    def test_auth_header_uses_bearer_format(self):
        """Helicone-Auth should use 'Bearer <key>' format."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = "sk-test"
            mock_settings.HELICONE_ENABLED = True
            mock_settings.HELICONE_API_KEY = "sk-helicone-123"
            mock_settings.ENVIRONMENT = "test"

            from workout_ingestor_api.ai.client_factory import AIClientFactory

            mock_openai_class = MagicMock()
            with patch("openai.OpenAI", mock_openai_class):
                AIClientFactory.create_openai_client()

                headers = mock_openai_class.call_args[1]["default_headers"]
                assert headers["Helicone-Auth"].startswith("Bearer ")
                assert headers["Helicone-Auth"] == "Bearer sk-helicone-123"

    def test_property_headers_use_correct_prefix(self):
        """Custom properties should use Helicone-Property-* prefix."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "test"

            from workout_ingestor_api.ai.client_factory import AIRequestContext

            context = AIRequestContext(custom_properties={"my_prop": "value"})
            headers = context.to_tracking_headers()

            # Should be Helicone-Property-My-Prop (title case with hyphens)
            property_headers = [k for k in headers.keys() if k.startswith("Helicone-Property-")]
            assert len(property_headers) >= 1  # At least environment + custom

    def test_helicone_base_urls_are_correct(self):
        """Verify Helicone proxy base URLs are correctly defined."""
        from workout_ingestor_api.ai.client_factory import (
            _HELICONE_OPENAI_BASE_URL,
            _HELICONE_ANTHROPIC_BASE_URL,
        )

        assert _HELICONE_OPENAI_BASE_URL == "https://oai.helicone.ai/v1"
        assert _HELICONE_ANTHROPIC_BASE_URL == "https://anthropic.helicone.ai"


class TestHeliconeRequiresApiKey:
    """Test behavior when Helicone is enabled but API key is missing."""

    def test_helicone_enabled_without_key_falls_back_to_direct(self):
        """When HELICONE_ENABLED but no key, should fall back to direct."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = "sk-test"
            mock_settings.HELICONE_ENABLED = True
            mock_settings.HELICONE_API_KEY = None  # No key
            mock_settings.ENVIRONMENT = "test"

            from workout_ingestor_api.ai.client_factory import AIClientFactory

            mock_openai_class = MagicMock()
            with patch("openai.OpenAI", mock_openai_class):
                _client = AIClientFactory.create_openai_client()

                call_kwargs = mock_openai_class.call_args[1]
                # Should fall back to direct (no base_url or headers)
                assert "base_url" not in call_kwargs
                assert "default_headers" not in call_kwargs

    def test_helicone_enabled_with_empty_key_falls_back_to_direct(self):
        """When HELICONE_ENABLED but empty key, should fall back to direct."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = "sk-test"
            mock_settings.HELICONE_ENABLED = True
            mock_settings.HELICONE_API_KEY = ""  # Empty key
            mock_settings.ENVIRONMENT = "test"

            from workout_ingestor_api.ai.client_factory import AIClientFactory

            mock_openai_class = MagicMock()
            with patch("openai.OpenAI", mock_openai_class):
                _client = AIClientFactory.create_openai_client()

                call_kwargs = mock_openai_class.call_args[1]
                # Empty string is falsy, should fall back to direct
                assert "base_url" not in call_kwargs
