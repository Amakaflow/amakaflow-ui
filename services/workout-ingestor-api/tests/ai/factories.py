"""Factory functions for creating test doubles."""
from unittest.mock import MagicMock


def create_openai_response(content: str, model: str = "gpt-4o"):
    """Create a mock OpenAI ChatCompletion response."""
    mock_response = MagicMock()
    mock_response.id = "chatcmpl-test123"
    mock_response.model = model
    mock_response.choices = [
        MagicMock(
            index=0,
            message=MagicMock(
                role="assistant",
                content=content,
            ),
            finish_reason="stop",
        )
    ]
    mock_response.usage = MagicMock(
        prompt_tokens=10,
        completion_tokens=20,
        total_tokens=30,
    )
    return mock_response


def create_openai_error(status_code: int, message: str):
    """Create a mock OpenAI API error."""
    error = Exception(f"Error code: {status_code} - {message}")
    error.status_code = status_code
    return error


def create_anthropic_response(content: str, model: str = "claude-3-sonnet"):
    """Create a mock Anthropic Message response."""
    mock_response = MagicMock()
    mock_response.id = "msg-test123"
    mock_response.model = model
    mock_response.content = [
        MagicMock(
            type="text",
            text=content,
        )
    ]
    mock_response.stop_reason = "end_turn"
    mock_response.usage = MagicMock(
        input_tokens=10,
        output_tokens=20,
    )
    return mock_response


def create_httpx_error(error_type: str, message: str):
    """Create httpx errors for testing."""
    import httpx

    error_classes = {
        "timeout": httpx.ReadTimeout,
        "connect_timeout": httpx.ConnectTimeout,
        "connect_error": httpx.ConnectError,
    }

    error_class = error_classes.get(error_type, Exception)
    return error_class(message)
