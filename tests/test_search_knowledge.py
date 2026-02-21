"""Tests for SearchKnowledgeUseCase (AMA-661)."""
import pytest
from unittest.mock import MagicMock
from uuid import uuid4

from application.models.knowledge import SearchRequest, SourceType
from application.use_cases.search_knowledge import SearchKnowledgeUseCase


@pytest.fixture
def mock_repo():
    repo = MagicMock()
    repo.search_by_embedding.return_value = []
    repo.list_cards.return_value = {"items": [], "total": 0}
    return repo


@pytest.fixture
def mock_embedding():
    svc = MagicMock()
    svc.embed_single.return_value = [0.1] * 1536
    return svc


@pytest.fixture
def use_case(mock_repo, mock_embedding):
    return SearchKnowledgeUseCase(repo=mock_repo, embedding_service=mock_embedding)


def test_search_embeds_query(use_case, mock_embedding):
    request = SearchRequest(query="strength training")
    use_case.execute("user_abc", request)
    mock_embedding.embed_single.assert_called_once_with("strength training")


def test_search_calls_search_by_embedding(use_case, mock_repo):
    request = SearchRequest(query="endurance")
    use_case.execute("user_abc", request)
    mock_repo.search_by_embedding.assert_called_once()
    call_kwargs = mock_repo.search_by_embedding.call_args[1]
    assert call_kwargs["user_id"] == "user_abc"


def test_search_returns_response_shape(use_case, mock_repo):
    card = {"id": str(uuid4()), "title": "Article", "source_type": "url",
            "processing_status": "complete", "similarity": 0.9}
    mock_repo.search_by_embedding.return_value = [card]
    request = SearchRequest(query="running")
    result = use_case.execute("user_abc", request)
    assert "items" in result
    assert "total" in result
    assert "query" in result
    assert result["query"] == "running"
    assert len(result["items"]) == 1


def test_search_filters_by_source_type(use_case, mock_repo):
    card_url = {"id": str(uuid4()), "source_type": "url", "similarity": 0.9}
    card_manual = {"id": str(uuid4()), "source_type": "manual", "similarity": 0.8}
    mock_repo.search_by_embedding.return_value = [card_url, card_manual]
    request = SearchRequest(query="test", source_type=SourceType.url)
    result = use_case.execute("user_abc", request)
    assert len(result["items"]) == 1
    assert result["items"][0]["source_type"] == "url"


def test_search_increments_usage(use_case, mock_repo):
    request = SearchRequest(query="test query")
    use_case.execute("user_abc", request)
    mock_repo.increment_usage.assert_called_once_with("user_abc", queries_count=1)


def test_search_pagination(use_case, mock_repo):
    cards = [{"id": str(uuid4()), "source_type": "manual", "similarity": 0.9 - i*0.01}
             for i in range(5)]
    mock_repo.search_by_embedding.return_value = cards
    request = SearchRequest(query="test", limit=2, offset=1)
    result = use_case.execute("user_abc", request)
    assert len(result["items"]) == 2
    assert result["total"] == 5
    assert result["limit"] == 2
    assert result["offset"] == 1
