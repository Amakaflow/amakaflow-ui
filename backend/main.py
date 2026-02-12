"""
Application factory for FastAPI.

Part of AMA-429: Chat API service skeleton
Updated in AMA-441: Sentry release tags, SSE support, graceful shutdown
Updated in AMA-506: OpenTelemetry tracing and metrics

This module provides a factory function for creating FastAPI application instances.
The factory pattern allows for:
- Easy testing with custom settings
- Multiple app instances with different configurations
- Clear separation of app creation from route definitions

Usage:
    from backend.main import create_app
    from backend.settings import Settings

    # Default app (uses get_settings())
    app = create_app()

    # Test app with custom settings
    test_settings = Settings(environment="test", _env_file=None)
    test_app = create_app(settings=test_settings)
"""

import asyncio
import logging
import signal
import threading
from typing import Optional

import sentry_sdk
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from backend.settings import Settings, get_settings
from backend.observability import configure_observability, shutdown_observability, ChatMetrics

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# SSE Connection Tracking
# ---------------------------------------------------------------------------

_sse_connection_count = 0
_sse_lock = threading.Lock()


def sse_connect() -> int:
    """Increment SSE connection count. Returns new count."""
    global _sse_connection_count
    with _sse_lock:
        _sse_connection_count += 1
        # Record metric for active SSE connections
        try:
            ChatMetrics.active_sse_connections().add(1)
        except Exception:
            pass  # Don't fail if metrics not initialized
        return _sse_connection_count


def sse_disconnect() -> int:
    """Decrement SSE connection count. Returns new count."""
    global _sse_connection_count
    with _sse_lock:
        _sse_connection_count = max(0, _sse_connection_count - 1)
        # Record metric for active SSE connections
        try:
            ChatMetrics.active_sse_connections().add(-1)
        except Exception:
            pass  # Don't fail if metrics not initialized
        return _sse_connection_count


def get_sse_connection_count() -> int:
    """Get current SSE connection count."""
    return _sse_connection_count


# ---------------------------------------------------------------------------
# Application Factory
# ---------------------------------------------------------------------------


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    """
    Create and configure a FastAPI application instance.

    Args:
        settings: Optional Settings instance. If not provided, uses get_settings()
                  which loads from environment variables.

    Returns:
        Configured FastAPI application instance.
    """
    if settings is None:
        settings = get_settings()

    # Initialize OpenTelemetry observability (AMA-506)
    configure_observability(settings)

    # Initialize Sentry for error tracking
    _init_sentry(settings)

    # Create FastAPI app
    app = FastAPI(
        title="AmakaFlow Chat API",
        description="AI coaching chat and conversation API",
        version="1.0.0",
    )

    # Store settings on app state for middleware access
    app.state.settings = settings

    # Configure middleware
    _configure_cors(app, settings)
    _add_sse_headers_middleware(app)

    # Include API routers
    _include_routers(app)

    # Register lifecycle hooks
    _register_shutdown(app, settings)

    return app


def _init_sentry(settings: Settings) -> None:
    """Initialize Sentry SDK if DSN is configured."""
    if settings.sentry_dsn:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
            release=settings.render_git_commit,
            traces_sample_rate=0.1,
            profiles_sample_rate=0.1,
            enable_tracing=True,
        )
        logger.info(
            "Sentry initialized for chat-api (release=%s)",
            settings.render_git_commit or "unknown",
        )


def _configure_cors(app: FastAPI, settings: Settings) -> None:
    """Configure CORS middleware for the application."""
    origins = settings.allowed_origins_list
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


class SSEHeadersMiddleware(BaseHTTPMiddleware):
    """Add X-Accel-Buffering: no header for SSE endpoints."""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        content_type = response.headers.get("content-type", "")
        if "text/event-stream" in content_type:
            response.headers["X-Accel-Buffering"] = "no"
            response.headers["Cache-Control"] = "no-cache"
        return response


def _add_sse_headers_middleware(app: FastAPI) -> None:
    """Add middleware for SSE header injection."""
    app.add_middleware(SSEHeadersMiddleware)


def _include_routers(app: FastAPI) -> None:
    """Include all API routers in the application."""
    from api.routers import health_router, chat_router, embeddings_router, voice_router, workouts_router, pipelines_router, programs_router

    # Health router (no prefix - /health at root)
    app.include_router(health_router)

    # Chat router (/chat/stream)
    app.include_router(chat_router)

    # Embeddings router (/internal/embeddings/*)
    app.include_router(embeddings_router)

    # Voice router (/voice/*)
    app.include_router(voice_router)

    # Workouts router (/api/workouts/*)
    app.include_router(workouts_router)

    # Pipelines router (/api/pipelines/*)
    app.include_router(pipelines_router)

    # Programs router (/api/programs/*)
    app.include_router(programs_router)


def _register_shutdown(app: FastAPI, settings: Settings) -> None:
    """Register graceful shutdown handler."""

    @app.on_event("shutdown")
    async def shutdown_event():
        count = get_sse_connection_count()
        if count > 0:
            logger.info(
                "Shutting down with %d active SSE connections, "
                "waiting up to 5s for drain...",
                count,
            )
            # Give SSE connections a brief window to close
            for _ in range(10):
                if get_sse_connection_count() == 0:
                    break
                await asyncio.sleep(0.5)
        remaining = get_sse_connection_count()
        if remaining > 0:
            logger.warning(
                "Shutdown proceeding with %d SSE connections still active",
                remaining,
            )

        # Shutdown OpenTelemetry (AMA-506)
        shutdown_observability()

        logger.info("chat-api shutdown complete")

    # Handle SIGTERM for Render graceful shutdown
    def _handle_sigterm(signum, frame):
        logger.info("Received SIGTERM, initiating graceful shutdown")
        raise SystemExit(0)

    signal.signal(signal.SIGTERM, _handle_sigterm)


# Default app instance for uvicorn
# This allows: uvicorn backend.main:app --reload
app = create_app()
