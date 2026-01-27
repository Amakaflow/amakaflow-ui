"""
FastAPI Dependency Providers for AmakaFlow Chat API.

Part of AMA-429: Chat API service skeleton

This module provides FastAPI dependency injection functions that return
interface types (Protocols) rather than concrete implementations.

Architecture:
- Settings and Supabase client are cached per-process (lru_cache)
- Auth providers wrap existing Clerk/JWT logic
- Repositories will be added in later tickets

Usage in routers:
    from api.deps import get_current_user

    @router.get("/chat")
    def chat(user_id: str = Depends(get_current_user)):
        return {"user_id": user_id}

Testing:
    # Override dependencies in tests
    app.dependency_overrides[get_current_user] = lambda: "test-user-123"
"""

from functools import lru_cache
from typing import Optional

from fastapi import Header
from supabase import Client, create_client

from backend.settings import Settings, get_settings as _get_settings

# Auth from existing module (wrap to maintain single source of truth)
from backend.auth import (
    get_current_user as _get_current_user,
    get_optional_user as _get_optional_user,
)


# =============================================================================
# Settings Provider
# =============================================================================


def get_settings() -> Settings:
    """
    Get application settings.

    Returns cached Settings instance from backend.settings.
    Use this as a FastAPI dependency for settings access.

    Returns:
        Settings: Application settings instance
    """
    return _get_settings()


# =============================================================================
# Supabase Client Provider
# =============================================================================


@lru_cache
def get_supabase_client() -> Optional[Client]:
    """
    Get Supabase client instance (cached).

    Creates a Supabase client using credentials from settings.
    Returns None if credentials are not configured.

    Returns:
        Client: Supabase client instance, or None if not configured
    """
    settings = _get_settings()

    if not settings.supabase_url or not settings.supabase_key:
        return None

    return create_client(settings.supabase_url, settings.supabase_key)


def get_supabase_client_required() -> Client:
    """
    Get Supabase client instance, raising if not configured.

    Use this dependency when the endpoint requires database access.
    Raises HTTPException 503 if database is not available.

    Returns:
        Client: Supabase client instance

    Raises:
        HTTPException: 503 if Supabase is not configured
    """
    from fastapi import HTTPException

    client = get_supabase_client()
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Supabase credentials not configured.",
        )
    return client


# =============================================================================
# Authentication Providers
# =============================================================================


async def get_current_user(
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    x_test_auth: Optional[str] = Header(None, alias="X-Test-Auth"),
    x_test_user_id: Optional[str] = Header(None, alias="X-Test-User-Id"),
) -> str:
    """
    Get the current authenticated user ID.

    Wraps backend.auth.get_current_user for dependency injection.
    Supports multiple auth methods:
    - Clerk JWT (RS256 via JWKS)
    - Mobile pairing JWT (HS256)
    - API key authentication
    - E2E test bypass (dev/staging only)

    Returns:
        str: User ID from authentication

    Raises:
        HTTPException: 401 if authentication fails
    """
    return await _get_current_user(
        authorization=authorization,
        x_api_key=x_api_key,
        x_test_auth=x_test_auth,
        x_test_user_id=x_test_user_id,
    )


async def get_optional_user(
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    x_test_auth: Optional[str] = Header(None, alias="X-Test-Auth"),
    x_test_user_id: Optional[str] = Header(None, alias="X-Test-User-Id"),
) -> Optional[str]:
    """
    Get the current user ID if authenticated, None otherwise.

    Wraps backend.auth.get_optional_user for dependency injection.
    Use for endpoints that work differently when authenticated vs anonymous.

    Returns:
        Optional[str]: User ID if authenticated, None otherwise
    """
    return await _get_optional_user(
        authorization=authorization,
        x_api_key=x_api_key,
        x_test_auth=x_test_auth,
        x_test_user_id=x_test_user_id,
    )


# =============================================================================
# AI Client Factory
# =============================================================================


def get_ai_client_factory():
    """
    Get AIClientFactory class for creating AI clients.

    Returns the class itself (all methods are static), which allows
    test overrides via dependency_overrides.

    Usage in routers:
        from api.deps import get_ai_client_factory, get_settings
        from backend.ai import AIRequestContext

        @router.post("/chat")
        def chat(
            settings: Settings = Depends(get_settings),
            factory = Depends(get_ai_client_factory),
        ):
            ctx = AIRequestContext(user_id=user_id, feature_name="chat")
            client = factory.create_anthropic_client(settings, context=ctx)
    """
    from backend.ai import AIClientFactory
    return AIClientFactory


# =============================================================================
# Exports
# =============================================================================

__all__ = [
    # Settings
    "get_settings",
    # Database
    "get_supabase_client",
    "get_supabase_client_required",
    # Authentication
    "get_current_user",
    "get_optional_user",
    # AI
    "get_ai_client_factory",
]
