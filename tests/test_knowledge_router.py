"""Integration-style tests for the knowledge router (AMA-662)."""
import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from fastapi.testclient import TestClient

from api.deps import (
    get_ingest_knowledge_use_case,
    get_knowledge_repository,
    get_search_knowledge_use_case,
    get_current_user,
)
from backend.main import create_app


@pytest.fixture
def card_row():
    return {
        "id": str(uuid4()),
        "user_id": "user_abc",
        "title": "Test card",
        "summary": "A summary",
        "micro_summary": "Short",
        "key_takeaways": ["Point 1"],
        "source_type": "manual",
        "source_url": None,
        "processing_status": "complete",
        "metadata": {},
        "created_at": "2026-02-20T00:00:00+00:00",
        "updated_at": "2026-02-20T00:00:00+00:00",
    }


@pytest.fixture
def app(card_row):
    application = create_app()

    mock_repo = MagicMock()
    mock_repo.list_cards.return_value = {"items": [card_row], "total": 1}
    mock_repo.get_card.return_value = card_row
    mock_repo.get_card_tags.return_value = []
    mock_repo.delete_card.return_value = True
    mock_repo.list_tags.return_value = []

    mock_ingest_uc = MagicMock()
    mock_ingest_uc.execute = AsyncMock(return_value=card_row)

    mock_search_uc = MagicMock()
    mock_search_uc.execute.return_value = {
        "items": [card_row], "total": 1, "limit": 10, "offset": 0, "query": "test"
    }

    application.dependency_overrides[get_current_user] = lambda: "user_abc"
    application.dependency_overrides[get_knowledge_repository] = lambda: mock_repo
    application.dependency_overrides[get_ingest_knowledge_use_case] = lambda: mock_ingest_uc
    application.dependency_overrides[get_search_knowledge_use_case] = lambda: mock_search_uc

    return application


@pytest.fixture
def client(app):
    return TestClient(app)


def test_list_cards_returns_200(client):
    resp = client.get("/api/knowledge/cards")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert data["total"] == 1


def test_get_card_returns_200(client, card_row):
    resp = client.get(f"/api/knowledge/cards/{card_row['id']}")
    assert resp.status_code == 200


def test_get_card_404_when_not_found(app, card_row):
    mock_repo_404 = MagicMock()
    mock_repo_404.get_card.return_value = None
    mock_repo_404.get_card_tags.return_value = []
    app.dependency_overrides[get_knowledge_repository] = lambda: mock_repo_404
    with TestClient(app) as c:
        resp = c.get(f"/api/knowledge/cards/{uuid4()}")
    assert resp.status_code == 404


def test_ingest_returns_201(client):
    resp = client.post("/api/knowledge/ingest", json={
        "source_type": "manual",
        "raw_content": "Some fitness knowledge content.",
    })
    assert resp.status_code == 201


def test_search_returns_200(client):
    resp = client.post("/api/knowledge/search", json={"query": "strength training"})
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "query" in data


def test_delete_card_returns_204(client, card_row):
    resp = client.delete(f"/api/knowledge/cards/{card_row['id']}")
    assert resp.status_code == 204


def test_list_tags_returns_200(client):
    resp = client.get("/api/knowledge/tags")
    assert resp.status_code == 200
