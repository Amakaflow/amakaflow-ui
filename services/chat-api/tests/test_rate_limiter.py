"""Tests for InMemoryRateLimiter."""

import time
from unittest.mock import patch

import pytest

from backend.services.rate_limiter import InMemoryRateLimiter


class TestInMemoryRateLimiter:
    """Tests for sliding window burst rate limiter."""

    def test_allows_up_to_limit(self):
        """Requests up to the limit are all allowed."""
        limiter = InMemoryRateLimiter(max_requests=3, window_seconds=60)
        for _ in range(3):
            result = limiter.check("user-1")
            assert result.allowed is True

    def test_rejects_at_limit_plus_one(self):
        """Request at limit+1 is rejected."""
        limiter = InMemoryRateLimiter(max_requests=3, window_seconds=60)
        for _ in range(3):
            limiter.check("user-1")

        result = limiter.check("user-1")
        assert result.allowed is False

    def test_retry_after_is_positive(self):
        """Rejected request has a positive retry_after value."""
        limiter = InMemoryRateLimiter(max_requests=2, window_seconds=60)
        limiter.check("user-1")
        limiter.check("user-1")

        result = limiter.check("user-1")
        assert result.allowed is False
        assert result.retry_after is not None
        assert result.retry_after > 0
        assert result.retry_after <= 60

    def test_allows_after_window_expires(self):
        """Requests are allowed again after the window expires."""
        limiter = InMemoryRateLimiter(max_requests=2, window_seconds=1)
        limiter.check("user-1")
        limiter.check("user-1")

        # Should be rejected now
        result = limiter.check("user-1")
        assert result.allowed is False

        # Wait for window to expire
        time.sleep(1.1)

        result = limiter.check("user-1")
        assert result.allowed is True

    def test_key_isolation(self):
        """Different keys have independent limits."""
        limiter = InMemoryRateLimiter(max_requests=1, window_seconds=60)
        result1 = limiter.check("user-1")
        assert result1.allowed is True

        result2 = limiter.check("user-2")
        assert result2.allowed is True

        # user-1 is now at limit
        result3 = limiter.check("user-1")
        assert result3.allowed is False

        # user-2 is also at limit
        result4 = limiter.check("user-2")
        assert result4.allowed is False
