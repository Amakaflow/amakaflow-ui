"""
OpenTelemetry observability package for chat-api.

Part of AMA-506: Add OpenTelemetry Tracing and Metrics

This package provides distributed tracing, metrics, and log correlation
for the chat-api service.

Usage:
    from backend.observability import (
        configure_observability,
        get_tracer,
        traced,
        ChatMetrics,
        get_current_trace_id,
        propagate_context_to_thread,
    )

    # Initialize in application startup
    configure_observability(settings)

    # Use decorator for automatic tracing
    @traced
    async def my_function():
        ...

    # Access metrics
    ChatMetrics.chat_requests_total.add(1, {"status": "success"})

    # Get trace ID for logging
    trace_id = get_current_trace_id()
"""

from backend.observability.config import configure_observability, shutdown_observability
from backend.observability.tracing import get_tracer, traced
from backend.observability.metrics import ChatMetrics, get_metrics_response
from backend.observability.context import (
    get_current_trace_id,
    get_current_span_id,
    propagate_context_to_thread,
)

__all__ = [
    # Configuration
    "configure_observability",
    "shutdown_observability",
    # Tracing
    "get_tracer",
    "traced",
    # Metrics
    "ChatMetrics",
    "get_metrics_response",
    # Context
    "get_current_trace_id",
    "get_current_span_id",
    "propagate_context_to_thread",
]
