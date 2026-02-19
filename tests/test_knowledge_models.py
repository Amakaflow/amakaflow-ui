"""Unit tests for KB domain models (AMA-653).

Covers:
- All enum values match the DB CHECK constraints
- IngestRequest validation: URL-based types require source_url
- IngestRequest validation: content-based types require raw_content
- Valid payloads pass without error
- Response models serialise correctly
"""

import uuid
from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from application.models.knowledge import (
    CardListResponse,
    CardResponse,
    IngestRequest,
    KnowledgeCard,
    KnowledgeEdge,
    KnowledgeTag,
    ProcessingStatus,
    RelationshipType,
    SearchRequest,
    SearchResponse,
    SourceType,
)


# ---------------------------------------------------------------------------
# SourceType enum
# ---------------------------------------------------------------------------


class TestSourceTypeEnum:
    def test_all_values_present(self):
        expected = {
            "url",
            "youtube",
            "pdf",
            "manual",
            "workout_log",
            "chat_extract",
            "voice_note",
            "image",
            "social_media",
            "email",
            "sensor_data",
            "csv",
        }
        assert {m.value for m in SourceType} == expected

    def test_is_string_enum(self):
        assert isinstance(SourceType.url, str)
        assert SourceType.url == "url"


# ---------------------------------------------------------------------------
# ProcessingStatus enum
# ---------------------------------------------------------------------------


class TestProcessingStatusEnum:
    def test_all_values_present(self):
        expected = {
            "pending",
            "extracting",
            "summarizing",
            "tagging",
            "embedding",
            "linking",
            "complete",
            "failed",
        }
        assert {m.value for m in ProcessingStatus} == expected


# ---------------------------------------------------------------------------
# RelationshipType enum
# ---------------------------------------------------------------------------


class TestRelationshipTypeEnum:
    def test_all_values_present(self):
        expected = {
            "related_to",
            "builds_on",
            "contradicts",
            "same_topic",
            "cites",
        }
        assert {m.value for m in RelationshipType} == expected


# ---------------------------------------------------------------------------
# IngestRequest — URL-based types require source_url
# ---------------------------------------------------------------------------


class TestIngestRequestUrlValidation:
    @pytest.mark.parametrize("source_type", ["url", "youtube", "social_media"])
    def test_url_based_requires_source_url(self, source_type):
        with pytest.raises(ValidationError, match="source_url is required"):
            IngestRequest(source_type=source_type)

    @pytest.mark.parametrize("source_type", ["url", "youtube", "social_media"])
    def test_url_based_with_source_url_passes(self, source_type):
        req = IngestRequest(
            source_type=source_type,
            source_url="https://example.com/content",
        )
        assert req.source_url == "https://example.com/content"


# ---------------------------------------------------------------------------
# IngestRequest — content-based types require raw_content
# ---------------------------------------------------------------------------


class TestIngestRequestContentValidation:
    @pytest.mark.parametrize("source_type", ["manual", "voice_note"])
    def test_content_based_requires_raw_content(self, source_type):
        with pytest.raises(ValidationError, match="raw_content is required"):
            IngestRequest(source_type=source_type)

    @pytest.mark.parametrize("source_type", ["manual", "voice_note"])
    def test_content_based_with_raw_content_passes(self, source_type):
        req = IngestRequest(
            source_type=source_type,
            raw_content="Some detailed fitness notes here.",
        )
        assert req.raw_content == "Some detailed fitness notes here."


# ---------------------------------------------------------------------------
# IngestRequest — unconstrained types accept neither field
# ---------------------------------------------------------------------------


class TestIngestRequestUnconstrained:
    def test_chat_extract_needs_no_extra_fields(self):
        """chat_extract is ingested from conversation history — no URL or content required."""
        req = IngestRequest(source_type="chat_extract")
        assert req.source_type == SourceType.chat_extract


# ---------------------------------------------------------------------------
# SearchRequest — field constraints
# ---------------------------------------------------------------------------


class TestSearchRequest:
    def test_empty_query_rejected(self):
        with pytest.raises(ValidationError):
            SearchRequest(query="")

    def test_defaults(self):
        req = SearchRequest(query="pull-up progression")
        assert req.limit == 10
        assert req.offset == 0
        assert req.tag_names == []
        assert req.min_confidence == 0.0

    def test_limit_bounds(self):
        with pytest.raises(ValidationError):
            SearchRequest(query="test", limit=0)
        with pytest.raises(ValidationError):
            SearchRequest(query="test", limit=101)

    def test_negative_offset_rejected(self):
        with pytest.raises(ValidationError):
            SearchRequest(query="test", offset=-1)

    def test_min_confidence_bounds(self):
        with pytest.raises(ValidationError):
            SearchRequest(query="test", min_confidence=-0.1)
        with pytest.raises(ValidationError):
            SearchRequest(query="test", min_confidence=1.1)


# ---------------------------------------------------------------------------
# IngestRequest — whitespace-only values treated as missing
# ---------------------------------------------------------------------------


class TestIngestRequestWhitespace:
    def test_whitespace_source_url_rejected_for_url_type(self):
        with pytest.raises(ValidationError, match="source_url is required"):
            IngestRequest(source_type="url", source_url="   ")

    def test_whitespace_raw_content_rejected_for_manual_type(self):
        with pytest.raises(ValidationError, match="raw_content is required"):
            IngestRequest(source_type="manual", raw_content="   ")


# ---------------------------------------------------------------------------
# CardListResponse — pagination fields
# ---------------------------------------------------------------------------


class TestCardListResponse:
    def test_empty_list(self):
        resp = CardListResponse(items=[], total=0, limit=10, offset=0)
        assert resp.items == []
        assert resp.total == 0


# ---------------------------------------------------------------------------
# SearchResponse
# ---------------------------------------------------------------------------


class TestSearchResponse:
    def test_construction(self):
        resp = SearchResponse(items=[], total=0, limit=10, offset=0, query="bench press")
        assert resp.query == "bench press"
        assert resp.total == 0
        assert resp.items == []
        assert resp.limit == 10
        assert resp.offset == 0


# ---------------------------------------------------------------------------
# Internal domain models — basic construction and defaults
# ---------------------------------------------------------------------------

_NOW = datetime(2026, 2, 19, 12, 0, 0, tzinfo=timezone.utc)
_UID = str(uuid.uuid4())


def _card_id():
    return uuid.uuid4()


class TestKnowledgeCard:
    def test_construction_with_defaults(self):
        card = KnowledgeCard(
            id=_card_id(),
            user_id=_UID,
            source_type=SourceType.manual,
            created_at=_NOW,
            updated_at=_NOW,
        )
        assert card.processing_status == ProcessingStatus.pending
        assert card.key_takeaways == []
        assert card.metadata == {}
        assert card.embedding is None
        assert card.title is None

    def test_rejects_invalid_source_type(self):
        with pytest.raises(ValidationError):
            KnowledgeCard(
                id=_card_id(),
                user_id=_UID,
                source_type="nonexistent",
                created_at=_NOW,
                updated_at=_NOW,
            )


class TestKnowledgeTag:
    def test_construction(self):
        tag = KnowledgeTag(
            id=_card_id(),
            user_id=_UID,
            name="pull-ups",
            created_at=_NOW,
        )
        assert tag.name == "pull-ups"
        assert tag.tag_type is None


class TestKnowledgeEdge:
    def test_construction_with_default_confidence(self):
        edge = KnowledgeEdge(
            id=_card_id(),
            user_id=_UID,
            source_card_id=_card_id(),
            target_card_id=_card_id(),
            relationship_type=RelationshipType.builds_on,
            created_at=_NOW,
        )
        assert edge.confidence == 1.0

    def test_confidence_bounds(self):
        with pytest.raises(ValidationError):
            KnowledgeEdge(
                id=_card_id(),
                user_id=_UID,
                source_card_id=_card_id(),
                target_card_id=_card_id(),
                relationship_type=RelationshipType.related_to,
                confidence=-0.1,
                created_at=_NOW,
            )
        with pytest.raises(ValidationError):
            KnowledgeEdge(
                id=_card_id(),
                user_id=_UID,
                source_card_id=_card_id(),
                target_card_id=_card_id(),
                relationship_type=RelationshipType.related_to,
                confidence=1.1,
                created_at=_NOW,
            )


# ---------------------------------------------------------------------------
# KnowledgeCard — micro_summary length constraint
# ---------------------------------------------------------------------------


class TestKnowledgeCardMicroSummary:
    def test_micro_summary_over_100_chars_rejected(self):
        with pytest.raises(ValidationError):
            KnowledgeCard(
                id=_card_id(),
                user_id=_UID,
                source_type=SourceType.manual,
                micro_summary="x" * 101,
                created_at=_NOW,
                updated_at=_NOW,
            )

    def test_micro_summary_exactly_100_chars_accepted(self):
        card = KnowledgeCard(
            id=_card_id(),
            user_id=_UID,
            source_type=SourceType.manual,
            micro_summary="x" * 100,
            created_at=_NOW,
            updated_at=_NOW,
        )
        assert len(card.micro_summary) == 100

    def test_embedding_excluded_from_serialization(self):
        card = KnowledgeCard(
            id=_card_id(),
            user_id=_UID,
            source_type=SourceType.manual,
            embedding=[0.1] * 1536,
            created_at=_NOW,
            updated_at=_NOW,
        )
        dumped = card.model_dump()
        assert "embedding" not in dumped


# ---------------------------------------------------------------------------
# KnowledgeTag — name constraints
# ---------------------------------------------------------------------------


class TestKnowledgeTagName:
    def test_empty_name_rejected(self):
        with pytest.raises(ValidationError):
            KnowledgeTag(id=_card_id(), user_id=_UID, name="", created_at=_NOW)

    def test_name_over_100_chars_rejected(self):
        with pytest.raises(ValidationError):
            KnowledgeTag(id=_card_id(), user_id=_UID, name="x" * 101, created_at=_NOW)


# ---------------------------------------------------------------------------
# IngestRequest — file-based types require at least one content field
# ---------------------------------------------------------------------------


class TestIngestRequestFileBasedTypes:
    @pytest.mark.parametrize("source_type", ["pdf", "csv", "image", "email", "sensor_data", "workout_log"])
    def test_file_based_with_no_content_rejected(self, source_type):
        with pytest.raises(ValidationError, match="source_url or raw_content is required"):
            IngestRequest(source_type=source_type)

    @pytest.mark.parametrize("source_type", ["pdf", "csv", "image", "email", "sensor_data", "workout_log"])
    def test_file_based_with_source_url_accepted(self, source_type):
        req = IngestRequest(source_type=source_type, source_url="https://storage.example.com/file")
        assert req.source_type.value == source_type

    @pytest.mark.parametrize("source_type", ["pdf", "csv", "image", "email", "sensor_data", "workout_log"])
    def test_file_based_with_raw_content_accepted(self, source_type):
        req = IngestRequest(source_type=source_type, raw_content="raw bytes or text")
        assert req.source_type.value == source_type
