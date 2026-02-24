"""Unit tests for SupabaseKnowledgeRepository (AMA-659).

All tests use a mocked Supabase client and assert:
- correct table / RPC is called
- user_id is always present in the query filter (row-level isolation)
- return values are correctly derived from the mock response
"""

import uuid
from unittest.mock import MagicMock, call, patch

import pytest

from infrastructure.db.knowledge_repository import SupabaseKnowledgeRepository


# ---------------------------------------------------------------------------
# Helpers / constants
# ---------------------------------------------------------------------------

USER_ID = "user_abc123"
CARD_ID = uuid.uuid4()
TAG_ID = uuid.uuid4()
EDGE_ID = uuid.uuid4()


def _now_str() -> str:
    return "2026-02-19T12:00:00+00:00"


def _card_row(card_id: uuid.UUID = CARD_ID) -> dict:
    return {
        "id": str(card_id),
        "user_id": USER_ID,
        "title": "Test Card",
        "raw_content": "Some fitness content",
        "source_type": "manual",
        "processing_status": "pending",
        "created_at": _now_str(),
        "updated_at": _now_str(),
        "metadata": {},
        "key_takeaways": [],
    }


def _tag_row(tag_id: uuid.UUID = TAG_ID) -> dict:
    return {
        "id": str(tag_id),
        "user_id": USER_ID,
        "name": "pull-ups",
        "tag_type": "movement_pattern",
        "created_at": _now_str(),
    }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_client():
    """Return a fresh MagicMock standing in for the Supabase client."""
    return MagicMock()


@pytest.fixture
def repo(mock_client):
    """Return SupabaseKnowledgeRepository wired to the mock client."""
    return SupabaseKnowledgeRepository(mock_client)


# ---------------------------------------------------------------------------
# Helper: build a simple fluent-chain mock where every chained attribute
# returns itself, and .execute() returns a mock with .data set to `data`.
# ---------------------------------------------------------------------------


def _chain(mock_client, data, count=None):
    """Configure mock_client so any fluent chain terminates with data.

    Every fluent builder method (select, eq, in_, limit, range, order,
    insert, update, delete, upsert) returns the same chain object, so any
    call sequence resolves to .execute() which returns data/count.
    """
    execute_result = MagicMock()
    execute_result.data = data
    execute_result.count = count

    chain = MagicMock()
    chain.execute.return_value = execute_result

    # Wire every builder method back to chain so chains of arbitrary depth work
    for method in (
        "select", "insert", "update", "delete", "upsert",
        "eq", "neq", "in_", "not_", "is_", "ilike",
        "limit", "range", "order",
    ):
        getattr(chain, method).return_value = chain

    mock_client.table.return_value = chain
    mock_client.rpc.return_value = chain
    return chain


# ===========================================================================
# 1. create_card — returns the created card dict
# ===========================================================================


class TestCreateCard:
    def test_returns_created_card(self, repo, mock_client):
        row = _card_row()
        chain = _chain(mock_client, [row])

        result = repo.create_card(USER_ID, {"title": "Test Card", "source_type": "manual"})

        assert result == row

    def test_inserts_into_knowledge_cards_table(self, repo, mock_client):
        _chain(mock_client, [_card_row()])

        repo.create_card(USER_ID, {"title": "Test Card", "source_type": "manual"})

        mock_client.table.assert_called_once_with("knowledge_cards")

    def test_payload_includes_user_id(self, repo, mock_client):
        chain = _chain(mock_client, [_card_row()])

        repo.create_card(USER_ID, {"title": "Test Card", "source_type": "manual"})

        inserted_payload = chain.insert.call_args[0][0]
        assert inserted_payload["user_id"] == USER_ID

    def test_payload_merges_caller_data(self, repo, mock_client):
        chain = _chain(mock_client, [_card_row()])
        data = {"title": "Deadlift Notes", "source_type": "manual", "summary": "Short"}

        repo.create_card(USER_ID, data)

        inserted_payload = chain.insert.call_args[0][0]
        assert inserted_payload["title"] == "Deadlift Notes"
        assert inserted_payload["source_type"] == "manual"
        assert inserted_payload["summary"] == "Short"


# ===========================================================================
# 2. get_card — returns card when found, None when not found
# ===========================================================================


class TestGetCard:
    def test_returns_card_when_found(self, repo, mock_client):
        row = _card_row()
        _chain(mock_client, [row])

        result = repo.get_card(CARD_ID, USER_ID)

        assert result == row

    def test_returns_none_when_not_found(self, repo, mock_client):
        _chain(mock_client, [])

        result = repo.get_card(CARD_ID, USER_ID)

        assert result is None

    def test_filters_by_user_id(self, repo, mock_client):
        chain = _chain(mock_client, [_card_row()])

        repo.get_card(CARD_ID, USER_ID)

        # Verify user_id eq filter was applied
        eq_calls = chain.eq.call_args_list
        filter_args = [c[0] for c in eq_calls]
        assert ("user_id", USER_ID) in filter_args

    def test_filters_by_card_id(self, repo, mock_client):
        chain = _chain(mock_client, [_card_row()])

        repo.get_card(CARD_ID, USER_ID)

        eq_calls = chain.eq.call_args_list
        filter_args = [c[0] for c in eq_calls]
        assert ("id", str(CARD_ID)) in filter_args


# ===========================================================================
# 3. find_by_source_url — deduplication lookup
# ===========================================================================


class TestFindBySourceUrl:
    SOURCE_URL = "https://example.com/fitness-article"

    def test_returns_card_when_url_matches(self, repo, mock_client):
        row = {**_card_row(), "source_url": self.SOURCE_URL, "source_type": "url"}
        _chain(mock_client, [row])

        result = repo.find_by_source_url(USER_ID, self.SOURCE_URL)

        assert result == row
        assert result["source_url"] == self.SOURCE_URL

    def test_returns_none_when_url_not_found(self, repo, mock_client):
        _chain(mock_client, [])

        result = repo.find_by_source_url(USER_ID, self.SOURCE_URL)

        assert result is None

    def test_query_is_scoped_to_user_id(self, repo, mock_client):
        chain = _chain(mock_client, [])

        repo.find_by_source_url(USER_ID, self.SOURCE_URL)

        eq_calls = chain.eq.call_args_list
        filter_args = [c[0] for c in eq_calls]
        assert ("user_id", USER_ID) in filter_args

    def test_query_filters_on_source_url(self, repo, mock_client):
        chain = _chain(mock_client, [])

        repo.find_by_source_url(USER_ID, self.SOURCE_URL)

        eq_calls = chain.eq.call_args_list
        filter_args = [c[0] for c in eq_calls]
        assert ("source_url", self.SOURCE_URL) in filter_args


# ===========================================================================
# 4. list_cards — paginated results
# ===========================================================================


class TestListCards:
    def test_returns_items_and_total(self, repo, mock_client):
        rows = [_card_row(), _card_row(uuid.uuid4())]
        _chain(mock_client, rows, count=2)

        result = repo.list_cards(USER_ID, limit=10, offset=0)

        assert result["items"] == rows
        assert result["total"] == 2

    def test_returns_empty_list_when_no_cards(self, repo, mock_client):
        _chain(mock_client, [], count=0)

        result = repo.list_cards(USER_ID)

        assert result["items"] == []
        assert result["total"] == 0

    def test_applies_correct_range(self, repo, mock_client):
        chain = _chain(mock_client, [], count=0)

        repo.list_cards(USER_ID, limit=5, offset=10)

        # range(10, 14) because offset=10, limit=5 → 10+5-1=14
        chain.range.assert_called_with(10, 14)

    def test_default_range(self, repo, mock_client):
        chain = _chain(mock_client, [], count=0)

        repo.list_cards(USER_ID)

        # Default limit=20, offset=0 → range(0, 19)
        chain.range.assert_called_with(0, 19)

    def test_query_scoped_to_user_id(self, repo, mock_client):
        chain = _chain(mock_client, [], count=0)

        repo.list_cards(USER_ID)

        chain.eq.assert_any_call("user_id", USER_ID)

    def test_filters_by_source_type_when_provided(self, repo, mock_client):
        chain = _chain(mock_client, [], count=0)

        repo.list_cards(USER_ID, source_types=["manual", "url"])

        chain.in_.assert_called_once_with("source_type", ["manual", "url"])

    def test_filters_by_processing_status_when_provided(self, repo, mock_client):
        chain = _chain(mock_client, [], count=0)

        repo.list_cards(USER_ID, processing_status="complete")

        # eq is called for user_id and processing_status
        eq_calls = chain.eq.call_args_list
        filter_args = [c[0] for c in eq_calls]
        assert ("processing_status", "complete") in filter_args

    def test_ordered_by_created_at_desc(self, repo, mock_client):
        chain = _chain(mock_client, [], count=0)

        repo.list_cards(USER_ID)

        chain.order.assert_called_with("created_at", desc=True)


# ===========================================================================
# 5. search_by_embedding — calls correct RPC with user_id scoping
# ===========================================================================


class TestSearchByEmbedding:
    EMBEDDING = [0.1] * 1536

    def test_calls_correct_rpc(self, repo, mock_client):
        _chain(mock_client, [])

        repo.search_by_embedding(USER_ID, self.EMBEDDING, limit=5)

        mock_client.rpc.assert_called_once_with(
            "knowledge_search_by_embedding",
            {
                "p_user_id": USER_ID,
                "p_embedding": self.EMBEDDING,
                "p_limit": 5,
                "p_min_similarity": 0.5,
            },
        )

    def test_returns_results(self, repo, mock_client):
        row = {**_card_row(), "similarity": 0.92}
        _chain(mock_client, [row])

        results = repo.search_by_embedding(USER_ID, self.EMBEDDING)

        assert len(results) == 1
        assert results[0]["similarity"] == 0.92

    def test_returns_empty_list_on_no_results(self, repo, mock_client):
        _chain(mock_client, [])

        results = repo.search_by_embedding(USER_ID, self.EMBEDDING)

        assert results == []

    def test_passes_min_similarity_threshold(self, repo, mock_client):
        _chain(mock_client, [])

        repo.search_by_embedding(USER_ID, self.EMBEDDING, limit=3, min_similarity=0.75)

        mock_client.rpc.assert_called_once_with(
            "knowledge_search_by_embedding",
            {
                "p_user_id": USER_ID,
                "p_embedding": self.EMBEDDING,
                "p_limit": 3,
                "p_min_similarity": 0.75,
            },
        )

    def test_rpc_params_include_user_id(self, repo, mock_client):
        _chain(mock_client, [])

        repo.search_by_embedding(USER_ID, self.EMBEDDING)

        rpc_params = mock_client.rpc.call_args[0][1]
        assert rpc_params["p_user_id"] == USER_ID


# ===========================================================================
# 6. get_or_create_tag — upsert pattern
# ===========================================================================


class TestGetOrCreateTag:
    def test_returns_existing_tag_without_insert(self, repo, mock_client):
        existing = _tag_row()
        chain = _chain(mock_client, [existing])

        result = repo.get_or_create_tag(USER_ID, "pull-ups", "movement_pattern")

        assert result == existing
        # insert should NOT have been called
        chain.insert.assert_not_called()

    def test_creates_tag_when_not_found(self, repo, mock_client):
        new_tag = _tag_row()

        # First call (select) returns empty; second call (insert) returns new tag
        execute_result_empty = MagicMock()
        execute_result_empty.data = []
        execute_result_empty.count = None

        execute_result_tag = MagicMock()
        execute_result_tag.data = [new_tag]
        execute_result_tag.count = None

        chain = MagicMock()
        # Select chain returns empty, insert chain returns new tag
        select_chain = MagicMock()
        select_chain.eq.return_value = select_chain
        select_chain.limit.return_value = select_chain
        select_chain.execute.return_value = execute_result_empty

        insert_chain = MagicMock()
        insert_chain.execute.return_value = execute_result_tag

        mock_client.table.return_value.select.return_value = select_chain
        mock_client.table.return_value.insert.return_value = insert_chain

        result = repo.get_or_create_tag(USER_ID, "pull-ups", "movement_pattern")

        assert result == new_tag
        mock_client.table.return_value.insert.assert_called_once()

    def test_normalizes_tag_name_to_lowercase(self, repo, mock_client):
        existing = {**_tag_row(), "name": "pull-ups"}

        select_chain = MagicMock()
        select_chain.eq.return_value = select_chain
        select_chain.limit.return_value = select_chain
        execute_result = MagicMock()
        execute_result.data = [existing]
        select_chain.execute.return_value = execute_result

        mock_client.table.return_value.select.return_value = select_chain

        repo.get_or_create_tag(USER_ID, "PULL-UPS", "movement_pattern")

        # eq called with lowercased name
        eq_calls = select_chain.eq.call_args_list
        filter_args = [c[0] for c in eq_calls]
        assert ("name", "pull-ups") in filter_args

    def test_select_is_scoped_to_user_id(self, repo, mock_client):
        select_chain = MagicMock()
        select_chain.eq.return_value = select_chain
        select_chain.limit.return_value = select_chain
        execute_result = MagicMock()
        execute_result.data = [_tag_row()]
        select_chain.execute.return_value = execute_result

        mock_client.table.return_value.select.return_value = select_chain

        repo.get_or_create_tag(USER_ID, "squat", "movement_pattern")

        eq_calls = select_chain.eq.call_args_list
        filter_args = [c[0] for c in eq_calls]
        assert ("user_id", USER_ID) in filter_args


# ===========================================================================
# 7. User-ID scoping — cross-cutting assertion
# ===========================================================================


class TestUserIdScoping:
    """Verify that user_id is always present as a filter in key operations."""

    def test_update_card_scoped_to_user_id(self, repo, mock_client):
        chain = _chain(mock_client, [_card_row()])

        repo.update_card(CARD_ID, USER_ID, {"title": "Updated"})

        eq_calls = chain.eq.call_args_list
        filter_args = [c[0] for c in eq_calls]
        assert ("user_id", USER_ID) in filter_args

    def test_delete_card_scoped_to_user_id(self, repo, mock_client):
        chain = _chain(mock_client, [_card_row()])

        repo.delete_card(CARD_ID, USER_ID)

        eq_calls = chain.eq.call_args_list
        filter_args = [c[0] for c in eq_calls]
        assert ("user_id", USER_ID) in filter_args

    def test_create_edge_includes_user_id_in_payload(self, repo, mock_client):
        edge_row = {
            "id": str(uuid.uuid4()),
            "user_id": USER_ID,
            "source_card_id": str(CARD_ID),
            "target_card_id": str(uuid.uuid4()),
            "relationship_type": "related_to",
            "confidence": 0.9,
            "created_at": _now_str(),
        }
        chain = _chain(mock_client, [edge_row])

        target_id = uuid.uuid4()
        repo.create_edge(USER_ID, CARD_ID, target_id, "related_to", 0.9)

        upserted_payload = chain.upsert.call_args[0][0]
        assert upserted_payload["user_id"] == USER_ID

    def test_increment_usage_sends_user_id_in_rpc(self, repo, mock_client):
        _chain(mock_client, [])

        repo.increment_usage(USER_ID, cards_ingested=3, tokens_used=500)

        rpc_params = mock_client.rpc.call_args[0][1]
        assert rpc_params["p_user_id"] == USER_ID

    def test_list_tags_scoped_to_user_id(self, repo, mock_client):
        chain = _chain(mock_client, [_tag_row()])

        repo.list_tags(USER_ID)

        chain.eq.assert_any_call("user_id", USER_ID)
