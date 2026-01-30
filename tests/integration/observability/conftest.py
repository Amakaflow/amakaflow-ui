"""
Fixtures for observability integration tests.

Combines OTel test infrastructure with integration test fakes.
"""

import pytest

from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import InMemoryMetricReader

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

    original_provider = trace.get_tracer_provider()
    trace.set_tracer_provider(provider)

    yield capture

    trace.set_tracer_provider(original_provider)
    capture.clear()


@pytest.fixture
def metric_reader() -> InMemoryMetricReader:
    """InMemoryMetricReader for verifying metric recording."""
    reader = InMemoryMetricReader()
    provider = MeterProvider(metric_readers=[reader])

    original_provider = metrics.get_meter_provider()
    metrics.set_meter_provider(provider)

    # Reset ChatMetrics singletons
    ChatMetrics._chat_requests_total = None
    ChatMetrics._tool_execution_seconds = None
    ChatMetrics._anthropic_ttft_seconds = None
    ChatMetrics._anthropic_total_seconds = None
    ChatMetrics._tokens_used_total = None
    ChatMetrics._active_sse_connections = None
    ChatMetrics._rate_limit_hits_total = None

    yield reader

    metrics.set_meter_provider(original_provider)


@pytest.fixture
def otel_test_setup(span_capture: SpanCapture, metric_reader: InMemoryMetricReader):
    """Combined OTel test setup for integration tests."""
    return {"spans": span_capture, "metrics": metric_reader}
