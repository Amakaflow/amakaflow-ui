"""Tests for ApifyService."""
import pytest
from unittest.mock import patch, MagicMock
from workout_ingestor_api.services.apify_service import ApifyService, ApifyServiceError


def test_fetch_reel_data_returns_metadata():
    """ApifyService should call the reel scraper actor and return reel data."""
    mock_item = {
        "id": "abc123",
        "shortCode": "DRHiuniDM1K",
        "caption": "Full body HIIT workout! 3 rounds...",
        "videoDuration": 62,
        "videoUrl": "https://scontent.cdninstagram.com/v/...",
        "ownerUsername": "fitcoach",
        "likesCount": 1200,
        "timestamp": "2026-01-15T10:00:00.000Z",
        "transcript": "okay let's start with jumping jacks for 30 seconds...",
    }

    with patch("workout_ingestor_api.services.apify_service.ApifyClient") as MockClient, \
         patch("workout_ingestor_api.services.apify_service.settings") as mock_settings:
        mock_settings.APIFY_API_TOKEN = "test-token"
        mock_client = MockClient.return_value
        mock_actor = MagicMock()
        mock_client.actor.return_value = mock_actor
        mock_actor.call.return_value = {"defaultDatasetId": "ds_123"}
        mock_dataset = MagicMock()
        mock_client.dataset.return_value = mock_dataset
        mock_dataset.iterate_items.return_value = iter([mock_item])

        result = ApifyService.fetch_reel_data("https://www.instagram.com/reel/DRHiuniDM1K/")

    assert result["shortCode"] == "DRHiuniDM1K"
    assert result["transcript"] == "okay let's start with jumping jacks for 30 seconds..."
    assert result["videoDuration"] == 62


def test_fetch_reel_data_no_token_raises():
    """ApifyService should raise if APIFY_API_TOKEN is not set."""
    with patch("workout_ingestor_api.services.apify_service.settings") as mock_settings:
        mock_settings.APIFY_API_TOKEN = None
        with pytest.raises(ApifyServiceError, match="APIFY_API_TOKEN"):
            ApifyService.fetch_reel_data("https://www.instagram.com/reel/DRHiuniDM1K/")


def test_fetch_reel_data_no_results_raises():
    """ApifyService should raise if actor returns no items."""
    with patch("workout_ingestor_api.services.apify_service.ApifyClient") as MockClient:
        mock_client = MockClient.return_value
        mock_actor = MagicMock()
        mock_client.actor.return_value = mock_actor
        mock_actor.call.return_value = {"defaultDatasetId": "ds_123"}
        mock_dataset = MagicMock()
        mock_client.dataset.return_value = mock_dataset
        mock_dataset.iterate_items.return_value = iter([])

        with patch("workout_ingestor_api.services.apify_service.settings") as mock_settings:
            mock_settings.APIFY_API_TOKEN = "test-token"
            with pytest.raises(ApifyServiceError, match="No reel data"):
                ApifyService.fetch_reel_data("https://www.instagram.com/reel/DRHiuniDM1K/")
