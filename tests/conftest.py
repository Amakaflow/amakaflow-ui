import pytest
from fastapi.testclient import TestClient

from app.main import app  # <- this is your FastAPI app


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)