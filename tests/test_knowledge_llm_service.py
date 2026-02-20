"""Unit tests for KnowledgeLLMService (AMA-658).

All tests mock the AsyncAIClient.stream_chat method. The mock yields
StreamEvent objects exactly as the real client does so that _collect_stream
can assemble the full response text before JSON parsing.

Coverage:
- summarize: returns dict with summary, micro_summary (≤100 chars), key_takeaways
- discover_tags: returns list of typed tags with confidence scores
- judge_relationships: filters out results with confidence < 0.6
- Edge cases: JSON parse failure safe defaults, micro_summary truncation,
  low-confidence relationship filtering
"""

import json
from unittest.mock import MagicMock

import pytest

from backend.services.ai_client import StreamEvent
from backend.services.knowledge_llm_service import KnowledgeLLMService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_stream(*text_chunks: str):
    """Return an async generator that yields StreamEvents for the given text chunks.

    Simulates the AsyncAIClient.stream_chat async generator interface.
    """
    async def _gen(*args, **kwargs):
        for chunk in text_chunks:
            yield StreamEvent(event="content_delta", data={"text": chunk})
        yield StreamEvent(
            event="message_end",
            data={
                "model": "test-model",
                "input_tokens": 10,
                "output_tokens": 20,
                "latency_ms": 100,
                "stop_reason": "end_turn",
            },
        )

    return _gen


def _mock_client_returning(payload: object) -> MagicMock:
    """Build a mock AI client whose stream_chat returns the JSON-serialised payload."""
    client = MagicMock()
    json_text = json.dumps(payload)
    client.stream_chat = _make_stream(json_text)
    return client


# ---------------------------------------------------------------------------
# summarize
# ---------------------------------------------------------------------------


class TestSummarize:
    @pytest.mark.asyncio
    async def test_returns_all_three_fields(self):
        """summarize() returns a dict with summary, micro_summary, and key_takeaways."""
        payload = {
            "summary": "Progressive overload is the cornerstone of strength training. "
                       "Incrementally increasing load forces muscle adaptation. "
                       "Without it, plateaus are inevitable.",
            "micro_summary": "Add weight each session to keep growing stronger.",
            "key_takeaways": [
                "Increase load by 2.5–5 kg when you hit the top of your rep range.",
                "Track every set to spot stalls early.",
                "Deload every 4–6 weeks to avoid overtraining.",
            ],
        }
        client = _mock_client_returning(payload)
        service = KnowledgeLLMService(ai_client=client)

        result = await service.summarize("Progressive overload explained...")

        assert isinstance(result, dict)
        assert "summary" in result
        assert "micro_summary" in result
        assert "key_takeaways" in result

        assert isinstance(result["summary"], str)
        assert len(result["summary"]) > 0

        assert isinstance(result["micro_summary"], str)
        assert len(result["micro_summary"]) <= 100, (
            f"micro_summary must be ≤100 chars, got {len(result['micro_summary'])}"
        )

        assert isinstance(result["key_takeaways"], list)
        assert len(result["key_takeaways"]) >= 1

    @pytest.mark.asyncio
    async def test_micro_summary_truncated_to_100_chars(self):
        """summarize() truncates micro_summary to 100 chars if Claude returns a longer one."""
        long_micro = "A" * 150  # deliberately too long
        payload = {
            "summary": "Some summary text.",
            "micro_summary": long_micro,
            "key_takeaways": ["Takeaway one."],
        }
        client = _mock_client_returning(payload)
        service = KnowledgeLLMService(ai_client=client)

        result = await service.summarize("content")

        assert len(result["micro_summary"]) == 100

    @pytest.mark.asyncio
    async def test_returns_safe_defaults_on_json_parse_failure(self):
        """summarize() returns empty-but-valid defaults when the response is not JSON."""
        client = MagicMock()
        client.stream_chat = _make_stream("This is definitely not JSON at all.")
        service = KnowledgeLLMService(ai_client=client)

        result = await service.summarize("some content")

        assert result == {"summary": "", "micro_summary": "", "key_takeaways": []}

    @pytest.mark.asyncio
    async def test_uses_sonnet_model(self):
        """summarize() calls stream_chat with the Sonnet model."""
        calls = []

        async def capturing_stream(*args, **kwargs):
            calls.append(kwargs)
            payload = {"summary": "s", "micro_summary": "m", "key_takeaways": []}
            yield StreamEvent(event="content_delta", data={"text": json.dumps(payload)})

        client = MagicMock()
        client.stream_chat = capturing_stream
        service = KnowledgeLLMService(ai_client=client)

        await service.summarize("content")

        assert len(calls) == 1
        assert calls[0].get("model") == "claude-sonnet-4-6"


# ---------------------------------------------------------------------------
# discover_tags
# ---------------------------------------------------------------------------


class TestDiscoverTags:
    @pytest.mark.asyncio
    async def test_returns_typed_tags_with_confidence(self):
        """discover_tags() returns a list of dicts with name, tag_type, confidence."""
        payload = [
            {"name": "progressive-overload", "tag_type": "methodology", "confidence": 0.95},
            {"name": "barbell", "tag_type": "equipment", "confidence": 0.90},
            {"name": "strength", "tag_type": "goal", "confidence": 0.85},
        ]
        client = _mock_client_returning(payload)
        service = KnowledgeLLMService(ai_client=client)

        result = await service.discover_tags("content about barbell strength training")

        assert isinstance(result, list)
        assert len(result) >= 1

        for tag in result:
            assert "name" in tag
            assert "tag_type" in tag
            assert "confidence" in tag
            assert isinstance(tag["name"], str)
            assert isinstance(tag["confidence"], float)
            assert 0.0 <= tag["confidence"] <= 1.0

    @pytest.mark.asyncio
    async def test_tag_type_is_one_of_valid_types(self):
        """discover_tags() normalises invalid tag_type values to 'topic'."""
        payload = [
            {"name": "pull-day", "tag_type": "invalid_type", "confidence": 0.8},
            {"name": "deadlift", "tag_type": "movement_pattern", "confidence": 0.9},
        ]
        client = _mock_client_returning(payload)
        service = KnowledgeLLMService(ai_client=client)

        result = await service.discover_tags("deadlift pull day content")

        # Invalid tag_type should be normalised to "topic"
        pull_day_tag = next((t for t in result if t["name"] == "pull-day"), None)
        assert pull_day_tag is not None
        assert pull_day_tag["tag_type"] == "topic"

        deadlift_tag = next((t for t in result if t["name"] == "deadlift"), None)
        assert deadlift_tag is not None
        assert deadlift_tag["tag_type"] == "movement_pattern"

    @pytest.mark.asyncio
    async def test_existing_tags_passed_in_prompt(self):
        """discover_tags() sends existing_tags to the model (captured via mock)."""
        calls = []

        async def capturing_stream(*args, **kwargs):
            calls.append(kwargs)
            payload = [{"name": "pull-ups", "tag_type": "movement_pattern", "confidence": 0.9}]
            yield StreamEvent(event="content_delta", data={"text": json.dumps(payload)})

        client = MagicMock()
        client.stream_chat = capturing_stream
        service = KnowledgeLLMService(ai_client=client)

        existing = ["pull-ups", "back", "bodyweight"]
        await service.discover_tags("content about pull-ups", existing_tags=existing)

        assert len(calls) == 1
        messages = calls[0].get("messages", [])
        # The user message content should reference existing tags
        user_content = messages[0]["content"]
        for tag in existing:
            assert tag in user_content

    @pytest.mark.asyncio
    async def test_returns_empty_list_on_json_parse_failure(self):
        """discover_tags() returns [] when the response is not valid JSON."""
        client = MagicMock()
        client.stream_chat = _make_stream("not json")
        service = KnowledgeLLMService(ai_client=client)

        result = await service.discover_tags("content")

        assert result == []

    @pytest.mark.asyncio
    async def test_uses_haiku_model(self):
        """discover_tags() calls stream_chat with the Haiku model."""
        calls = []

        async def capturing_stream(*args, **kwargs):
            calls.append(kwargs)
            yield StreamEvent(event="content_delta", data={"text": "[]"})

        client = MagicMock()
        client.stream_chat = capturing_stream
        service = KnowledgeLLMService(ai_client=client)

        await service.discover_tags("content")

        assert calls[0].get("model") == "claude-haiku-4-5-20251001"


# ---------------------------------------------------------------------------
# judge_relationships
# ---------------------------------------------------------------------------


class TestJudgeRelationships:
    @pytest.mark.asyncio
    async def test_filters_out_low_confidence_results(self):
        """judge_relationships() excludes candidates with confidence < 0.6."""
        payload = [
            {"card_id": "card-001", "relationship_type": "builds_on", "confidence": 0.85},
            {"card_id": "card-002", "relationship_type": "related_to", "confidence": 0.55},  # below threshold
            {"card_id": "card-003", "relationship_type": "same_topic", "confidence": 0.60},  # exactly at threshold
            {"card_id": "card-004", "relationship_type": "contradicts", "confidence": 0.30},  # well below
        ]
        client = _mock_client_returning(payload)
        service = KnowledgeLLMService(ai_client=client)

        candidates = [
            {"id": "card-001", "summary": "Periodisation for powerlifting."},
            {"id": "card-002", "summary": "A generic fitness article."},
            {"id": "card-003", "summary": "Linear progression in strength training."},
            {"id": "card-004", "summary": "Unrelated content."},
        ]

        result = await service.judge_relationships("Strength training periodisation.", candidates)

        returned_ids = {r["card_id"] for r in result}
        # card-001 (0.85) and card-003 (0.60) should be included
        assert "card-001" in returned_ids
        assert "card-003" in returned_ids
        # card-002 (0.55) and card-004 (0.30) should be excluded
        assert "card-002" not in returned_ids
        assert "card-004" not in returned_ids

    @pytest.mark.asyncio
    async def test_returns_relationship_type_and_confidence(self):
        """judge_relationships() results include valid relationship_type and confidence fields."""
        payload = [
            {"card_id": "abc-123", "relationship_type": "builds_on", "confidence": 0.92},
        ]
        client = _mock_client_returning(payload)
        service = KnowledgeLLMService(ai_client=client)

        result = await service.judge_relationships(
            "RPE-based training guide.",
            [{"id": "abc-123", "summary": "Autoregulation in strength sports."}],
        )

        assert len(result) == 1
        item = result[0]
        assert item["card_id"] == "abc-123"
        assert item["relationship_type"] == "builds_on"
        assert isinstance(item["confidence"], float)
        assert 0.0 <= item["confidence"] <= 1.0

    @pytest.mark.asyncio
    async def test_returns_empty_list_when_no_candidates(self):
        """judge_relationships() short-circuits and returns [] with no candidates."""
        client = MagicMock()
        service = KnowledgeLLMService(ai_client=client)

        result = await service.judge_relationships("source summary", candidate_cards=[])

        assert result == []
        # stream_chat should NOT have been called
        client.stream_chat.assert_not_called()

    @pytest.mark.asyncio
    async def test_returns_empty_list_on_json_parse_failure(self):
        """judge_relationships() returns [] when the response is not valid JSON."""
        client = MagicMock()
        client.stream_chat = _make_stream("not json at all")
        service = KnowledgeLLMService(ai_client=client)

        result = await service.judge_relationships(
            "source",
            [{"id": "x", "summary": "candidate"}],
        )

        assert result == []

    @pytest.mark.asyncio
    async def test_uses_haiku_model(self):
        """judge_relationships() calls stream_chat with the Haiku model."""
        calls = []

        async def capturing_stream(*args, **kwargs):
            calls.append(kwargs)
            yield StreamEvent(event="content_delta", data={"text": "[]"})

        client = MagicMock()
        client.stream_chat = capturing_stream
        service = KnowledgeLLMService(ai_client=client)

        await service.judge_relationships(
            "source",
            [{"id": "c1", "summary": "candidate 1"}],
        )

        assert calls[0].get("model") == "claude-haiku-4-5-20251001"

    @pytest.mark.asyncio
    async def test_invalid_relationship_type_normalised(self):
        """judge_relationships() normalises unknown relationship_type to 'related_to'."""
        payload = [
            {"card_id": "card-xyz", "relationship_type": "unknown_type", "confidence": 0.80},
        ]
        client = _mock_client_returning(payload)
        service = KnowledgeLLMService(ai_client=client)

        result = await service.judge_relationships(
            "source summary",
            [{"id": "card-xyz", "summary": "candidate summary"}],
        )

        assert len(result) == 1
        assert result[0]["relationship_type"] == "related_to"
