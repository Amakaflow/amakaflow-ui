"""Port interface for knowledge base storage operations."""

from typing import Any, Dict, List, Optional, Protocol
from uuid import UUID


class KnowledgeRepository(Protocol):
    """Repository protocol for knowledge card, tag, edge, and usage operations.

    Implementations: SupabaseKnowledgeRepository (Postgres + pgvector).
    """

    # ------------------------------------------------------------------
    # Cards
    # ------------------------------------------------------------------

    def create_card(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a knowledge card.

        Args:
            user_id: Owning user's Clerk sub.
            data: Card fields to insert (title, raw_content, source_type, etc.).

        Returns:
            Created card dict including generated 'id' and timestamps.
        """
        ...

    def get_card(self, card_id: UUID, user_id: str) -> Optional[Dict[str, Any]]:
        """Get a single card by ID, scoped to user.

        Args:
            card_id: Card UUID.
            user_id: Owning user — enforces row-level isolation.

        Returns:
            Card dict or None if not found or not owned by user.
        """
        ...

    def update_card(
        self, card_id: UUID, user_id: str, data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Patch a card's fields.

        Args:
            card_id: Card to update.
            user_id: Must own the card.
            data: Fields to update (partial — only provided keys are changed).

        Returns:
            Updated card dict or None if not found.
        """
        ...

    def delete_card(self, card_id: UUID, user_id: str) -> bool:
        """Delete a card and cascade to card_tags/edges.

        Args:
            card_id: Card to delete.
            user_id: Must own the card.

        Returns:
            True if deleted, False if not found.
        """
        ...

    def list_cards(
        self,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
        source_types: Optional[List[str]] = None,
        processing_status: Optional[str] = None,
        tag_names: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """List cards for a user with pagination and optional filters.

        Args:
            user_id: Scope to this user's cards.
            limit: Maximum rows to return.
            offset: Rows to skip for pagination.
            source_types: Optional list of source_type values to filter on.
            processing_status: Optional status to filter on (e.g. 'complete').
            tag_names: Optional list of tag names — return cards matching ANY.

        Returns:
            Dict with keys 'items' (List[Dict]) and 'total' (int).
        """
        ...

    def find_by_source_url(
        self, user_id: str, source_url: str
    ) -> Optional[Dict[str, Any]]:
        """Find an existing card by exact source URL for deduplication.

        Args:
            user_id: Scope to this user's cards.
            source_url: Full URL to match against.

        Returns:
            Card dict or None if no match found.
        """
        ...

    def search_by_embedding(
        self,
        user_id: str,
        embedding: List[float],
        limit: int = 10,
        min_similarity: float = 0.5,
    ) -> List[Dict[str, Any]]:
        """Semantic search using pgvector cosine similarity.

        Delegates to the knowledge_search_by_embedding RPC function (AMA-663).

        Args:
            user_id: Scope to this user's embedded, complete cards.
            embedding: Query vector (1536 dimensions, OpenAI text-embedding-3-small).
            limit: Maximum results to return.
            min_similarity: Minimum cosine similarity threshold (0.0–1.0).

        Returns:
            List of dicts, each containing card fields plus 'similarity' (float),
            ordered by similarity descending.
        """
        ...

    # ------------------------------------------------------------------
    # Tags
    # ------------------------------------------------------------------

    def get_or_create_tag(
        self, user_id: str, name: str, tag_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get existing tag by (user_id, name) or create it if absent.

        Args:
            user_id: Tag is scoped to this user.
            name: Tag name (implementations should lowercase before lookup).
            tag_type: One of topic, muscle_group, equipment, methodology,
                sport, movement_pattern, goal. May be None.

        Returns:
            Tag dict with at least 'id', 'name', 'tag_type'.
        """
        ...

    def list_tags(self, user_id: str) -> List[Dict[str, Any]]:
        """Return all tags for a user.

        Args:
            user_id: Scope to this user's tags.

        Returns:
            List of tag dicts ordered by name.
        """
        ...

    # ------------------------------------------------------------------
    # Card-tag associations
    # ------------------------------------------------------------------

    def add_card_tags(
        self,
        card_id: UUID,
        tag_ids: List[UUID],
        confidences: Optional[List[float]] = None,
    ) -> None:
        """Associate tags with a card (upsert — safe to call multiple times).

        Args:
            card_id: Target card.
            tag_ids: Tags to associate.
            confidences: Optional per-tag AI confidence scores (0.0–1.0).
                Defaults to 1.0 for each tag if omitted.
        """
        ...

    def get_card_tags(self, card_id: UUID) -> List[Dict[str, Any]]:
        """Fetch all tags attached to a card.

        Args:
            card_id: Card whose tags to retrieve.

        Returns:
            List of dicts with 'name', 'tag_type', 'confidence'.
        """
        ...

    def remove_card_tag(self, card_id: UUID, tag_id: UUID) -> None:
        """Remove a specific tag association from a card.

        Args:
            card_id: Card to update.
            tag_id: Tag to detach.
        """
        ...

    # ------------------------------------------------------------------
    # Edges
    # ------------------------------------------------------------------

    def create_edge(
        self,
        user_id: str,
        source_card_id: UUID,
        target_card_id: UUID,
        relationship_type: str,
        confidence: float = 1.0,
    ) -> Dict[str, Any]:
        """Create a directed edge between two cards (upsert on unique constraint).

        Args:
            user_id: Denormalized owner for RLS — must match both cards' user_id.
            source_card_id: Origin card.
            target_card_id: Destination card.
            relationship_type: One of related_to, builds_on, contradicts,
                same_topic, cites.
            confidence: AI-assigned confidence 0.0–1.0.

        Returns:
            Edge dict with at least 'id', 'source_card_id', 'target_card_id',
            'relationship_type', 'confidence'.
        """
        ...

    def get_edges_for_card(self, card_id: UUID) -> List[Dict[str, Any]]:
        """Fetch all edges where the card is source OR target.

        Args:
            card_id: Card whose edges to retrieve.

        Returns:
            List of edge dicts including 'source_card_id', 'target_card_id',
            'relationship_type', 'confidence'.
        """
        ...

    def delete_edge(self, edge_id: UUID, user_id: str) -> bool:
        """Delete an edge by ID, scoped to user.

        Args:
            edge_id: Edge to delete.
            user_id: Must own the edge.

        Returns:
            True if deleted, False if not found.
        """
        ...

    # ------------------------------------------------------------------
    # Usage metrics
    # ------------------------------------------------------------------

    def increment_usage(
        self,
        user_id: str,
        cards_ingested: int = 0,
        queries_count: int = 0,
        tokens_used: int = 0,
        estimated_cost_usd: float = 0.0,
    ) -> None:
        """Upsert usage counters for the current month (YYYY-MM period).

        Delegates to the knowledge_increment_usage RPC function (AMA-663).

        Args:
            user_id: User to charge usage against.
            cards_ingested: Number of new cards processed in this call.
            queries_count: Number of search queries in this call.
            tokens_used: LLM tokens consumed in this call.
            estimated_cost_usd: Dollar cost of LLM + embedding calls.
        """
        ...
