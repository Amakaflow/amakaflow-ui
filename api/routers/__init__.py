"""
Router package for AmakaFlow Chat API.

This package contains all API routers organized by domain:
- health: Health check endpoints
- chat: SSE streaming chat endpoints (AMA-439)
- embeddings: Internal embedding generation endpoints (AMA-431)
- voice: TTS synthesis and settings endpoints (AMA-442)
"""

from api.routers.health import router as health_router
from api.routers.chat import router as chat_router
from api.routers.embeddings import router as embeddings_router
from api.routers.voice import router as voice_router
from api.routers.workouts import router as workouts_router
from api.routers.pipelines import router as pipelines_router

__all__ = [
    "health_router",
    "chat_router",
    "embeddings_router",
    "voice_router",
    "workouts_router",
    "pipelines_router",
]
