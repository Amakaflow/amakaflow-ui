"""Configuration settings for the workout ingestor API."""
import os
from typing import Literal


EnvironmentType = Literal["development", "staging", "production"]


class Settings:
    """Application settings."""

    # Feature flags
    USE_LLM_NORMALIZER: bool = False
    HELICONE_ENABLED: bool = False

    # Environment
    ENVIRONMENT: EnvironmentType = "development"

    # API Keys
    OPENAI_API_KEY: str | None = None
    ANTHROPIC_API_KEY: str | None = None
    HELICONE_API_KEY: str | None = None
    APIFY_API_TOKEN: str | None = None

    # Model configuration
    PARSE_MODEL: str = "gpt-4o-mini"

    def __init__(self):
        # Environment
        env = os.getenv("ENVIRONMENT", "development").lower()
        if env in ("development", "staging", "production"):
            self.ENVIRONMENT = env  # type: ignore
        else:
            self.ENVIRONMENT = "development"

        # Feature flags
        self.USE_LLM_NORMALIZER = os.getenv("USE_LLM_NORMALIZER", "false").lower() == "true"
        self.HELICONE_ENABLED = os.getenv("HELICONE_ENABLED", "false").lower() == "true"

        # API Keys
        self.OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
        self.ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
        self.HELICONE_API_KEY = os.getenv("HELICONE_API_KEY")
        self.APIFY_API_TOKEN = os.getenv("APIFY_API_TOKEN")

        # Model configuration
        self.PARSE_MODEL: str = os.getenv("PARSE_MODEL", "gpt-4o-mini")
        self.ANTHROPIC_PARSE_MODEL: str = os.getenv("ANTHROPIC_PARSE_MODEL", "claude-3-5-sonnet-20241022")


settings = Settings()

