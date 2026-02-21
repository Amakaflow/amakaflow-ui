"""Execute the full KB ingestion pipeline for one piece of content (AMA-660).

Pipeline stages (matching ProcessingStatus):
  pending → extracting → summarizing → tagging → embedding → linking → complete

On any failure the card is set to 'failed' and the exception re-raised.
"""

import hashlib
import logging
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from application.models.knowledge import IngestRequest, ProcessingStatus
from application.ports.content_extractor_port import ContentExtractorPort
from application.ports.knowledge_repository import KnowledgeRepository
from backend.services.embedding_service import EmbeddingService
from backend.services.knowledge_llm_service import KnowledgeLLMService

logger = logging.getLogger(__name__)

# Embed title + summary; cap at 8000 chars (~6000 tokens, well under limit)
_MAX_EMBED_CHARS = 8000


class IngestKnowledgeUseCase:
    """Execute the full KB ingestion pipeline for one piece of content.

    Args:
        repo: KnowledgeRepository for persistence.
        llm_service: For summarise / tag / relationship operations.
        embedding_service: OpenAI text-embedding-3-small wrapper.
        extractors: ContentExtractorPort implementations (url, youtube, etc.).
    """

    def __init__(
        self,
        repo: KnowledgeRepository,
        llm_service: KnowledgeLLMService,
        embedding_service: EmbeddingService,
        extractors: List[ContentExtractorPort],
    ) -> None:
        self._repo = repo
        self._llm = llm_service
        self._embedding = embedding_service
        self._extractors = extractors

    async def execute(self, user_id: str, request: IngestRequest) -> Dict[str, Any]:
        """Run the ingest pipeline and return the final card dict.

        Returns the existing card without re-processing if source_url already exists.
        Sets processing_status='failed' and re-raises on any unhandled error.
        """
        # --- Deduplication ---
        if request.source_url:
            existing = self._repo.find_by_source_url(user_id, request.source_url)
            if existing:
                logger.info("Duplicate URL — returning card %s", existing["id"])
                return existing

        # --- Create card (pending) ---
        card = self._repo.create_card(user_id, {
            "title": request.title,
            "raw_content": request.raw_content,
            "source_type": request.source_type.value,
            "source_url": request.source_url,
            "metadata": request.metadata,
            "processing_status": ProcessingStatus.pending.value,
        })

        try:
            card_id = UUID(card["id"])

            # Stage: extracting
            self._repo.update_card(card_id, user_id,
                                   {"processing_status": ProcessingStatus.extracting.value})
            raw_content, title, source_url = self._extract(request)
            card = self._repo.update_card(card_id, user_id, {
                "raw_content": raw_content,
                "title": title or request.title,
                "source_url": source_url or request.source_url,
            }) or card

            # Stage: summarizing
            self._repo.update_card(card_id, user_id,
                                   {"processing_status": ProcessingStatus.summarizing.value})
            summary_result = await self._llm.summarize(raw_content or "")
            card = self._repo.update_card(card_id, user_id, {
                "summary": summary_result.get("summary", ""),
                "micro_summary": summary_result.get("micro_summary", ""),
                "key_takeaways": summary_result.get("key_takeaways", []),
            }) or card

            # Stage: tagging
            self._repo.update_card(card_id, user_id,
                                   {"processing_status": ProcessingStatus.tagging.value})
            existing_tag_names = [t["name"] for t in self._repo.list_tags(user_id)]
            suggested = await self._llm.discover_tags(raw_content or "", existing_tag_names)
            tag_ids: List[UUID] = []
            confidences: List[float] = []
            for tag in suggested:
                t = self._repo.get_or_create_tag(user_id, tag["name"], tag["tag_type"])
                tag_ids.append(UUID(t["id"]))
                confidences.append(tag["confidence"])
            if tag_ids:
                self._repo.add_card_tags(card_id, tag_ids, confidences)

            # Stage: embedding
            self._repo.update_card(card_id, user_id,
                                   {"processing_status": ProcessingStatus.embedding.value})
            embed_text = self._build_embed_text(card or {})
            content_hash = hashlib.sha256(embed_text.encode()).hexdigest()
            vector = self._embedding.embed_single(embed_text)
            card = self._repo.update_card(card_id, user_id, {
                "embedding": vector,
                "embedding_content_hash": content_hash,
            }) or card

            # Stage: linking
            self._repo.update_card(card_id, user_id,
                                   {"processing_status": ProcessingStatus.linking.value})
            await self._link_card(user_id, card_id, (card or {}).get("summary", ""))

            # Complete
            card = self._repo.update_card(card_id, user_id,
                                          {"processing_status": ProcessingStatus.complete.value}) or card

            # Usage
            self._repo.increment_usage(user_id, cards_ingested=1)

            return card

        except Exception as exc:
            logger.error("Ingestion failed for card %s: %s", card_id, exc)
            self._repo.update_card(card_id, user_id,
                                   {"processing_status": ProcessingStatus.failed.value})
            raise

    def _extract(self, request: IngestRequest) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """Run the first matching extractor. Returns (raw_content, title, source_url)."""
        source_type = request.source_type.value
        for extractor in self._extractors:
            if extractor.can_handle(source_type):
                result = extractor.extract({
                    "source_type": source_type,
                    "source_url": request.source_url,
                    "raw_content": request.raw_content,
                })
                return (
                    result.get("raw_content"),
                    result.get("title"),
                    result.get("source_url"),
                )
        # No extractor — use supplied raw_content as-is
        return request.raw_content, request.title, request.source_url

    def _build_embed_text(self, card: Dict[str, Any]) -> str:
        """Concatenate title + summary, capped at _MAX_EMBED_CHARS."""
        parts = []
        if card.get("title"):
            parts.append(card["title"])
        if card.get("summary"):
            parts.append(card["summary"])
        return "\n".join(parts)[:_MAX_EMBED_CHARS]

    async def _link_card(
        self, user_id: str, card_id: UUID, summary: str
    ) -> None:
        """Find candidates and create edges for genuinely related cards."""
        result = self._repo.list_cards(
            user_id, limit=20, processing_status=ProcessingStatus.complete.value
        )
        candidates = [
            {"id": str(c["id"]), "summary": c.get("summary", "")}
            for c in result.get("items", [])
            if c["id"] != str(card_id) and c.get("summary")
        ]
        if not candidates:
            return
        relationships = await self._llm.judge_relationships(summary, candidates)
        for rel in relationships:
            try:
                self._repo.create_edge(
                    user_id=user_id,
                    source_card_id=card_id,
                    target_card_id=UUID(rel["card_id"]),
                    relationship_type=rel["relationship_type"],
                    confidence=rel["confidence"],
                )
            except Exception as exc:
                logger.warning("Edge creation failed for %s: %s", rel["card_id"], exc)
