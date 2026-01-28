"""
Router package for AmakaFlow Chat API.

This package contains all API routers organized by domain:
- health: Health check endpoints
- chat: SSE streaming chat endpoints (AMA-439)
- embeddings: Internal embedding generation endpoints (AMA-431)
"""

from api.routers.health import router as health_router
from api.routers.chat import router as chat_router
from api.routers.embeddings import router as embeddings_router

__all__ = [
    "health_router",
    "chat_router",
    "embeddings_router",
]
