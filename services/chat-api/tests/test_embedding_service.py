"""Unit tests for embedding service: content building and batch embedding."""

from unittest.mock import MagicMock, patch

import pytest

from backend.services.embedding_service import (
    EmbeddingService,
    build_content,
    content_hash,
)


# ---------------------------------------------------------------------------
# build_content tests
# ---------------------------------------------------------------------------


class TestBuildContent:
    def test_full_workout(self):
        workout = {
            "title": "Upper Body Blast",
            "description": "Intense upper body session",
            "workout_type": "strength",
            "difficulty_level": "intermediate",
            "target_muscle_groups": ["chest", "shoulders", "triceps"],
            "equipment": ["dumbbells", "bench"],
            "duration_minutes": 45,
            "workout_data": {
                "goals": ["build muscle", "increase strength"],
                "instructions": "Warm up for 5 minutes",
            },
        }
        result = build_content(workout)
        assert "Upper Body Blast" in result
        assert "strength" in result
        assert "intermediate" in result
        assert "chest" in result
        assert "dumbbells" in result
        assert "45 minutes" in result
        assert "build muscle" in result
        assert "Warm up for 5 minutes" in result

    def test_minimal_workout(self):
        workout = {"title": "Quick Run"}
        result = build_content(workout)
        assert result == "Quick Run"

    def test_empty_workout(self):
        result = build_content({})
        assert result == ""

    def test_workout_data_none(self):
        workout = {"title": "Test", "workout_data": None}
        result = build_content(workout)
        assert result == "Test"

    def test_list_fields_non_list(self):
        workout = {"title": "Test", "target_muscle_groups": "chest"}
        result = build_content(workout)
        # Non-list value for list field should be ignored
        assert "chest" not in result


# ---------------------------------------------------------------------------
# content_hash tests
# ---------------------------------------------------------------------------


class TestContentHash:
    def test_deterministic(self):
        assert content_hash("hello") == content_hash("hello")

    def test_different_input(self):
        assert content_hash("hello") != content_hash("world")


# ---------------------------------------------------------------------------
# EmbeddingService tests
# ---------------------------------------------------------------------------


class TestEmbeddingService:
    @patch("backend.services.embedding_service.OpenAI")
    def test_embed_batch(self, mock_openai_cls):
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client

        # Mock response
        mock_item_0 = MagicMock()
        mock_item_0.index = 0
        mock_item_0.embedding = [0.1, 0.2, 0.3]
        mock_item_1 = MagicMock()
        mock_item_1.index = 1
        mock_item_1.embedding = [0.4, 0.5, 0.6]

        mock_response = MagicMock()
        mock_response.data = [mock_item_1, mock_item_0]  # Out of order
        mock_client.embeddings.create.return_value = mock_response

        service = EmbeddingService(api_key="test-key")
        result = service.embed_batch(["text1", "text2"])

        assert result == [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]
        mock_client.embeddings.create.assert_called_once_with(
            model="text-embedding-3-small",
            input=["text1", "text2"],
        )

    @patch("backend.services.embedding_service.OpenAI")
    def test_embed_batch_empty(self, mock_openai_cls):
        service = EmbeddingService(api_key="test-key")
        result = service.embed_batch([])
        assert result == []

    @patch("backend.services.embedding_service.OpenAI")
    def test_embed_single(self, mock_openai_cls):
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client

        mock_item = MagicMock()
        mock_item.index = 0
        mock_item.embedding = [0.1, 0.2]
        mock_response = MagicMock()
        mock_response.data = [mock_item]
        mock_client.embeddings.create.return_value = mock_response

        service = EmbeddingService(api_key="test-key")
        result = service.embed_single("hello")
        assert result == [0.1, 0.2]
