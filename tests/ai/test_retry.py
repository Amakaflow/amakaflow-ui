"""Unit tests for retry logic and error classification."""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock

from workout_ingestor_api.ai.retry import (
    is_retryable_error,
    retry_sync_call,
    retry_async_call,
    DEFAULT_MAX_ATTEMPTS,
)


class TestIsRetryableError:
    """Test error classification for retry decisions."""

    # --- Retryable errors (should return True) ---

    @pytest.mark.parametrize(
        "error_message",
        [
            "Rate limit exceeded",
            "rate limit reached",
            "Error code: 429",
            "Status 429: Too Many Requests",
            "You have exceeded your rate limit",
        ],
    )
    def test_rate_limit_errors_are_retryable(self, error_message):
        """429 rate limit errors should be retryable."""
        exception = Exception(error_message)
        assert is_retryable_error(exception) is True

    @pytest.mark.parametrize("status_code", ["500", "502", "503", "504"])
    def test_server_errors_5xx_are_retryable(self, status_code):
        """5xx server errors should be retryable."""
        exception = Exception(f"Server error: {status_code}")
        assert is_retryable_error(exception) is True

    @pytest.mark.parametrize(
        "error_message",
        [
            "Request timed out",
            "Connection timed out after 30s",
            "Operation timed out",
            "Read timeout",
        ],
    )
    def test_timeout_errors_are_retryable(self, error_message):
        """Timeout errors should be retryable."""
        exception = Exception(error_message)
        assert is_retryable_error(exception) is True

    def test_timeout_exception_type_is_retryable(self):
        """Exception with 'timeout' in class name should be retryable."""

        class ReadTimeoutError(Exception):
            pass

        exception = ReadTimeoutError("request failed")
        assert is_retryable_error(exception) is True

    @pytest.mark.parametrize(
        "error_message",
        [
            "Connection refused",
            "Connection reset by peer",
            "Failed to establish connection",
        ],
    )
    def test_connection_errors_are_retryable(self, error_message):
        """Connection errors should be retryable."""
        exception = Exception(error_message)
        assert is_retryable_error(exception) is True

    def test_connection_exception_type_is_retryable(self):
        """Exception with 'connect' in class name should be retryable."""

        class ConnectionResetError(Exception):
            pass

        exception = ConnectionResetError("connection lost")
        assert is_retryable_error(exception) is True

    # --- Non-retryable errors (should return False) ---

    @pytest.mark.parametrize(
        "error_message",
        [
            "Error 400: Bad Request",
            "Status code: 400",
            "Invalid request format: 400",
        ],
    )
    def test_bad_request_400_not_retryable(self, error_message):
        """400 bad request errors should NOT be retryable."""
        exception = Exception(error_message)
        assert is_retryable_error(exception) is False

    @pytest.mark.parametrize(
        "error_message",
        [
            "Error 401: Unauthorized",
            "Authentication failed: 401",
            "Invalid authentication credentials",
            "Unauthorized access",
        ],
    )
    def test_auth_errors_401_not_retryable(self, error_message):
        """401 authentication errors should NOT be retryable."""
        exception = Exception(error_message)
        assert is_retryable_error(exception) is False

    @pytest.mark.parametrize(
        "error_message",
        [
            "Error 403: Forbidden",
            "Status code: 403",
        ],
    )
    def test_forbidden_403_not_retryable(self, error_message):
        """403 forbidden errors should NOT be retryable."""
        exception = Exception(error_message)
        assert is_retryable_error(exception) is False

    @pytest.mark.parametrize(
        "error_message",
        [
            "Error 404: Not Found",
            "Resource not found: 404",
        ],
    )
    def test_not_found_404_not_retryable(self, error_message):
        """404 not found errors should NOT be retryable."""
        exception = Exception(error_message)
        assert is_retryable_error(exception) is False

    @pytest.mark.parametrize(
        "error_message",
        [
            "Invalid API key provided",
            "Invalid key format",
            "API key is invalid",
        ],
    )
    def test_invalid_key_errors_not_retryable(self, error_message):
        """Invalid API key errors should NOT be retryable."""
        exception = Exception(error_message)
        assert is_retryable_error(exception) is False

    @pytest.mark.parametrize(
        "error_message",
        [
            "Quota exceeded for this month",
            "You have exceeded your quota",
            "Billing quota exceeded",
        ],
    )
    def test_quota_exceeded_not_retryable(self, error_message):
        """Quota exceeded errors should NOT be retryable."""
        exception = Exception(error_message)
        assert is_retryable_error(exception) is False

    def test_unknown_errors_not_retryable_by_default(self):
        """Unknown/unrecognized errors should NOT be retryable."""
        exception = Exception("Something completely unexpected happened")
        assert is_retryable_error(exception) is False


class TestRetrySyncCall:
    """Test synchronous retry execution."""

    def test_successful_call_returns_immediately(self):
        """Successful calls should return without retry."""
        mock_func = MagicMock(return_value="success")

        result = retry_sync_call(mock_func, max_attempts=3)

        assert result == "success"
        assert mock_func.call_count == 1

    def test_retryable_error_retries_up_to_max_attempts(self):
        """Retryable errors should retry up to max_attempts."""
        mock_func = MagicMock(side_effect=Exception("Error 503: Service Unavailable"))

        with pytest.raises(Exception, match="503"):
            retry_sync_call(
                mock_func,
                max_attempts=3,
                min_wait_seconds=0.01,  # Fast for testing
                max_wait_seconds=0.02,
            )

        assert mock_func.call_count == 3

    def test_non_retryable_error_fails_immediately(self):
        """Non-retryable errors should fail without retry."""
        mock_func = MagicMock(side_effect=Exception("Error 401: Unauthorized"))

        with pytest.raises(Exception, match="401"):
            retry_sync_call(mock_func, max_attempts=3)

        assert mock_func.call_count == 1  # No retry

    def test_eventual_success_after_failures(self):
        """Should return result if call succeeds within max_attempts."""
        mock_func = MagicMock(
            side_effect=[
                Exception("Error 503"),
                Exception("Error 503"),
                "success",
            ]
        )

        result = retry_sync_call(
            mock_func,
            max_attempts=3,
            min_wait_seconds=0.01,
            max_wait_seconds=0.02,
        )

        assert result == "success"
        assert mock_func.call_count == 3

    def test_arguments_passed_to_function(self):
        """Arguments should be passed through to the function."""
        mock_func = MagicMock(return_value="result")

        retry_sync_call(mock_func, "arg1", "arg2", kwarg1="value1")

        mock_func.assert_called_once_with("arg1", "arg2", kwarg1="value1")

    def test_default_max_attempts_is_three(self):
        """Default max attempts should be 3."""
        assert DEFAULT_MAX_ATTEMPTS == 3


class TestRetryAsyncCall:
    """Test asynchronous retry execution."""

    @pytest.mark.asyncio
    async def test_successful_async_call_returns_immediately(self):
        """Successful async calls should return without retry."""
        mock_func = AsyncMock(return_value="async_success")

        result = await retry_async_call(mock_func, max_attempts=3)

        assert result == "async_success"
        assert mock_func.call_count == 1

    @pytest.mark.asyncio
    async def test_retryable_error_retries_async(self):
        """Retryable errors should retry asynchronously."""
        mock_func = AsyncMock(side_effect=Exception("Error 429: Rate limited"))

        with pytest.raises(Exception, match="429"):
            await retry_async_call(
                mock_func,
                max_attempts=3,
                min_wait_seconds=0.01,
                max_wait_seconds=0.02,
            )

        assert mock_func.call_count == 3

    @pytest.mark.asyncio
    async def test_non_retryable_error_fails_immediately_async(self):
        """Non-retryable errors should fail without retry in async."""
        mock_func = AsyncMock(side_effect=Exception("Error 400: Bad Request"))

        with pytest.raises(Exception, match="400"):
            await retry_async_call(mock_func, max_attempts=3)

        assert mock_func.call_count == 1

    @pytest.mark.asyncio
    async def test_eventual_success_after_failures_async(self):
        """Should return result if async call succeeds within max_attempts."""
        mock_func = AsyncMock(
            side_effect=[
                Exception("Error 502"),
                "async_success",
            ]
        )

        result = await retry_async_call(
            mock_func,
            max_attempts=3,
            min_wait_seconds=0.01,
            max_wait_seconds=0.02,
        )

        assert result == "async_success"
        assert mock_func.call_count == 2


class TestExponentialBackoff:
    """Test exponential backoff timing."""

    def test_backoff_timing_increases_exponentially(self):
        """Wait times should increase exponentially between retries."""
        wait_times = []

        def capture_sleep(duration):
            wait_times.append(duration)
            # Don't actually sleep in tests

        mock_func = MagicMock(
            side_effect=[
                Exception("Error 503"),
                Exception("Error 503"),
                Exception("Error 503"),
            ]
        )

        with patch("time.sleep", capture_sleep):
            with pytest.raises(Exception):
                retry_sync_call(
                    mock_func,
                    max_attempts=3,
                    min_wait_seconds=1,
                    max_wait_seconds=10,
                )

        # First wait: 1 * 2^0 = 1
        # Second wait: 1 * 2^1 = 2
        # (Third failure doesn't wait, it raises)
        assert len(wait_times) == 2
        assert wait_times[0] == 1.0
        assert wait_times[1] == 2.0

    def test_backoff_respects_max_wait(self):
        """Wait time should be capped at max_wait_seconds."""
        wait_times = []

        def capture_sleep(duration):
            wait_times.append(duration)

        mock_func = MagicMock(
            side_effect=[
                Exception("Error 503"),
                Exception("Error 503"),
                Exception("Error 503"),
                Exception("Error 503"),
                Exception("Error 503"),
            ]
        )

        with patch("time.sleep", capture_sleep):
            with pytest.raises(Exception):
                retry_sync_call(
                    mock_func,
                    max_attempts=5,
                    min_wait_seconds=1,
                    max_wait_seconds=3,  # Cap at 3
                )

        # Wait times should be capped: 1, 2, 3, 3 (not 4 or 8)
        assert all(t <= 3.0 for t in wait_times)

    def test_single_attempt_does_not_sleep(self):
        """With max_attempts=1, should not sleep at all."""
        sleep_called = []

        def capture_sleep(duration):
            sleep_called.append(duration)

        mock_func = MagicMock(side_effect=Exception("Error 503"))

        with patch("time.sleep", capture_sleep):
            with pytest.raises(Exception):
                retry_sync_call(
                    mock_func,
                    max_attempts=1,
                )

        assert len(sleep_called) == 0
        assert mock_func.call_count == 1


class TestHttpxErrors:
    """Test handling of httpx-specific errors."""

    def test_httpx_read_timeout_is_retryable(self):
        """httpx.ReadTimeout should be retryable."""
        import httpx

        error = httpx.ReadTimeout("Read timed out")
        assert is_retryable_error(error) is True

    def test_httpx_connect_timeout_is_retryable(self):
        """httpx.ConnectTimeout should be retryable."""
        import httpx

        error = httpx.ConnectTimeout("Connect timed out")
        assert is_retryable_error(error) is True

    def test_httpx_connect_error_is_retryable(self):
        """httpx.ConnectError should be retryable."""
        import httpx

        error = httpx.ConnectError("Failed to connect")
        assert is_retryable_error(error) is True
