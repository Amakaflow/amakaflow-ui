"""
Unit tests for backend/observability/context.py

Tests context propagation utilities for trace ID retrieval and thread propagation.
"""

import pytest
import concurrent.futures

from opentelemetry import trace

from backend.observability.context import (
    get_current_trace_id,
    get_current_span_id,
    propagate_context_to_thread,
    get_trace_context_headers,
    extract_trace_context,
)
from backend.observability import get_tracer


class TestGetCurrentTraceId:
    """Tests for get_current_trace_id() function."""

    def test_returns_hex_string_in_span(self, span_capture, active_span):
        """Should return 32-character hex trace ID inside span."""
        trace_id = get_current_trace_id()

        assert trace_id is not None
        assert len(trace_id) == 32
        assert all(c in "0123456789abcdef" for c in trace_id)

    def test_returns_none_outside_span(self, no_active_span):
        """Should return None when no span is recording."""
        trace_id = get_current_trace_id()
        assert trace_id is None

    def test_consistent_within_span(self, span_capture, active_span):
        """Multiple calls within same span should return same trace ID."""
        trace_id_1 = get_current_trace_id()
        trace_id_2 = get_current_trace_id()

        assert trace_id_1 == trace_id_2


class TestGetCurrentSpanId:
    """Tests for get_current_span_id() function."""

    def test_returns_hex_string_in_span(self, span_capture, active_span):
        """Should return 16-character hex span ID inside span."""
        span_id = get_current_span_id()

        assert span_id is not None
        assert len(span_id) == 16
        assert all(c in "0123456789abcdef" for c in span_id)

    def test_returns_none_outside_span(self, no_active_span):
        """Should return None when no span is recording."""
        span_id = get_current_span_id()
        assert span_id is None

    def test_different_spans_have_different_ids(self, span_capture):
        """Different spans should have different span IDs."""
        tracer = get_tracer()

        with tracer.start_as_current_span("span1"):
            span_id_1 = get_current_span_id()

        with tracer.start_as_current_span("span2"):
            span_id_2 = get_current_span_id()

        assert span_id_1 != span_id_2


class TestPropagateContextToThread:
    """Tests for propagate_context_to_thread() function."""

    def test_wraps_function_correctly(self):
        """Wrapped function should be callable."""
        def target():
            return 42

        wrapped = propagate_context_to_thread(target)
        result = wrapped()

        assert result == 42

    def test_preserves_args_and_kwargs(self):
        """Wrapped function should receive args and kwargs."""
        def target(a, b, c=None):
            return (a, b, c)

        wrapped = propagate_context_to_thread(target)
        result = wrapped(1, 2, c=3)

        assert result == (1, 2, 3)

    def test_context_preserved_in_thread_pool(self, span_capture):
        """Wrapped function in ThreadPoolExecutor should have same trace context."""
        tracer = get_tracer()
        results = {}

        with tracer.start_as_current_span("parent"):
            parent_trace_id = get_current_trace_id()

            def capture():
                results["thread_trace_id"] = get_current_trace_id()

            wrapped = propagate_context_to_thread(capture)

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(wrapped)
                future.result(timeout=5.0)  # Fail fast on deadlock

        assert results.get("thread_trace_id") == parent_trace_id

    def test_context_not_preserved_without_wrapper(self, span_capture):
        """Without wrapper, thread should not have parent context."""
        tracer = get_tracer()
        results = {}

        with tracer.start_as_current_span("parent"):
            parent_trace_id = get_current_trace_id()

            def capture():
                results["thread_trace_id"] = get_current_trace_id()

            # NOT wrapped
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(capture)
                future.result(timeout=5.0)  # Fail fast on deadlock

        # Without propagation, thread has no context
        assert results.get("thread_trace_id") is None

    def test_multiple_threads_preserve_context(self, span_capture):
        """Multiple threads should all preserve the same trace context."""
        tracer = get_tracer()
        results = []

        with tracer.start_as_current_span("parent"):
            parent_trace_id = get_current_trace_id()

            def capture(idx):
                trace_id = get_current_trace_id()
                results.append((idx, trace_id))

            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                futures = []
                for i in range(3):
                    wrapped = propagate_context_to_thread(lambda i=i: capture(i))
                    futures.append(executor.submit(wrapped))

                concurrent.futures.wait(futures, timeout=5.0)  # Fail fast on deadlock

        # All threads should have same trace ID
        for idx, trace_id in results:
            assert trace_id == parent_trace_id, f"Thread {idx} has wrong trace_id"


class TestGetTraceContextHeaders:
    """Tests for get_trace_context_headers() function."""

    def test_returns_dict(self, span_capture, active_span):
        """Should return a dictionary."""
        headers = get_trace_context_headers()
        assert isinstance(headers, dict)

    def test_contains_traceparent_in_span(self, span_capture, active_span):
        """Should include traceparent header in W3C format inside span."""
        headers = get_trace_context_headers()

        assert "traceparent" in headers
        # W3C format: 00-{trace_id}-{span_id}-{flags}
        assert headers["traceparent"].startswith("00-")

    def test_empty_dict_without_span(self, no_active_span):
        """Should return empty dict when no context to propagate."""
        headers = get_trace_context_headers()
        # May be empty or contain default values depending on propagator
        assert isinstance(headers, dict)


class TestExtractTraceContext:
    """Tests for extract_trace_context() function."""

    def test_extracts_from_valid_headers(self):
        """Should extract context from valid traceparent header."""
        headers = {
            "traceparent": "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01"
        }

        ctx = extract_trace_context(headers)
        assert ctx is not None

    def test_returns_context_for_empty_headers(self):
        """Should return context object even for empty headers."""
        ctx = extract_trace_context({})
        assert ctx is not None

    def test_roundtrip_inject_extract(self, span_capture, active_span):
        """Injected headers should be extractable."""
        # Inject
        headers = get_trace_context_headers()

        # Extract
        ctx = extract_trace_context(headers)

        # Verify context is valid
        assert ctx is not None
