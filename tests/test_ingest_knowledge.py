"""Tests for IngestKnowledgeUseCase (AMA-660)."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from application.models.knowledge import IngestRequest, ProcessingStatus, SourceType
from application.use_cases.ingest_knowledge import IngestKnowledgeUseCase


@pytest.fixture
def mock_repo():
    repo = MagicMock()
    card_id = str(uuid4())
    repo.create_card.return_value = {
        "id": card_id, "user_id": "user_abc",
        "processing_status": "pending", "summary": None,
        "title": "Test", "raw_content": None, "source_url": None,
    }
    repo.update_card.return_value = {
        "id": card_id, "user_id": "user_abc",
        "processing_status": "complete", "summary": "A test summary.",
        "title": "Test", "raw_content": "content",
        "source_url": None,
    }
    repo.find_by_source_url.return_value = None
    repo.list_tags.return_value = []
    repo.get_or_create_tag.return_value = {"id": str(uuid4()), "name": "strength", "tag_type": "topic"}
    repo.list_cards.return_value = {"items": [], "total": 0}
    return repo


@pytest.fixture
def mock_llm():
    llm = MagicMock()
    llm.summarize = AsyncMock(return_value={
        "summary": "A test summary.",
        "micro_summary": "Short summary.",
        "key_takeaways": ["Point 1", "Point 2"],
    })
    llm.discover_tags = AsyncMock(return_value=[
        {"name": "strength", "tag_type": "topic", "confidence": 0.9}
    ])
    llm.judge_relationships = AsyncMock(return_value=[])
    return llm


@pytest.fixture
def mock_embedding():
    svc = MagicMock()
    svc.embed_single.return_value = [0.1] * 1536
    return svc


@pytest.fixture
def use_case(mock_repo, mock_llm, mock_embedding):
    return IngestKnowledgeUseCase(
        repo=mock_repo,
        llm_service=mock_llm,
        embedding_service=mock_embedding,
        extractors=[],
    )


@pytest.mark.asyncio
async def test_ingest_manual_content_returns_complete_card(use_case, mock_repo):
    request = IngestRequest(source_type=SourceType.manual, raw_content="Some fitness content.")
    await use_case.execute("user_abc", request)
    assert mock_repo.create_card.called
    # Final update should set status to complete
    last_update = mock_repo.update_card.call_args_list[-1]
    assert last_update[0][2]["processing_status"] == ProcessingStatus.complete.value


@pytest.mark.asyncio
async def test_ingest_deduplicates_by_source_url(use_case, mock_repo):
    existing = {"id": str(uuid4()), "user_id": "user_abc", "processing_status": "complete"}
    mock_repo.find_by_source_url.return_value = existing
    request = IngestRequest(
        source_type=SourceType.url,
        source_url="https://example.com/article"
    )
    result = await use_case.execute("user_abc", request)
    mock_repo.create_card.assert_not_called()
    assert result["id"] == existing["id"]


@pytest.mark.asyncio
async def test_ingest_calls_summarize(use_case, mock_llm):
    request = IngestRequest(source_type=SourceType.manual, raw_content="Fitness content here.")
    await use_case.execute("user_abc", request)
    mock_llm.summarize.assert_awaited_once()


@pytest.mark.asyncio
async def test_ingest_calls_discover_tags(use_case, mock_llm):
    request = IngestRequest(source_type=SourceType.manual, raw_content="Fitness content here.")
    await use_case.execute("user_abc", request)
    mock_llm.discover_tags.assert_awaited_once()


@pytest.mark.asyncio
async def test_ingest_sets_failed_status_on_error(use_case, mock_repo, mock_llm):
    mock_llm.summarize.side_effect = RuntimeError("LLM down")
    request = IngestRequest(source_type=SourceType.manual, raw_content="content")
    with pytest.raises(RuntimeError):
        await use_case.execute("user_abc", request)
    # Last update_card call should set status to failed
    last_call = mock_repo.update_card.call_args_list[-1]
    assert last_call[0][2]["processing_status"] == ProcessingStatus.failed.value


@pytest.mark.asyncio
async def test_ingest_increments_usage_on_success(use_case, mock_repo):
    request = IngestRequest(source_type=SourceType.manual, raw_content="content")
    await use_case.execute("user_abc", request)
    mock_repo.increment_usage.assert_called_once_with("user_abc", cards_ingested=1)
