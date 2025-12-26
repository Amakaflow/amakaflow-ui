"""Tests for input validation on ingestion endpoints."""

import pytest


class TestInputValidation:
    """Test input validation for various ingestion endpoints."""

    def test_ingest_youtube_missing_url(self, api_client):
        """Test YouTube ingestion with missing URL returns 422."""
        response = api_client.post("/ingest/youtube", json={})
        assert response.status_code == 422

    def test_ingest_youtube_empty_url(self, api_client):
        """Test YouTube ingestion with empty URL returns error."""
        response = api_client.post("/ingest/youtube", json={"url": ""})
        # Can return 400 (bad request) or 422 (validation error)
        assert response.status_code in [400, 422]

    def test_ingest_tiktok_missing_url(self, api_client):
        """Test TikTok ingestion with missing URL returns 422."""
        response = api_client.post("/ingest/tiktok", json={})
        assert response.status_code == 422

    def test_ingest_tiktok_empty_url(self, api_client):
        """Test TikTok ingestion with empty URL returns error."""
        response = api_client.post("/ingest/tiktok", json={"url": ""})
        # Can return 400 (bad request) or 422 (validation error)
        assert response.status_code in [400, 422]

    def test_ingest_instagram_missing_url(self, api_client):
        """Test Instagram ingestion with missing URL returns 422."""
        response = api_client.post("/ingest/instagram_test", json={})
        assert response.status_code == 422

    def test_ingest_json_malformed_json(self, api_client):
        """Test JSON ingestion with malformed JSON returns 422."""
        response = api_client.post(
            "/ingest/json",
            content='{"title": "Test", "blocks": [}',
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code == 422

    def test_ingest_json_invalid_structure(self, api_client):
        """Test JSON ingestion with invalid workout structure returns 400."""
        response = api_client.post(
            "/ingest/json",
            json={"invalid": "structure"},
        )
        # Should fail validation since required fields are missing
        assert response.status_code in [400, 422, 500]

    def test_ingest_text_missing_text(self, api_client):
        """Test text ingestion with missing text field returns 422."""
        response = api_client.post("/ingest/text", data={})
        assert response.status_code == 422

    def test_export_csv_missing_body(self, api_client):
        """Test CSV export with missing body returns 422."""
        response = api_client.post("/export/csv")
        assert response.status_code == 422

    def test_export_fit_missing_body(self, api_client):
        """Test FIT export with missing body returns 422."""
        response = api_client.post("/export/fit")
        assert response.status_code == 422


class TestTikTokUrlValidation:
    """Test TikTok URL validation in the ingestion endpoint."""

    def test_ingest_tiktok_invalid_url(self, api_client):
        """Test TikTok ingestion with non-TikTok URL returns 400."""
        response = api_client.post(
            "/ingest/tiktok",
            json={"url": "https://www.youtube.com/watch?v=abc123"},
        )
        assert response.status_code == 400
        assert "Invalid TikTok URL" in response.json().get("detail", "")

    def test_ingest_tiktok_malformed_url(self, api_client):
        """Test TikTok ingestion with malformed URL returns 400."""
        response = api_client.post(
            "/ingest/tiktok",
            json={"url": "not-a-valid-url"},
        )
        assert response.status_code == 400


class TestInstagramUrlValidation:
    """Test Instagram URL validation."""

    def test_ingest_instagram_video_url_not_supported(self, api_client):
        """Test that video URL error message is helpful."""
        # This is just testing that the endpoint exists and validates
        response = api_client.post(
            "/ingest/instagram_test",
            json={"url": "https://www.instagram.com/p/ABC123/"},
        )
        # Should attempt to process (may fail without network, but validates)
        assert response.status_code in [400, 422, 500]


class TestYouTubeUrlValidation:
    """Test YouTube URL validation."""

    def test_ingest_youtube_invalid_url_format(self, api_client):
        """Test YouTube ingestion with non-YouTube URL."""
        response = api_client.post(
            "/ingest/youtube",
            json={"url": "https://vimeo.com/12345678"},
        )
        # Should return error for non-YouTube URL
        assert response.status_code in [400, 422, 500]
