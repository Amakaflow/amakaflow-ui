"""
Metrics definitions for chat-api.

Part of AMA-506: Add OpenTelemetry Tracing and Metrics

Defines all metrics using OpenTelemetry Meter API.
"""

import logging
from typing import Optional

from opentelemetry import metrics

logger = logging.getLogger(__name__)

# Meter name
_METER_NAME = "chat-api"


def _get_meter() -> metrics.Meter:
    """Get the metrics meter instance."""
    return metrics.get_meter(_METER_NAME)


class ChatMetrics:
    """
    Centralized metrics for chat-api.

    All metrics are lazily initialized on first access.
    """

    _chat_requests_total: Optional[metrics.Counter] = None
    _tool_execution_seconds: Optional[metrics.Histogram] = None
    _anthropic_ttft_seconds: Optional[metrics.Histogram] = None
    _anthropic_total_seconds: Optional[metrics.Histogram] = None
    _tokens_used_total: Optional[metrics.Counter] = None
    _active_sse_connections: Optional[metrics.UpDownCounter] = None
    _rate_limit_hits_total: Optional[metrics.Counter] = None

    @classmethod
    def chat_requests_total(cls) -> metrics.Counter:
        """Counter for total chat requests by status."""
        if cls._chat_requests_total is None:
            cls._chat_requests_total = _get_meter().create_counter(
                name="chat_requests_total",
                description="Total number of chat requests",
                unit="1",
            )
        return cls._chat_requests_total

    @classmethod
    def tool_execution_seconds(cls) -> metrics.Histogram:
        """Histogram for tool execution duration."""
        if cls._tool_execution_seconds is None:
            cls._tool_execution_seconds = _get_meter().create_histogram(
                name="tool_execution_seconds",
                description="Duration of tool executions",
                unit="s",
            )
        return cls._tool_execution_seconds

    @classmethod
    def anthropic_ttft_seconds(cls) -> metrics.Histogram:
        """Histogram for Anthropic time to first token."""
        if cls._anthropic_ttft_seconds is None:
            cls._anthropic_ttft_seconds = _get_meter().create_histogram(
                name="anthropic_ttft_seconds",
                description="Time to first token from Anthropic API",
                unit="s",
            )
        return cls._anthropic_ttft_seconds

    @classmethod
    def anthropic_total_seconds(cls) -> metrics.Histogram:
        """Histogram for total Anthropic request duration."""
        if cls._anthropic_total_seconds is None:
            cls._anthropic_total_seconds = _get_meter().create_histogram(
                name="anthropic_total_seconds",
                description="Total duration of Anthropic API requests",
                unit="s",
            )
        return cls._anthropic_total_seconds

    @classmethod
    def tokens_used_total(cls) -> metrics.Counter:
        """Counter for total tokens used by type."""
        if cls._tokens_used_total is None:
            cls._tokens_used_total = _get_meter().create_counter(
                name="tokens_used_total",
                description="Total tokens used",
                unit="1",
            )
        return cls._tokens_used_total

    @classmethod
    def active_sse_connections(cls) -> metrics.UpDownCounter:
        """Gauge for active SSE connections."""
        if cls._active_sse_connections is None:
            cls._active_sse_connections = _get_meter().create_up_down_counter(
                name="active_sse_connections",
                description="Number of active SSE connections",
                unit="1",
            )
        return cls._active_sse_connections

    @classmethod
    def rate_limit_hits_total(cls) -> metrics.Counter:
        """Counter for rate limit hits by type."""
        if cls._rate_limit_hits_total is None:
            cls._rate_limit_hits_total = _get_meter().create_counter(
                name="rate_limit_hits_total",
                description="Total rate limit hits",
                unit="1",
            )
        return cls._rate_limit_hits_total


def get_metrics_response() -> str:
    """
    Get Prometheus-format metrics response.

    Returns:
        Prometheus text format metrics string.
    """
    try:
        from prometheus_client import generate_latest, REGISTRY
        return generate_latest(REGISTRY).decode("utf-8")
    except ImportError:
        # Fall back to OpenTelemetry Prometheus exporter
        try:
            from opentelemetry.exporter.prometheus import PrometheusMetricReader  # noqa: F401
            # The PrometheusMetricReader exposes metrics via its own HTTP server
            # For manual export, we need to access the registry
            return "# Prometheus metrics available at /metrics endpoint\n"
        except ImportError:
            return "# Prometheus exporter not available\n"
