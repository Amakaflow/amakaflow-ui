"""In-memory sliding window rate limiter for pipeline burst protection.

Uses a deque of timestamps per key with a configurable window.
Thread-safe via threading.Lock. Ephemeral — state is lost on redeploy,
which is acceptable because the durable monthly DB limits remain as a safety net.
"""

import threading
import time
from collections import deque
from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class RateLimitResult:
    """Result of a rate limit check."""

    allowed: bool
    retry_after: Optional[float] = None  # seconds until next allowed request


class InMemoryRateLimiter:
    """Sliding window rate limiter backed by in-memory deques."""

    _SWEEP_INTERVAL = 100  # sweep stale buckets every N checks

    def __init__(self, max_requests: int, window_seconds: int):
        self._max_requests = max_requests
        self._window_seconds = window_seconds
        self._buckets: Dict[str, deque] = {}
        self._lock = threading.Lock()
        self._check_count = 0

    def check(self, key: str) -> RateLimitResult:
        """Check and record a request. Returns whether it's allowed."""
        now = time.monotonic()
        cutoff = now - self._window_seconds

        with self._lock:
            bucket = self._buckets.get(key)
            if bucket is None:
                bucket = deque()
                self._buckets[key] = bucket

            # Evict expired timestamps
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            # Periodic sweep of stale buckets from other keys
            self._check_count += 1
            if self._check_count % self._SWEEP_INTERVAL == 0:
                self._sweep_stale(cutoff)

            if len(bucket) < self._max_requests:
                bucket.append(now)
                return RateLimitResult(allowed=True)

            # Rejected — compute retry_after from oldest entry in window
            oldest = bucket[0]
            retry_after = oldest + self._window_seconds - now
            return RateLimitResult(allowed=False, retry_after=max(0.0, retry_after))

    def _sweep_stale(self, cutoff: float) -> None:
        """Remove buckets with no timestamps in the current window. Must hold _lock."""
        stale_keys: List[str] = []
        for k, b in self._buckets.items():
            # Evict expired from this bucket too
            while b and b[0] <= cutoff:
                b.popleft()
            if not b:
                stale_keys.append(k)
        for k in stale_keys:
            del self._buckets[k]
