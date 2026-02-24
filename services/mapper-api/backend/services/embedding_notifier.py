"""
Embedding notifier service.

Part of AMA-746: mapper-api never called the chat-api embedding webhook,
causing new workouts to have NULL embeddings and be invisible to semantic search.

This module provides a fire-and-forget async function that notifies chat-api
to generate/update the embedding for a saved or patched workout.

Usage:
    import asyncio
    from backend.services.embedding_notifier import notify_embedding_update
    from backend.settings import get_settings

    # Inside an async endpoint, after a successful save or patch:
    asyncio.create_task(
        notify_embedding_update(
            workout_id=result.workout_id,
            chat_api_url=get_settings().chat_api_url,
        )
    )
"""

import logging

import httpx

logger = logging.getLogger(__name__)


async def notify_embedding_update(workout_id: str, chat_api_url: str) -> None:
    """Notify chat-api to generate or refresh the embedding for a workout.

    This is a fire-and-forget function: all exceptions are caught, logged,
    and swallowed. It will never raise, ensuring it never disrupts the caller.

    Args:
        workout_id: The UUID of the workout whose embedding should be updated.
        chat_api_url: Base URL of the chat-api service (e.g. "http://localhost:8005").
    """
    url = f"{chat_api_url}/internal/embeddings/webhook"
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json={"workout_id": workout_id})
            response.raise_for_status()
        logger.debug(
            "Embedding webhook notified successfully for workout %s", workout_id
        )
    except Exception as exc:  # noqa: BLE001 — intentional broad catch for fire-and-forget
        logger.warning(
            "Failed to notify embedding webhook for workout %s (url=%s): %s",
            workout_id,
            url,
            exc,
        )
