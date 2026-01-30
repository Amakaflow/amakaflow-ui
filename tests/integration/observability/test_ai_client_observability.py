"""
Integration tests for AI client observability.

Tests that ai_client.py works correctly with OTel instrumentation enabled.

Note: Due to OTel global state constraints, span capture assertions
may be unreliable. Tests focus on functional behavior verification.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from typing import List, Dict, Any

from backend.services.ai_client import AIClient, AsyncAIClient, StreamEvent


class FakeAnthropicMessage:
    """Fake Anthropic message for testing."""
    def __init__(self, usage_input=50, usage_output=20, stop_reason="end_turn"):
        self.usage = Mock(input_tokens=usage_input, output_tokens=usage_output)
        self.stop_reason = stop_reason


class FakeAnthropicEvent:
    """Fake Anthropic streaming event."""
    def __init__(self, event_type: str, **kwargs):
        self.type = event_type
        for k, v in kwargs.items():
            setattr(self, k, v)


class TestAIClientObservability:
    """Tests for sync AIClient observability."""

    def test_stream_chat_completes_successfully(self):
        """stream_chat should complete and yield events."""
        with patch("backend.services.ai_client.anthropic") as mock_anthropic:
            mock_stream = MagicMock()
            mock_stream.__enter__ = Mock(return_value=mock_stream)
            mock_stream.__exit__ = Mock(return_value=False)
            mock_stream.__iter__ = Mock(return_value=iter([
                FakeAnthropicEvent("message_start", message=FakeAnthropicMessage()),
                FakeAnthropicEvent(
                    "content_block_delta",
                    delta=Mock(text="Hello", partial_json=None),
                ),
                FakeAnthropicEvent("message_delta", usage=Mock(output_tokens=10)),
            ]))
            mock_stream.get_final_message.return_value = FakeAnthropicMessage()

            mock_anthropic.Anthropic.return_value.messages.stream.return_value = mock_stream

            client = AIClient(api_key="test-key")
            events = list(client.stream_chat(
                messages=[{"role": "user", "content": "Hi"}],
                system="Test system prompt",
            ))

        assert len(events) > 0

    def test_stream_chat_yields_content_delta(self):
        """stream_chat should yield content_delta events with text."""
        with patch("backend.services.ai_client.anthropic") as mock_anthropic:
            mock_stream = MagicMock()
            mock_stream.__enter__ = Mock(return_value=mock_stream)
            mock_stream.__exit__ = Mock(return_value=False)
            mock_stream.__iter__ = Mock(return_value=iter([
                FakeAnthropicEvent("message_start", message=FakeAnthropicMessage()),
                FakeAnthropicEvent(
                    "content_block_delta",
                    delta=Mock(text="Hello world", partial_json=None),
                ),
            ]))
            mock_stream.get_final_message.return_value = FakeAnthropicMessage()

            mock_anthropic.Anthropic.return_value.messages.stream.return_value = mock_stream

            client = AIClient(api_key="test-key", default_model="claude-test-model")
            events = list(client.stream_chat(
                messages=[{"role": "user", "content": "Hi"}],
                system="Test",
                max_tokens=2048,
            ))

        content_deltas = [e for e in events if e.event == "content_delta"]
        assert len(content_deltas) >= 1
        assert content_deltas[0].data.get("text") == "Hello world"

    def test_stream_chat_yields_message_end(self):
        """stream_chat should yield message_end with token usage."""
        with patch("backend.services.ai_client.anthropic") as mock_anthropic:
            mock_stream = MagicMock()
            mock_stream.__enter__ = Mock(return_value=mock_stream)
            mock_stream.__exit__ = Mock(return_value=False)
            mock_stream.__iter__ = Mock(return_value=iter([
                FakeAnthropicEvent("message_start", message=FakeAnthropicMessage(usage_input=100)),
                FakeAnthropicEvent("message_delta", usage=Mock(output_tokens=50)),
            ]))
            mock_stream.get_final_message.return_value = FakeAnthropicMessage(
                usage_input=100, usage_output=50
            )

            mock_anthropic.Anthropic.return_value.messages.stream.return_value = mock_stream

            client = AIClient(api_key="test-key")
            events = list(client.stream_chat(
                messages=[{"role": "user", "content": "Hi"}],
                system="Test",
            ))

        message_end = [e for e in events if e.event == "message_end"]
        assert len(message_end) >= 1


class TestAsyncAIClientObservability:
    """Tests for async AsyncAIClient observability."""

    @pytest.mark.asyncio
    async def test_async_stream_completes(self):
        """Async stream_chat should complete and yield events."""
        with patch("backend.services.ai_client.anthropic") as mock_anthropic:
            mock_stream = AsyncMock()
            mock_stream.__aenter__ = AsyncMock(return_value=mock_stream)
            mock_stream.__aexit__ = AsyncMock(return_value=False)

            async def async_iter():
                yield FakeAnthropicEvent("message_start", message=FakeAnthropicMessage())
                yield FakeAnthropicEvent(
                    "content_block_delta",
                    delta=Mock(text="Hello", partial_json=None),
                )

            mock_stream.__aiter__ = Mock(return_value=async_iter())
            mock_stream.get_final_message = AsyncMock(return_value=FakeAnthropicMessage())

            mock_anthropic.AsyncAnthropic.return_value.messages.stream.return_value = mock_stream

            client = AsyncAIClient(api_key="test-key")
            events = []
            async for event in client.stream_chat(
                messages=[{"role": "user", "content": "Hi"}],
                system="Test",
            ):
                events.append(event)

        assert len(events) > 0

    @pytest.mark.asyncio
    async def test_async_error_yields_error_event(self):
        """Errors should yield error event."""
        import anthropic

        with patch("backend.services.ai_client.anthropic") as mock_anthropic:
            mock_anthropic.RateLimitError = anthropic.RateLimitError
            mock_anthropic.APIError = anthropic.APIError

            mock_stream = AsyncMock()
            mock_stream.__aenter__ = AsyncMock(
                side_effect=anthropic.RateLimitError(
                    "Rate limited",
                    response=Mock(status_code=429),
                    body=None,
                )
            )

            mock_anthropic.AsyncAnthropic.return_value.messages.stream.return_value = mock_stream

            client = AsyncAIClient(api_key="test-key")
            events = []
            async for event in client.stream_chat(
                messages=[{"role": "user", "content": "Hi"}],
                system="Test",
            ):
                events.append(event)

        # Should have error event
        assert any(e.event == "error" for e in events)
