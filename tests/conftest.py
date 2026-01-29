import os
import sys
from pathlib import Path
from typing import Dict, Generator, List
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

# Set test environment variables BEFORE importing backend modules.
# backend/auth.py reads os.getenv() at module import time, so these
# must be set before any backend imports occur.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-supabase-key")

# Ensure chat-api root is on sys.path so `import backend` and `import api` work
ROOT = Path(__file__).resolve().parents[1]
root_str = str(ROOT)
if root_str not in sys.path:
    sys.path.insert(0, root_str)

from backend.main import create_app
from backend.settings import Settings
from backend.auth import get_current_user as backend_get_current_user
from api.deps import get_current_user as deps_get_current_user, get_auth_context, AuthContext


# ---------------------------------------------------------------------------
# Auth Mock
# ---------------------------------------------------------------------------

TEST_USER_ID = "test-user-123"


async def mock_get_current_user() -> str:
    """Mock auth dependency that returns a test user."""
    return TEST_USER_ID


async def mock_get_auth_context() -> AuthContext:
    """Mock auth context dependency that returns test user with token."""
    return AuthContext(user_id=TEST_USER_ID, auth_token="Bearer test-token")


# ---------------------------------------------------------------------------
# Mock Environment Variables
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def mock_env_vars(monkeypatch):
    """Reinforce test environment variables for each test function."""
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("SUPABASE_URL", "https://test.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-supabase-key")


# ---------------------------------------------------------------------------
# App & Client Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def test_settings() -> Settings:
    """Test settings with minimal configuration."""
    return Settings(
        environment="test",
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="test-key",
        _env_file=None,
    )


@pytest.fixture(scope="session")
def app(test_settings):
    """Create test application instance."""
    return create_app(settings=test_settings)


@pytest.fixture(scope="session")
def api_client(app) -> Generator[TestClient, None, None]:
    """Shared FastAPI TestClient for chat-api endpoints."""
    app.dependency_overrides[backend_get_current_user] = mock_get_current_user
    app.dependency_overrides[deps_get_current_user] = mock_get_current_user
    app.dependency_overrides[get_auth_context] = mock_get_auth_context
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def client(app) -> Generator[TestClient, None, None]:
    """Per-test FastAPI TestClient (for tests needing fresh state)."""
    app.dependency_overrides[backend_get_current_user] = mock_get_current_user
    app.dependency_overrides[deps_get_current_user] = mock_get_current_user
    app.dependency_overrides[get_auth_context] = mock_get_auth_context
    yield TestClient(app)
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Mock Repository Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_embedding_repo():
    """Mock embedding repository."""
    repo = MagicMock()
    repo.get_workouts_without_embeddings.return_value = []
    repo.get_progress.return_value = {"total": 0, "embedded": 0, "remaining": 0}
    return repo


@pytest.fixture
def mock_session_repo():
    """Mock chat session repository."""
    repo = MagicMock()
    repo.create.return_value = {"id": "sess-test", "title": "New Chat"}
    repo.get.return_value = {"id": "sess-test", "title": "Test"}
    repo.list_for_user.return_value = []
    return repo


@pytest.fixture
def mock_message_repo():
    """Mock chat message repository."""
    repo = MagicMock()
    repo.create.return_value = {"id": "msg-test"}
    repo.list_for_session.return_value = []
    return repo


@pytest.fixture
def mock_rate_limit_repo():
    """Mock rate limit repository."""
    repo = MagicMock()
    repo.get_monthly_usage.return_value = 0
    return repo


# ---------------------------------------------------------------------------
# Mock Service Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_embedding_service():
    """Mock embedding service."""
    return MagicMock()


@pytest.fixture
def mock_ai_client():
    """Mock AI client."""
    from backend.services.ai_client import StreamEvent
    client = MagicMock()
    client.stream_chat.return_value = iter([
        StreamEvent(event="content_delta", data={"text": "Test response"}),
        StreamEvent(event="message_end", data={
            "model": "claude-sonnet-4-20250514",
            "input_tokens": 10,
            "output_tokens": 5,
            "latency_ms": 500,
        }),
    ])
    return client


@pytest.fixture
def mock_function_dispatcher():
    """Mock function dispatcher for tool execution."""
    from backend.services.function_dispatcher import FunctionDispatcher
    dispatcher = MagicMock(spec=FunctionDispatcher)
    dispatcher.execute.return_value = "Mock result"
    return dispatcher


# ---------------------------------------------------------------------------
# Fake Services for E2E Tests
# ---------------------------------------------------------------------------


class FakeFunctionRateLimitRepository:
    """In-memory fake for function rate limit repository.

    Tracks call counts per user/function for testing rate limit behavior.
    """

    def __init__(self):
        self._counts: Dict[str, int] = {}

    def _key(self, user_id: str, function_name: str) -> str:
        return f"{user_id}:{function_name}"

    def check_and_increment(
        self, user_id: str, function_name: str, limit: int, window_hours: int = 1
    ) -> tuple:
        """Check rate limit and increment counter."""
        key = self._key(user_id, function_name)
        current = self._counts.get(key, 0)

        if current >= limit:
            return (False, current, limit)

        self._counts[key] = current + 1
        return (True, current + 1, limit)

    def get_remaining(
        self, user_id: str, function_name: str, limit: int, window_hours: int = 1
    ) -> int:
        """Get remaining calls in window."""
        key = self._key(user_id, function_name)
        current = self._counts.get(key, 0)
        return max(0, limit - current)

    def reset(self):
        """Reset all counters (for test isolation)."""
        self._counts.clear()

    def set_count(self, user_id: str, function_name: str, count: int):
        """Set a specific count (for test setup)."""
        key = self._key(user_id, function_name)
        self._counts[key] = count


class FakeFeatureFlagService:
    """In-memory fake for feature flag service.

    Allows tests to control which features are enabled.
    """

    def __init__(self):
        self._enabled_functions: Dict[str, List[str]] = {}
        self._chat_enabled: Dict[str, bool] = {}
        self._default_enabled = True

    def is_function_enabled(self, user_id: str, function_name: str) -> bool:
        """Check if function is enabled for user."""
        if user_id in self._enabled_functions:
            return function_name in self._enabled_functions[user_id]
        return self._default_enabled

    def is_chat_enabled(self, user_id: str) -> bool:
        """Check if chat is enabled for user."""
        return self._chat_enabled.get(user_id, True)

    def get_rate_limit_for_user(self, user_id: str) -> int:
        """Get monthly rate limit for user."""
        return 50  # Default free tier

    def set_function_enabled(self, user_id: str, function_name: str, enabled: bool):
        """Configure function enablement for test setup."""
        if user_id not in self._enabled_functions:
            self._enabled_functions[user_id] = []
        if enabled and function_name not in self._enabled_functions[user_id]:
            self._enabled_functions[user_id].append(function_name)
        elif not enabled and function_name in self._enabled_functions[user_id]:
            self._enabled_functions[user_id].remove(function_name)

    def set_chat_enabled(self, user_id: str, enabled: bool):
        """Configure chat enablement for test setup."""
        self._chat_enabled[user_id] = enabled

    def disable_all_for_user(self, user_id: str):
        """Disable all functions for a user."""
        self._enabled_functions[user_id] = []

    def enable_all_for_user(self, user_id: str):
        """Remove user-specific restrictions (use defaults)."""
        if user_id in self._enabled_functions:
            del self._enabled_functions[user_id]


@pytest.fixture
def fake_rate_limit_repo():
    """Provide fake rate limit repository for E2E tests."""
    return FakeFunctionRateLimitRepository()


@pytest.fixture
def fake_feature_flag_service():
    """Provide fake feature flag service for E2E tests."""
    return FakeFeatureFlagService()
