"""Test HTTP error handling with simulated responses."""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
import httpx


class TestRateLimitHandling:
    """Test handling of 429 rate limit responses."""

    def test_openai_rate_limit_triggers_retry(self):
        """OpenAI 429 response should trigger retry logic."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        # Simulate OpenAI rate limit error
        error = Exception("Error code: 429 - Rate limit reached for gpt-4")
        assert is_retryable_error(error) is True

    def test_anthropic_rate_limit_triggers_retry(self):
        """Anthropic rate limit error should trigger retry."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("rate_limit_error: This request would exceed your rate limit")
        assert is_retryable_error(error) is True

    def test_openai_rate_limit_message_format(self):
        """Test various OpenAI rate limit message formats."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error_messages = [
            "Rate limit reached for gpt-4 in organization",
            "Request rate limit exceeded",
            "Error 429: Too many requests",
            "You exceeded your current quota, please check your plan",
        ]

        for msg in error_messages[:-1]:  # Last one is quota, not rate limit
            assert is_retryable_error(Exception(msg)) is True


class TestServerErrorHandling:
    """Test handling of 5xx server errors."""

    @pytest.mark.parametrize(
        "status_code,should_retry",
        [
            (500, True),  # Internal Server Error
            (502, True),  # Bad Gateway
            (503, True),  # Service Unavailable
            (504, True),  # Gateway Timeout
        ],
    )
    def test_server_error_retry_decisions(self, status_code, should_retry):
        """Server errors should be retried based on status code."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception(f"Server returned status {status_code}")
        assert is_retryable_error(error) is should_retry

    def test_500_internal_server_error(self):
        """500 Internal Server Error should be retryable."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("Internal Server Error: 500")
        assert is_retryable_error(error) is True

    def test_502_bad_gateway(self):
        """502 Bad Gateway should be retryable."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("Bad Gateway: The server returned a 502 error")
        assert is_retryable_error(error) is True

    def test_503_service_unavailable(self):
        """503 Service Unavailable should be retryable."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("Service temporarily unavailable (503)")
        assert is_retryable_error(error) is True

    def test_504_gateway_timeout(self):
        """504 Gateway Timeout should be retryable."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("Gateway timeout: 504")
        assert is_retryable_error(error) is True


class TestTimeoutHandling:
    """Test timeout error handling."""

    def test_read_timeout_triggers_retry(self):
        """Read timeout should trigger retry."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = httpx.ReadTimeout("Read timed out")
        assert is_retryable_error(error) is True

    def test_connect_timeout_triggers_retry(self):
        """Connect timeout should trigger retry."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = httpx.ConnectTimeout("Connect timed out")
        assert is_retryable_error(error) is True

    def test_generic_timeout_message_triggers_retry(self):
        """Generic timeout message should trigger retry."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("Request timed out after 30 seconds")
        assert is_retryable_error(error) is True

    def test_socket_timeout_triggers_retry(self):
        """Socket timeout should trigger retry."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("Socket operation timed out")
        assert is_retryable_error(error) is True


class TestHeliconeProxyFailure:
    """Test behavior when Helicone proxy is unreachable."""

    def test_connection_error_to_helicone_is_retryable(self):
        """Connection failure to Helicone should be retryable."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        # Simulate DNS resolution failure or connection refused
        error = httpx.ConnectError("Failed to connect to oai.helicone.ai")
        assert is_retryable_error(error) is True

    def test_helicone_503_is_retryable(self):
        """Helicone returning 503 should be retryable."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("Status 503: Helicone service temporarily unavailable")
        assert is_retryable_error(error) is True

    def test_helicone_dns_failure_is_retryable(self):
        """DNS resolution failure for Helicone should be retryable."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("Failed to resolve oai.helicone.ai: Name or service not known")
        # DNS failures are transient network issues and should be retried
        assert is_retryable_error(error) is True

    def test_dns_getaddrinfo_failure_is_retryable(self):
        """getaddrinfo failures should be retryable."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("getaddrinfo failed for api.openai.com")
        assert is_retryable_error(error) is True

    def test_dns_nodename_failure_is_retryable(self):
        """macOS-style DNS failures should be retryable."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("nodename nor servname provided, or not known")
        assert is_retryable_error(error) is True

    def test_temporary_dns_failure_is_retryable(self):
        """Temporary name resolution failures should be retryable."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("Temporary failure in name resolution")
        assert is_retryable_error(error) is True

    def test_ssl_error_is_not_retryable(self):
        """SSL certificate errors should not be retried."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("SSL certificate verify failed")
        assert is_retryable_error(error) is False


class TestAuthenticationErrors:
    """Test authentication error handling (non-retryable)."""

    def test_invalid_openai_api_key(self):
        """Invalid OpenAI API key should not be retried."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("Error code: 401 - Invalid API key provided")
        assert is_retryable_error(error) is False

    def test_invalid_anthropic_api_key(self):
        """Invalid Anthropic API key should not be retried."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("authentication_error: Invalid API key")
        assert is_retryable_error(error) is False

    def test_invalid_helicone_api_key(self):
        """Invalid Helicone API key should not be retried."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        # Helicone auth errors would come as 401
        error = Exception("401 Unauthorized: Invalid Helicone-Auth header")
        assert is_retryable_error(error) is False

    def test_expired_api_key(self):
        """Expired API key should not be retried."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("API key has expired. Please generate a new key.")
        # Contains "key" but not "invalid key" pattern
        assert is_retryable_error(error) is False


class TestBadRequestErrors:
    """Test bad request error handling (non-retryable)."""

    def test_malformed_request_body(self):
        """Malformed request body should not be retried."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("Error 400: Invalid JSON in request body")
        assert is_retryable_error(error) is False

    def test_missing_required_field(self):
        """Missing required field should not be retried."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("400 Bad Request: Missing required parameter 'model'")
        assert is_retryable_error(error) is False

    def test_invalid_model_name(self):
        """Invalid model name should not be retried."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("Error 400: The model 'gpt-5' does not exist")
        assert is_retryable_error(error) is False

    def test_content_policy_violation(self):
        """Content policy violation should not be retried."""
        from workout_ingestor_api.ai.retry import is_retryable_error

        error = Exception("Error 400: Your request was rejected due to content policy")
        assert is_retryable_error(error) is False


class TestRetryIntegration:
    """Integration tests for retry behavior with simulated errors."""

    def test_retry_exhaustion_with_persistent_503(self):
        """Should exhaust retries on persistent 503 errors."""
        from workout_ingestor_api.ai.retry import retry_sync_call

        call_count = 0

        def failing_function():
            nonlocal call_count
            call_count += 1
            raise Exception("Error 503: Service Unavailable")

        with pytest.raises(Exception, match="503"):
            retry_sync_call(
                failing_function,
                max_attempts=3,
                min_wait_seconds=0.01,
                max_wait_seconds=0.02,
            )

        assert call_count == 3

    def test_no_retry_on_400_error(self):
        """Should not retry on 400 errors."""
        from workout_ingestor_api.ai.retry import retry_sync_call

        call_count = 0

        def failing_function():
            nonlocal call_count
            call_count += 1
            raise Exception("Error 400: Bad Request")

        with pytest.raises(Exception, match="400"):
            retry_sync_call(
                failing_function,
                max_attempts=3,
            )

        assert call_count == 1  # No retries

    def test_success_after_transient_failure(self):
        """Should succeed after transient 503 failures."""
        from workout_ingestor_api.ai.retry import retry_sync_call

        call_count = 0

        def flaky_function():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise Exception("Error 503: Service Unavailable")
            return "success"

        result = retry_sync_call(
            flaky_function,
            max_attempts=5,
            min_wait_seconds=0.01,
            max_wait_seconds=0.02,
        )

        assert result == "success"
        assert call_count == 3
