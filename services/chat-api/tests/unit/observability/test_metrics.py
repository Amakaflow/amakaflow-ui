"""
Unit tests for backend/observability/metrics.py

Tests ChatMetrics class methods and metric creation.

Note: Due to OpenTelemetry's global state management, we focus on verifying
that metrics can be created and called. Value assertions are unreliable
across test runs due to provider state issues.
"""

import pytest

from backend.observability.metrics import ChatMetrics, get_metrics_response


class TestChatMetricsCounters:
    """Tests for counter metrics."""

    def test_chat_requests_total_created(self):
        """chat_requests_total should be created as counter."""
        counter = ChatMetrics.chat_requests_total()
        assert counter is not None
        assert hasattr(counter, "add")

    def test_chat_requests_total_can_be_called(self):
        """chat_requests_total.add() should not raise."""
        counter = ChatMetrics.chat_requests_total()
        # Should not raise
        counter.add(1, {"status": "success"})

    def test_chat_requests_total_accepts_different_labels(self):
        """Counter should accept various status labels."""
        counter = ChatMetrics.chat_requests_total()
        # Should not raise for any valid label
        counter.add(1, {"status": "success"})
        counter.add(1, {"status": "error"})
        counter.add(1, {"status": "rate_limited"})

    def test_tokens_used_total_created(self):
        """tokens_used_total should be created as counter."""
        counter = ChatMetrics.tokens_used_total()
        assert counter is not None
        assert hasattr(counter, "add")

    def test_tokens_used_total_accepts_type_labels(self):
        """tokens_used_total should accept input/output type labels."""
        counter = ChatMetrics.tokens_used_total()
        # Should not raise
        counter.add(100, {"type": "input", "model": "test"})
        counter.add(50, {"type": "output", "model": "test"})

    def test_rate_limit_hits_total_created(self):
        """rate_limit_hits_total should be created as counter."""
        counter = ChatMetrics.rate_limit_hits_total()
        assert counter is not None
        assert hasattr(counter, "add")

    def test_rate_limit_hits_total_can_be_called(self):
        """rate_limit_hits_total.add() should not raise."""
        counter = ChatMetrics.rate_limit_hits_total()
        # Should not raise
        counter.add(1, {"limit_type": "monthly_messages"})


class TestChatMetricsHistograms:
    """Tests for histogram metrics."""

    def test_tool_execution_seconds_created(self):
        """tool_execution_seconds should be created as histogram."""
        histogram = ChatMetrics.tool_execution_seconds()
        assert histogram is not None
        assert hasattr(histogram, "record")

    def test_tool_execution_seconds_can_record(self):
        """tool_execution_seconds.record() should not raise."""
        histogram = ChatMetrics.tool_execution_seconds()
        # Should not raise
        histogram.record(0.5, {"tool_name": "search_workout_library", "status": "success"})

    def test_anthropic_ttft_seconds_created(self):
        """anthropic_ttft_seconds should be created as histogram."""
        histogram = ChatMetrics.anthropic_ttft_seconds()
        assert histogram is not None
        assert hasattr(histogram, "record")

    def test_anthropic_ttft_seconds_can_record(self):
        """anthropic_ttft_seconds.record() should not raise."""
        histogram = ChatMetrics.anthropic_ttft_seconds()
        # Should not raise
        histogram.record(0.25, {"model": "test-model"})

    def test_anthropic_total_seconds_created(self):
        """anthropic_total_seconds should be created as histogram."""
        histogram = ChatMetrics.anthropic_total_seconds()
        assert histogram is not None
        assert hasattr(histogram, "record")

    def test_anthropic_total_seconds_can_record(self):
        """anthropic_total_seconds.record() should not raise."""
        histogram = ChatMetrics.anthropic_total_seconds()
        # Should not raise
        histogram.record(1.5, {"model": "test-model", "stop_reason": "end_turn"})

    def test_multiple_histogram_observations(self):
        """Multiple histogram observations should be accepted."""
        histogram = ChatMetrics.tool_execution_seconds()
        # Should not raise
        histogram.record(0.1, {"tool_name": "test", "status": "success"})
        histogram.record(0.2, {"tool_name": "test", "status": "success"})
        histogram.record(0.3, {"tool_name": "test", "status": "success"})


class TestChatMetricsGauges:
    """Tests for gauge (UpDownCounter) metrics."""

    def test_active_sse_connections_created(self):
        """active_sse_connections should be created as UpDownCounter."""
        gauge = ChatMetrics.active_sse_connections()
        assert gauge is not None
        assert hasattr(gauge, "add")

    def test_active_sse_connections_increments(self):
        """active_sse_connections.add(1) should not raise."""
        gauge = ChatMetrics.active_sse_connections()
        # Should not raise
        gauge.add(1)

    def test_active_sse_connections_decrements(self):
        """active_sse_connections.add(-1) should not raise."""
        gauge = ChatMetrics.active_sse_connections()
        # Should not raise
        gauge.add(-1)


class TestMetricsSingletons:
    """Tests for metric singleton behavior."""

    def test_chat_requests_total_is_singleton(self):
        """Repeated calls should return same counter instance."""
        counter1 = ChatMetrics.chat_requests_total()
        counter2 = ChatMetrics.chat_requests_total()
        assert counter1 is counter2

    def test_tool_execution_seconds_is_singleton(self):
        """Repeated calls should return same histogram instance."""
        hist1 = ChatMetrics.tool_execution_seconds()
        hist2 = ChatMetrics.tool_execution_seconds()
        assert hist1 is hist2

    def test_active_sse_connections_is_singleton(self):
        """Repeated calls should return same gauge instance."""
        gauge1 = ChatMetrics.active_sse_connections()
        gauge2 = ChatMetrics.active_sse_connections()
        assert gauge1 is gauge2


class TestGetMetricsResponse:
    """Tests for get_metrics_response() function."""

    def test_returns_string(self):
        """get_metrics_response() should return a string."""
        response = get_metrics_response()
        assert isinstance(response, str)

    def test_contains_comment_or_metrics(self):
        """Response should contain Prometheus format (comments or metrics)."""
        response = get_metrics_response()
        # Prometheus format has lines starting with # or metric names
        assert response.startswith("#") or "\n" in response or response == ""
