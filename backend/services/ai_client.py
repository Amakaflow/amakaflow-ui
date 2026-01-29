"""Anthropic client with optional Helicone proxy and streaming support."""

import logging
import time
from dataclasses import dataclass
from typing import Any, Dict, Generator, List, Optional

import anthropic

logger = logging.getLogger(__name__)

HELICONE_BASE_URL = "https://anthropic.helicone.ai"


@dataclass
class StreamEvent:
    """A single SSE event from the AI stream."""

    event: str  # message_start, content_delta, function_call, function_result, message_end, error
    data: Dict[str, Any]


class AIClient:
    """Wraps Anthropic SDK with optional Helicone proxy."""

    def __init__(
        self,
        api_key: str,
        helicone_api_key: Optional[str] = None,
        helicone_enabled: bool = False,
        default_model: str = "claude-sonnet-4-20250514",
    ) -> None:
        self._default_model = default_model

        kwargs: Dict[str, Any] = {"api_key": api_key}
        extra_headers: Dict[str, str] = {}

        if helicone_enabled and helicone_api_key:
            kwargs["base_url"] = HELICONE_BASE_URL
            extra_headers["Helicone-Auth"] = f"Bearer {helicone_api_key}"
            logger.info("AI client configured with Helicone proxy")

        if extra_headers:
            kwargs["default_headers"] = extra_headers

        self._client = anthropic.Anthropic(**kwargs)

    def stream_chat(
        self,
        messages: List[Dict[str, Any]],
        system: str,
        model: Optional[str] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        max_tokens: int = 4096,
        user_id: Optional[str] = None,
    ) -> Generator[StreamEvent, None, None]:
        """Stream a chat completion from Claude.

        Yields StreamEvent objects for each piece of the response.

        Args:
            messages: Anthropic-format message list.
            system: System prompt.
            model: Model override (defaults to default_model).
            tools: Tool definitions for function calling.
            max_tokens: Max output tokens.
            user_id: Optional user ID for Helicone tracking.
        """
        model = model or self._default_model
        start_time = time.time()
        input_tokens = 0
        output_tokens = 0

        create_kwargs: Dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "system": system,
            "messages": messages,
        }
        if tools:
            create_kwargs["tools"] = tools

        try:
            with self._client.messages.stream(**create_kwargs) as stream:
                for event in stream:
                    if event.type == "message_start":
                        msg = getattr(event, "message", None)
                        if msg and hasattr(msg, "usage"):
                            input_tokens = getattr(msg.usage, "input_tokens", 0)

                    elif event.type == "content_block_delta":
                        delta = getattr(event, "delta", None)
                        if delta:
                            if hasattr(delta, "text"):
                                yield StreamEvent(
                                    event="content_delta",
                                    data={"text": delta.text},
                                )
                            elif hasattr(delta, "partial_json"):
                                yield StreamEvent(
                                    event="content_delta",
                                    data={"partial_json": delta.partial_json},
                                )

                    elif event.type == "content_block_start":
                        block = getattr(event, "content_block", None)
                        if block and getattr(block, "type", None) == "tool_use":
                            yield StreamEvent(
                                event="function_call",
                                data={
                                    "id": block.id,
                                    "name": block.name,
                                },
                            )

                    elif event.type == "message_delta":
                        usage = getattr(
                            getattr(event, "usage", None), "output_tokens", 0
                        )
                        if usage:
                            output_tokens = usage

                # Get final message for stop_reason
                final_message = stream.get_final_message()
                stop_reason = getattr(final_message, "stop_reason", "end_turn")
                latency_ms = round((time.time() - start_time) * 1000)

                yield StreamEvent(
                    event="message_end",
                    data={
                        "model": model,
                        "input_tokens": input_tokens,
                        "output_tokens": output_tokens,
                        "latency_ms": latency_ms,
                        "stop_reason": stop_reason,
                    },
                )

        except anthropic.RateLimitError as e:
            logger.warning("Anthropic rate limit: %s", e)
            yield StreamEvent(
                event="error",
                data={"type": "rate_limit", "message": "AI service is busy. Please try again shortly."},
            )
        except anthropic.APIError as e:
            logger.error("Anthropic API error: %s", e)
            yield StreamEvent(
                event="error",
                data={"type": "api_error", "message": "AI service error. Please try again."},
            )
        except Exception as e:
            logger.error("Unexpected streaming error: %s", e)
            yield StreamEvent(
                event="error",
                data={"type": "internal_error", "message": "An unexpected error occurred."},
            )
