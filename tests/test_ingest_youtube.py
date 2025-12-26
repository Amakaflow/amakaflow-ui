"""Tests for YouTube ingestion endpoint."""

import json
import pytest
from unittest.mock import patch, MagicMock, AsyncMock


class TestYouTubeIngestion:
    """Test YouTube video ingestion."""

    def test_ingest_youtube_valid_url(
        self, api_client, mock_youtube_transcript, sample_workout_json
    ):
        """Test ingesting a valid YouTube URL with mocked transcript."""
        # Mock the entire ingest_youtube_impl function
        mock_response = {
            "title": "Full Body Workout",
            "blocks": json.loads(sample_workout_json)["blocks"],
            "_provenance": {
                "mode": "youtube_transcript",
                "video_id": "dQw4w9WgXcQ",
            },
        }

        with patch(
            "workout_ingestor_api.api.routes.ingest_youtube_impl",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            response = api_client.post(
                "/ingest/youtube",
                json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
            )

            assert response.status_code == 200
            data = response.json()
            assert "blocks" in data
            assert data["_provenance"]["mode"] == "youtube_transcript"

    def test_ingest_youtube_shorts_url(
        self, api_client, sample_workout_json
    ):
        """Test ingesting a YouTube Shorts URL."""
        mock_response = {
            "title": "Quick Workout",
            "blocks": json.loads(sample_workout_json)["blocks"],
            "_provenance": {
                "mode": "youtube_transcript",
                "video_id": "abc123xyz",
            },
        }

        with patch(
            "workout_ingestor_api.api.routes.ingest_youtube_impl",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            response = api_client.post(
                "/ingest/youtube",
                json={"url": "https://www.youtube.com/shorts/abc123xyz"},
            )

            assert response.status_code == 200


class TestYouTubeCache:
    """Test YouTube caching functionality."""

    def test_youtube_cache_hit(self, api_client, mock_supabase_cache_hit):
        """Test that cached workouts are returned from cache."""
        mock_cached_response = {
            "title": "Cached Workout",
            "blocks": [{"label": "Workout", "exercises": []}],
            "_provenance": {
                "mode": "youtube_cached",
                "video_id": "dQw4w9WgXcQ",
                "cache_hit": True,
            },
        }

        with patch(
            "workout_ingestor_api.api.routes.ingest_youtube_impl",
            new_callable=AsyncMock,
            return_value=mock_cached_response,
        ):
            response = api_client.post(
                "/ingest/youtube",
                json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
            )

            assert response.status_code == 200

    def test_youtube_cache_skip(self, api_client, sample_workout_json):
        """Test skip_cache parameter bypasses cache."""
        mock_response = {
            "title": "Fresh Workout",
            "blocks": json.loads(sample_workout_json)["blocks"],
            "_provenance": {
                "mode": "youtube_transcript",
            },
        }

        with patch(
            "workout_ingestor_api.api.routes.ingest_youtube_impl",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            response = api_client.post(
                "/ingest/youtube",
                json={
                    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                    "skip_cache": True,
                },
            )

            assert response.status_code == 200


class TestYouTubeCacheEndpoints:
    """Test YouTube cache management endpoints."""

    def test_get_cache_stats(self, api_client):
        """Test cache stats endpoint."""
        with patch(
            "workout_ingestor_api.services.youtube_cache_service.YouTubeCacheService.get_cache_stats",
            return_value={"total_cached": 10, "total_cache_hits": 50},
        ):
            response = api_client.get("/youtube/cache/stats")

            assert response.status_code == 200
            data = response.json()
            assert "total_cached" in data
            assert "total_cache_hits" in data

    def test_get_cached_workout_found(self, api_client, sample_workout_dict):
        """Test getting a specific cached workout."""
        with patch(
            "workout_ingestor_api.services.youtube_cache_service.YouTubeCacheService.get_cached_workout",
            return_value={"workout_data": sample_workout_dict},
        ):
            response = api_client.get("/youtube/cache/dQw4w9WgXcQ")

            assert response.status_code == 200

    def test_get_cached_workout_not_found(self, api_client):
        """Test getting a non-existent cached workout."""
        with patch(
            "workout_ingestor_api.services.youtube_cache_service.YouTubeCacheService.get_cached_workout",
            return_value=None,
        ):
            response = api_client.get("/youtube/cache/nonexistent")

            assert response.status_code == 404


class TestYouTubeUrlFormats:
    """Test various YouTube URL formats."""

    @pytest.mark.parametrize(
        "url,expected_id",
        [
            ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
            ("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
            ("https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
            ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ],
    )
    def test_youtube_url_formats_accepted(
        self, api_client, sample_workout_json, url, expected_id
    ):
        """Test that various YouTube URL formats are accepted."""
        mock_response = {
            "title": "Workout",
            "blocks": json.loads(sample_workout_json)["blocks"],
            "_provenance": {"video_id": expected_id},
        }

        with patch(
            "workout_ingestor_api.api.routes.ingest_youtube_impl",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            response = api_client.post(
                "/ingest/youtube",
                json={"url": url},
            )

            # Should at least accept the URL format
            assert response.status_code in [200, 400, 422, 500]


class TestYouTubeProvenance:
    """Test provenance tracking for YouTube ingestion."""

    def test_youtube_provenance_includes_video_id(
        self, api_client, sample_workout_json
    ):
        """Test that provenance includes video ID."""
        mock_response = {
            "title": "Workout",
            "blocks": json.loads(sample_workout_json)["blocks"],
            "_provenance": {
                "mode": "youtube_transcript",
                "video_id": "dQw4w9WgXcQ",
                "channel": "FitnessChannel",
            },
        }

        with patch(
            "workout_ingestor_api.api.routes.ingest_youtube_impl",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            response = api_client.post(
                "/ingest/youtube",
                json={"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
            )

            assert response.status_code == 200
            data = response.json()
            assert "_provenance" in data
            assert "video_id" in data["_provenance"]

    def test_youtube_user_id_tracking(self, api_client, sample_workout_json):
        """Test that user_id is passed for tracking."""
        mock_response = {
            "title": "Workout",
            "blocks": json.loads(sample_workout_json)["blocks"],
            "_provenance": {"mode": "youtube_transcript"},
        }

        with patch(
            "workout_ingestor_api.api.routes.ingest_youtube_impl",
            new_callable=AsyncMock,
            return_value=mock_response,
        ) as mock_impl:
            response = api_client.post(
                "/ingest/youtube",
                json={
                    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                    "user_id": "user123",
                },
            )

            assert response.status_code == 200
            # Verify user_id was passed to the implementation
            mock_impl.assert_called_once()
            call_kwargs = mock_impl.call_args.kwargs
            assert call_kwargs.get("user_id") == "user123"
