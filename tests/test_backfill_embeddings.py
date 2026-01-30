"""Tests for the embedding backfill script (AMA-503)."""

import subprocess
import sys
from unittest.mock import MagicMock, patch

import pytest

# Add scripts to path for imports
sys.path.insert(0, "scripts")

from scripts.backfill_embeddings import (
    backfill_embeddings,
    main,
    show_progress,
)
from backend.services.embedding_service import build_content, content_hash


@pytest.fixture
def mock_supabase():
    """Mock Supabase client."""
    return MagicMock()


@pytest.fixture
def mock_repo():
    """Mock embedding repository."""
    repo = MagicMock()
    repo.get_progress.return_value = {"total": 100, "embedded": 50, "remaining": 50}
    repo.get_workouts_without_embeddings.return_value = []
    return repo


@pytest.fixture
def mock_embedding_service():
    """Mock embedding service."""
    return MagicMock()


class TestShowProgress:
    def test_displays_progress_counts(self, mock_repo, capsys):
        show_progress(mock_repo, "workouts")

        captured = capsys.readouterr()
        assert "Total workouts:    100" in captured.out
        assert "Already embedded:  50" in captured.out
        assert "Remaining:         50" in captured.out

    def test_returns_progress_dict(self, mock_repo):
        result = show_progress(mock_repo, "workouts")

        assert result == {"total": 100, "embedded": 50, "remaining": 50}


class TestBackfillEmbeddings:
    @patch("scripts.backfill_embeddings.get_supabase_client")
    @patch("scripts.backfill_embeddings.get_embedding_service")
    @patch("scripts.backfill_embeddings.SupabaseEmbeddingRepository")
    def test_no_workouts_to_process(
        self,
        mock_repo_class,
        mock_get_service,
        mock_get_client,
        mock_supabase,
        mock_embedding_service,
    ):
        mock_get_client.return_value = mock_supabase
        mock_repo = MagicMock()
        mock_repo.get_progress.return_value = {"total": 10, "embedded": 10, "remaining": 0}
        mock_repo_class.return_value = mock_repo

        result = backfill_embeddings(table="workouts")

        assert result.total_processed == 0
        assert result.total_embedded == 0
        mock_get_service.assert_not_called()

    @patch("scripts.backfill_embeddings.get_supabase_client")
    @patch("scripts.backfill_embeddings.SupabaseEmbeddingRepository")
    def test_dry_run_does_not_embed(
        self,
        mock_repo_class,
        mock_get_client,
        mock_supabase,
        capsys,
    ):
        mock_get_client.return_value = mock_supabase
        mock_repo = MagicMock()
        mock_repo.get_progress.return_value = {"total": 10, "embedded": 5, "remaining": 5}
        mock_repo_class.return_value = mock_repo

        result = backfill_embeddings(table="workouts", dry_run=True)

        captured = capsys.readouterr()
        assert "[DRY RUN]" in captured.out
        assert "Would process 5 workouts" in captured.out
        assert result.total_processed == 5
        assert result.total_embedded == 0

    @patch("scripts.backfill_embeddings.get_supabase_client")
    @patch("scripts.backfill_embeddings.get_embedding_service")
    @patch("scripts.backfill_embeddings.SupabaseEmbeddingRepository")
    def test_processes_workouts_in_batches(
        self,
        mock_repo_class,
        mock_get_service,
        mock_get_client,
        mock_supabase,
        mock_embedding_service,
    ):
        mock_get_client.return_value = mock_supabase
        mock_get_service.return_value = mock_embedding_service
        mock_embedding_service.embed_batch.return_value = [[0.1, 0.2], [0.3, 0.4]]

        mock_repo = MagicMock()
        mock_repo.get_progress.return_value = {"total": 4, "embedded": 0, "remaining": 4}
        workouts = [
            {"id": "w1", "title": "Push Day", "description": "Chest"},
            {"id": "w2", "title": "Pull Day", "description": "Back"},
        ]
        mock_repo.get_workouts_without_embeddings.side_effect = [workouts, []]
        mock_repo_class.return_value = mock_repo

        result = backfill_embeddings(table="workouts", batch_size=2)

        assert result.total_processed == 2
        assert result.total_embedded == 2
        assert mock_repo.save_embedding.call_count == 2

    @patch("scripts.backfill_embeddings.get_supabase_client")
    @patch("scripts.backfill_embeddings.get_embedding_service")
    @patch("scripts.backfill_embeddings.SupabaseEmbeddingRepository")
    def test_skips_empty_content(
        self,
        mock_repo_class,
        mock_get_service,
        mock_get_client,
        mock_supabase,
        mock_embedding_service,
        capsys,
    ):
        mock_get_client.return_value = mock_supabase
        mock_get_service.return_value = mock_embedding_service

        mock_repo = MagicMock()
        mock_repo.get_progress.return_value = {"total": 1, "embedded": 0, "remaining": 1}
        workouts = [{"id": "w1"}]  # No title/description
        mock_repo.get_workouts_without_embeddings.side_effect = [workouts, []]
        mock_repo_class.return_value = mock_repo

        result = backfill_embeddings(table="workouts")

        assert result.total_processed == 1
        assert result.total_skipped == 1
        assert result.total_embedded == 0
        captured = capsys.readouterr()
        assert "Skipped w1: empty content" in captured.out

    @patch("scripts.backfill_embeddings.get_supabase_client")
    @patch("scripts.backfill_embeddings.get_embedding_service")
    @patch("scripts.backfill_embeddings.SupabaseEmbeddingRepository")
    def test_handles_embedding_errors(
        self,
        mock_repo_class,
        mock_get_service,
        mock_get_client,
        mock_supabase,
        mock_embedding_service,
        capsys,
    ):
        mock_get_client.return_value = mock_supabase
        mock_get_service.return_value = mock_embedding_service
        mock_embedding_service.embed_batch.side_effect = Exception("API rate limit")

        mock_repo = MagicMock()
        mock_repo.get_progress.return_value = {"total": 1, "embedded": 0, "remaining": 1}
        workouts = [{"id": "w1", "title": "Workout"}]
        mock_repo.get_workouts_without_embeddings.side_effect = [workouts, []]
        mock_repo_class.return_value = mock_repo

        result = backfill_embeddings(table="workouts")

        assert result.total_processed == 1
        assert result.total_embedded == 0
        assert len(result.errors) == 1
        assert result.errors[0]["workout_id"] == "w1"
        captured = capsys.readouterr()
        assert "ERROR: Batch embedding failed" in captured.out

    @patch("scripts.backfill_embeddings.get_supabase_client")
    @patch("scripts.backfill_embeddings.get_embedding_service")
    @patch("scripts.backfill_embeddings.SupabaseEmbeddingRepository")
    @patch("scripts.backfill_embeddings.time.sleep")
    def test_rate_limiting_delay(
        self,
        mock_sleep,
        mock_repo_class,
        mock_get_service,
        mock_get_client,
        mock_supabase,
        mock_embedding_service,
    ):
        mock_get_client.return_value = mock_supabase
        mock_get_service.return_value = mock_embedding_service
        mock_embedding_service.embed_batch.return_value = [[0.1]]

        mock_repo = MagicMock()
        mock_repo.get_progress.return_value = {"total": 2, "embedded": 0, "remaining": 2}
        batch1 = [{"id": "w1", "title": "A"}]
        batch2 = [{"id": "w2", "title": "B"}]
        mock_repo.get_workouts_without_embeddings.side_effect = [batch1, batch2, []]
        mock_repo_class.return_value = mock_repo

        backfill_embeddings(table="workouts", batch_size=1, delay=0.5)

        # Should sleep after each batch except the last
        assert mock_sleep.call_count == 2
        mock_sleep.assert_called_with(0.5)

    @patch("scripts.backfill_embeddings.get_supabase_client")
    @patch("scripts.backfill_embeddings.get_embedding_service")
    @patch("scripts.backfill_embeddings.SupabaseEmbeddingRepository")
    def test_follow_along_workouts_table(
        self,
        mock_repo_class,
        mock_get_service,
        mock_get_client,
        mock_supabase,
        mock_embedding_service,
    ):
        mock_get_client.return_value = mock_supabase
        mock_get_service.return_value = mock_embedding_service
        mock_embedding_service.embed_batch.return_value = [[0.1]]

        mock_repo = MagicMock()
        mock_repo.get_progress.return_value = {"total": 1, "embedded": 0, "remaining": 1}
        workouts = [{"id": "fa1", "title": "HIIT Workout"}]
        mock_repo.get_workouts_without_embeddings.side_effect = [workouts, []]
        mock_repo_class.return_value = mock_repo

        result = backfill_embeddings(table="follow_along_workouts")

        assert result.total_embedded == 1
        mock_repo.get_workouts_without_embeddings.assert_called_with(
            table="follow_along_workouts",
            limit=100,
        )
        mock_repo.save_embedding.assert_called_once()
        call_kwargs = mock_repo.save_embedding.call_args.kwargs
        assert call_kwargs["table"] == "follow_along_workouts"


class TestBackfillIdempotency:
    @patch("scripts.backfill_embeddings.get_supabase_client")
    @patch("scripts.backfill_embeddings.get_embedding_service")
    @patch("scripts.backfill_embeddings.SupabaseEmbeddingRepository")
    def test_errored_workouts_not_retried_in_same_run(
        self,
        mock_repo_class,
        mock_get_service,
        mock_get_client,
        mock_supabase,
        mock_embedding_service,
    ):
        """Workouts that error should be skipped on subsequent batches to avoid infinite loops."""
        mock_get_client.return_value = mock_supabase
        mock_get_service.return_value = mock_embedding_service
        mock_embedding_service.embed_batch.side_effect = Exception("API error")

        mock_repo = MagicMock()
        mock_repo.get_progress.return_value = {"total": 1, "embedded": 0, "remaining": 1}
        # Return same workout repeatedly (simulating it never getting embedded)
        workouts = [{"id": "w1", "title": "Workout"}]
        mock_repo.get_workouts_without_embeddings.side_effect = [workouts, workouts, workouts]
        mock_repo_class.return_value = mock_repo

        result = backfill_embeddings(table="workouts")

        # Should only process once, not get stuck in infinite loop
        assert result.total_processed == 1
        assert len(result.errors) == 1


class TestDatabaseSaveErrors:
    """Tests for database save error handling (HIGH priority gap)."""

    @patch("scripts.backfill_embeddings.get_supabase_client")
    @patch("scripts.backfill_embeddings.get_embedding_service")
    @patch("scripts.backfill_embeddings.SupabaseEmbeddingRepository")
    def test_handles_save_error(
        self,
        mock_repo_class,
        mock_get_service,
        mock_get_client,
        mock_supabase,
        mock_embedding_service,
        capsys,
    ):
        """Individual save failure is recorded without stopping batch."""
        mock_get_client.return_value = mock_supabase
        mock_get_service.return_value = mock_embedding_service
        mock_embedding_service.embed_batch.return_value = [[0.1, 0.2]]

        mock_repo = MagicMock()
        mock_repo.get_progress.return_value = {"total": 1, "embedded": 0, "remaining": 1}
        workouts = [{"id": "w1", "title": "Workout"}]
        mock_repo.get_workouts_without_embeddings.side_effect = [workouts, []]
        mock_repo.save_embedding.side_effect = Exception("DB connection error")
        mock_repo_class.return_value = mock_repo

        result = backfill_embeddings(table="workouts")

        assert result.total_processed == 1
        assert result.total_embedded == 0
        assert len(result.errors) == 1
        assert result.errors[0]["workout_id"] == "w1"
        assert "DB connection error" in result.errors[0]["error"]

        captured = capsys.readouterr()
        assert "ERROR: Failed to save w1" in captured.out

    @patch("scripts.backfill_embeddings.get_supabase_client")
    @patch("scripts.backfill_embeddings.get_embedding_service")
    @patch("scripts.backfill_embeddings.SupabaseEmbeddingRepository")
    def test_partial_batch_save_failure(
        self,
        mock_repo_class,
        mock_get_service,
        mock_get_client,
        mock_supabase,
        mock_embedding_service,
    ):
        """Some workouts in batch succeed, others fail on save."""
        mock_get_client.return_value = mock_supabase
        mock_get_service.return_value = mock_embedding_service
        mock_embedding_service.embed_batch.return_value = [[0.1], [0.2], [0.3]]

        mock_repo = MagicMock()
        mock_repo.get_progress.return_value = {"total": 3, "embedded": 0, "remaining": 3}
        workouts = [
            {"id": "w1", "title": "Workout 1"},
            {"id": "w2", "title": "Workout 2"},
            {"id": "w3", "title": "Workout 3"},
        ]
        mock_repo.get_workouts_without_embeddings.side_effect = [workouts, []]
        # First and third succeed, second fails
        mock_repo.save_embedding.side_effect = [None, Exception("DB error"), None]
        mock_repo_class.return_value = mock_repo

        result = backfill_embeddings(table="workouts")

        assert result.total_processed == 3
        assert result.total_embedded == 2
        assert len(result.errors) == 1
        assert result.errors[0]["workout_id"] == "w2"


class TestContentHashVerification:
    """Tests for content hash storage verification (MEDIUM priority gap)."""

    @patch("scripts.backfill_embeddings.get_supabase_client")
    @patch("scripts.backfill_embeddings.get_embedding_service")
    @patch("scripts.backfill_embeddings.SupabaseEmbeddingRepository")
    def test_saves_correct_content_hash(
        self,
        mock_repo_class,
        mock_get_service,
        mock_get_client,
        mock_supabase,
        mock_embedding_service,
    ):
        """Verify content hash is computed and saved correctly."""
        mock_get_client.return_value = mock_supabase
        mock_get_service.return_value = mock_embedding_service
        mock_embedding_service.embed_batch.return_value = [[0.1, 0.2, 0.3]]

        mock_repo = MagicMock()
        mock_repo.get_progress.return_value = {"total": 1, "embedded": 0, "remaining": 1}
        workout = {"id": "w1", "title": "Push Day", "description": "Chest workout"}
        mock_repo.get_workouts_without_embeddings.side_effect = [[workout], []]
        mock_repo_class.return_value = mock_repo

        backfill_embeddings(table="workouts")

        # Verify save_embedding was called with correct content hash
        mock_repo.save_embedding.assert_called_once()
        call_kwargs = mock_repo.save_embedding.call_args.kwargs

        expected_content = build_content(workout)
        expected_hash = content_hash(expected_content)

        assert call_kwargs["content_hash"] == expected_hash
        assert call_kwargs["workout_id"] == "w1"
        assert call_kwargs["table"] == "workouts"


class TestCLIMain:
    """Tests for CLI main() function and exit codes (MEDIUM priority gap)."""

    def test_help_flag_exits_zero(self):
        """--help displays usage and exits with code 0."""
        result = subprocess.run(
            [sys.executable, "scripts/backfill_embeddings.py", "--help"],
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0
        assert "Backfill embeddings" in result.stdout
        assert "--dry-run" in result.stdout
        assert "--batch-size" in result.stdout
        assert "--progress-only" in result.stdout
        assert "--delay" in result.stdout
        assert "--table" in result.stdout

    def test_invalid_table_rejected(self):
        """Invalid --table value is rejected by argparse."""
        result = subprocess.run(
            [sys.executable, "scripts/backfill_embeddings.py", "--table", "invalid_table"],
            capture_output=True,
            text=True,
        )
        assert result.returncode != 0
        assert "invalid choice" in result.stderr

    @patch("scripts.backfill_embeddings.backfill_embeddings")
    @patch("scripts.backfill_embeddings.get_supabase_client")
    @patch("scripts.backfill_embeddings.SupabaseEmbeddingRepository")
    def test_main_passes_dry_run_flag(
        self,
        mock_repo_class,
        mock_get_client,
        mock_backfill,
    ):
        """--dry-run flag is passed to backfill function."""
        from application.use_cases.generate_embeddings import EmbeddingResult

        mock_backfill.return_value = EmbeddingResult()

        original_argv = sys.argv
        sys.argv = ["backfill_embeddings.py", "--dry-run"]
        try:
            main()
            mock_backfill.assert_called_once()
            call_kwargs = mock_backfill.call_args.kwargs
            assert call_kwargs["dry_run"] is True
        finally:
            sys.argv = original_argv

    @patch("scripts.backfill_embeddings.backfill_embeddings")
    @patch("scripts.backfill_embeddings.get_supabase_client")
    @patch("scripts.backfill_embeddings.SupabaseEmbeddingRepository")
    def test_main_passes_batch_size_and_delay(
        self,
        mock_repo_class,
        mock_get_client,
        mock_backfill,
    ):
        """--batch-size and --delay are passed to backfill function."""
        from application.use_cases.generate_embeddings import EmbeddingResult

        mock_backfill.return_value = EmbeddingResult()

        original_argv = sys.argv
        sys.argv = ["backfill_embeddings.py", "--batch-size", "50", "--delay", "1.5"]
        try:
            main()
            mock_backfill.assert_called_once()
            call_kwargs = mock_backfill.call_args.kwargs
            assert call_kwargs["batch_size"] == 50
            assert call_kwargs["delay"] == 1.5
        finally:
            sys.argv = original_argv

    @patch("scripts.backfill_embeddings.backfill_embeddings")
    @patch("scripts.backfill_embeddings.get_supabase_client")
    @patch("scripts.backfill_embeddings.SupabaseEmbeddingRepository")
    def test_main_exits_with_error_code_on_errors(
        self,
        mock_repo_class,
        mock_get_client,
        mock_backfill,
    ):
        """Script exits with code 1 when errors occur."""
        from application.use_cases.generate_embeddings import EmbeddingResult

        # Return result with errors
        mock_backfill.return_value = EmbeddingResult(
            total_processed=1,
            total_embedded=0,
            errors=[{"workout_id": "w1", "error": "API error"}],
        )

        original_argv = sys.argv
        sys.argv = ["backfill_embeddings.py"]
        try:
            with pytest.raises(SystemExit) as exc_info:
                main()
            assert exc_info.value.code == 1
        finally:
            sys.argv = original_argv

    @patch("scripts.backfill_embeddings.backfill_embeddings")
    @patch("scripts.backfill_embeddings.get_supabase_client")
    @patch("scripts.backfill_embeddings.SupabaseEmbeddingRepository")
    def test_main_exits_cleanly_on_success(
        self,
        mock_repo_class,
        mock_get_client,
        mock_backfill,
    ):
        """Script exits without error code on successful run."""
        from application.use_cases.generate_embeddings import EmbeddingResult

        mock_backfill.return_value = EmbeddingResult(
            total_processed=5,
            total_embedded=5,
            errors=[],
        )

        original_argv = sys.argv
        sys.argv = ["backfill_embeddings.py"]
        try:
            # Should not raise SystemExit
            main()
        finally:
            sys.argv = original_argv

    @patch("scripts.backfill_embeddings.get_supabase_client")
    @patch("scripts.backfill_embeddings.SupabaseEmbeddingRepository")
    def test_main_progress_only_mode(
        self,
        mock_repo_class,
        mock_get_client,
        mock_supabase,
        capsys,
    ):
        """--progress-only shows progress and exits without embedding."""
        mock_get_client.return_value = mock_supabase
        mock_repo = MagicMock()
        mock_repo.get_progress.return_value = {"total": 100, "embedded": 75, "remaining": 25}
        mock_repo_class.return_value = mock_repo

        original_argv = sys.argv
        sys.argv = ["backfill_embeddings.py", "--progress-only"]
        try:
            main()
            captured = capsys.readouterr()
            assert "Total workouts:    100" in captured.out
            assert "Already embedded:  75" in captured.out
            assert "Remaining:         25" in captured.out
            # Should not show "Starting backfill" since we're in progress-only mode
            assert "Starting backfill" not in captured.out
        finally:
            sys.argv = original_argv
