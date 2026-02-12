"""In-memory preview store with TTL for generate→preview→save checkpoint.

Stores generated workout previews keyed by preview_id with automatic
TTL eviction. Ephemeral — same-session use only.
"""

import threading
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass
class _Entry:
    data: Dict[str, Any]
    user_id: str
    expires_at: float


class PreviewStore:
    """Thread-safe in-memory store for workout previews with TTL."""

    def __init__(self, ttl_seconds: int = 900):  # 15 minutes default
        self._ttl = ttl_seconds
        self._store: Dict[str, _Entry] = {}
        self._lock = threading.Lock()

    def put(self, preview_id: str, user_id: str, data: Dict[str, Any]) -> None:
        """Store a preview. Overwrites if key already exists."""
        with self._lock:
            self._evict_expired()
            self._store[preview_id] = _Entry(
                data=data,
                user_id=user_id,
                expires_at=time.monotonic() + self._ttl,
            )

    def get(self, preview_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a preview without consuming it. Returns None if missing/expired/wrong user."""
        with self._lock:
            entry = self._store.get(preview_id)
            if entry is None:
                return None
            if entry.user_id != user_id:
                return None
            if time.monotonic() > entry.expires_at:
                del self._store[preview_id]
                return None
            return entry.data

    def pop(self, preview_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve and consume a preview. Returns None if missing/expired/wrong user."""
        with self._lock:
            entry = self._store.get(preview_id)
            if entry is None:
                return None
            if entry.user_id != user_id:
                return None
            if time.monotonic() > entry.expires_at:
                del self._store[preview_id]
                return None
            del self._store[preview_id]
            return entry.data

    def _evict_expired(self) -> None:
        """Remove expired entries. Must be called with lock held."""
        now = time.monotonic()
        expired = [k for k, v in self._store.items() if now > v.expires_at]
        for k in expired:
            del self._store[k]
