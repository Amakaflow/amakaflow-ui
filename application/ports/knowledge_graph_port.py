"""Port interface for knowledge graph traversal operations (AMA-655).

Phase 1: Traversal is handled by SupabaseKnowledgeRepository.get_edges_for_card()
combined with application-layer post-processing. This port formalises the contract
for future graph DB migrations.
"""

from typing import Any, Dict, List, Optional, Protocol
from uuid import UUID


class KnowledgeGraphPort(Protocol):
    """Protocol for graph traversal queries on knowledge cards and edges."""

    def get_related_cards(
        self,
        card_id: UUID,
        user_id: str,
        depth: int = 1,
        relationship_types: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Traverse the graph to find cards related to card_id.

        Args:
            card_id: Starting card UUID.
            user_id: Scope — only returns cards owned by this user.
            depth: Number of hops (1 = direct neighbours only; Phase 1 supports 1).
            relationship_types: Optional filter on edge relationship_type values.

        Returns:
            List of card dicts with added keys:
              - 'depth' (int): number of hops from source
              - 'relationship_type' (str): how the card connects
        """
        ...

    def find_candidates_for_linking(
        self,
        card_id: UUID,
        user_id: str,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Return recently-complete cards not yet linked to card_id.

        Used to feed judge_relationships with candidate cards during ingestion.

        Args:
            card_id: Source card to find candidates for.
            user_id: Scope to this user's cards.
            limit: Max candidates.

        Returns:
            List of dicts with at least 'id' (str) and 'summary' (str).
        """
        ...
