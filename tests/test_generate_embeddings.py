"""Unit tests for GenerateEmbeddingsUseCase orchestration."""

from unittest.mock import MagicMock

import pytest

from application.use_cases.generate_embeddings import (
    GenerateEmbeddingsUseCase,
    EmbeddingResult,
    SingleEmbeddingResult,
)
from backend.services.embedding_service import content_hash, build_content


@pytest.fixture
def mock_repo():
    repo = MagicMock()
    repo.get_progress.return_value = {"total": 10, "embedded": 5, "remaining": 5}
    return repo


@pytest.fixture
def mock_embedding_service():
    return MagicMock()


@pytest.fixture
def use_case(mock_repo, mock_embedding_service):
    return GenerateEmbeddingsUseCase(
        repository=mock_repo,
        embedding_service=mock_embedding_service,
        batch_size=2,
    )


class TestGenerateEmbeddings:
    def test_no_workouts(self, use_case, mock_repo):
        mock_repo.get_workouts_without_embeddings.return_value = []

        result = use_case.execute(table="workouts")

        assert result.total_processed == 0
        assert result.total_embedded == 0
        assert result.total_skipped == 0
        assert result.errors == []

    def test_processes_batch(self, use_case, mock_repo, mock_embedding_service):
        workouts = [
            {"id": "w1", "title": "Push Day", "description": "Chest and triceps"},
            {"id": "w2", "title": "Pull Day", "description": "Back and biceps"},
        ]
        # Return workouts once, then empty to stop loop
        mock_repo.get_workouts_without_embeddings.side_effect = [workouts, []]
        mock_embedding_service.embed_batch.return_value = [
            [0.1, 0.2],
            [0.3, 0.4],
        ]

        result = use_case.execute()

        assert result.total_processed == 2
        assert result.total_embedded == 2
        assert result.total_skipped == 0
        assert mock_repo.save_embedding.call_count == 2

    def test_skips_empty_content(self, use_case, mock_repo, mock_embedding_service):
        workouts = [
            {"id": "w1"},  # No title/description → empty content
        ]
        mock_repo.get_workouts_without_embeddings.side_effect = [workouts, []]

        result = use_case.execute()

        assert result.total_processed == 1
        assert result.total_skipped == 1
        assert result.total_embedded == 0
        mock_embedding_service.embed_batch.assert_not_called()

    def test_handles_embed_error(self, use_case, mock_repo, mock_embedding_service):
        workouts = [
            {"id": "w1", "title": "Workout"},
        ]
        mock_repo.get_workouts_without_embeddings.side_effect = [workouts, []]
        mock_embedding_service.embed_batch.side_effect = Exception("API error")

        result = use_case.execute()

        assert result.total_processed == 1
        assert result.total_embedded == 0
        assert len(result.errors) == 1
        assert result.errors[0]["workout_id"] == "w1"

    def test_handles_save_error(self, use_case, mock_repo, mock_embedding_service):
        workouts = [
            {"id": "w1", "title": "Workout"},
        ]
        mock_repo.get_workouts_without_embeddings.side_effect = [workouts, []]
        mock_embedding_service.embed_batch.return_value = [[0.1, 0.2]]
        mock_repo.save_embedding.side_effect = Exception("DB error")

        result = use_case.execute()

        assert result.total_processed == 1
        assert result.total_embedded == 0
        assert len(result.errors) == 1

    def test_specific_workout_ids(self, use_case, mock_repo, mock_embedding_service):
        mock_repo.get_workouts_without_embeddings.return_value = []

        use_case.execute(workout_ids=["w1", "w2"])

        mock_repo.get_workouts_without_embeddings.assert_called_with(
            table="workouts",
            limit=2,
            workout_ids=["w1", "w2"],
        )

    def test_get_progress(self, use_case):
        progress = use_case.get_progress("workouts")
        assert progress == {"total": 10, "embedded": 5, "remaining": 5}

    def test_multiple_batches(self, use_case, mock_repo, mock_embedding_service):
        batch1 = [{"id": "w1", "title": "A"}, {"id": "w2", "title": "B"}]
        batch2 = [{"id": "w3", "title": "C"}]
        mock_repo.get_workouts_without_embeddings.side_effect = [batch1, batch2, []]
        mock_embedding_service.embed_batch.side_effect = [
            [[0.1], [0.2]],  # batch1: 2 items
            [[0.3]],         # batch2: 1 item
        ]

        result = use_case.execute()

        assert result.total_processed == 3
        assert result.total_embedded == 3


class TestExecuteSingle:
    def test_not_found(self, use_case, mock_repo):
        mock_repo.get_workout_by_id.return_value = None

        result = use_case.execute_single(table="workouts", workout_id="w999")

        assert isinstance(result, SingleEmbeddingResult)
        assert result.status == "not_found"
        assert result.workout_id == "w999"

    def test_empty_content_skipped(self, use_case, mock_repo):
        mock_repo.get_workout_by_id.return_value = {"id": "w1"}  # no title/description

        result = use_case.execute_single(table="workouts", workout_id="w1")

        assert result.status == "skipped"

    def test_embeds_successfully(self, use_case, mock_repo, mock_embedding_service):
        mock_repo.get_workout_by_id.return_value = {
            "id": "w1",
            "title": "Push Day",
            "description": "Chest and triceps",
        }
        mock_embedding_service.embed_single.return_value = [0.1, 0.2, 0.3]

        result = use_case.execute_single(table="workouts", workout_id="w1")

        assert result.status == "embedded"
        assert result.workout_id == "w1"
        mock_embedding_service.embed_single.assert_called_once()
        mock_repo.save_embedding.assert_called_once()

    def test_unchanged_skips_embedding(self, use_case, mock_repo, mock_embedding_service):
        """When content hash matches existing, skip the embedding API call."""
        workout = {
            "id": "w1",
            "title": "Push Day",
            "description": "Chest and triceps",
        }
        # Pre-compute the hash that execute_single will compute
        text = build_content(workout)
        existing_hash = content_hash(text)
        workout["embedding_content_hash"] = existing_hash
        mock_repo.get_workout_by_id.return_value = workout

        result = use_case.execute_single(table="workouts", workout_id="w1")

        assert result.status == "unchanged"
        assert result.workout_id == "w1"
        mock_embedding_service.embed_single.assert_not_called()
        mock_repo.save_embedding.assert_not_called()

    def test_changed_content_re_embeds(self, use_case, mock_repo, mock_embedding_service):
        """When content hash differs from existing, re-embed."""
        workout = {
            "id": "w1",
            "title": "Push Day",
            "description": "Chest and triceps",
            "embedding_content_hash": "stale-hash-from-old-content",
        }
        mock_repo.get_workout_by_id.return_value = workout
        mock_embedding_service.embed_single.return_value = [0.1, 0.2, 0.3]

        result = use_case.execute_single(table="workouts", workout_id="w1")

        assert result.status == "embedded"
        mock_embedding_service.embed_single.assert_called_once()
        mock_repo.save_embedding.assert_called_once()

    def test_embed_error(self, use_case, mock_repo, mock_embedding_service):
        mock_repo.get_workout_by_id.return_value = {"id": "w1", "title": "Workout"}
        mock_embedding_service.embed_single.side_effect = Exception("API error")

        result = use_case.execute_single(table="workouts", workout_id="w1")

        assert result.status == "error"
        assert "API error" in result.error

    def test_save_error(self, use_case, mock_repo, mock_embedding_service):
        mock_repo.get_workout_by_id.return_value = {"id": "w1", "title": "Workout"}
        mock_embedding_service.embed_single.return_value = [0.1, 0.2]
        mock_repo.save_embedding.side_effect = Exception("DB error")

        result = use_case.execute_single(table="workouts", workout_id="w1")

        assert result.status == "error"
        assert "DB error" in result.error
