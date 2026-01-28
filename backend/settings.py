"""
Centralized settings configuration using Pydantic BaseSettings.

Part of AMA-429: Chat API service skeleton

All environment variables are defined here with types, defaults, and validation.
Use get_settings() for dependency injection compatibility in FastAPI.

Usage:
    from backend.settings import get_settings, Settings

    # In FastAPI endpoints (dependency injection)
    @app.get("/")
    def read_root(settings: Settings = Depends(get_settings)):
        return {"environment": settings.environment}

    # Direct access (module-level)
    settings = get_settings()
    print(settings.supabase_url)
"""

from functools import lru_cache
from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # -------------------------------------------------------------------------
    # Core Environment
    # -------------------------------------------------------------------------
    environment: str = Field(
        default="development",
        description="Runtime environment: development, staging, production",
    )

    # -------------------------------------------------------------------------
    # Supabase Database
    # -------------------------------------------------------------------------
    supabase_url: Optional[str] = Field(
        default=None,
        description="Supabase project URL",
    )
    supabase_service_role_key: Optional[str] = Field(
        default=None,
        description="Supabase service role key (full access)",
    )

    @property
    def supabase_key(self) -> Optional[str]:
        """Get the Supabase key.

        Note: Unlike mapper-api, chat-api does not fall back to supabase_anon_key.
        Chat operations require service role access for cross-user data queries.
        """
        return self.supabase_service_role_key

    # -------------------------------------------------------------------------
    # Authentication - Clerk
    # -------------------------------------------------------------------------
    clerk_domain: str = Field(
        default="",
        description="Clerk domain for JWT validation",
    )

    # -------------------------------------------------------------------------
    # AI Services
    # -------------------------------------------------------------------------
    anthropic_api_key: Optional[str] = Field(
        default=None,
        description="Anthropic API key for Claude",
    )
    openai_api_key: Optional[str] = Field(
        default=None,
        description="OpenAI API key for GPT-4o-mini routing",
    )

    # -------------------------------------------------------------------------
    # Helicone Observability
    # -------------------------------------------------------------------------
    helicone_api_key: Optional[str] = Field(
        default=None,
        description="Helicone API key for LLM observability",
    )
    helicone_enabled: bool = Field(
        default=False,
        description="Enable Helicone LLM request logging",
    )

    # -------------------------------------------------------------------------
    # CORS
    # -------------------------------------------------------------------------
    allowed_origins: List[str] = Field(
        default_factory=list,
        description="Allowed CORS origins. If empty, defaults to localhost:3000/3001.",
    )

    # -------------------------------------------------------------------------
    # Observability - Sentry
    # -------------------------------------------------------------------------
    sentry_dsn: Optional[str] = Field(
        default=None,
        description="Sentry DSN for error tracking",
    )

    # -------------------------------------------------------------------------
    # Rate Limits
    # -------------------------------------------------------------------------
    rate_limit_free: int = Field(
        default=50,
        description="Monthly message limit for free tier users",
    )
    rate_limit_paid: int = Field(
        default=500,
        description="Monthly message limit for paid tier users",
    )

    # -------------------------------------------------------------------------
    # Internal API
    # -------------------------------------------------------------------------
    internal_api_key: Optional[str] = Field(
        default=None,
        description="Shared secret for internal service-to-service calls",
    )

    # -------------------------------------------------------------------------
    # Embeddings
    # -------------------------------------------------------------------------
    embedding_batch_size: int = Field(
        default=100,
        description="Number of workouts to embed per batch",
    )
    embedding_rate_limit_rpm: int = Field(
        default=3000,
        description="OpenAI embedding API rate limit (requests per minute)",
    )

    # -------------------------------------------------------------------------
    # AI Model Defaults
    # -------------------------------------------------------------------------
    default_model: str = Field(
        default="claude-sonnet-4-20250514",
        description="Default Anthropic model for chat completions",
    )

    # -------------------------------------------------------------------------
    # Validators
    # -------------------------------------------------------------------------
    @field_validator("environment")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        """Ensure environment is a valid value."""
        valid_environments = {"development", "staging", "production", "test"}
        if v.lower() not in valid_environments:
            raise ValueError(
                f"Invalid environment '{v}'. Must be one of: {valid_environments}"
            )
        return v.lower()

    # -------------------------------------------------------------------------
    # Helper Properties
    # -------------------------------------------------------------------------
    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.environment == "production"

    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.environment == "development"

    @property
    def is_test(self) -> bool:
        """Check if running in test environment."""
        return self.environment == "test"


@lru_cache
def get_settings() -> Settings:
    """
    Get cached settings instance.

    Uses lru_cache to ensure settings are only loaded once.
    For testing, you can clear the cache with get_settings.cache_clear().

    Returns:
        Settings: Application settings instance
    """
    return Settings()
