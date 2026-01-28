"""
Health check router.

Part of AMA-429: Chat API service skeleton
Updated in AMA-441: Add readiness probe and Sentry exclusion

This router provides health check endpoints for monitoring and load balancers.
"""

import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from backend.settings import Settings, get_settings

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["Health"],
)


@router.get("/health")
def health():
    """
    Simple liveness endpoint for chat-api.

    Returns:
        dict: Status indicator for health checks
    """
    return {"status": "ok", "service": "chat-api"}


@router.get("/health/ready")
async def health_ready(settings: Settings = Depends(get_settings)):
    """
    Readiness probe that checks downstream dependencies.

    Verifies Supabase connectivity. Returns 503 if any dependency is unavailable.
    """
    checks = {}

    # Check Supabase connectivity
    try:
        if settings.supabase_url and settings.supabase_service_role_key:
            from supabase import create_client

            client = create_client(
                settings.supabase_url, settings.supabase_service_role_key
            )
            # Lightweight query to verify connectivity
            client.table("profiles").select("id").limit(1).execute()
            checks["supabase"] = "ok"
        else:
            checks["supabase"] = "not_configured"
    except Exception as e:
        logger.warning("Readiness check failed for supabase: %s", e)
        checks["supabase"] = "unavailable"
        return JSONResponse(
            status_code=503,
            content={
                "status": "not_ready",
                "service": "chat-api",
                "checks": checks,
            },
        )

    return {"status": "ready", "service": "chat-api", "checks": checks}
