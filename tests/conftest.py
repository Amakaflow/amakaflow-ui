import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Repo root: .../amakaflow-dev/workout-ingestor-api
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

# Make src/ importable so tests can do `import workout_ingestor_api...`
for p in {ROOT, SRC}:
    p_str = str(p)
    if p_str not in sys.path:
        sys.path.insert(0, p_str)

# Import FastAPI app (main.py at repo root)
from main import app  # adjust if your app module is named differently

@pytest.fixture(scope="session")
def api_client() -> TestClient:
    """Shared FastAPI TestClient for workout-ingestor-api."""
    return TestClient(app)
