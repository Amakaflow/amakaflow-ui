"""Knowledge Base REST endpoints (AMA-662).

POST   /api/knowledge/ingest          — ingest a piece of content
GET    /api/knowledge/cards           — list cards (paginated)
GET    /api/knowledge/cards/{card_id} — get a single card
DELETE /api/knowledge/cards/{card_id} — delete a card
POST   /api/knowledge/search          — semantic search
GET    /api/knowledge/tags            — list user's tags
"""

from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from api.deps import (
    get_current_user,
    get_ingest_knowledge_use_case,
    get_knowledge_repository,
    get_search_knowledge_use_case,
)
from application.models.knowledge import (
    CardListResponse,
    CardResponse,
    IngestRequest,
    SearchRequest,
    SearchResponse,
    SourceType,
)
from application.ports.knowledge_repository import KnowledgeRepository
from application.use_cases.ingest_knowledge import IngestKnowledgeUseCase
from application.use_cases.search_knowledge import SearchKnowledgeUseCase

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


@router.post("/ingest", response_model=CardResponse, status_code=201)
async def ingest_knowledge(
    body: IngestRequest,
    user_id: str = Depends(get_current_user),
    use_case: IngestKnowledgeUseCase = Depends(get_ingest_knowledge_use_case),
) -> CardResponse:
    """Ingest a piece of fitness content into the Knowledge Base.

    Runs the full pipeline: extract -> summarise -> tag -> embed -> link.
    Returns the card; processing_status may be 'failed' on pipeline error.
    """
    try:
        card = await use_case.execute(user_id, body)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return _card_to_response(card, repo=None)


@router.get("/cards", response_model=CardListResponse)
def list_knowledge_cards(
    limit: int = 20,
    offset: int = 0,
    source_type: Optional[SourceType] = None,
    processing_status: Optional[str] = None,
    tag: Optional[str] = None,
    user_id: str = Depends(get_current_user),
    repo: KnowledgeRepository = Depends(get_knowledge_repository),
) -> CardListResponse:
    """List the user's knowledge cards with optional filters."""
    source_types = [source_type.value] if source_type else None
    tag_names = [tag] if tag else None
    result = repo.list_cards(
        user_id=user_id,
        limit=min(limit, 100),
        offset=offset,
        source_types=source_types,
        processing_status=processing_status,
        tag_names=tag_names,
    )
    items = [_card_to_response(c, repo=repo) for c in result["items"]]
    return CardListResponse(
        items=items,
        total=result["total"],
        limit=limit,
        offset=offset,
    )


@router.get("/cards/{card_id}", response_model=CardResponse)
def get_knowledge_card(
    card_id: UUID,
    user_id: str = Depends(get_current_user),
    repo: KnowledgeRepository = Depends(get_knowledge_repository),
) -> CardResponse:
    """Fetch a single knowledge card by ID."""
    card = repo.get_card(card_id, user_id)
    if card is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return _card_to_response(card, repo=repo)


@router.delete("/cards/{card_id}", status_code=204)
def delete_knowledge_card(
    card_id: UUID,
    user_id: str = Depends(get_current_user),
    repo: KnowledgeRepository = Depends(get_knowledge_repository),
) -> None:
    """Delete a knowledge card and its tags/edges."""
    deleted = repo.delete_card(card_id, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Card not found")


@router.post("/search", response_model=SearchResponse)
def search_knowledge(
    body: SearchRequest,
    user_id: str = Depends(get_current_user),
    use_case: SearchKnowledgeUseCase = Depends(get_search_knowledge_use_case),
) -> SearchResponse:
    """Semantic search over the user's knowledge cards."""
    result = use_case.execute(user_id, body)
    return SearchResponse(
        items=[_card_to_response(c, repo=None) for c in result["items"]],
        total=result["total"],
        limit=result["limit"],
        offset=result["offset"],
        query=result["query"],
    )


@router.get("/tags")
def list_knowledge_tags(
    user_id: str = Depends(get_current_user),
    repo: KnowledgeRepository = Depends(get_knowledge_repository),
) -> List[Dict[str, Any]]:
    """List all tags for the current user."""
    return repo.list_tags(user_id)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _card_to_response(card: dict, repo) -> CardResponse:
    """Map a raw card dict to CardResponse, fetching tags if repo is provided."""
    tags: List[str] = []
    if repo is not None:
        try:
            tag_rows = repo.get_card_tags(UUID(str(card["id"])))
            tags = [t["name"] for t in tag_rows]
        except Exception:
            pass
    return CardResponse(
        id=card["id"],
        title=card.get("title"),
        summary=card.get("summary"),
        micro_summary=card.get("micro_summary"),
        key_takeaways=card.get("key_takeaways") or [],
        source_type=card["source_type"],
        source_url=card.get("source_url"),
        processing_status=card["processing_status"],
        tags=tags,
        created_at=card["created_at"],
        updated_at=card["updated_at"],
    )
