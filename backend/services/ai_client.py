"""Anthropic client with optional Helicone proxy and streaming support.

Updated in AMA-506: Add OpenTelemetry tracing and metrics.
"""

import logging
import time
from dataclasses import dataclass
from typing import Any, AsyncGenerator, Dict, Generator, List, Optional

import anthropic
from opentelemetry.trace import SpanKind

from backend.observability import get_tracer, ChatMetrics

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
        ttft_recorded = False
        input_tokens = 0
        output_tokens = 0
        stop_reason = "end_turn"

        tracer = get_tracer()

        create_kwargs: Dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "system": [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            "messages": messages,
        }
        if tools:
            create_kwargs["tools"] = [*tools[:-1], {**tools[-1], "cache_control": {"type": "ephemeral"}}]

        cache_read_tokens = 0
        cache_write_tokens = 0

        with tracer.start_as_current_span(
            "anthropic.messages.stream",
            kind=SpanKind.CLIENT,
            attributes={
                "llm.model": model,
                "llm.max_tokens": max_tokens,
            },
        ) as span:
            try:
                with self._client.messages.stream(**create_kwargs) as stream:
                    for event in stream:
                        if event.type == "message_start":
                            msg = getattr(event, "message", None)
                            if msg and hasattr(msg, "usage"):
                                input_tokens = getattr(msg.usage, "input_tokens", 0)
                                cache_read_tokens = getattr(msg.usage, "cache_read_input_tokens", 0)
                                cache_write_tokens = getattr(msg.usage, "cache_creation_input_tokens", 0)

                        elif event.type == "content_block_delta":
                            # Record TTFT on first content delta
                            if not ttft_recorded:
                                ttft = time.time() - start_time
                                ChatMetrics.anthropic_ttft_seconds().record(
                                    ttft, {"model": model}
                                )
                                span.set_attribute("llm.ttft_seconds", ttft)
                                ttft_recorded = True

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
                            delta = getattr(event, "delta", None)
                            if delta:
                                delta_stop = getattr(delta, "stop_reason", None)
                                if delta_stop:
                                    stop_reason = delta_stop
                            usage = getattr(
                                getattr(event, "usage", None), "output_tokens", 0
                            )
                            if usage:
                                output_tokens = usage

                    total_seconds = time.time() - start_time
                    latency_ms = round(total_seconds * 1000)

                    # Record metrics
                    ChatMetrics.anthropic_total_seconds().record(
                        total_seconds, {"model": model, "stop_reason": stop_reason}
                    )
                    ChatMetrics.tokens_used_total().add(
                        input_tokens, {"type": "input", "model": model}
                    )
                    ChatMetrics.tokens_used_total().add(
                        output_tokens, {"type": "output", "model": model}
                    )

                    # Add span attributes
                    span.set_attribute("llm.input_tokens", input_tokens)
                    span.set_attribute("llm.output_tokens", output_tokens)
                    span.set_attribute("llm.total_seconds", total_seconds)
                    span.set_attribute("llm.stop_reason", stop_reason)
                    span.set_attribute("llm.cache_read_tokens", cache_read_tokens)
                    span.set_attribute("llm.cache_write_tokens", cache_write_tokens)
                    if cache_read_tokens or cache_write_tokens:
                        logger.debug("Prompt cache: read=%d write=%d", cache_read_tokens, cache_write_tokens)

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
                span.set_attribute("error.type", "rate_limit")
                yield StreamEvent(
                    event="error",
                    data={"type": "rate_limit", "message": "AI service is busy. Please try again shortly."},
                )
            except anthropic.APIError as e:
                logger.error("Anthropic API error: %s", e)
                span.set_attribute("error.type", "api_error")
                span.record_exception(e)
                yield StreamEvent(
                    event="error",
                    data={"type": "api_error", "message": "AI service error. Please try again."},
                )
            except Exception as e:
                logger.error("Unexpected streaming error: %s", e)
                span.set_attribute("error.type", "internal_error")
                span.record_exception(e)
                yield StreamEvent(
                    event="error",
                    data={"type": "internal_error", "message": "An unexpected error occurred."},
                )


class AsyncAIClient:
    """Async version of AIClient using AsyncAnthropic for non-blocking streaming."""

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
            logger.info("Async AI client configured with Helicone proxy")

        if extra_headers:
            kwargs["default_headers"] = extra_headers

        self._client = anthropic.AsyncAnthropic(**kwargs)

    async def stream_chat(
        self,
        messages: List[Dict[str, Any]],
        system: str,
        model: Optional[str] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        max_tokens: int = 4096,
        user_id: Optional[str] = None,
    ) -> AsyncGenerator[StreamEvent, None]:
        """Async stream a chat completion from Claude.

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
        ttft_recorded = False
        input_tokens = 0
        output_tokens = 0

        tracer = get_tracer()

        create_kwargs: Dict[str, Any] = {
            "model": model,
            "max_tokens": max_tokens,
            "system": [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            "messages": messages,
        }
        if tools:
            create_kwargs["tools"] = [*tools[:-1], {**tools[-1], "cache_control": {"type": "ephemeral"}}]

        cache_read_tokens = 0
        cache_write_tokens = 0

        with tracer.start_as_current_span(
            "anthropic.messages.stream",
            kind=SpanKind.CLIENT,
            attributes={
                "llm.model": model,
                "llm.max_tokens": max_tokens,
            },
        ) as span:
            try:
                async with self._client.messages.stream(**create_kwargs) as stream:
                    async for event in stream:
                        if event.type == "message_start":
                            msg = getattr(event, "message", None)
                            if msg and hasattr(msg, "usage"):
                                input_tokens = getattr(msg.usage, "input_tokens", 0)
                                cache_read_tokens = getattr(msg.usage, "cache_read_input_tokens", 0)
                                cache_write_tokens = getattr(msg.usage, "cache_creation_input_tokens", 0)

                        elif event.type == "content_block_delta":
                            # Record TTFT on first content delta
                            if not ttft_recorded:
                                ttft = time.time() - start_time
                                ChatMetrics.anthropic_ttft_seconds().record(
                                    ttft, {"model": model}
                                )
                                span.set_attribute("llm.ttft_seconds", ttft)
                                ttft_recorded = True

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
                    final_message = await stream.get_final_message()
                    stop_reason = getattr(final_message, "stop_reason", "end_turn")
                    total_seconds = time.time() - start_time
                    latency_ms = round(total_seconds * 1000)

                    # Record metrics
                    ChatMetrics.anthropic_total_seconds().record(
                        total_seconds, {"model": model, "stop_reason": stop_reason}
                    )
                    ChatMetrics.tokens_used_total().add(
                        input_tokens, {"type": "input", "model": model}
                    )
                    ChatMetrics.tokens_used_total().add(
                        output_tokens, {"type": "output", "model": model}
                    )

                    # Add span attributes
                    span.set_attribute("llm.input_tokens", input_tokens)
                    span.set_attribute("llm.output_tokens", output_tokens)
                    span.set_attribute("llm.total_seconds", total_seconds)
                    span.set_attribute("llm.stop_reason", stop_reason)
                    span.set_attribute("llm.cache_read_tokens", cache_read_tokens)
                    span.set_attribute("llm.cache_write_tokens", cache_write_tokens)
                    if cache_read_tokens or cache_write_tokens:
                        logger.debug("Prompt cache: read=%d write=%d", cache_read_tokens, cache_write_tokens)

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
                span.set_attribute("error.type", "rate_limit")
                yield StreamEvent(
                    event="error",
                    data={"type": "rate_limit", "message": "AI service is busy. Please try again shortly."},
                )
            except anthropic.APIError as e:
                logger.error("Anthropic API error: %s", e)
                span.set_attribute("error.type", "api_error")
                span.record_exception(e)
                yield StreamEvent(
                    event="error",
                    data={"type": "api_error", "message": "AI service error. Please try again."},
                )
            except Exception as e:
                logger.error("Unexpected async streaming error: %s", e)
                span.set_attribute("error.type", "internal_error")
                span.record_exception(e)
                yield StreamEvent(
                    event="error",
                    data={"type": "internal_error", "message": "An unexpected error occurred."},
                )
