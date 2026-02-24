"""
Fixtures for OpenTelemetry observability unit tests.

Provides in-memory span and metric exporters for verifying telemetry
without requiring an external collector.
"""

import pytest

from opentelemetry import trace, metrics, context as otel_context
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import InMemoryMetricReader

from backend.observability import config
from backend.observability.metrics import ChatMetrics
from tests.fixtures.otel import SpanCapture, get_metric_value, get_histogram_count


# Re-export for convenience
__all__ = ["SpanCapture", "get_metric_value", "get_histogram_count"]


@pytest.fixture
def span_capture() -> SpanCapture:
    """Provide span capture with TracerProvider setup."""
    capture = SpanCapture()
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(capture._exporter))

    # Store original and set new
    original_provider = trace.get_tracer_provider()
    trace.set_tracer_provider(provider)

    yield capture

    # Restore original
    trace.set_tracer_provider(original_provider)
    capture.clear()


@pytest.fixture
def in_memory_exporter(span_capture: SpanCapture) -> SpanCapture:
    """Alias for span_capture for backward compatibility."""
    return span_capture


@pytest.fixture
def metric_reader() -> InMemoryMetricReader:
    """InMemoryMetricReader for verifying metric recording."""
    reader = InMemoryMetricReader()
    provider = MeterProvider(metric_readers=[reader])

    # Store original and set new
    original_provider = metrics.get_meter_provider()
    metrics.set_meter_provider(provider)

    # Reset ChatMetrics singletons to use new provider
    ChatMetrics._chat_requests_total = None
    ChatMetrics._tool_execution_seconds = None
    ChatMetrics._anthropic_ttft_seconds = None
    ChatMetrics._anthropic_total_seconds = None
    ChatMetrics._tokens_used_total = None
    ChatMetrics._active_sse_connections = None
    ChatMetrics._rate_limit_hits_total = None

    yield reader

    # Restore original
    metrics.set_meter_provider(original_provider)


@pytest.fixture
def active_span(span_capture: SpanCapture):
    """Context manager that provides an active span for testing."""
    tracer = trace.get_tracer("test")
    with tracer.start_as_current_span("test-span") as span:
        yield span


@pytest.fixture
def no_active_span():
    """Ensure no span is active (for negative tests)."""
    token = otel_context.attach(otel_context.Context())
    yield
    otel_context.detach(token)


@pytest.fixture
def reset_otel_state():
    """Reset global OTel state between tests."""
    original_initialized = config._initialized
    config._initialized = False

    yield

    config._initialized = original_initialized
