"""Shared fixtures for AI module tests."""
import os
import subprocess
import sys
from unittest.mock import MagicMock, patch

import pytest


# =============================================================================
# Environment Isolation Fixtures (fixes module reloading anti-pattern)
# =============================================================================


@pytest.fixture
def isolated_env_runner():
    """
    Run code in isolated subprocess with custom environment.

    This avoids the module reloading anti-pattern by running each test
    in a fresh Python interpreter with the desired environment variables.
    """

    def run_with_env(code: str, env_overrides: dict) -> subprocess.CompletedProcess:
        env = {**os.environ, **env_overrides}
        result = subprocess.run(
            [sys.executable, "-c", code],
            env=env,
            capture_output=True,
            text=True,
            timeout=60,
        )
        return result

    return run_with_env


@pytest.fixture
def helicone_enabled_env():
    """Environment variables for Helicone-enabled tests."""
    return {
        "HELICONE_ENABLED": "true",
        "ENVIRONMENT": "test",
    }


@pytest.fixture
def helicone_disabled_env():
    """Environment variables for Helicone-disabled tests."""
    return {
        "HELICONE_ENABLED": "false",
        "ENVIRONMENT": "test",
    }


# =============================================================================
# Mock Settings Fixtures
# =============================================================================


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


# =============================================================================
# E2E Test Fixtures
# =============================================================================


@pytest.fixture
def real_anthropic_key():
    """Verify real Anthropic API key is available for E2E tests."""
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key or key.startswith("test"):
        pytest.skip("Real ANTHROPIC_API_KEY required for Anthropic E2E tests")
    return key
