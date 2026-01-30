"""
OpenTelemetry SDK configuration and initialization.

Part of AMA-506: Add OpenTelemetry Tracing and Metrics

Configures TracerProvider, MeterProvider, and auto-instrumentation
for FastAPI, HTTPX, and logging.
"""

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from backend.settings import Settings

logger = logging.getLogger(__name__)

# Track initialization state
_initialized = False


def configure_observability(settings: "Settings") -> None:
    """
    Configure OpenTelemetry SDK with tracing, metrics, and auto-instrumentation.

    Args:
        settings: Application settings with OTel configuration.
    """
    global _initialized

    if _initialized:
        logger.debug("OpenTelemetry already initialized, skipping")
        return

    if not settings.otel_enabled:
        logger.info("OpenTelemetry disabled via settings")
        return

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.sampling import TraceIdRatioBased
        from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
        from opentelemetry.propagate import set_global_textmap
        from opentelemetry.propagators.composite import CompositePropagator
        from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
        from opentelemetry.propagators.b3 import B3MultiFormat

        # Build resource attributes
        resource_attributes = {
            SERVICE_NAME: settings.otel_service_name,
            SERVICE_VERSION: "1.0.0",
            "deployment.environment": settings.environment,
        }
        if settings.render_git_commit:
            resource_attributes["service.instance.id"] = settings.render_git_commit

        resource = Resource.create(resource_attributes)

        # Configure sampling
        sampler = TraceIdRatioBased(settings.otel_traces_sample_rate)

        # Create TracerProvider
        tracer_provider = TracerProvider(resource=resource, sampler=sampler)

        # Configure exporters based on endpoint
        if settings.otel_exporter_otlp_endpoint:
            _configure_otlp_exporters(
                tracer_provider,
                settings.otel_exporter_otlp_endpoint,
                settings.otel_exporter_otlp_protocol,
                resource,
                settings.otel_metrics_export_interval_ms,
            )
        else:
            # Console exporter for development
            _configure_console_exporters(tracer_provider)

        # Set global tracer provider
        trace.set_tracer_provider(tracer_provider)

        # Configure MeterProvider (metrics)
        _configure_meter_provider(
            resource,
            settings.otel_exporter_otlp_endpoint,
            settings.otel_exporter_otlp_protocol,
            settings.otel_metrics_export_interval_ms,
        )

        # Configure propagators (W3C TraceContext + B3)
        propagator = CompositePropagator([
            TraceContextTextMapPropagator(),
            B3MultiFormat(),
        ])
        set_global_textmap(propagator)

        # Auto-instrument FastAPI, HTTPX, and logging
        _configure_auto_instrumentation(settings.otel_log_correlation)

        _initialized = True
        logger.info(
            "OpenTelemetry initialized: service=%s, sample_rate=%.2f, endpoint=%s",
            settings.otel_service_name,
            settings.otel_traces_sample_rate,
            settings.otel_exporter_otlp_endpoint or "console",
        )

    except ImportError as e:
        logger.warning("OpenTelemetry packages not installed: %s", e)
    except Exception as e:
        logger.error("Failed to initialize OpenTelemetry: %s", e)


def _configure_otlp_exporters(
    tracer_provider,
    endpoint: str,
    protocol: str,
    resource,
    metrics_interval_ms: int,
) -> None:
    """Configure OTLP exporters for traces."""
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    if protocol == "grpc":
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        span_exporter = OTLPSpanExporter(endpoint=endpoint)
    else:
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        # HTTP endpoint typically needs /v1/traces suffix
        http_endpoint = endpoint.rstrip("/") + "/v1/traces"
        span_exporter = OTLPSpanExporter(endpoint=http_endpoint)

    tracer_provider.add_span_processor(BatchSpanProcessor(span_exporter))


def _configure_console_exporters(tracer_provider) -> None:
    """Configure console exporters for development."""
    from opentelemetry.sdk.trace.export import SimpleSpanProcessor, ConsoleSpanExporter

    tracer_provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))


def _configure_meter_provider(
    resource,
    endpoint: str | None,
    protocol: str,
    metrics_interval_ms: int,
) -> None:
    """Configure MeterProvider with exporters."""
    from opentelemetry import metrics
    from opentelemetry.sdk.metrics import MeterProvider
    from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader

    readers = []

    # Add OTLP metrics exporter if endpoint configured
    if endpoint:
        if protocol == "grpc":
            from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
            metric_exporter = OTLPMetricExporter(endpoint=endpoint)
        else:
            from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
            http_endpoint = endpoint.rstrip("/") + "/v1/metrics"
            metric_exporter = OTLPMetricExporter(endpoint=http_endpoint)

        readers.append(PeriodicExportingMetricReader(
            metric_exporter,
            export_interval_millis=metrics_interval_ms,
        ))

    # Always add Prometheus exporter for /metrics endpoint
    try:
        from opentelemetry.exporter.prometheus import PrometheusMetricReader
        readers.append(PrometheusMetricReader())
    except ImportError:
        logger.debug("Prometheus exporter not available")

    if readers:
        meter_provider = MeterProvider(resource=resource, metric_readers=readers)
        metrics.set_meter_provider(meter_provider)


def _configure_auto_instrumentation(log_correlation: bool) -> None:
    """Configure auto-instrumentation for FastAPI, HTTPX, and logging."""

    # FastAPI instrumentation
    try:
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        FastAPIInstrumentor().instrument()
        logger.debug("FastAPI auto-instrumentation enabled")
    except ImportError:
        logger.debug("FastAPI instrumentation not available")

    # HTTPX instrumentation
    try:
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
        HTTPXClientInstrumentor().instrument()
        logger.debug("HTTPX auto-instrumentation enabled")
    except ImportError:
        logger.debug("HTTPX instrumentation not available")

    # Logging instrumentation for trace correlation
    if log_correlation:
        try:
            from opentelemetry.instrumentation.logging import LoggingInstrumentor
            LoggingInstrumentor().instrument(set_logging_format=True)
            logger.debug("Logging auto-instrumentation enabled")
        except ImportError:
            logger.debug("Logging instrumentation not available")


def shutdown_observability() -> None:
    """Shutdown OpenTelemetry providers gracefully."""
    global _initialized

    if not _initialized:
        return

    try:
        from opentelemetry import trace, metrics

        tracer_provider = trace.get_tracer_provider()
        if hasattr(tracer_provider, "shutdown"):
            tracer_provider.shutdown()

        meter_provider = metrics.get_meter_provider()
        if hasattr(meter_provider, "shutdown"):
            meter_provider.shutdown()

        _initialized = False
        logger.info("OpenTelemetry shutdown complete")
    except Exception as e:
        logger.error("Error during OpenTelemetry shutdown: %s", e)
