import pytest
from unittest.mock import MagicMock, patch
from contextlib import contextmanager
from fastapi.testclient import TestClient

from app.main import app  # <- this is your FastAPI app
from app.auth import get_current_user


# Test user ID for mocked authentication
TEST_USER_ID = "test-user-123"


async def mock_get_current_user() -> str:
    """Mock auth dependency that returns a test user."""
    return TEST_USER_ID


@contextmanager
def mock_db_connection():
    """Mock database connection that returns empty results."""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = []
    mock_cursor.fetchone.return_value = None
    mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    yield mock_conn


@pytest.fixture(scope="session")
def client() -> TestClient:
    # Override auth dependency for all tests
    app.dependency_overrides[get_current_user] = mock_get_current_user

    with patch("app.db.get_db_connection", mock_db_connection):
        with patch("app.routes.calendar.get_db_connection", mock_db_connection):
            yield TestClient(app)

    # Clean up
    app.dependency_overrides.clear()