"""
FastAPI Dependency Providers for AmakaFlow Chat API.

This module provides FastAPI dependency injection functions that return
interface types (Protocols) rather than concrete implementations.

Architecture:
- Settings and Supabase client are cached per-process (lru_cache)
- Auth providers wrap existing Clerk/JWT logic
- Repositories are instantiated per-request with shared Supabase client
- Services and use cases are wired through dependency chains
"""

from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

from fastapi import Depends, Header
from supabase import Client, create_client

from backend.settings import Settings, get_settings as _get_settings
from backend.services.function_dispatcher import FunctionDispatcher
from backend.services.feature_flag_service import FeatureFlagService

# Auth from existing module (wrap to maintain single source of truth)
from backend.auth import (
    get_current_user as _get_current_user,
    get_optional_user as _get_optional_user,
)

# Repositories
from infrastructure.db.embedding_repository import SupabaseEmbeddingRepository
from infrastructure.db.chat_session_repository import SupabaseChatSessionRepository
from infrastructure.db.chat_message_repository import SupabaseChatMessageRepository
from infrastructure.db.rate_limit_repository import SupabaseRateLimitRepository
from infrastructure.db.function_rate_limit_repository import SupabaseFunctionRateLimitRepository

# Services
from backend.services.embedding_service import EmbeddingService
from backend.services.ai_client import AIClient

# Use cases
from application.use_cases.generate_embeddings import GenerateEmbeddingsUseCase
from application.use_cases.stream_chat import StreamChatUseCase


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


@dataclass
class AuthContext:
    """Auth info for request, including token for forwarding to external services."""

    user_id: str
    auth_token: Optional[str] = None


async def get_auth_context(
    authorization: Optional[str] = Header(None),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    x_test_auth: Optional[str] = Header(None, alias="X-Test-Auth"),
    x_test_user_id: Optional[str] = Header(None, alias="X-Test-User-Id"),
) -> AuthContext:
    """
    Get auth context with user ID and token for external service calls.

    Returns:
        AuthContext: Contains user_id and auth_token for forwarding.

    Raises:
        HTTPException: 401 if authentication fails.
    """
    user_id = await _get_current_user(
        authorization=authorization,
        x_api_key=x_api_key,
        x_test_auth=x_test_auth,
        x_test_user_id=x_test_user_id,
    )
    return AuthContext(user_id=user_id, auth_token=authorization)


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
# Repository Providers
# =============================================================================


def get_embedding_repository(
    client: Client = Depends(get_supabase_client_required),
) -> SupabaseEmbeddingRepository:
    """Get embedding repository instance."""
    return SupabaseEmbeddingRepository(client)


def get_chat_session_repository(
    client: Client = Depends(get_supabase_client_required),
) -> SupabaseChatSessionRepository:
    """Get chat session repository instance."""
    return SupabaseChatSessionRepository(client)


def get_chat_message_repository(
    client: Client = Depends(get_supabase_client_required),
) -> SupabaseChatMessageRepository:
    """Get chat message repository instance."""
    return SupabaseChatMessageRepository(client)


def get_rate_limit_repository(
    client: Client = Depends(get_supabase_client_required),
) -> SupabaseRateLimitRepository:
    """Get rate limit repository instance."""
    return SupabaseRateLimitRepository(client)


def get_function_rate_limit_repository(
    client: Client = Depends(get_supabase_client_required),
) -> SupabaseFunctionRateLimitRepository:
    """Get function rate limit repository instance."""
    return SupabaseFunctionRateLimitRepository(client)


# =============================================================================
# Service Providers
# =============================================================================


@lru_cache
def get_embedding_service() -> EmbeddingService:
    """Get cached embedding service instance."""
    settings = _get_settings()
    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY not configured")
    return EmbeddingService(api_key=settings.openai_api_key)


@lru_cache
def get_ai_client() -> AIClient:
    """Get cached AI client instance."""
    settings = _get_settings()
    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY not configured")
    return AIClient(
        api_key=settings.anthropic_api_key,
        helicone_api_key=settings.helicone_api_key,
        helicone_enabled=settings.helicone_enabled,
        default_model=settings.default_model,
    )


def get_feature_flag_service(
    client: Client = Depends(get_supabase_client_required),
) -> FeatureFlagService:
    """Get feature flag service instance."""
    return FeatureFlagService(client)


def get_function_dispatcher(
    function_rate_limit_repo: SupabaseFunctionRateLimitRepository = Depends(
        get_function_rate_limit_repository
    ),
    feature_flags: FeatureFlagService = Depends(get_feature_flag_service),
    settings: Settings = Depends(get_settings),
) -> FunctionDispatcher:
    """Get function dispatcher for tool execution with rate limiting and feature flags."""
    return FunctionDispatcher(
        mapper_api_url=settings.mapper_api_url,
        calendar_api_url=settings.calendar_api_url,
        ingestor_api_url=settings.workout_ingestor_api_url,
        timeout=settings.function_timeout_seconds,
        strava_sync_api_url=settings.strava_sync_api_url,
        garmin_sync_api_url=settings.garmin_sync_api_url,
        function_rate_limit_repo=function_rate_limit_repo,
        feature_flag_service=feature_flags,
        sync_rate_limit_per_hour=settings.sync_rate_limit_per_hour,
    )


# =============================================================================
# Use Case Providers
# =============================================================================


def get_generate_embeddings_use_case(
    repo: SupabaseEmbeddingRepository = Depends(get_embedding_repository),
    service: EmbeddingService = Depends(get_embedding_service),
    settings: Settings = Depends(get_settings),
) -> GenerateEmbeddingsUseCase:
    """Get embedding generation use case."""
    return GenerateEmbeddingsUseCase(
        repository=repo,
        embedding_service=service,
        batch_size=settings.embedding_batch_size,
    )


def get_stream_chat_use_case(
    session_repo: SupabaseChatSessionRepository = Depends(get_chat_session_repository),
    message_repo: SupabaseChatMessageRepository = Depends(get_chat_message_repository),
    rate_limit_repo: SupabaseRateLimitRepository = Depends(get_rate_limit_repository),
    ai_client: AIClient = Depends(get_ai_client),
    dispatcher: FunctionDispatcher = Depends(get_function_dispatcher),
    feature_flags: FeatureFlagService = Depends(get_feature_flag_service),
    settings: Settings = Depends(get_settings),
) -> StreamChatUseCase:
    """Get stream chat use case."""
    return StreamChatUseCase(
        session_repo=session_repo,
        message_repo=message_repo,
        rate_limit_repo=rate_limit_repo,
        ai_client=ai_client,
        function_dispatcher=dispatcher,
        feature_flag_service=feature_flags,
        monthly_limit=settings.rate_limit_free,
    )


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
    "AuthContext",
    "get_auth_context",
    "get_current_user",
    "get_optional_user",
    # AI
    "get_ai_client_factory",
    # Repositories
    "get_embedding_repository",
    "get_chat_session_repository",
    "get_chat_message_repository",
    "get_rate_limit_repository",
    "get_function_rate_limit_repository",
    # Services
    "get_embedding_service",
    "get_ai_client",
    "get_function_dispatcher",
    "get_feature_flag_service",
    # Use Cases
    "get_generate_embeddings_use_case",
    "get_stream_chat_use_case",
]
