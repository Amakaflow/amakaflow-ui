"""Semantic search for knowledge cards (AMA-661)."""

import logging
from typing import Any, Dict, List

from application.models.knowledge import SearchRequest
from application.ports.knowledge_repository import KnowledgeRepository
from backend.services.embedding_service import EmbeddingService

logger = logging.getLogger(__name__)

# Never request below this similarity — returns too much noise
_MIN_SIMILARITY_FLOOR = 0.3


class SearchKnowledgeUseCase:
    """Execute semantic vector search with optional source_type and tag filters.

    Args:
        repo: KnowledgeRepository.
        embedding_service: OpenAI embedding service for query vectorisation.
    """

    def __init__(
        self,
        repo: KnowledgeRepository,
        embedding_service: EmbeddingService,
    ) -> None:
        self._repo = repo
        self._embedding = embedding_service

    def execute(self, user_id: str, request: SearchRequest) -> Dict[str, Any]:
        """Search and return a paginated response dict.

        Returns:
            Dict with 'items', 'total', 'limit', 'offset', 'query'.
        """
        # Embed query
        vector = self._embedding.embed_single(request.query)

        # Fetch more than limit to allow for post-filtering
        fetch_limit = request.limit * 3 if (request.source_type or request.tag_names) else request.limit
        results: List[Dict[str, Any]] = self._repo.search_by_embedding(
            user_id=user_id,
            embedding=vector,
            limit=fetch_limit,
            min_similarity=max(request.min_confidence, _MIN_SIMILARITY_FLOOR),
        )

        # Post-filter: source_type
        if request.source_type:
            results = [r for r in results if r.get("source_type") == request.source_type.value]

        # Post-filter: tag_names (intersect with tag-filtered card IDs)
        if request.tag_names:
            tag_filtered = self._repo.list_cards(
                user_id=user_id,
                limit=500,
                tag_names=request.tag_names,
            )
            tag_card_ids = {str(c["id"]) for c in tag_filtered.get("items", [])}
            results = [r for r in results if str(r["id"]) in tag_card_ids]

        # Pagination slice
        total = len(results)
        paginated = results[request.offset: request.offset + request.limit]

        # Usage
        self._repo.increment_usage(user_id, queries_count=1)

        return {
            "items": paginated,
            "total": total,
            "limit": request.limit,
            "offset": request.offset,
            "query": request.query,
        }
