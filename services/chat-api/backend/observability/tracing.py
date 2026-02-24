"""
Tracing utilities for OpenTelemetry.

Part of AMA-506: Add OpenTelemetry Tracing and Metrics

Provides the @traced decorator and get_tracer() helper.
"""

import functools
import inspect
import logging
from typing import Any, Callable, Optional, TypeVar, Union

from opentelemetry import trace
from opentelemetry.trace import SpanKind, Status, StatusCode

logger = logging.getLogger(__name__)

# Type variable for generic function wrapping
F = TypeVar("F", bound=Callable[..., Any])

# Default tracer name
_DEFAULT_TRACER_NAME = "chat-api"


def get_tracer(name: Optional[str] = None) -> trace.Tracer:
    """
    Get an OpenTelemetry tracer instance.

    Args:
        name: Optional tracer name. Defaults to "chat-api".

    Returns:
        Tracer instance for creating spans.
    """
    return trace.get_tracer(name or _DEFAULT_TRACER_NAME)


def traced(
    _func: Optional[Callable] = None,
    *,
    name: Optional[str] = None,
    kind: SpanKind = SpanKind.INTERNAL,
    attributes: Optional[dict] = None,
) -> Union[Callable[[F], F], F]:
    """
    Decorator to automatically create a span around a function.

    Works with both sync and async functions. Can be used with or without parentheses.

    Args:
        _func: The function being decorated (when used without parentheses).
        name: Span name. Defaults to function name.
        kind: Span kind (INTERNAL, CLIENT, SERVER, etc.).
        attributes: Static attributes to add to the span.

    Returns:
        Decorated function that creates a span on each call.

    Example:
        @traced
        def my_function():
            ...

        @traced(name="custom.span.name", kind=SpanKind.CLIENT)
        async def call_external_api():
            ...
    """
    def decorator(func: F) -> F:
        span_name = name or func.__name__
        tracer = get_tracer()

        if inspect.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                with tracer.start_as_current_span(
                    span_name,
                    kind=kind,
                    attributes=attributes,
                ) as span:
                    try:
                        result = await func(*args, **kwargs)
                        span.set_status(Status(StatusCode.OK))
                        return result
                    except Exception as e:
                        span.set_status(Status(StatusCode.ERROR, str(e)))
                        span.record_exception(e)
                        raise

            return async_wrapper  # type: ignore
        else:
            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                with tracer.start_as_current_span(
                    span_name,
                    kind=kind,
                    attributes=attributes,
                ) as span:
                    try:
                        result = func(*args, **kwargs)
                        span.set_status(Status(StatusCode.OK))
                        return result
                    except Exception as e:
                        span.set_status(Status(StatusCode.ERROR, str(e)))
                        span.record_exception(e)
                        raise

            return sync_wrapper  # type: ignore

    # Handle @traced without parentheses
    if _func is not None:
        return decorator(_func)

    return decorator


def add_span_attributes(attributes: dict) -> None:
    """
    Add attributes to the current span.

    Args:
        attributes: Dictionary of attribute key-value pairs.
    """
    span = trace.get_current_span()
    if span and span.is_recording():
        for key, value in attributes.items():
            span.set_attribute(key, value)


def record_exception(exception: Exception, attributes: Optional[dict] = None) -> None:
    """
    Record an exception on the current span.

    Args:
        exception: The exception to record.
        attributes: Optional additional attributes.
    """
    span = trace.get_current_span()
    if span and span.is_recording():
        span.record_exception(exception, attributes=attributes)
        span.set_status(Status(StatusCode.ERROR, str(exception)))
