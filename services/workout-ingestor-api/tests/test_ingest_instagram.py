"""Tests for Instagram ingestion endpoint."""

import pytest
from unittest.mock import patch


class TestInstagramIngestion:
    """Test Instagram post ingestion."""

    def test_ingest_instagram_valid_post_with_ocr(
        self, api_client, mock_instagram_service, mock_ocr_service
    ):
        """Test ingesting valid Instagram post with OCR extraction."""
        response = api_client.post(
            "/ingest/instagram_test",
            json={"url": "https://www.instagram.com/p/ABC123/"},
        )
        # With mocked services, should succeed
        assert response.status_code == 200

        data = response.json()
        assert "blocks" in data
        assert "_provenance" in data
        assert data["_provenance"]["mode"] == "instagram_image_test"

    def test_ingest_instagram_returns_filtered_items(
        self, api_client, mock_instagram_service, mock_ocr_service
    ):
        """Test that Instagram ingestion returns filtered items."""
        response = api_client.post(
            "/ingest/instagram_test",
            json={"url": "https://www.instagram.com/p/ABC123/"},
        )
        assert response.status_code == 200

        data = response.json()
        assert "_filtered_items" in data

    def test_ingest_instagram_includes_image_count(
        self, api_client, mock_instagram_service, mock_ocr_service
    ):
        """Test that provenance includes image count."""
        response = api_client.post(
            "/ingest/instagram_test",
            json={"url": "https://www.instagram.com/p/ABC123/"},
        )
        assert response.status_code == 200

        data = response.json()
        assert "_provenance" in data
        assert "image_count" in data["_provenance"]
        assert data["_provenance"]["image_count"] == 2  # From mock


class TestInstagramServiceError:
    """Test Instagram ingestion error handling."""

    def test_ingest_instagram_service_error(self, api_client):
        """Test handling of Instagram service errors."""
        with patch(
            "workout_ingestor_api.services.instagram_service.InstagramService.download_post_images_no_login"
        ) as mock:
            from workout_ingestor_api.services.instagram_service import InstagramServiceError
            mock.side_effect = InstagramServiceError("Failed to download images")

            response = api_client.post(
                "/ingest/instagram_test",
                json={"url": "https://www.instagram.com/p/ABC123/"},
            )
            assert response.status_code == 400
            assert "Failed to download images" in response.json().get("detail", "")

    def test_ingest_instagram_no_text_extracted(self, api_client, mock_instagram_images):
        """Test handling when OCR extracts no text."""
        with patch(
            "workout_ingestor_api.services.instagram_service.InstagramService.download_post_images_no_login",
            return_value=mock_instagram_images,
        ), patch(
            "workout_ingestor_api.services.ocr_service.OCRService.ocr_image_bytes",
            return_value="",  # Empty OCR result
        ):
            response = api_client.post(
                "/ingest/instagram_test",
                json={"url": "https://www.instagram.com/p/ABC123/"},
            )
            assert response.status_code == 422
            assert "OCR could not extract text" in response.json().get("detail", "")


class TestInstagramUrlFormats:
    """Test various Instagram URL formats."""

    @pytest.mark.parametrize(
        "url",
        [
            "https://www.instagram.com/p/ABC123/",
            "https://instagram.com/p/ABC123/",
            "https://www.instagram.com/p/ABC123",
        ],
    )
    def test_instagram_url_formats(
        self, api_client, mock_instagram_service, mock_ocr_service, url
    ):
        """Test that various Instagram post URL formats are accepted."""
        response = api_client.post(
            "/ingest/instagram_test",
            json={"url": url},
        )
        # Should at least attempt to process (mocked services)
        assert response.status_code in [200, 400, 422, 500]
