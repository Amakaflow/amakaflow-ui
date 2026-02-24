# AMA-599: Reduced to minimal re-export file
# All @app.* decorators have been removed - endpoints are now in api/routers/
from backend.main import app

__all__ = ["app"]
