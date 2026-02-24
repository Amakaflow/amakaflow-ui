"""Platform adapter registry for unified workout ingestion."""
from typing import Dict, Optional, Type
from .base import PlatformAdapter, MediaContent, PlatformFetchError

_ADAPTER_REGISTRY: Dict[str, Type[PlatformAdapter]] = {}


def register_adapter(adapter_class: Type[PlatformAdapter]) -> None:
    """Register a platform adapter class.

    Raises:
        ValueError: If an adapter is already registered for this platform.
    """
    name = adapter_class.platform_name()
    if name in _ADAPTER_REGISTRY:
        raise ValueError(f"Adapter already registered for platform '{name}'")
    _ADAPTER_REGISTRY[name] = adapter_class


def get_adapter(platform: str) -> PlatformAdapter:
    """Get an instantiated adapter for the given platform.

    Raises:
        KeyError: If no adapter is registered for the platform.
    """
    cls = _ADAPTER_REGISTRY[platform]
    return cls()


__all__ = [
    "register_adapter",
    "get_adapter",
    "PlatformAdapter",
    "MediaContent",
    "PlatformFetchError",
]

# Auto-load adapters (triggers self-registration)
from . import instagram_adapter  # noqa: F401
from . import youtube_adapter  # noqa: F401
from . import tiktok_adapter  # noqa: F401
from . import pinterest_adapter  # noqa: F401
