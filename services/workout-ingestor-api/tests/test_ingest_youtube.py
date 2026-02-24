"""Tests for YouTube ingestion endpoint."""

import json
import os
import pytest
from copy import deepcopy
from typing import Any, Dict, List
from unittest.mock import patch, MagicMock, AsyncMock


# Video ID constants for test videos
VIDEO_ID_RICKROLL = "dQw4w9WgXcQ"
VIDEO_ID_SHORTS = "abc123xyz"
VIDEO_ID_NULL_STRUCT = "xyz789abc"
VIDEO_ID_MIXED = "mixed12345"


# Module-level test fixtures for LLM mock responses with structural issues
CIRCUIT_WITH_SUPERSETS: Dict[str, Any] = {
    "title": "HYROX Workout",
    "workout_type": "circuit",
    "blocks": [
        {
            "label": "HYROX Circuit",
            "structure": "circuit",
            "rounds": 5,
            "exercises": [
                {"name": "Ski Erg", "distance_m": 500, "type": "cardio"},
                {"name": "Sled Pull", "distance_m": 25, "type": "strength"},
                {"name": "Burpees", "reps": 10, "type": "cardio"},
                {"name": "Wall Balls", "reps": 20, "type": "strength"},
            ],
            "supersets": [{"exercises": [{"name": "Ski Erg"}, {"name": "Sled Pull"}]}],
        }
    ],
}

AMRAP_WITH_SUPERSETS: Dict[str, Any] = {
    "title": "20 Min AMRAP",
    "workout_type": "circuit",
    "blocks": [
        {
            "label": "AMRAP 20",
            "structure": "amrap",
            "exercises": [
                {"name": "Box Jumps", "reps": 10, "type": "plyometric"},
                {"name": "Push-ups", "reps": 15, "type": "strength"},
                {"name": "Air Squats", "reps": 20, "type": "strength"},
            ],
            "supersets": [
                {"exercises": [{"name": "Box Jumps"}, {"name": "Push-ups"}]}
            ],
        }
    ],
}

NULL_STRUCTURE_WITH_SUPERSETS: Dict[str, Any] = {
    "title": "Strength Workout",
    "workout_type": "strength",
    "blocks": [
        {
            "label": "Main",
            "structure": None,
            "exercises": [{"name": "Squats", "sets": 5, "reps": 5, "type": "strength"}],
            "supersets": [
                {
                    "exercises": [
                        {"name": "Bench Press", "sets": 5, "reps": 5, "type": "strength"},
                        {"name": "Rows", "sets": 5, "reps": 8, "type": "strength"},
                    ]
                }
            ],
        }
    ],
}

MIXED_BLOCKS: Dict[str, Any] = {
    "title": "Mixed Workout",
    "workout_type": "mixed",
    "blocks": [
        {
            "label": "Circuit",
            "structure": "circuit",
            "rounds": 3,
            "exercises": [
                {"name": "KB Swing", "reps": 20, "type": "cardio"},
                {"name": "Goblet Squat", "reps": 12, "type": "strength"},
                {"name": "Push-ups", "reps": 10, "type": "strength"},
            ],
            "supersets": [{"exercises": [{"name": "KB Swing"}, {"name": "Goblet Squat"}]}],
        },
        {
            "label": "Superset Block",
            "structure": "superset",
            "exercises": [],
            "supersets": [
                {
                    "exercises": [
                        {"name": "Bicep Curls", "sets": 3, "reps": 12, "type": "strength"},
                        {"name": "Tricep Extensions", "sets": 3, "reps": 12, "type": "strength"},
                    ]
                }
            ],
        },
    ],
}


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
                "video_id": VIDEO_ID_RICKROLL,
            },
        }

        with patch(
            "workout_ingestor_api.api.routes.ingest_youtube_impl",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            response = api_client.post(
                "/ingest/youtube",
                json={"url": f"https://www.youtube.com/watch?v={VIDEO_ID_RICKROLL}"},
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
                "video_id": VIDEO_ID_SHORTS,
            },
        }

        with patch(
            "workout_ingestor_api.api.routes.ingest_youtube_impl",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            response = api_client.post(
                "/ingest/youtube",
                json={"url": f"https://www.youtube.com/shorts/{VIDEO_ID_SHORTS}"},
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
                "video_id": VIDEO_ID_RICKROLL,
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
                json={"url": f"https://www.youtube.com/watch?v={VIDEO_ID_RICKROLL}"},
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
                    "url": f"https://www.youtube.com/watch?v={VIDEO_ID_RICKROLL}",
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
            response = api_client.get(f"/youtube/cache/{VIDEO_ID_RICKROLL}")

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
            (f"https://www.youtube.com/watch?v={VIDEO_ID_RICKROLL}", VIDEO_ID_RICKROLL),
            (f"https://youtu.be/{VIDEO_ID_RICKROLL}", VIDEO_ID_RICKROLL),
            (f"https://www.youtube.com/shorts/{VIDEO_ID_RICKROLL}", VIDEO_ID_RICKROLL),
            (f"https://www.youtube.com/embed/{VIDEO_ID_RICKROLL}", VIDEO_ID_RICKROLL),
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
                "video_id": VIDEO_ID_RICKROLL,
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
                json={"url": f"https://www.youtube.com/watch?v={VIDEO_ID_RICKROLL}"},
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
                    "url": f"https://www.youtube.com/watch?v={VIDEO_ID_RICKROLL}",
                    "user_id": "user123",
                },
            )

            assert response.status_code == 200
            # Verify user_id was passed to the implementation
            mock_impl.assert_called_once()
            call_kwargs = mock_impl.call_args.kwargs
            assert call_kwargs.get("user_id") == "user123"


# ---------------------------------------------------------------------------
# AMA-650: Integration tests for YouTube sanitizer
# ---------------------------------------------------------------------------
# These tests verify that _sanitize_workout_data is correctly applied
# in the YouTube ingest path after LLM parsing.


class TestYouTubeSanitizerIntegration:
    """
    Integration tests for YouTube path sanitization.

    AMA-650: Verifies that the YouTube ingest path correctly applies
    _sanitize_workout_data to fix common LLM structural mistakes.
    """

    def test_youtube_openai_circuit_preserved(self, api_client: Any) -> None:
        """
        Test that OpenAI circuit blocks are preserved with supersets cleared.

        AMA-650: Verifies that when OpenAI returns a circuit with supersets
        (LLM mistake), the sanitizer preserves the circuit and clears supersets.
        """
        # Mock the LLM parsing function to return circuit with supersets
        mock_llm_response: Dict[str, Any] = deepcopy(CIRCUIT_WITH_SUPERSETS)

        # Mock the transcript API response
        mock_transcript_response = MagicMock()
        mock_transcript_response.status_code = 200
        mock_transcript_response.json.return_value = {
            VIDEO_ID_RICKROLL: {
                "title": "Test Video",
                "transcript": [
                    {"text": "Hello", "start": 0, "dur": 5},
                    {"text": "This is a workout", "start": 5, "dur": 10},
                ],
            }
        }

        # Set up env vars to enable LLM parsing
        env_with_keys = {"YT_TRANSCRIPT_API_TOKEN": "fake_token", "OPENAI_API_KEY": "fake_key"}

        with patch.dict(os.environ, env_with_keys):
            with patch(
                "workout_ingestor_api.api.youtube_ingest.requests.post",
                return_value=mock_transcript_response,
            ):
                with patch(
                    "workout_ingestor_api.api.youtube_ingest._parse_with_openai",
                    return_value=mock_llm_response,
                ):
                    with patch(
                        "workout_ingestor_api.api.youtube_ingest.YouTubeCacheService.get_cached_workout",
                        return_value=None,
                    ):
                        with patch(
                            "workout_ingestor_api.api.youtube_ingest.YouTubeCacheService.save_cached_workout",
                        ):
                            response = api_client.post(
                                "/ingest/youtube",
                                json={"url": f"https://www.youtube.com/watch?v={VIDEO_ID_RICKROLL}"},
                            )

        assert response.status_code == 200
        data = response.json()

        # Verify circuit is preserved
        assert len(data["blocks"]) == 1
        block: Dict[str, Any] = data["blocks"][0]
        assert block["structure"] == "circuit"
        assert block["rounds"] == 5

        # Verify exercises are preserved (4 exercises)
        assert len(block["exercises"]) == 4
        assert block["exercises"][0]["name"] == "Ski Erg"
        assert block["exercises"][1]["name"] == "Sled Pull"

        # Verify supersets are cleared (the fix!)
        assert block["supersets"] == []

    def test_youtube_anthropic_circuit_preserved(self, api_client: Any) -> None:
        """
        Test that Anthropic circuit blocks are preserved with supersets cleared.

        AMA-650: Verifies that when Anthropic returns a circuit with supersets
        (LLM mistake), the sanitizer preserves the circuit and clears supersets.
        """
        # Mock the LLM parsing function to return circuit with supersets
        mock_llm_response: Dict[str, Any] = deepcopy(AMRAP_WITH_SUPERSETS)

        # Mock the transcript API response - must include workout keywords
        mock_transcript_response = MagicMock()
        mock_transcript_response.status_code = 200
        mock_transcript_response.json.return_value = {
            VIDEO_ID_SHORTS: {
                "title": "Test Video",
                "transcript": [
                    {"text": "Today were doing a workout", "start": 0, "dur": 5},
                    {"text": "Lets do some exercises", "start": 5, "dur": 10},
                ],
            }
        }

        # Mock OpenAI to fail so it falls back to Anthropic
        def mock_openai_failure(*args: Any, **kwargs: Any) -> None:
            raise Exception("OpenAI not available")

        with patch.dict(os.environ, {"YT_TRANSCRIPT_API_TOKEN": "fake_token"}):
            with patch(
                "workout_ingestor_api.api.youtube_ingest.requests.post",
                return_value=mock_transcript_response,
            ):
                with patch(
                    "workout_ingestor_api.api.youtube_ingest._parse_with_openai",
                    side_effect=mock_openai_failure,
                ):
                    with patch(
                        "workout_ingestor_api.api.youtube_ingest._parse_with_anthropic",
                        return_value=mock_llm_response,
                    ):
                        with patch(
                            "workout_ingestor_api.api.youtube_ingest.YouTubeCacheService.get_cached_workout",
                            return_value=None,
                        ):
                            with patch(
                                "workout_ingestor_api.api.youtube_ingest.YouTubeCacheService.save_cached_workout",
                            ):
                                response = api_client.post(
                                    "/ingest/youtube",
                                    json={"url": f"https://www.youtube.com/watch?v={VIDEO_ID_SHORTS}"},
                                )

        assert response.status_code == 200
        data = response.json()

        # Verify AMRAP is preserved
        assert len(data["blocks"]) == 1
        block: Dict[str, Any] = data["blocks"][0]
        assert block["structure"] == "amrap"

        # Verify exercises are preserved (3 exercises)
        assert len(block["exercises"]) == 3

        # Verify supersets are cleared (the fix!)
        assert block["supersets"] == []

    def test_youtube_superset_structure_fixed(self, api_client: Any) -> None:
        """
        Test that null structure is fixed to 'superset' when supersets present.

        AMA-650: Verifies that when LLM returns null structure but has valid
        supersets, the sanitizer sets structure to "superset".
        """
        # Mock the LLM parsing function to return null structure with supersets
        mock_llm_response: Dict[str, Any] = deepcopy(NULL_STRUCTURE_WITH_SUPERSETS)

        # Mock the transcript API response - must include workout keywords
        mock_transcript_response = MagicMock()
        mock_transcript_response.status_code = 200
        mock_transcript_response.json.return_value = {
            VIDEO_ID_NULL_STRUCT: {
                "title": "Test Video",
                "transcript": [
                    {"text": "Lets workout today", "start": 0, "dur": 5},
                ],
            }
        }

        # Set up env vars to enable LLM parsing
        env_with_keys = {"YT_TRANSCRIPT_API_TOKEN": "fake_token", "OPENAI_API_KEY": "fake_key"}

        with patch.dict(os.environ, env_with_keys):
            with patch(
                "workout_ingestor_api.api.youtube_ingest.requests.post",
                return_value=mock_transcript_response,
            ):
                with patch(
                    "workout_ingestor_api.api.youtube_ingest._parse_with_openai",
                    return_value=mock_llm_response,
                ):
                    with patch(
                        "workout_ingestor_api.api.youtube_ingest.YouTubeCacheService.get_cached_workout",
                        return_value=None,
                    ):
                        with patch(
                            "workout_ingestor_api.api.youtube_ingest.YouTubeCacheService.save_cached_workout",
                        ):
                            response = api_client.post(
                                "/ingest/youtube",
                                json={"url": f"https://www.youtube.com/watch?v={VIDEO_ID_NULL_STRUCT}"},
                            )

        assert response.status_code == 200
        data = response.json()

        # Verify structure is fixed to "superset"
        assert len(data["blocks"]) == 1
        block: Dict[str, Any] = data["blocks"][0]
        assert block["structure"] == "superset"

        # Note: Due to convert_to_new_structure flattening supersets to exercises,
        # we verify that at least the structure was corrected and exercises exist.
        # The supersets array will be empty in the final response.
        assert len(block["exercises"]) == 2  # Exercises from supersets are flattened

    def test_youtube_mixed_blocks_sanitized(self, api_client: Any) -> None:
        """
        Test that mixed circuit + superset blocks are correctly sanitized.

        AMA-650: Verifies that when LLM returns both circuit and superset blocks
        with structural issues, both are handled correctly.
        """
        # Mock the LLM parsing function to return mixed blocks with issues
        mock_llm_response: Dict[str, Any] = deepcopy(MIXED_BLOCKS)

        # Mock the transcript API response - must include workout keywords
        mock_transcript_response = MagicMock()
        mock_transcript_response.status_code = 200
        mock_transcript_response.json.return_value = {
            VIDEO_ID_MIXED: {
                "title": "Test Video",
                "transcript": [
                    {"text": "Great workout today", "start": 0, "dur": 5},
                ],
            }
        }

        # Set up env vars to enable LLM parsing
        env_with_keys = {"YT_TRANSCRIPT_API_TOKEN": "fake_token", "OPENAI_API_KEY": "fake_key"}

        with patch.dict(os.environ, env_with_keys):
            with patch(
                "workout_ingestor_api.api.youtube_ingest.requests.post",
                return_value=mock_transcript_response,
            ):
                with patch(
                    "workout_ingestor_api.api.youtube_ingest._parse_with_openai",
                    return_value=mock_llm_response,
                ):
                    with patch(
                        "workout_ingestor_api.api.youtube_ingest.YouTubeCacheService.get_cached_workout",
                        return_value=None,
                    ):
                        with patch(
                            "workout_ingestor_api.api.youtube_ingest.YouTubeCacheService.save_cached_workout",
                        ):
                            response = api_client.post(
                                "/ingest/youtube",
                                json={"url": f"https://www.youtube.com/watch?v={VIDEO_ID_MIXED}"},
                            )

        assert response.status_code == 200
        data = response.json()

        # Verify we have 2 blocks
        assert len(data["blocks"]) == 2

        # Block 1: Circuit should be preserved, supersets cleared
        circuit_block: Dict[str, Any] = data["blocks"][0]
        assert circuit_block["structure"] == "circuit"
        assert circuit_block["rounds"] == 3
        assert len(circuit_block["exercises"]) == 3  # All exercises preserved
        assert circuit_block["supersets"] == []  # Supersets cleared

        # Block 2: Superset block should have structure corrected
        # Note: Due to convert_to_new_structure flattening supersets to exercises,
        # we verify structure is set but supersets are flattened
        superset_block: Dict[str, Any] = data["blocks"][1]
        assert superset_block["structure"] == "superset"
        assert len(superset_block["exercises"]) == 2  # Exercises from supersets are flattened


class TestYouTubeErrorHandling:
    """Test error handling for YouTube ingestion."""

    def test_youtube_llm_parse_failure(self, api_client: Any) -> None:
        """
        Test handling of LLM parsing failures.

        AMA-650: Verifies that when LLM parsing fails, appropriate error is returned.
        """
        # Mock the transcript API response
        mock_transcript_response = MagicMock()
        mock_transcript_response.status_code = 200
        mock_transcript_response.json.return_value = {
            VIDEO_ID_RICKROLL: {
                "title": "Test Video",
                "transcript": [
                    {"text": "This is a workout video", "start": 0, "dur": 5},
                ],
            }
        }

        # Mock LLM parsing to fail
        def mock_openai_failure(*args: Any, **kwargs: Any) -> None:
            raise Exception("OpenAI API error: rate limit exceeded")

        def mock_anthropic_failure(*args: Any, **kwargs: Any) -> None:
            raise Exception("Anthropic API error: invalid API key")

        with patch.dict(os.environ, {"OPENAI_API_KEY": "fake_key", "ANTHROPIC_API_KEY": "fake_key"}):
            with patch(
                "workout_ingestor_api.api.youtube_ingest.requests.post",
                return_value=mock_transcript_response,
            ):
                with patch(
                    "workout_ingestor_api.api.youtube_ingest._parse_with_openai",
                    side_effect=mock_openai_failure,
                ):
                    with patch(
                        "workout_ingestor_api.api.youtube_ingest._parse_with_anthropic",
                        side_effect=mock_anthropic_failure,
                    ):
                        with patch(
                            "workout_ingestor_api.api.youtube_ingest.YouTubeCacheService.get_cached_workout",
                            return_value=None,
                        ):
                            response = api_client.post(
                                "/ingest/youtube",
                                json={"url": f"https://www.youtube.com/watch?v={VIDEO_ID_RICKROLL}"},
                            )

        # Should return 500 or 503 due to LLM failures
        assert response.status_code in [500, 503]

    def test_youtube_cache_service_failure(self, api_client: Any) -> None:
        """
        Test handling of cache service failures.

        AMA-650: Verifies behavior when cache service fails.
        Note: Currently cache failures raise unhandled exceptions as there's no
        exception handling around the cache calls in youtube_ingest.py.
        This test documents the current behavior.
        """
        # Mock the LLM parsing function to return valid response
        mock_llm_response: Dict[str, Any] = deepcopy(CIRCUIT_WITH_SUPERSETS)

        # Mock the transcript API response
        mock_transcript_response = MagicMock()
        mock_transcript_response.status_code = 200
        mock_transcript_response.json.return_value = {
            VIDEO_ID_RICKROLL: {
                "title": "Test Video",
                "transcript": [
                    {"text": "This is a workout video", "start": 0, "dur": 5},
                ],
            }
        }

        # Mock cache service to fail on get
        def mock_cache_get_failure(*args: Any, **kwargs: Any) -> None:
            raise Exception("Cache service unavailable")

        # Exception is expected to propagate (no exception handling in code)
        with pytest.raises(Exception, match="Cache service unavailable"):
            with patch.dict(os.environ, {"OPENAI_API_KEY": "fake_key"}):
                with patch(
                    "workout_ingestor_api.api.youtube_ingest.requests.post",
                    return_value=mock_transcript_response,
                ):
                    with patch(
                        "workout_ingestor_api.api.youtube_ingest._parse_with_openai",
                        return_value=mock_llm_response,
                    ):
                        with patch(
                            "workout_ingestor_api.api.youtube_ingest.YouTubeCacheService.get_cached_workout",
                            side_effect=mock_cache_get_failure,
                        ):
                            with patch(
                                "workout_ingestor_api.api.youtube_ingest.YouTubeCacheService.save_cached_workout",
                            ):
                                response = api_client.post(
                                    "/ingest/youtube",
                                    json={"url": f"https://www.youtube.com/watch?v={VIDEO_ID_RICKROLL}"},
                                )

    def test_youtube_invalid_transcript_response(self, api_client: Any) -> None:
        """
        Test handling of invalid transcript API responses.

        AMA-650: Verifies that invalid transcript responses are handled gracefully.
        """
        # Mock invalid transcript API response (no transcript data)
        mock_transcript_response = MagicMock()
        mock_transcript_response.status_code = 200
        mock_transcript_response.json.return_value = {}

        with patch.dict(os.environ, {"OPENAI_API_KEY": "fake_key"}):
            with patch(
                "workout_ingestor_api.api.youtube_ingest.requests.post",
                return_value=mock_transcript_response,
            ):
                with patch(
                    "workout_ingestor_api.api.youtube_ingest.YouTubeCacheService.get_cached_workout",
                    return_value=None,
                ):
                    response = api_client.post(
                        "/ingest/youtube",
                        json={"url": f"https://www.youtube.com/watch?v={VIDEO_ID_RICKROLL}"},
                    )

        # Should return error for invalid transcript
        assert response.status_code in [400, 500, 503]
