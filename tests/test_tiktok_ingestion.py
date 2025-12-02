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