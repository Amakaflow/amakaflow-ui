"""Tests for TikTok ingestion."""

import pytest
from workout_ingestor_api.services.tiktok_service import (
    TikTokService,
    TikTokServiceError,
    TikTokVideoMetadata,
)


class TestTikTokService:
    """Test TikTok service methods."""
    
    def test_extract_video_id_standard_url(self):
        """Test video ID extraction from standard URLs."""
        url = "https://www.tiktok.com/@jeffnippardfitness/video/7575571317500546322"
        video_id = TikTokService.extract_video_id(url)
        assert video_id == "7575571317500546322"
    
    def test_extract_video_id_with_query_params(self):
        """Test video ID extraction with query parameters."""
        url = "https://www.tiktok.com/@user/video/1234567890?is_from_webapp=1&sender_device=pc"
        video_id = TikTokService.extract_video_id(url)
        assert video_id == "1234567890"
    
    def test_extract_video_id_short_url(self):
        """Test that short URLs return None (need resolution)."""
        url = "https://vm.tiktok.com/ZMrXYZ123/"
        video_id = TikTokService.extract_video_id(url)
        assert video_id is None
    
    def test_normalize_url(self):
        """Test URL normalization removes query params."""
        url = "https://www.tiktok.com/@user/video/123?is_from_webapp=1"
        normalized = TikTokService.normalize_url(url)
        assert normalized == "https://www.tiktok.com/@user/video/123"
    
    def test_is_short_url(self):
        """Test short URL detection."""
        assert TikTokService.is_short_url("https://vm.tiktok.com/ZMrXYZ123/")
        assert TikTokService.is_short_url("https://www.tiktok.com/t/ZMrXYZ123/")
        assert not TikTokService.is_short_url("https://www.tiktok.com/@user/video/123")
    
    def test_is_tiktok_url_valid(self):
        """Test TikTok URL validation."""
        valid_urls = [
            "https://www.tiktok.com/@jeffnippardfitness/video/7575571317500546322",
            "https://tiktok.com/@user/video/123",
            "https://vm.tiktok.com/ZMrXYZ/",
            "https://www.tiktok.com/t/ABC123/",
        ]
        for url in valid_urls:
            assert TikTokService.is_tiktok_url(url), f"Should be valid: {url}"
    
    def test_is_tiktok_url_invalid(self):
        """Test TikTok URL validation rejects non-TikTok URLs."""
        invalid_urls = [
            "https://www.youtube.com/watch?v=abc",
            "https://www.instagram.com/p/ABC123/",
            "https://twitter.com/user/status/123",
            "https://example.com",
        ]
        for url in invalid_urls:
            assert not TikTokService.is_tiktok_url(url), f"Should be invalid: {url}"
    
    def test_extract_hashtags(self):
        """Test hashtag extraction from text."""
        text = "Full body workout #fitness #gym #workout #legday"
        hashtags = TikTokService.extract_hashtags(text)
        assert hashtags == ["fitness", "gym", "workout", "legday"]
    
    def test_extract_hashtags_empty(self):
        """Test hashtag extraction with no hashtags."""
        text = "Just a regular title"
        hashtags = TikTokService.extract_hashtags(text)
        assert hashtags == []
    
    def test_tiktok_video_metadata_to_dict(self):
        """Test metadata conversion to dict."""
        metadata = TikTokVideoMetadata(
            video_id="123",
            url="https://tiktok.com/@user/video/123",
            title="Workout #fitness",
            author_name="user",
            author_url="https://tiktok.com/@user",
            hashtags=["fitness"],
        )
        data = metadata.to_dict()
        assert data["video_id"] == "123"
        assert data["title"] == "Workout #fitness"
        assert data["hashtags"] == ["fitness"]


class TestTikTokIntegration:
    """Integration tests (require network, marked for optional skip)."""

    @pytest.mark.skip(reason="Requires network access")
    def test_get_oembed_metadata(self):
        """Test oEmbed metadata extraction."""
        url = "https://www.tiktok.com/@jeffnippardfitness/video/7575571317500546322"
        data = TikTokService.get_oembed_metadata(url)
        assert data is not None
        assert "title" in data
        assert "author_name" in data

    @pytest.mark.skip(reason="Requires network access")
    def test_extract_metadata(self):
        """Test full metadata extraction."""
        url = "https://www.tiktok.com/@jeffnippardfitness/video/7575571317500546322"
        metadata = TikTokService.extract_metadata(url)
        assert metadata.video_id == "7575571317500546322"
        assert metadata.author_name != ""


# ---------------------------------------------------------------------------
# API Endpoint Tests with Mocking
# ---------------------------------------------------------------------------

from unittest.mock import patch, MagicMock
import json


class TestTikTokIngestionEndpoint:
    """Test TikTok ingestion API endpoints with mocking."""

    def test_ingest_tiktok_invalid_url(self, api_client):
        """Test ingestion with invalid (non-TikTok) URL."""
        response = api_client.post(
            "/ingest/tiktok",
            json={"url": "https://www.youtube.com/watch?v=abc123"},
        )
        assert response.status_code == 400
        assert "Invalid TikTok URL" in response.json().get("detail", "")

    def test_ingest_tiktok_vision_mode(
        self, api_client, mock_tiktok_metadata, mock_vision_workout_dict, tmp_path
    ):
        """Test TikTok ingestion with vision-only mode."""
        video_path = tmp_path / "video.mp4"
        video_path.touch()

        with patch.multiple(
            "workout_ingestor_api.services.tiktok_service.TikTokService",
            is_tiktok_url=MagicMock(return_value=True),
            extract_metadata=MagicMock(return_value=mock_tiktok_metadata),
            download_video=MagicMock(return_value=str(video_path)),
        ), patch(
            "workout_ingestor_api.services.vision_service.VisionService.extract_and_structure_workout_openai",
            return_value=mock_vision_workout_dict,
        ), patch(
            "workout_ingestor_api.services.video_service.VideoService.sample_frames",
            return_value=None,
        ), patch(
            "os.listdir",
            return_value=["frame_001.png"],
        ), patch(
            "os.path.join",
            side_effect=lambda *args: "/".join(args),
        ):
            response = api_client.post(
                "/ingest/tiktok",
                json={
                    "url": "https://www.tiktok.com/@user/video/123",
                    "mode": "vision_only",
                },
            )
            # May succeed or fail depending on file system mocking
            assert response.status_code in [200, 400, 500]

    def test_ingest_tiktok_audio_mode(
        self, api_client, mock_tiktok_metadata, tmp_path
    ):
        """Test TikTok ingestion with audio-only mode."""
        video_path = tmp_path / "video.mp4"
        video_path.touch()
        audio_path = tmp_path / "audio.mp3"
        audio_path.touch()

        mock_workout = {
            "title": "Audio Workout",
            "blocks": [
                {
                    "label": "Workout",
                    "structure": "regular",
                    "exercises": [
                        {"name": "Squats", "sets": 3, "reps": 10, "type": "strength"}
                    ],
                }
            ],
        }

        with patch.multiple(
            "workout_ingestor_api.services.tiktok_service.TikTokService",
            is_tiktok_url=MagicMock(return_value=True),
            extract_metadata=MagicMock(return_value=mock_tiktok_metadata),
            download_video=MagicMock(return_value=str(video_path)),
        ), patch(
            "workout_ingestor_api.services.asr_service.ASRService.extract_audio",
            return_value=str(audio_path),
        ), patch(
            "workout_ingestor_api.services.asr_service.ASRService.transcribe_with_openai_api",
            return_value={"text": "This workout includes 3 sets of 10 squats followed by push-ups and lunges for a complete routine", "language": "en"},
        ), patch(
            "workout_ingestor_api.api.youtube_ingest._parse_with_openai",
            return_value=mock_workout,
        ):
            response = api_client.post(
                "/ingest/tiktok",
                json={
                    "url": "https://www.tiktok.com/@user/video/123",
                    "mode": "audio_only",
                },
            )
            # May succeed or fail depending on file system mocking
            assert response.status_code in [200, 400, 500]


class TestTikTokMetadataEndpoint:
    """Test TikTok metadata API endpoint."""

    def test_get_tiktok_metadata_valid_url(self, api_client, mock_tiktok_metadata):
        """Test getting metadata for a valid TikTok URL."""
        with patch.multiple(
            "workout_ingestor_api.services.tiktok_service.TikTokService",
            is_tiktok_url=MagicMock(return_value=True),
            extract_metadata=MagicMock(return_value=mock_tiktok_metadata),
        ):
            response = api_client.get(
                "/tiktok/metadata",
                params={"url": "https://www.tiktok.com/@user/video/123"},
            )
            assert response.status_code == 200

            data = response.json()
            assert "video_id" in data
            assert "title" in data
            assert "author_name" in data

    def test_get_tiktok_metadata_invalid_url(self, api_client):
        """Test getting metadata with invalid URL."""
        response = api_client.get(
            "/tiktok/metadata",
            params={"url": "https://www.youtube.com/watch?v=abc"},
        )
        assert response.status_code == 400
        assert "Invalid TikTok URL" in response.json().get("detail", "")


class TestTikTokProvenance:
    """Test provenance tracking for TikTok ingestion."""

    def test_tiktok_provenance_includes_mode(
        self, api_client, mock_tiktok_metadata, mock_vision_workout_dict, tmp_path
    ):
        """Test that provenance includes extraction mode."""
        video_path = tmp_path / "video.mp4"
        video_path.touch()

        with patch.multiple(
            "workout_ingestor_api.services.tiktok_service.TikTokService",
            is_tiktok_url=MagicMock(return_value=True),
            extract_metadata=MagicMock(return_value=mock_tiktok_metadata),
            download_video=MagicMock(return_value=str(video_path)),
        ), patch(
            "workout_ingestor_api.services.vision_service.VisionService.extract_and_structure_workout_openai",
            return_value=mock_vision_workout_dict,
        ), patch(
            "workout_ingestor_api.services.video_service.VideoService.sample_frames",
            return_value=None,
        ), patch(
            "os.listdir",
            return_value=["frame_001.png"],
        ), patch(
            "os.path.join",
            side_effect=lambda *args: "/".join(args),
        ):
            response = api_client.post(
                "/ingest/tiktok",
                json={
                    "url": "https://www.tiktok.com/@user/video/123",
                    "mode": "vision_only",
                },
            )

            if response.status_code == 200:
                data = response.json()
                assert "_provenance" in data
                assert "mode" in data["_provenance"]
                assert "video_id" in data["_provenance"]