"""Main entry point for the application - imports from workout_ingestor_api package."""
from workout_ingestor_api.main import app

__all__ = ["app"]

@app.get("/health")
def health():
    """Simple liveness check for workout-ingestor-api."""
    return {"status": "ok"}
