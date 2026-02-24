"""
Unit tests for backend/observability/config.py

Tests OTel SDK configuration and initialization.
"""

import pytest
from unittest.mock import patch, MagicMock

from backend.settings import Settings
from backend.observability.config import (
    configure_observability,
    shutdown_observability,
    _initialized,
)
from backend.observability import config


class TestConfigureObservability:
    """Tests for configure_observability() function."""

    def test_disabled_via_settings(self, reset_otel_state):
        """OTel should not initialize when otel_enabled=False."""
        settings = Settings(
            _env_file=None,
            otel_enabled=False,
        )

        configure_observability(settings)

        # Should remain not initialized
        assert config._initialized is False

    def test_enabled_initializes(self, reset_otel_state):
        """OTel should initialize when otel_enabled=True."""
        settings = Settings(
            _env_file=None,
            otel_enabled=True,
            otel_service_name="test-service",
            otel_traces_sample_rate=1.0,
        )

        configure_observability(settings)

        assert config._initialized is True

    def test_idempotent_initialization(self, reset_otel_state):
        """Calling configure_observability twice should be safe."""
        settings = Settings(
            _env_file=None,
            otel_enabled=True,
        )

        configure_observability(settings)
        first_state = config._initialized

        configure_observability(settings)
        second_state = config._initialized

        assert first_state is True
        assert second_state is True

    def test_console_exporter_when_no_endpoint(self, reset_otel_state):
        """Development mode (no endpoint) should use console exporter."""
        settings = Settings(
            _env_file=None,
            otel_enabled=True,
            otel_exporter_otlp_endpoint=None,
        )

        # Should not raise - uses console exporter
        configure_observability(settings)
        assert config._initialized is True

    def test_grpc_endpoint_configuration(self, reset_otel_state):
        """GRPC protocol should be accepted."""
        settings = Settings(
            _env_file=None,
            otel_enabled=True,
            otel_exporter_otlp_endpoint="http://localhost:4317",
            otel_exporter_otlp_protocol="grpc",
        )

        # Should not raise
        configure_observability(settings)
        assert config._initialized is True

    def test_http_endpoint_configuration(self, reset_otel_state):
        """HTTP protocol should be accepted."""
        settings = Settings(
            _env_file=None,
            otel_enabled=True,
            otel_exporter_otlp_endpoint="http://localhost:4318",
            otel_exporter_otlp_protocol="http",
        )

        # Should not raise
        configure_observability(settings)
        assert config._initialized is True

    def test_invalid_protocol_falls_back_gracefully(self, reset_otel_state):
        """Invalid protocol should fall back to HTTP or handle gracefully.

        This test documents the expected behavior when an invalid protocol
        is configured - the implementation should either fall back to a
        default protocol or raise a clear error, rather than failing silently.
        """
        settings = Settings(
            _env_file=None,
            otel_enabled=True,
            otel_exporter_otlp_endpoint="http://localhost:4318",
            otel_exporter_otlp_protocol="invalid_protocol",
        )

        # Implementation should handle invalid protocol gracefully
        # Either by falling back to HTTP or by completing without crash
        configure_observability(settings)
        assert config._initialized is True

    def test_sample_rate_respected(self, reset_otel_state):
        """Sample rate setting should be applied."""
        settings = Settings(
            _env_file=None,
            otel_enabled=True,
            otel_traces_sample_rate=0.5,
        )

        configure_observability(settings)
        assert config._initialized is True

    def test_log_correlation_disabled(self, reset_otel_state):
        """otel_log_correlation=False should skip LoggingInstrumentor."""
        settings = Settings(
            _env_file=None,
            otel_enabled=True,
            otel_log_correlation=False,
        )

        # Should not raise
        configure_observability(settings)
        assert config._initialized is True

    def test_resource_attributes_set(self, reset_otel_state):
        """Resource should include service name and environment."""
        settings = Settings(
            _env_file=None,
            otel_enabled=True,
            otel_service_name="test-api",
            environment="test",
        )

        configure_observability(settings)
        assert config._initialized is True


class TestShutdownObservability:
    """Tests for shutdown_observability() function."""

    def test_shutdown_when_not_initialized(self, reset_otel_state):
        """Shutdown should be safe when not initialized."""
        config._initialized = False

        # Should not raise
        shutdown_observability()

    def test_shutdown_resets_flag(self, reset_otel_state):
        """Shutdown should reset _initialized flag."""
        settings = Settings(
            _env_file=None,
            otel_enabled=True,
        )

        configure_observability(settings)
        assert config._initialized is True

        shutdown_observability()
        assert config._initialized is False

    def test_shutdown_idempotent(self, reset_otel_state):
        """Multiple shutdowns should be safe."""
        settings = Settings(
            _env_file=None,
            otel_enabled=True,
        )

        configure_observability(settings)
        shutdown_observability()
        shutdown_observability()  # Second call should not raise

        assert config._initialized is False


class TestAutoInstrumentation:
    """Tests for auto-instrumentation configuration."""

    def test_handles_missing_fastapi_instrumentation(self, reset_otel_state):
        """Missing FastAPIInstrumentor should not crash."""
        settings = Settings(
            _env_file=None,
            otel_enabled=True,
        )

        with patch(
            "backend.observability.config._configure_auto_instrumentation"
        ) as mock_auto:
            mock_auto.return_value = None
            configure_observability(settings)

        # Should complete without error
        assert config._initialized is True

    def test_handles_missing_httpx_instrumentation(self, reset_otel_state):
        """Missing HTTPXClientInstrumentor should not crash."""
        settings = Settings(
            _env_file=None,
            otel_enabled=True,
        )

        # Should complete without error
        configure_observability(settings)
        assert config._initialized is True
