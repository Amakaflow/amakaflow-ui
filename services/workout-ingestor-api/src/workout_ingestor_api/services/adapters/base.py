"""Base classes for platform adapters."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List


class PlatformFetchError(RuntimeError):
    """Raised when a platform adapter fails to fetch media."""


@dataclass
class MediaContent:
    """Normalised media content from any platform."""
    primary_text: str
    secondary_texts: List[str] = field(default_factory=list)
    title: str = ""
    media_metadata: Dict[str, Any] = field(default_factory=dict)


class PlatformAdapter(ABC):
    """Abstract base class for all platform media adapters."""

    @staticmethod
    @abstractmethod
    def platform_name() -> str:
        """Return the canonical platform identifier (e.g. 'instagram')."""
        ...

    @abstractmethod
    def fetch(self, url: str, source_id: str) -> MediaContent:
        """Fetch media content from the platform."""
        ...
