"""Tests for PipelineConcurrencyLimiter.

Verifies per-user concurrency limiting, slot acquisition/release,
and the async context manager wrapper.

Part of AMA-567 Phase E: Program pipeline (batched generation)
"""

import pytest

from backend.services.pipeline_concurrency import (
    PipelineConcurrencyExceeded,
    PipelineConcurrencyLimiter,
)


class TestAcquireRelease:
    """Test raw acquire/release slot management."""

    @pytest.mark.asyncio
    async def test_acquire_first_slot_succeeds(self):
        limiter = PipelineConcurrencyLimiter(max_per_user=2)
        result = await limiter.acquire("user-1", "run-1")
        assert result is True
        assert limiter.user_active_count("user-1") == 1

    @pytest.mark.asyncio
    async def test_acquire_up_to_limit_succeeds(self):
        limiter = PipelineConcurrencyLimiter(max_per_user=2)
        assert await limiter.acquire("user-1", "run-1") is True
        assert await limiter.acquire("user-1", "run-2") is True
        assert limiter.user_active_count("user-1") == 2
        assert limiter.active_count == 2

    @pytest.mark.asyncio
    async def test_acquire_beyond_limit_fails(self):
        limiter = PipelineConcurrencyLimiter(max_per_user=2)
        await limiter.acquire("user-1", "run-1")
        await limiter.acquire("user-1", "run-2")
        result = await limiter.acquire("user-1", "run-3")
        assert result is False
        assert limiter.user_active_count("user-1") == 2

    @pytest.mark.asyncio
    async def test_release_frees_slot(self):
        limiter = PipelineConcurrencyLimiter(max_per_user=2)
        await limiter.acquire("user-1", "run-1")
        await limiter.acquire("user-1", "run-2")
        await limiter.release("user-1", "run-1")

        assert limiter.user_active_count("user-1") == 1
        # Now we can acquire a third
        result = await limiter.acquire("user-1", "run-3")
        assert result is True

    @pytest.mark.asyncio
    async def test_release_nonexistent_is_safe(self):
        limiter = PipelineConcurrencyLimiter(max_per_user=2)
        # Release for user that never acquired — should not raise
        await limiter.release("user-999", "run-999")
        assert limiter.active_count == 0

    @pytest.mark.asyncio
    async def test_release_cleans_up_empty_user(self):
        limiter = PipelineConcurrencyLimiter(max_per_user=2)
        await limiter.acquire("user-1", "run-1")
        await limiter.release("user-1", "run-1")

        # Internal dict should be cleaned up (no empty sets lingering)
        assert limiter.user_active_count("user-1") == 0
        assert limiter.active_count == 0
        # Verify the user key itself was removed from _active
        assert "user-1" not in limiter._active

    @pytest.mark.asyncio
    async def test_multi_user_isolation(self):
        limiter = PipelineConcurrencyLimiter(max_per_user=1)

        assert await limiter.acquire("user-1", "run-a") is True
        assert await limiter.acquire("user-2", "run-b") is True

        # user-1 is at limit
        assert await limiter.acquire("user-1", "run-c") is False
        # user-2 is at limit
        assert await limiter.acquire("user-2", "run-d") is False

        assert limiter.active_count == 2
        assert limiter.user_active_count("user-1") == 1
        assert limiter.user_active_count("user-2") == 1


class TestLimitContextManager:
    """Test the async context manager (limit)."""

    @pytest.mark.asyncio
    async def test_limit_context_manager_acquires_and_releases(self):
        limiter = PipelineConcurrencyLimiter(max_per_user=2)

        async with limiter.limit("user-1", "run-1"):
            assert limiter.user_active_count("user-1") == 1

        # After exiting context, slot is released
        assert limiter.user_active_count("user-1") == 0

    @pytest.mark.asyncio
    async def test_limit_raises_when_exceeded(self):
        limiter = PipelineConcurrencyLimiter(max_per_user=1)
        await limiter.acquire("user-1", "run-1")

        with pytest.raises(PipelineConcurrencyExceeded, match="Too many active pipelines"):
            async with limiter.limit("user-1", "run-2"):
                pass  # pragma: no cover

        # Original slot still held
        assert limiter.user_active_count("user-1") == 1

    @pytest.mark.asyncio
    async def test_limit_releases_on_exception(self):
        limiter = PipelineConcurrencyLimiter(max_per_user=2)

        with pytest.raises(ValueError, match="boom"):
            async with limiter.limit("user-1", "run-1"):
                assert limiter.user_active_count("user-1") == 1
                raise ValueError("boom")

        # Slot is released even though body raised
        assert limiter.user_active_count("user-1") == 0
        assert "user-1" not in limiter._active
