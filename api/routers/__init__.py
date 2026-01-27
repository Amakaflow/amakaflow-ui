"""
Router package for AmakaFlow Chat API.

Part of AMA-429: Chat API service skeleton

This package contains all API routers organized by domain:
- health: Health check endpoints
"""

from api.routers.health import router as health_router

__all__ = [
    "health_router",
]
