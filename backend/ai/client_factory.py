"""AI client factory with Helicone integration support.

Adapted from workout-ingestor-api for chat-api (AMA-429).
Uses dependency-injected Settings instead of a global config import.
"""
import logging
from dataclasses import dataclass, field
from typing import Optional

from anthropic import Anthropic
from openai import OpenAI

from backend.settings import Settings

logger = logging.getLogger(__name__)

# Helicone proxy URLs
_HELICONE_OPENAI_BASE_URL = "https://oai.helicone.ai/v1"
_HELICONE_ANTHROPIC_BASE_URL = "https://anthropic.helicone.ai"

DEFAULT_TIMEOUT = 60.0


@dataclass
class AIRequestContext:
    """Context for AI requests, used for tracking and observability."""

    user_id: Optional[str] = None
    session_id: Optional[str] = None
    feature_name: Optional[str] = None
    request_id: Optional[str] = None
    custom_properties: dict[str, str] = field(default_factory=dict)

    def to_tracking_headers(self, environment: str = "development") -> dict[str, str]:
        """Convert context to Helicone tracking headers."""
        headers: dict[str, str] = {}

        if self.user_id:
            headers["Helicone-User-Id"] = self.user_id
        if self.session_id:
            headers["Helicone-Session-Id"] = self.session_id
        if self.feature_name:
            headers["Helicone-Property-Feature"] = self.feature_name
        if self.request_id:
            headers["Helicone-Request-Id"] = self.request_id

        headers["Helicone-Property-Environment"] = environment

        for key, value in self.custom_properties.items():
            header_key = f"Helicone-Property-{key.replace('_', '-').title()}"
            headers[header_key] = str(value)

        return headers


class AIClientFactory:
    """Factory for creating AI clients with optional Helicone integration."""

    @staticmethod
    def create_openai_client(
        settings: Settings,
        context: Optional[AIRequestContext] = None,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> OpenAI:
        """Create an OpenAI client, optionally proxied through Helicone."""
        api_key = settings.openai_api_key
        if not api_key:
            raise ValueError("OPENAI_API_KEY not configured.")

        client_kwargs: dict = {
            "api_key": api_key,
            "timeout": timeout,
        }

        if settings.helicone_enabled and settings.helicone_api_key:
            client_kwargs["base_url"] = _HELICONE_OPENAI_BASE_URL
            default_headers = {
                "Helicone-Auth": f"Bearer {settings.helicone_api_key}",
            }
            if context:
                default_headers.update(context.to_tracking_headers(settings.environment))
            client_kwargs["default_headers"] = default_headers
            logger.debug("Creating OpenAI client with Helicone proxy")
        elif settings.helicone_enabled:
            logger.warning("HELICONE_ENABLED=true but HELICONE_API_KEY not set. Using direct API.")

        return OpenAI(**client_kwargs)

    @staticmethod
    def create_anthropic_client(
        settings: Settings,
        context: Optional[AIRequestContext] = None,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> Anthropic:
        """Create an Anthropic client, optionally proxied through Helicone."""
        api_key = settings.anthropic_api_key
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not configured.")

        client_kwargs: dict = {
            "api_key": api_key,
            "timeout": timeout,
        }

        if settings.helicone_enabled and settings.helicone_api_key:
            client_kwargs["base_url"] = _HELICONE_ANTHROPIC_BASE_URL
            default_headers = {
                "Helicone-Auth": f"Bearer {settings.helicone_api_key}",
            }
            if context:
                default_headers.update(context.to_tracking_headers(settings.environment))
            client_kwargs["default_headers"] = default_headers
            logger.debug("Creating Anthropic client with Helicone proxy")
        elif settings.helicone_enabled:
            logger.warning("HELICONE_ENABLED=true but HELICONE_API_KEY not set. Using direct API.")

        return Anthropic(**client_kwargs)
