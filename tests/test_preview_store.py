"""Tests for PreviewStore."""

import time

from backend.services.preview_store import PreviewStore


class TestPreviewStore:
    """Tests for in-memory preview store with TTL."""

    def test_put_and_get(self):
        """put + get returns the stored data."""
        store = PreviewStore(ttl_seconds=60)
        store.put("p1", "user-1", {"name": "Leg Day"})

        result = store.get("p1", "user-1")
        assert result == {"name": "Leg Day"}

    def test_ttl_expiry(self):
        """Expired entries return None on get."""
        store = PreviewStore(ttl_seconds=1)
        store.put("p1", "user-1", {"name": "Test"})

        time.sleep(1.1)

        result = store.get("p1", "user-1")
        assert result is None

    def test_pop_consumes(self):
        """pop returns data and removes the entry."""
        store = PreviewStore(ttl_seconds=60)
        store.put("p1", "user-1", {"name": "HIIT"})

        result = store.pop("p1", "user-1")
        assert result == {"name": "HIIT"}

        # Second pop should return None
        result2 = store.pop("p1", "user-1")
        assert result2 is None

        # get also returns None
        result3 = store.get("p1", "user-1")
        assert result3 is None

    def test_user_isolation(self):
        """A different user cannot access another user's preview."""
        store = PreviewStore(ttl_seconds=60)
        store.put("p1", "user-1", {"name": "Private"})

        result = store.get("p1", "user-2")
        assert result is None

        result2 = store.pop("p1", "user-2")
        assert result2 is None

    def test_missing_key_returns_none(self):
        """Getting a non-existent key returns None."""
        store = PreviewStore(ttl_seconds=60)

        assert store.get("nonexistent", "user-1") is None
        assert store.pop("nonexistent", "user-1") is None
