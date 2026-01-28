import os
import sys
from pathlib import Path
from typing import Generator
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
from api.deps import get_current_user as deps_get_current_user


# ---------------------------------------------------------------------------
# Auth Mock
# ---------------------------------------------------------------------------

TEST_USER_ID = "test-user-123"


async def mock_get_current_user() -> str:
    """Mock auth dependency that returns a test user."""
    return TEST_USER_ID


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
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def client(app) -> Generator[TestClient, None, None]:
    """Per-test FastAPI TestClient (for tests needing fresh state)."""
    app.dependency_overrides[backend_get_current_user] = mock_get_current_user
    app.dependency_overrides[deps_get_current_user] = mock_get_current_user
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
