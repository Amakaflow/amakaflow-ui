"""Domain models for the Fitness Knowledge Base (AMA-653).

Matches the schema defined in:
  amakaflow-db/supabase/migrations/20260218000000_create_knowledge_base_tables.sql
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Enums — values mirror the DB CHECK constraints
# ---------------------------------------------------------------------------


class SourceType(str, Enum):
    url = "url"
    youtube = "youtube"
    pdf = "pdf"
    manual = "manual"
    workout_log = "workout_log"
    chat_extract = "chat_extract"
    voice_note = "voice_note"
    image = "image"
    social_media = "social_media"
    email = "email"
    sensor_data = "sensor_data"
    csv = "csv"


# Source types that require source_url to be set
_URL_BASED_TYPES = {
    SourceType.url,
    SourceType.youtube,
    SourceType.social_media,
}

# Source types that require raw_content to be set
_CONTENT_BASED_TYPES = {
    SourceType.manual,
    SourceType.voice_note,
}

# File-based types that require at least one of source_url or raw_content
_FILE_BASED_TYPES = {
    SourceType.pdf,
    SourceType.csv,
    SourceType.image,
    SourceType.email,
    SourceType.sensor_data,
    SourceType.workout_log,
}


class ProcessingStatus(str, Enum):
    pending = "pending"
    extracting = "extracting"
    summarizing = "summarizing"
    tagging = "tagging"
    embedding = "embedding"
    linking = "linking"
    complete = "complete"
    failed = "failed"


class RelationshipType(str, Enum):
    related_to = "related_to"
    builds_on = "builds_on"
    contradicts = "contradicts"
    same_topic = "same_topic"
    cites = "cites"


# ---------------------------------------------------------------------------
# Internal domain models — mirror DB rows, used inside the service layer
# ---------------------------------------------------------------------------


class KnowledgeCard(BaseModel):
    id: UUID
    user_id: str
    title: Optional[str] = None
    raw_content: Optional[str] = None
    summary: Optional[str] = None
    micro_summary: Optional[str] = Field(default=None, max_length=100)  # watch display
    key_takeaways: List[str] = Field(default_factory=list)
    source_type: SourceType
    source_url: Optional[str] = None
    processing_status: ProcessingStatus = ProcessingStatus.pending
    # excluded from serialization — never expose raw vectors in API responses
    embedding: Optional[List[float]] = Field(default=None, exclude=True)
    embedding_content_hash: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class KnowledgeTag(BaseModel):
    id: UUID
    user_id: str
    name: str = Field(min_length=1, max_length=100)
    tag_type: Optional[str] = None  # topic, muscle_group, equipment, etc.
    created_at: datetime


class KnowledgeEdge(BaseModel):
    id: UUID
    user_id: str
    source_card_id: UUID
    target_card_id: UUID
    relationship_type: RelationshipType
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    created_at: datetime


# ---------------------------------------------------------------------------
# API request types
# ---------------------------------------------------------------------------


class IngestRequest(BaseModel):
    source_type: SourceType
    source_url: Optional[str] = None
    raw_content: Optional[str] = None
    title: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_source_fields(self) -> IngestRequest:
        url = self.source_url.strip() if self.source_url else None
        content = self.raw_content.strip() if self.raw_content else None
        if self.source_type in _URL_BASED_TYPES and not url:
            raise ValueError(f"source_url is required for source_type '{self.source_type.value}'")
        if self.source_type in _CONTENT_BASED_TYPES and not content:
            raise ValueError(f"raw_content is required for source_type '{self.source_type.value}'")
        if self.source_type in _FILE_BASED_TYPES and not url and not content:
            raise ValueError(f"source_url or raw_content is required for source_type '{self.source_type.value}'")
        return self


class SearchRequest(BaseModel):
    query: str = Field(min_length=1)
    limit: int = Field(default=10, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    source_type: Optional[SourceType] = None
    tag_names: List[str] = Field(default_factory=list)
    min_confidence: float = Field(default=0.0, ge=0.0, le=1.0)


# ---------------------------------------------------------------------------
# API response types
# ---------------------------------------------------------------------------


class CardResponse(BaseModel):
    id: UUID
    title: Optional[str] = None
    summary: Optional[str] = None
    micro_summary: Optional[str] = Field(default=None, max_length=100)
    key_takeaways: List[str] = Field(default_factory=list)
    source_type: SourceType
    source_url: Optional[str] = None
    processing_status: ProcessingStatus
    tags: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class CardListResponse(BaseModel):
    items: List[CardResponse]
    total: int
    limit: int
    offset: int


class SearchResponse(BaseModel):
    items: List[CardResponse]
    total: int
    limit: int
    offset: int
    query: str
