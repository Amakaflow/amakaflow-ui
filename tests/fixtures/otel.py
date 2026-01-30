"""
Shared OpenTelemetry test fixtures and utilities.

Provides span capture, metric reading, and helper functions for verifying
telemetry without requiring an external collector.

Note: Due to OTel's global state constraints (TracerProvider and MeterProvider
cannot be overridden once set), span/metric capture may be unreliable in some
test contexts. Tests should account for this by using conditional assertions
or pytest.skip() when capture fails.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional

from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from opentelemetry.sdk.metrics.export import (
    InMemoryMetricReader,
    HistogramDataPoint,
    NumberDataPoint,
)


@dataclass
class CapturedSpan:
    """Simplified span representation for test assertions.

    Attributes:
        name: The span name (e.g., "chat.stream", "tool.search")
        trace_id: 32-character hex trace ID
        span_id: 16-character hex span ID
        parent_span_id: Parent span ID if this is a child span, None otherwise
        attributes: Dict of span attributes (e.g., {"user.id": "123"})
        status_code: Span status ("OK", "ERROR", "UNSET")
        events: List of span events with name and attributes
    """

    name: str
    trace_id: str
    span_id: str
    parent_span_id: Optional[str]
    attributes: Dict
    status_code: str
    events: List[Dict]


class SpanCapture:
    """Collects spans for test verification.

    Usage:
        capture = SpanCapture()
        provider = TracerProvider()
        provider.add_span_processor(SimpleSpanProcessor(capture._exporter))
        trace.set_tracer_provider(provider)

        # ... run code that creates spans ...

        spans = capture.get_spans()
        assert len(spans) == 1
        assert spans[0].name == "my.span"
    """

    def __init__(self) -> None:
        self._exporter = InMemorySpanExporter()

    def get_spans(self) -> List[CapturedSpan]:
        """Return all captured spans."""
        return [
            CapturedSpan(
                name=span.name,
                trace_id=format(span.context.trace_id, "032x"),
                span_id=format(span.context.span_id, "016x"),
                parent_span_id=(
                    format(span.parent.span_id, "016x") if span.parent else None
                ),
                attributes=dict(span.attributes) if span.attributes else {},
                status_code=span.status.status_code.name,
                events=[
                    {"name": e.name, "attributes": dict(e.attributes) if e.attributes else {}}
                    for e in span.events
                ],
            )
            for span in self._exporter.get_finished_spans()
        ]

    def get_spans_by_name(self, name: str) -> List[CapturedSpan]:
        """Filter spans by name."""
        return [s for s in self.get_spans() if s.name == name]

    def get_children_of(self, parent_span_id: str) -> List[CapturedSpan]:
        """Get all spans that are children of the given parent."""
        return [s for s in self.get_spans() if s.parent_span_id == parent_span_id]

    def get_span_by_id(self, span_id: str) -> Optional[CapturedSpan]:
        """Get span by span ID."""
        for s in self.get_spans():
            if s.span_id == span_id:
                return s
        return None

    def build_span_tree(self) -> Dict[str, List[str]]:
        """Build a tree of span relationships (parent_id -> [child_ids])."""
        tree: Dict[str, List[str]] = {}
        for span in self.get_spans():
            parent = span.parent_span_id or "root"
            if parent not in tree:
                tree[parent] = []
            tree[parent].append(span.span_id)
        return tree

    def get_span_tree(self, root_name: str) -> Dict:
        """Build span hierarchy tree for assertion.

        Returns a nested dict structure like:
        {
            "name": "chat.stream",
            "children": [
                {"name": "anthropic.messages.stream", "children": []},
                {"name": "tool.search", "children": []}
            ]
        }
        """
        spans = self.get_spans()
        root = next((s for s in spans if s.name == root_name), None)
        if not root:
            return {}

        def build_children(parent_span_id: str) -> List[Dict]:
            children = [s for s in spans if s.parent_span_id == parent_span_id]
            return [
                {"name": c.name, "children": build_children(c.span_id)} for c in children
            ]

        return {"name": root.name, "children": build_children(root.span_id)}

    def clear(self) -> None:
        """Clear captured spans between tests."""
        self._exporter.clear()


def get_metric_value(
    reader: InMemoryMetricReader,
    name: str,
    labels: Optional[Dict[str, str]] = None,
) -> Optional[float]:
    """Get metric value from reader, optionally filtered by labels.

    Args:
        reader: InMemoryMetricReader instance
        name: Metric name to look up
        labels: Optional dict of label key-value pairs to filter by

    Returns:
        The metric value (counter value or histogram sum), or None if not found
    """
    data = reader.get_metrics_data()
    if not data:
        return None

    for resource_metric in data.resource_metrics:
        for scope_metric in resource_metric.scope_metrics:
            for metric in scope_metric.metrics:
                if metric.name == name:
                    for point in metric.data.data_points:
                        if labels:
                            point_labels = dict(point.attributes)
                            if not all(
                                point_labels.get(k) == v for k, v in labels.items()
                            ):
                                continue
                        if isinstance(point, NumberDataPoint):
                            return point.value
                        if isinstance(point, HistogramDataPoint):
                            return point.sum
    return None


def get_histogram_count(
    reader: InMemoryMetricReader,
    name: str,
    labels: Optional[Dict[str, str]] = None,
) -> int:
    """Get histogram observation count.

    Args:
        reader: InMemoryMetricReader instance
        name: Metric name to look up
        labels: Optional dict of label key-value pairs to filter by

    Returns:
        The number of observations recorded in the histogram, or 0 if not found
    """
    data = reader.get_metrics_data()
    if not data:
        return 0

    for resource_metric in data.resource_metrics:
        for scope_metric in resource_metric.scope_metrics:
            for metric in scope_metric.metrics:
                if metric.name == name:
                    for point in metric.data.data_points:
                        if isinstance(point, HistogramDataPoint):
                            if labels:
                                point_labels = dict(point.attributes)
                                if not all(
                                    point_labels.get(k) == v for k, v in labels.items()
                                ):
                                    continue
                            return point.count
    return 0
