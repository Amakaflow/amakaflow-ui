"""
Unit tests for the embedding notifier service.

Part of AMA-746: mapper-api never calls the chat-api embedding webhook,
causing new workouts to have NULL embeddings and be invisible to semantic search.

Tests verify:
1. Webhook is called with the correct URL and payload
2. Errors from httpx are swallowed (exception does NOT propagate)
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

pytestmark = pytest.mark.unit


# =============================================================================
# Tests
# =============================================================================


class TestNotifyEmbeddingUpdate:
    """Tests for notify_embedding_update() function."""

    @pytest.mark.asyncio
    async def test_posts_to_correct_url(self) -> None:
        """Webhook is called with the correct URL composed from chat_api_url."""
        from backend.services.embedding_notifier import notify_embedding_update

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch("httpx.AsyncClient", return_value=mock_client):
            await notify_embedding_update(
                workout_id="abc-123",
                chat_api_url="http://localhost:8005",
            )

        mock_client.post.assert_called_once_with(
            "http://localhost:8005/internal/embeddings/webhook",
            json={"workout_id": "abc-123"},
        )

    @pytest.mark.asyncio
    async def test_sends_correct_payload(self) -> None:
        """Webhook payload contains workout_id."""
        from backend.services.embedding_notifier import notify_embedding_update

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch("httpx.AsyncClient", return_value=mock_client):
            await notify_embedding_update(
                workout_id="workout-xyz-999",
                chat_api_url="http://chat-api:8005",
            )

        _, kwargs = mock_client.post.call_args
        assert kwargs["json"] == {"workout_id": "workout-xyz-999"}

    @pytest.mark.asyncio
    async def test_swallows_httpx_exception(self) -> None:
        """An exception raised by httpx does NOT propagate — it is logged and swallowed."""
        import httpx
        from backend.services.embedding_notifier import notify_embedding_update

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(
            side_effect=httpx.ConnectError("Connection refused")
        )

        with patch("httpx.AsyncClient", return_value=mock_client):
            # Must not raise — fire-and-forget, errors are swallowed
            await notify_embedding_update(
                workout_id="abc-123",
                chat_api_url="http://localhost:8005",
            )

    @pytest.mark.asyncio
    async def test_swallows_generic_exception(self) -> None:
        """Any unexpected exception is also swallowed and does not propagate."""
        from backend.services.embedding_notifier import notify_embedding_update

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(side_effect=RuntimeError("unexpected"))

        with patch("httpx.AsyncClient", return_value=mock_client):
            await notify_embedding_update(
                workout_id="abc-123",
                chat_api_url="http://localhost:8005",
            )

    @pytest.mark.asyncio
    async def test_swallows_http_status_error(self) -> None:
        """A non-2xx HTTP response (raise_for_status) is swallowed."""
        import httpx
        from backend.services.embedding_notifier import notify_embedding_update

        mock_response = MagicMock()
        mock_response.raise_for_status = MagicMock(
            side_effect=httpx.HTTPStatusError(
                "500 Server Error",
                request=MagicMock(),
                response=MagicMock(),
            )
        )

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_response)

        with patch("httpx.AsyncClient", return_value=mock_client):
            await notify_embedding_update(
                workout_id="abc-123",
                chat_api_url="http://localhost:8005",
            )
