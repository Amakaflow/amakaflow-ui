"""
Context propagation utilities for OpenTelemetry.

Part of AMA-506: Add OpenTelemetry Tracing and Metrics

Provides helpers for propagating trace context across threads
and retrieving current trace/span IDs.
"""

import logging
from typing import Any, Callable, Optional, TypeVar

from opentelemetry import context as otel_context
from opentelemetry import trace

logger = logging.getLogger(__name__)

# Type variable for generic callable wrapping
T = TypeVar("T")


def get_current_trace_id() -> Optional[str]:
    """
    Get the current trace ID as a hex string.

    Returns:
        Trace ID string or None if no active span.
    """
    span = trace.get_current_span()
    if span and span.is_recording():
        span_context = span.get_span_context()
        if span_context.is_valid:
            return format(span_context.trace_id, "032x")
    return None


def get_current_span_id() -> Optional[str]:
    """
    Get the current span ID as a hex string.

    Returns:
        Span ID string or None if no active span.
    """
    span = trace.get_current_span()
    if span and span.is_recording():
        span_context = span.get_span_context()
        if span_context.is_valid:
            return format(span_context.span_id, "016x")
    return None


def propagate_context_to_thread(func: Callable[..., T]) -> Callable[..., T]:
    """
    Wrap a function to propagate the current OpenTelemetry context to a thread.

    Use this when submitting work to ThreadPoolExecutor to ensure trace
    context is preserved.

    Args:
        func: Function to wrap.

    Returns:
        Wrapped function that will restore context when called.

    Example:
        with ThreadPoolExecutor() as executor:
            wrapped = propagate_context_to_thread(lambda: dispatcher.execute(...))
            future = executor.submit(wrapped)
    """
    # Capture the current context
    ctx = otel_context.get_current()

    def wrapper(*args: Any, **kwargs: Any) -> T:
        # Attach the captured context in the new thread
        token = otel_context.attach(ctx)
        try:
            return func(*args, **kwargs)
        finally:
            otel_context.detach(token)

    return wrapper


def get_trace_context_headers() -> dict:
    """
    Get trace context as HTTP headers for propagation.

    Useful for manually propagating context to external services.

    Returns:
        Dictionary of trace context headers.
    """
    from opentelemetry.propagate import inject

    headers: dict = {}
    inject(headers)
    return headers


def extract_trace_context(headers: dict) -> otel_context.Context:
    """
    Extract trace context from HTTP headers.

    Args:
        headers: Dictionary containing trace context headers.

    Returns:
        OpenTelemetry context.
    """
    from opentelemetry.propagate import extract

    return extract(headers)
