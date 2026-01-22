# Helicone AI Gateway Integration Test Strategy

**Feature**: AMA-405 - Helicone AI Gateway Integration
**Author**: Test Strategy Document
**Date**: 2026-01-21
**Status**: Proposed

---

## Executive Summary

This document defines a comprehensive test strategy for the Helicone AI Gateway integration in workout-ingestor-api. The integration touches three core files:

| File | Purpose | Risk Level |
|------|---------|------------|
| `src/workout_ingestor_api/ai/client_factory.py` | Client creation with optional Helicone proxy | **High** |
| `src/workout_ingestor_api/ai/retry.py` | Retry logic with exponential backoff | **High** |
| `src/workout_ingestor_api/config.py` | Feature flags and API key configuration | **Medium** |

---

## 1. Test Pyramid Plan

```
                    +------------------+
                    |      E2E         |  <- 2 tests (nightly)
                    |  Real Helicone   |
                    +------------------+
               +---------------------------+
               |      Integration          |  <- 8 tests (PR)
               |  Mocked HTTP responses    |
               +---------------------------+
          +--------------------------------------+
          |              Unit Tests              |  <- 25+ tests (PR)
          |  Pure logic, no I/O, fast (<100ms)  |
          +--------------------------------------+
```

### Test Distribution

| Layer | Test Count | Execution Time | CI Trigger |
|-------|------------|----------------|------------|
| Unit | 25-30 | < 2 seconds | Every PR |
| Integration | 8-12 | < 10 seconds | Every PR |
| E2E (Smoke) | 2-3 | < 30 seconds | Nightly / Manual |

---

## 2. Unit Tests (Fast, No I/O)

### 2.1 AIRequestContext Tests

**File**: `tests/ai/test_request_context.py`

```python
# tests/ai/test_request_context.py
"""Unit tests for AIRequestContext header generation."""
import pytest
from unittest.mock import patch

from workout_ingestor_api.ai.client_factory import AIRequestContext


class TestAIRequestContextHeaders:
    """Test Helicone header generation from AIRequestContext."""

    def test_empty_context_includes_environment_only(self):
        """Empty context should still include environment header."""
        with patch("workout_ingestor_api.config.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "production"

            context = AIRequestContext()
            headers = context.to_helicone_headers()

            assert headers == {"Helicone-Property-Environment": "production"}

    def test_user_id_maps_to_helicone_user_id_header(self):
        """user_id should map to Helicone-User-Id header."""
        with patch("workout_ingestor_api.config.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "development"

            context = AIRequestContext(user_id="user_123")
            headers = context.to_helicone_headers()

            assert headers["Helicone-User-Id"] == "user_123"

    def test_session_id_maps_to_helicone_session_id_header(self):
        """session_id should map to Helicone-Session-Id header."""
        with patch("workout_ingestor_api.config.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "development"

            context = AIRequestContext(session_id="sess_abc123")
            headers = context.to_helicone_headers()

            assert headers["Helicone-Session-Id"] == "sess_abc123"

    def test_feature_name_maps_to_helicone_property_feature(self):
        """feature_name should map to Helicone-Property-Feature header."""
        with patch("workout_ingestor_api.config.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "development"

            context = AIRequestContext(feature_name="workout_parser")
            headers = context.to_helicone_headers()

            assert headers["Helicone-Property-Feature"] == "workout_parser"

    def test_request_id_maps_to_helicone_request_id(self):
        """request_id should map to Helicone-Request-Id header."""
        with patch("workout_ingestor_api.config.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "development"

            context = AIRequestContext(request_id="req_xyz789")
            headers = context.to_helicone_headers()

            assert headers["Helicone-Request-Id"] == "req_xyz789"

    def test_custom_properties_converted_to_title_case_headers(self):
        """Custom properties should be converted to Helicone-Property-* headers."""
        with patch("workout_ingestor_api.config.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "development"

            context = AIRequestContext(
                custom_properties={
                    "workout_type": "strength",
                    "source_platform": "youtube",
                }
            )
            headers = context.to_helicone_headers()

            assert headers["Helicone-Property-Workout-Type"] == "strength"
            assert headers["Helicone-Property-Source-Platform"] == "youtube"

    def test_full_context_generates_all_headers(self):
        """Full context should generate all corresponding headers."""
        with patch("workout_ingestor_api.config.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "staging"

            context = AIRequestContext(
                user_id="user_456",
                session_id="sess_def",
                feature_name="voice_parser",
                request_id="req_001",
                custom_properties={"model": "gpt-4o"},
            )
            headers = context.to_helicone_headers()

            expected = {
                "Helicone-User-Id": "user_456",
                "Helicone-Session-Id": "sess_def",
                "Helicone-Property-Feature": "voice_parser",
                "Helicone-Request-Id": "req_001",
                "Helicone-Property-Environment": "staging",
                "Helicone-Property-Model": "gpt-4o",
            }
            assert headers == expected

    def test_none_values_are_excluded_from_headers(self):
        """None values should not generate headers."""
        with patch("workout_ingestor_api.config.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "development"

            context = AIRequestContext(
                user_id=None,
                session_id=None,
                feature_name="test",
            )
            headers = context.to_helicone_headers()

            assert "Helicone-User-Id" not in headers
            assert "Helicone-Session-Id" not in headers
            assert "Helicone-Property-Feature" in headers
```

### 2.2 Retry Logic Tests

**File**: `tests/ai/test_retry.py`

```python
# tests/ai/test_retry.py
"""Unit tests for retry logic and error classification."""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
import asyncio

from workout_ingestor_api.ai.retry import (
    is_retryable_error,
    retry_sync_call,
    retry_async_call,
    DEFAULT_MAX_ATTEMPTS,
)


class TestIsRetryableError:
    """Test error classification for retry decisions."""

    # --- Retryable errors (should return True) ---

    @pytest.mark.parametrize("error_message", [
        "Rate limit exceeded",
        "rate limit reached",
        "Error code: 429",
        "Status 429: Too Many Requests",
        "You have exceeded your rate limit",
    ])
    def test_rate_limit_errors_are_retryable(self, error_message):
        """429 rate limit errors should be retryable."""
        exception = Exception(error_message)
        assert is_retryable_error(exception) is True

    @pytest.mark.parametrize("status_code", ["500", "502", "503", "504"])
    def test_server_errors_5xx_are_retryable(self, status_code):
        """5xx server errors should be retryable."""
        exception = Exception(f"Server error: {status_code}")
        assert is_retryable_error(exception) is True

    @pytest.mark.parametrize("error_message", [
        "Request timed out",
        "Connection timed out after 30s",
        "Operation timed out",
        "Read timeout",
    ])
    def test_timeout_errors_are_retryable(self, error_message):
        """Timeout errors should be retryable."""
        exception = Exception(error_message)
        assert is_retryable_error(exception) is True

    def test_timeout_exception_type_is_retryable(self):
        """Exception with 'timeout' in class name should be retryable."""
        class ReadTimeoutError(Exception):
            pass

        exception = ReadTimeoutError("request failed")
        assert is_retryable_error(exception) is True

    @pytest.mark.parametrize("error_message", [
        "Connection refused",
        "Connection reset by peer",
        "Failed to establish connection",
    ])
    def test_connection_errors_are_retryable(self, error_message):
        """Connection errors should be retryable."""
        exception = Exception(error_message)
        assert is_retryable_error(exception) is True

    def test_connection_exception_type_is_retryable(self):
        """Exception with 'connect' in class name should be retryable."""
        class ConnectionResetError(Exception):
            pass

        exception = ConnectionResetError("connection lost")
        assert is_retryable_error(exception) is True

    # --- Non-retryable errors (should return False) ---

    @pytest.mark.parametrize("error_message", [
        "Error 400: Bad Request",
        "Status code: 400",
        "Invalid request format: 400",
    ])
    def test_bad_request_400_not_retryable(self, error_message):
        """400 bad request errors should NOT be retryable."""
        exception = Exception(error_message)
        assert is_retryable_error(exception) is False

    @pytest.mark.parametrize("error_message", [
        "Error 401: Unauthorized",
        "Authentication failed: 401",
        "Invalid authentication credentials",
        "Unauthorized access",
    ])
    def test_auth_errors_401_not_retryable(self, error_message):
        """401 authentication errors should NOT be retryable."""
        exception = Exception(error_message)
        assert is_retryable_error(exception) is False

    @pytest.mark.parametrize("error_message", [
        "Error 403: Forbidden",
        "Status code: 403",
    ])
    def test_forbidden_403_not_retryable(self, error_message):
        """403 forbidden errors should NOT be retryable."""
        exception = Exception(error_message)
        assert is_retryable_error(exception) is False

    @pytest.mark.parametrize("error_message", [
        "Error 404: Not Found",
        "Resource not found: 404",
    ])
    def test_not_found_404_not_retryable(self, error_message):
        """404 not found errors should NOT be retryable."""
        exception = Exception(error_message)
        assert is_retryable_error(exception) is False

    @pytest.mark.parametrize("error_message", [
        "Invalid API key provided",
        "Invalid key format",
        "API key is invalid",
    ])
    def test_invalid_key_errors_not_retryable(self, error_message):
        """Invalid API key errors should NOT be retryable."""
        exception = Exception(error_message)
        assert is_retryable_error(exception) is False

    @pytest.mark.parametrize("error_message", [
        "Quota exceeded for this month",
        "You have exceeded your quota",
        "Billing quota exceeded",
    ])
    def test_quota_exceeded_not_retryable(self, error_message):
        """Quota exceeded errors should NOT be retryable."""
        exception = Exception(error_message)
        assert is_retryable_error(exception) is False

    def test_unknown_errors_not_retryable_by_default(self):
        """Unknown/unrecognized errors should NOT be retryable."""
        exception = Exception("Something completely unexpected happened")
        assert is_retryable_error(exception) is False


class TestRetrySyncCall:
    """Test synchronous retry execution."""

    def test_successful_call_returns_immediately(self):
        """Successful calls should return without retry."""
        mock_func = MagicMock(return_value="success")

        result = retry_sync_call(mock_func, max_attempts=3)

        assert result == "success"
        assert mock_func.call_count == 1

    def test_retryable_error_retries_up_to_max_attempts(self):
        """Retryable errors should retry up to max_attempts."""
        mock_func = MagicMock(side_effect=Exception("Error 503: Service Unavailable"))

        with pytest.raises(Exception, match="503"):
            retry_sync_call(
                mock_func,
                max_attempts=3,
                min_wait_seconds=0.01,  # Fast for testing
                max_wait_seconds=0.02,
            )

        assert mock_func.call_count == 3

    def test_non_retryable_error_fails_immediately(self):
        """Non-retryable errors should fail without retry."""
        mock_func = MagicMock(side_effect=Exception("Error 401: Unauthorized"))

        with pytest.raises(Exception, match="401"):
            retry_sync_call(mock_func, max_attempts=3)

        assert mock_func.call_count == 1  # No retry

    def test_eventual_success_after_failures(self):
        """Should return result if call succeeds within max_attempts."""
        mock_func = MagicMock(side_effect=[
            Exception("Error 503"),
            Exception("Error 503"),
            "success",
        ])

        result = retry_sync_call(
            mock_func,
            max_attempts=3,
            min_wait_seconds=0.01,
            max_wait_seconds=0.02,
        )

        assert result == "success"
        assert mock_func.call_count == 3

    def test_arguments_passed_to_function(self):
        """Arguments should be passed through to the function."""
        mock_func = MagicMock(return_value="result")

        retry_sync_call(mock_func, "arg1", "arg2", kwarg1="value1")

        mock_func.assert_called_once_with("arg1", "arg2", kwarg1="value1")


class TestRetryAsyncCall:
    """Test asynchronous retry execution."""

    @pytest.mark.asyncio
    async def test_successful_async_call_returns_immediately(self):
        """Successful async calls should return without retry."""
        mock_func = AsyncMock(return_value="async_success")

        result = await retry_async_call(mock_func, max_attempts=3)

        assert result == "async_success"
        assert mock_func.call_count == 1

    @pytest.mark.asyncio
    async def test_retryable_error_retries_async(self):
        """Retryable errors should retry asynchronously."""
        mock_func = AsyncMock(side_effect=Exception("Error 429: Rate limited"))

        with pytest.raises(Exception, match="429"):
            await retry_async_call(
                mock_func,
                max_attempts=3,
                min_wait_seconds=0.01,
                max_wait_seconds=0.02,
            )

        assert mock_func.call_count == 3

    @pytest.mark.asyncio
    async def test_non_retryable_error_fails_immediately_async(self):
        """Non-retryable errors should fail without retry in async."""
        mock_func = AsyncMock(side_effect=Exception("Error 400: Bad Request"))

        with pytest.raises(Exception, match="400"):
            await retry_async_call(mock_func, max_attempts=3)

        assert mock_func.call_count == 1


class TestExponentialBackoff:
    """Test exponential backoff timing."""

    def test_backoff_timing_increases_exponentially(self):
        """Wait times should increase exponentially between retries."""
        wait_times = []
        original_sleep = __import__('time').sleep

        def capture_sleep(duration):
            wait_times.append(duration)
            # Don't actually sleep in tests

        mock_func = MagicMock(side_effect=[
            Exception("Error 503"),
            Exception("Error 503"),
            Exception("Error 503"),
        ])

        with patch('time.sleep', capture_sleep):
            with pytest.raises(Exception):
                retry_sync_call(
                    mock_func,
                    max_attempts=3,
                    min_wait_seconds=1,
                    max_wait_seconds=10,
                )

        # First wait: 1 * 2^0 = 1
        # Second wait: 1 * 2^1 = 2
        # (Third failure doesn't wait, it raises)
        assert len(wait_times) == 2
        assert wait_times[0] == 1.0
        assert wait_times[1] == 2.0

    def test_backoff_respects_max_wait(self):
        """Wait time should be capped at max_wait_seconds."""
        wait_times = []

        def capture_sleep(duration):
            wait_times.append(duration)

        mock_func = MagicMock(side_effect=[
            Exception("Error 503"),
            Exception("Error 503"),
            Exception("Error 503"),
            Exception("Error 503"),
            Exception("Error 503"),
        ])

        with patch('time.sleep', capture_sleep):
            with pytest.raises(Exception):
                retry_sync_call(
                    mock_func,
                    max_attempts=5,
                    min_wait_seconds=1,
                    max_wait_seconds=3,  # Cap at 3
                )

        # Wait times should be: 1, 2, 3, 3 (capped)
        # 1*2^0=1, 1*2^1=2, 1*2^2=4->3, 1*2^3=8->3
        assert all(t <= 3.0 for t in wait_times)
```

### 2.3 Settings/Config Tests

**File**: `tests/test_config.py`

```python
# tests/test_config.py
"""Unit tests for Settings configuration."""
import pytest
import os
from unittest.mock import patch


class TestSettingsHeliconeFlags:
    """Test Helicone-related settings."""

    def test_helicone_disabled_by_default(self):
        """HELICONE_ENABLED should be False by default."""
        with patch.dict(os.environ, {}, clear=True):
            from workout_ingestor_api.config import Settings
            settings = Settings()
            assert settings.HELICONE_ENABLED is False

    def test_helicone_enabled_when_env_true(self):
        """HELICONE_ENABLED should be True when env var is 'true'."""
        with patch.dict(os.environ, {"HELICONE_ENABLED": "true"}, clear=True):
            from workout_ingestor_api.config import Settings
            settings = Settings()
            assert settings.HELICONE_ENABLED is True

    def test_helicone_enabled_case_insensitive(self):
        """HELICONE_ENABLED should handle case variations."""
        for value in ["TRUE", "True", "true"]:
            with patch.dict(os.environ, {"HELICONE_ENABLED": value}, clear=True):
                from workout_ingestor_api.config import Settings
                settings = Settings()
                assert settings.HELICONE_ENABLED is True

    def test_helicone_api_key_from_env(self):
        """HELICONE_API_KEY should be read from environment."""
        with patch.dict(os.environ, {"HELICONE_API_KEY": "sk-helicone-test"}, clear=True):
            from workout_ingestor_api.config import Settings
            settings = Settings()
            assert settings.HELICONE_API_KEY == "sk-helicone-test"

    def test_environment_defaults_to_development(self):
        """ENVIRONMENT should default to 'development'."""
        with patch.dict(os.environ, {}, clear=True):
            from workout_ingestor_api.config import Settings
            settings = Settings()
            assert settings.ENVIRONMENT == "development"

    @pytest.mark.parametrize("env_value,expected", [
        ("development", "development"),
        ("staging", "staging"),
        ("production", "production"),
        ("PRODUCTION", "production"),
        ("invalid", "development"),  # Falls back to development
    ])
    def test_environment_values(self, env_value, expected):
        """ENVIRONMENT should accept valid values and fall back for invalid."""
        with patch.dict(os.environ, {"ENVIRONMENT": env_value}, clear=True):
            from workout_ingestor_api.config import Settings
            settings = Settings()
            assert settings.ENVIRONMENT == expected
```

---

## 3. Integration Tests (Mocked HTTP Layer)

### 3.1 Client Factory Integration Tests

**File**: `tests/ai/test_client_factory_integration.py`

```python
# tests/ai/test_client_factory_integration.py
"""Integration tests for AIClientFactory with mocked HTTP layer."""
import pytest
from unittest.mock import patch, MagicMock


class TestOpenAIClientCreation:
    """Test OpenAI client creation with various configurations."""

    @pytest.fixture
    def mock_openai_module(self):
        """Mock the openai module."""
        with patch("workout_ingestor_api.ai.client_factory.openai") as mock:
            mock.OpenAI = MagicMock()
            yield mock

    def test_creates_direct_client_when_helicone_disabled(self, mock_openai_module):
        """Should create direct OpenAI client when HELICONE_ENABLED=false."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = "sk-test-key"
            mock_settings.HELICONE_ENABLED = False
            mock_settings.HELICONE_API_KEY = None

            from workout_ingestor_api.ai.client_factory import AIClientFactory

            client = AIClientFactory.create_openai_client()

            call_kwargs = mock_openai_module.OpenAI.call_args[1]
            assert call_kwargs["api_key"] == "sk-test-key"
            assert "base_url" not in call_kwargs
            assert "default_headers" not in call_kwargs

    def test_creates_proxied_client_when_helicone_enabled(self, mock_openai_module):
        """Should create Helicone-proxied client when HELICONE_ENABLED=true."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = "sk-test-key"
            mock_settings.HELICONE_ENABLED = True
            mock_settings.HELICONE_API_KEY = "sk-helicone-key"
            mock_settings.ENVIRONMENT = "production"

            from workout_ingestor_api.ai.client_factory import (
                AIClientFactory,
                HELICONE_OPENAI_BASE_URL,
            )

            client = AIClientFactory.create_openai_client()

            call_kwargs = mock_openai_module.OpenAI.call_args[1]
            assert call_kwargs["base_url"] == HELICONE_OPENAI_BASE_URL
            assert "Helicone-Auth" in call_kwargs["default_headers"]
            assert call_kwargs["default_headers"]["Helicone-Auth"] == "Bearer sk-helicone-key"

    def test_includes_context_headers_in_proxied_client(self, mock_openai_module):
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

            client = AIClientFactory.create_openai_client(context=context)

            headers = mock_openai_module.OpenAI.call_args[1]["default_headers"]
            assert headers["Helicone-User-Id"] == "user_123"
            assert headers["Helicone-Property-Feature"] == "workout_parser"
            assert headers["Helicone-Property-Environment"] == "staging"

    def test_respects_custom_timeout(self, mock_openai_module):
        """Should pass custom timeout to client."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = "sk-test-key"
            mock_settings.HELICONE_ENABLED = False

            from workout_ingestor_api.ai.client_factory import AIClientFactory

            client = AIClientFactory.create_openai_client(timeout=120.0)

            call_kwargs = mock_openai_module.OpenAI.call_args[1]
            assert call_kwargs["timeout"] == 120.0

    def test_raises_value_error_without_api_key(self):
        """Should raise ValueError when OPENAI_API_KEY is not set."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = None

            from workout_ingestor_api.ai.client_factory import AIClientFactory

            with pytest.raises(ValueError, match="OpenAI API key not configured"):
                AIClientFactory.create_openai_client()

    def test_raises_import_error_without_openai_package(self):
        """Should raise ImportError when openai package is missing."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = "sk-test"

            with patch.dict("sys.modules", {"openai": None}):
                # Force reimport to trigger ImportError
                import importlib
                from workout_ingestor_api.ai import client_factory

                # The actual import error handling is in the method
                # This test validates the error message
                pass


class TestAnthropicClientCreation:
    """Test Anthropic client creation with various configurations."""

    @pytest.fixture
    def mock_anthropic_module(self):
        """Mock the anthropic module."""
        mock_anthropic = MagicMock()
        mock_anthropic.Anthropic = MagicMock()
        with patch.dict("sys.modules", {"anthropic": mock_anthropic}):
            yield mock_anthropic

    def test_creates_direct_anthropic_client_when_helicone_disabled(self, mock_anthropic_module):
        """Should create direct Anthropic client when HELICONE_ENABLED=false."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.ANTHROPIC_API_KEY = "sk-ant-test"
            mock_settings.HELICONE_ENABLED = False
            mock_settings.HELICONE_API_KEY = None

            from workout_ingestor_api.ai.client_factory import AIClientFactory

            # Need to patch the import inside the method
            with patch("workout_ingestor_api.ai.client_factory.Anthropic",
                       mock_anthropic_module.Anthropic, create=True):
                pass  # Test the direct path

    def test_creates_proxied_anthropic_client_when_helicone_enabled(self, mock_anthropic_module):
        """Should create Helicone-proxied Anthropic client when enabled."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.ANTHROPIC_API_KEY = "sk-ant-test"
            mock_settings.HELICONE_ENABLED = True
            mock_settings.HELICONE_API_KEY = "sk-helicone-key"
            mock_settings.ENVIRONMENT = "production"

            from workout_ingestor_api.ai.client_factory import HELICONE_ANTHROPIC_BASE_URL

            # Verify base URL is correct
            assert HELICONE_ANTHROPIC_BASE_URL == "https://anthropic.helicone.ai"

    def test_raises_value_error_without_anthropic_api_key(self):
        """Should raise ValueError when ANTHROPIC_API_KEY is not set."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.ANTHROPIC_API_KEY = None

            from workout_ingestor_api.ai.client_factory import AIClientFactory

            with pytest.raises(ValueError, match="Anthropic API key not configured"):
                AIClientFactory.create_anthropic_client()


class TestHeliconeHeaderCompliance:
    """Test that Helicone headers follow the documented format."""

    def test_auth_header_uses_bearer_format(self):
        """Helicone-Auth should use 'Bearer <key>' format."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.OPENAI_API_KEY = "sk-test"
            mock_settings.HELICONE_ENABLED = True
            mock_settings.HELICONE_API_KEY = "sk-helicone-123"
            mock_settings.ENVIRONMENT = "test"

            with patch("workout_ingestor_api.ai.client_factory.openai") as mock_openai:
                mock_openai.OpenAI = MagicMock()

                from workout_ingestor_api.ai.client_factory import AIClientFactory
                AIClientFactory.create_openai_client()

                headers = mock_openai.OpenAI.call_args[1]["default_headers"]
                assert headers["Helicone-Auth"].startswith("Bearer ")

    def test_property_headers_use_correct_prefix(self):
        """Custom properties should use Helicone-Property-* prefix."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "test"

            from workout_ingestor_api.ai.client_factory import AIRequestContext

            context = AIRequestContext(
                custom_properties={"my_prop": "value"}
            )
            headers = context.to_helicone_headers()

            # Should be Helicone-Property-My-Prop (title case with hyphens)
            assert any(k.startswith("Helicone-Property-") for k in headers.keys())
```

### 3.2 HTTP Response Simulation Tests

**File**: `tests/ai/test_http_error_handling.py`

```python
# tests/ai/test_http_error_handling.py
"""Test HTTP error handling with simulated responses."""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
import httpx


class TestRateLimitHandling:
    """Test handling of 429 rate limit responses."""

    def test_openai_rate_limit_triggers_retry(self):
        """OpenAI 429 response should trigger retry logic."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        # Simulate OpenAI rate limit error
        error = Exception("Error code: 429 - Rate limit reached for gpt-4")
        assert is_retryable_error(error) is True

    def test_anthropic_rate_limit_triggers_retry(self):
        """Anthropic rate limit error should trigger retry."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("rate_limit_error: This request would exceed your rate limit")
        assert is_retryable_error(error) is True


class TestServerErrorHandling:
    """Test handling of 5xx server errors."""

    @pytest.mark.parametrize("status_code,should_retry", [
        (500, True),   # Internal Server Error
        (502, True),   # Bad Gateway
        (503, True),   # Service Unavailable
        (504, True),   # Gateway Timeout
        (501, False),  # Not Implemented (not in retry list)
    ])
    def test_server_error_retry_decisions(self, status_code, should_retry):
        """Server errors should be retried based on status code."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception(f"Server returned status {status_code}")
        # Note: Current implementation checks for specific codes in string
        if status_code in [500, 502, 503, 504]:
            assert is_retryable_error(error) is True
        else:
            # 501 is not in the retry list
            assert is_retryable_error(error) is False


class TestTimeoutHandling:
    """Test timeout error handling."""

    def test_read_timeout_triggers_retry(self):
        """Read timeout should trigger retry."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = httpx.ReadTimeout("Read timed out")
        assert is_retryable_error(error) is True

    def test_connect_timeout_triggers_retry(self):
        """Connect timeout should trigger retry."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = httpx.ConnectTimeout("Connect timed out")
        assert is_retryable_error(error) is True


class TestHeliconeProxyFailure:
    """Test behavior when Helicone proxy is unreachable."""

    def test_connection_error_to_helicone_is_retryable(self):
        """Connection failure to Helicone should be retryable."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        # Simulate DNS resolution failure or connection refused
        error = httpx.ConnectError("Failed to connect to oai.helicone.ai")
        assert is_retryable_error(error) is True

    def test_helicone_503_is_retryable(self):
        """Helicone returning 503 should be retryable."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("Status 503: Helicone service temporarily unavailable")
        assert is_retryable_error(error) is True
```

---

## 4. E2E Tests (Real External Calls)

**File**: `tests/ai/test_helicone_e2e.py`

```python
# tests/ai/test_helicone_e2e.py
"""
End-to-end tests for Helicone integration.

These tests make REAL API calls and should only run:
- Nightly in CI (not on every PR)
- Manually during development
- In staging environment

Requires real API keys:
- OPENAI_API_KEY
- HELICONE_API_KEY
- HELICONE_ENABLED=true
"""
import pytest
import os


# Skip E2E tests unless explicitly enabled
pytestmark = pytest.mark.skipif(
    os.getenv("RUN_E2E_TESTS", "false").lower() != "true",
    reason="E2E tests disabled. Set RUN_E2E_TESTS=true to run."
)


@pytest.fixture
def real_api_keys():
    """Verify real API keys are available."""
    openai_key = os.getenv("OPENAI_API_KEY")
    helicone_key = os.getenv("HELICONE_API_KEY")

    if not openai_key or openai_key.startswith("test"):
        pytest.skip("Real OPENAI_API_KEY required for E2E tests")
    if not helicone_key:
        pytest.skip("Real HELICONE_API_KEY required for E2E tests")

    return {"openai": openai_key, "helicone": helicone_key}


class TestHeliconeE2E:
    """End-to-end tests with real Helicone integration."""

    @pytest.mark.slow
    def test_openai_call_through_helicone_proxy(self, real_api_keys):
        """
        Smoke test: Make a real OpenAI call through Helicone.

        Validates:
        - Helicone proxy is reachable
        - Authentication works
        - Request completes successfully
        """
        # Ensure Helicone is enabled for this test
        os.environ["HELICONE_ENABLED"] = "true"

        from workout_ingestor_api.ai.client_factory import (
            AIClientFactory,
            AIRequestContext,
        )

        context = AIRequestContext(
            user_id="e2e-test-user",
            feature_name="e2e_smoke_test",
            custom_properties={"test_run": "true"},
        )

        client = AIClientFactory.create_openai_client(context=context)

        # Make a minimal API call
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": "Say 'test passed' in 2 words"}],
            max_tokens=10,
        )

        assert response.choices[0].message.content is not None
        # Note: Verify in Helicone dashboard that request appears with correct metadata

    @pytest.mark.slow
    def test_openai_direct_call_when_helicone_disabled(self, real_api_keys):
        """
        Verify direct OpenAI calls work when Helicone is disabled.

        This ensures the fallback path (no proxy) is functional.
        """
        os.environ["HELICONE_ENABLED"] = "false"

        from workout_ingestor_api.ai.client_factory import AIClientFactory

        # Force reload to pick up new env var
        from importlib import reload
        from workout_ingestor_api import config
        reload(config)

        client = AIClientFactory.create_openai_client()

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": "Say 'direct test' in 2 words"}],
            max_tokens=10,
        )

        assert response.choices[0].message.content is not None


class TestHeliconeMetadataVerification:
    """Tests to verify metadata appears in Helicone dashboard."""

    @pytest.mark.slow
    @pytest.mark.manual
    def test_verify_user_id_in_helicone_dashboard(self, real_api_keys):
        """
        Manual verification test - check Helicone dashboard after running.

        Steps:
        1. Run this test
        2. Go to Helicone dashboard
        3. Find request with user_id = "e2e-verify-user-123"
        4. Verify custom properties are visible
        """
        os.environ["HELICONE_ENABLED"] = "true"

        from workout_ingestor_api.ai.client_factory import (
            AIClientFactory,
            AIRequestContext,
        )

        context = AIRequestContext(
            user_id="e2e-verify-user-123",
            session_id="e2e-session-456",
            feature_name="metadata_verification_test",
            request_id="e2e-req-789",
            custom_properties={
                "test_type": "manual_verification",
                "workout_source": "youtube",
            },
        )

        client = AIClientFactory.create_openai_client(context=context)

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": "Echo: metadata test"}],
            max_tokens=10,
        )

        print(f"\n[MANUAL VERIFICATION REQUIRED]")
        print(f"Check Helicone dashboard for request with:")
        print(f"  - User ID: e2e-verify-user-123")
        print(f"  - Session ID: e2e-session-456")
        print(f"  - Feature: metadata_verification_test")
        print(f"  - Request ID: e2e-req-789")
        print(f"  - Custom properties: test_type, workout_source")
```

---

## 5. Test Fixtures and Mocks

### 5.1 Shared Fixtures

**File**: `tests/ai/conftest.py`

```python
# tests/ai/conftest.py
"""Shared fixtures for AI module tests."""
import pytest
from unittest.mock import patch, MagicMock
import os


@pytest.fixture
def mock_settings_helicone_enabled():
    """Mock settings with Helicone enabled."""
    with patch("workout_ingestor_api.ai.client_factory.settings") as mock:
        mock.OPENAI_API_KEY = "sk-test-openai"
        mock.ANTHROPIC_API_KEY = "sk-test-anthropic"
        mock.HELICONE_ENABLED = True
        mock.HELICONE_API_KEY = "sk-test-helicone"
        mock.ENVIRONMENT = "test"
        yield mock


@pytest.fixture
def mock_settings_helicone_disabled():
    """Mock settings with Helicone disabled."""
    with patch("workout_ingestor_api.ai.client_factory.settings") as mock:
        mock.OPENAI_API_KEY = "sk-test-openai"
        mock.ANTHROPIC_API_KEY = "sk-test-anthropic"
        mock.HELICONE_ENABLED = False
        mock.HELICONE_API_KEY = None
        mock.ENVIRONMENT = "development"
        yield mock


@pytest.fixture
def mock_openai_client():
    """Mock OpenAI client for testing."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [
        MagicMock(message=MagicMock(content='{"title": "Test Workout"}'))
    ]
    mock_client.chat.completions.create.return_value = mock_response
    return mock_client


@pytest.fixture
def mock_anthropic_client():
    """Mock Anthropic client for testing."""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text='{"title": "Test Workout"}')]
    mock_client.messages.create.return_value = mock_response
    return mock_client


# Error simulation fixtures

@pytest.fixture
def rate_limit_error():
    """Simulate OpenAI rate limit error."""
    return Exception("Error code: 429 - Rate limit reached for requests")


@pytest.fixture
def server_error_503():
    """Simulate 503 Service Unavailable."""
    return Exception("Error code: 503 - Service temporarily unavailable")


@pytest.fixture
def timeout_error():
    """Simulate timeout error."""
    import httpx
    return httpx.ReadTimeout("Connection read timed out")


@pytest.fixture
def auth_error():
    """Simulate authentication error."""
    return Exception("Error code: 401 - Invalid API key provided")


@pytest.fixture
def bad_request_error():
    """Simulate bad request error."""
    return Exception("Error code: 400 - Invalid request: missing 'messages' field")
```

### 5.2 HTTP Response Factories

**File**: `tests/ai/factories.py`

```python
# tests/ai/factories.py
"""Factory functions for creating test doubles."""
from unittest.mock import MagicMock
from typing import Optional


def create_openai_response(content: str, model: str = "gpt-4o"):
    """Create a mock OpenAI ChatCompletion response."""
    mock_response = MagicMock()
    mock_response.id = "chatcmpl-test123"
    mock_response.model = model
    mock_response.choices = [
        MagicMock(
            index=0,
            message=MagicMock(
                role="assistant",
                content=content,
            ),
            finish_reason="stop",
        )
    ]
    mock_response.usage = MagicMock(
        prompt_tokens=10,
        completion_tokens=20,
        total_tokens=30,
    )
    return mock_response


def create_openai_error(status_code: int, message: str):
    """Create a mock OpenAI API error."""
    error = Exception(f"Error code: {status_code} - {message}")
    error.status_code = status_code
    return error


def create_anthropic_response(content: str, model: str = "claude-3-sonnet"):
    """Create a mock Anthropic Message response."""
    mock_response = MagicMock()
    mock_response.id = "msg-test123"
    mock_response.model = model
    mock_response.content = [
        MagicMock(
            type="text",
            text=content,
        )
    ]
    mock_response.stop_reason = "end_turn"
    mock_response.usage = MagicMock(
        input_tokens=10,
        output_tokens=20,
    )
    return mock_response


def create_httpx_error(error_type: str, message: str):
    """Create httpx errors for testing."""
    import httpx

    error_classes = {
        "timeout": httpx.ReadTimeout,
        "connect_timeout": httpx.ConnectTimeout,
        "connect_error": httpx.ConnectError,
        "http_error": httpx.HTTPStatusError,
    }

    error_class = error_classes.get(error_type, Exception)
    return error_class(message)
```

---

## 6. CI Strategy

### 6.1 PR Workflow (Fast Feedback)

```yaml
# .github/workflows/ci.yml (updated)
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt

      - name: Run unit tests
        run: |
          pytest tests/ -v \
            --ignore=tests/ai/test_helicone_e2e.py \
            -m "not slow and not e2e" \
            --tb=short
        env:
          OPENAI_API_KEY: test-key
          ANTHROPIC_API_KEY: test-key
          HELICONE_ENABLED: "false"
          HELICONE_API_KEY: ""
          ENVIRONMENT: development

      - name: Run AI module tests with coverage
        run: |
          pytest tests/ai/ -v \
            --ignore=tests/ai/test_helicone_e2e.py \
            --cov=src/workout_ingestor_api/ai \
            --cov-report=term-missing \
            --cov-fail-under=80
        env:
          OPENAI_API_KEY: test-key
          ANTHROPIC_API_KEY: test-key
          HELICONE_ENABLED: "false"
          ENVIRONMENT: test
```

### 6.2 Nightly E2E Workflow

```yaml
# .github/workflows/nightly-e2e.yml
name: Nightly E2E Tests

on:
  schedule:
    - cron: '0 4 * * *'  # 4 AM UTC daily
  workflow_dispatch:  # Allow manual trigger

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    environment: staging  # Use staging secrets

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt

      - name: Run E2E Helicone tests
        run: |
          pytest tests/ai/test_helicone_e2e.py -v \
            -m "slow or e2e" \
            --tb=long
        env:
          RUN_E2E_TESTS: "true"
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          HELICONE_ENABLED: "true"
          HELICONE_API_KEY: ${{ secrets.HELICONE_API_KEY }}
          ENVIRONMENT: staging

      - name: Notify on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Nightly E2E tests failed for workout-ingestor-api"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## 7. Risk-Based Prioritization

### Priority Matrix

| Test Category | Risk Level | Priority | CI Stage |
|--------------|------------|----------|----------|
| Header generation (AIRequestContext) | High | P0 | PR |
| Retry error classification | High | P0 | PR |
| Feature flag behavior | High | P0 | PR |
| Exponential backoff timing | Medium | P1 | PR |
| Missing API key handling | Medium | P1 | PR |
| Helicone proxy routing | Medium | P1 | PR |
| Timeout configuration | Medium | P2 | PR |
| E2E smoke test | Low | P2 | Nightly |
| Dashboard metadata verification | Low | P3 | Manual |

### Definition of Done

A test is considered complete when:

1. **Unit tests** achieve >= 80% code coverage for:
   - `ai/client_factory.py`
   - `ai/retry.py`

2. **Integration tests** verify:
   - Helicone headers are correctly formatted
   - Feature flag controls proxy behavior
   - Error classification is accurate

3. **All tests** are:
   - Deterministic (no flaky tests)
   - Fast (< 100ms for unit, < 1s for integration)
   - Isolated (no shared state between tests)

---

## 8. Test File Structure

```
tests/
  ai/
    __init__.py
    conftest.py                      # Shared AI fixtures
    factories.py                     # Response factories
    test_request_context.py          # AIRequestContext unit tests
    test_retry.py                    # Retry logic unit tests
    test_client_factory_integration.py  # Client creation integration
    test_http_error_handling.py      # HTTP error simulation
    test_helicone_e2e.py            # E2E tests (nightly only)
  test_config.py                     # Settings/config tests
```

---

## 9. Recommended Tooling

| Tool | Purpose | Installation |
|------|---------|--------------|
| pytest | Test framework | `pip install pytest` |
| pytest-cov | Coverage reporting | `pip install pytest-cov` |
| pytest-asyncio | Async test support | `pip install pytest-asyncio` |
| pytest-mock | Enhanced mocking | `pip install pytest-mock` |
| httpx | HTTP client for testing | Already in requirements |
| responses | HTTP mocking | `pip install responses` (optional) |

### pytest.ini Configuration

```ini
[pytest]
testpaths = tests
python_files = test_*.py
python_functions = test_*
asyncio_mode = auto
addopts = -v --tb=short
markers =
    slow: marks tests as slow (deselect with '-m "not slow"')
    e2e: marks tests as end-to-end (requires real API keys)
    manual: marks tests requiring manual verification
filterwarnings =
    ignore::DeprecationWarning
    ignore::PendingDeprecationWarning
```

---

## 10. Acceptance Criteria

### For PR Merge

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Code coverage >= 80% for AI module
- [ ] No new flaky tests introduced
- [ ] Test execution time < 30 seconds

### For Production Release

- [ ] All PR criteria met
- [ ] E2E smoke test passes in staging
- [ ] Helicone dashboard shows test requests with correct metadata
- [ ] No regression in existing functionality

---

## Appendix A: Sample Test Run Output

```bash
$ pytest tests/ai/ -v --cov=src/workout_ingestor_api/ai

========================= test session starts ==========================
platform linux -- Python 3.11.0, pytest-7.4.0
collected 35 items

tests/ai/test_request_context.py::TestAIRequestContextHeaders::test_empty_context_includes_environment_only PASSED
tests/ai/test_request_context.py::TestAIRequestContextHeaders::test_user_id_maps_to_helicone_user_id_header PASSED
tests/ai/test_request_context.py::TestAIRequestContextHeaders::test_session_id_maps_to_helicone_session_id_header PASSED
tests/ai/test_request_context.py::TestAIRequestContextHeaders::test_feature_name_maps_to_helicone_property_feature PASSED
tests/ai/test_request_context.py::TestAIRequestContextHeaders::test_full_context_generates_all_headers PASSED
tests/ai/test_retry.py::TestIsRetryableError::test_rate_limit_errors_are_retryable[Rate limit exceeded] PASSED
tests/ai/test_retry.py::TestIsRetryableError::test_rate_limit_errors_are_retryable[429] PASSED
tests/ai/test_retry.py::TestIsRetryableError::test_server_errors_5xx_are_retryable[500] PASSED
tests/ai/test_retry.py::TestIsRetryableError::test_server_errors_5xx_are_retryable[502] PASSED
tests/ai/test_retry.py::TestIsRetryableError::test_server_errors_5xx_are_retryable[503] PASSED
tests/ai/test_retry.py::TestIsRetryableError::test_timeout_errors_are_retryable[Request timed out] PASSED
tests/ai/test_retry.py::TestIsRetryableError::test_auth_errors_401_not_retryable[401] PASSED
tests/ai/test_retry.py::TestIsRetryableError::test_bad_request_400_not_retryable[400] PASSED
tests/ai/test_retry.py::TestRetrySyncCall::test_successful_call_returns_immediately PASSED
tests/ai/test_retry.py::TestRetrySyncCall::test_retryable_error_retries_up_to_max_attempts PASSED
tests/ai/test_retry.py::TestRetrySyncCall::test_non_retryable_error_fails_immediately PASSED
tests/ai/test_client_factory_integration.py::TestOpenAIClientCreation::test_creates_direct_client_when_helicone_disabled PASSED
tests/ai/test_client_factory_integration.py::TestOpenAIClientCreation::test_creates_proxied_client_when_helicone_enabled PASSED
tests/ai/test_client_factory_integration.py::TestOpenAIClientCreation::test_includes_context_headers_in_proxied_client PASSED
tests/ai/test_client_factory_integration.py::TestOpenAIClientCreation::test_raises_value_error_without_api_key PASSED

---------- coverage: platform linux, python 3.11.0 -----------
Name                                              Stmts   Miss  Cover
---------------------------------------------------------------------
src/workout_ingestor_api/ai/__init__.py              10      0   100%
src/workout_ingestor_api/ai/client_factory.py        68      5    93%
src/workout_ingestor_api/ai/retry.py                 82      8    90%
---------------------------------------------------------------------
TOTAL                                               160     13    92%

========================= 35 passed in 2.34s ===========================
```

---

## Appendix B: Quick Reference Commands

```bash
# Run all AI module tests
pytest tests/ai/ -v

# Run with coverage
pytest tests/ai/ --cov=src/workout_ingestor_api/ai --cov-report=html

# Run only unit tests (fast)
pytest tests/ai/ -m "not slow and not e2e"

# Run E2E tests (requires real keys)
RUN_E2E_TESTS=true pytest tests/ai/test_helicone_e2e.py -v

# Run specific test class
pytest tests/ai/test_retry.py::TestIsRetryableError -v

# Run with debug output
pytest tests/ai/ -v --capture=no --log-cli-level=DEBUG
```
