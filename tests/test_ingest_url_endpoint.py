from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient
from workout_ingestor_api.services.unified_parser import UnifiedParserError


WORKOUT_RESPONSE = {
    "title": "Test Workout",
    "workout_type": "strength",
    "blocks": [{"label": "Main", "exercises": [{"name": "Squat", "sets": 3, "reps": 10, "type": "strength"}], "supersets": []}],
}


def test_ingest_url_instagram_success(client):
    with patch(
        "workout_ingestor_api.services.url_router.route_url",
    ) as mock_route, patch(
        "workout_ingestor_api.services.unified_cache_service.UnifiedCacheService.get",
        return_value=None,
    ), patch(
        "workout_ingestor_api.services.adapters.get_adapter",
    ) as mock_get_adapter, patch(
        "workout_ingestor_api.services.unified_parser.UnifiedParser.parse",
        return_value=WORKOUT_RESPONSE,
    ), patch(
        "workout_ingestor_api.services.unified_cache_service.UnifiedCacheService.save",
    ):
        from workout_ingestor_api.services.url_router import RoutingResult
        from workout_ingestor_api.services.adapters.base import MediaContent
        mock_route.return_value = RoutingResult(platform="instagram", source_id="DEaDjHLtHwA")
        mock_adapter = MagicMock()
        mock_adapter.fetch.return_value = MediaContent(
            primary_text="4 rounds squats push-ups", title="Test"
        )
        mock_get_adapter.return_value = mock_adapter

        response = client.post("/ingest/url", json={"url": "https://instagram.com/p/DEaDjHLtHwA/"})
        assert response.status_code == 200
        data = response.json()
        assert "blocks" in data


def test_ingest_url_unsupported_returns_400(client):
    with patch("workout_ingestor_api.services.url_router.route_url", return_value=None):
        response = client.post("/ingest/url", json={"url": "https://example.com/video/123"})
        assert response.status_code == 400


def test_ingest_url_cache_hit_skips_adapter(client):
    with patch(
        "workout_ingestor_api.services.url_router.route_url",
    ) as mock_route, patch(
        "workout_ingestor_api.services.unified_cache_service.UnifiedCacheService.get",
        return_value=WORKOUT_RESPONSE,
    ), patch(
        "workout_ingestor_api.services.adapters.get_adapter",
    ) as mock_get_adapter:
        from workout_ingestor_api.services.url_router import RoutingResult
        mock_route.return_value = RoutingResult(platform="instagram", source_id="cached123")

        response = client.post("/ingest/url", json={"url": "https://instagram.com/p/cached123/"})
        assert response.status_code == 200
        mock_get_adapter.assert_not_called()


def test_ingest_url_fetch_failure_returns_502(client):
    with patch(
        "workout_ingestor_api.services.url_router.route_url",
    ) as mock_route, patch(
        "workout_ingestor_api.services.unified_cache_service.UnifiedCacheService.get",
        return_value=None,
    ), patch(
        "workout_ingestor_api.services.adapters.get_adapter",
    ) as mock_get_adapter:
        from workout_ingestor_api.services.url_router import RoutingResult
        from workout_ingestor_api.services.adapters.base import PlatformFetchError
        mock_route.return_value = RoutingResult(platform="instagram", source_id="fail123")
        mock_adapter = MagicMock()
        mock_adapter.fetch.side_effect = PlatformFetchError("Apify down")
        mock_get_adapter.return_value = mock_adapter

        response = client.post("/ingest/url", json={"url": "https://instagram.com/p/fail123/"})
        assert response.status_code == 502


def test_ingest_url_no_text_returns_400(client):
    with patch(
        "workout_ingestor_api.services.url_router.route_url",
    ) as mock_route, patch(
        "workout_ingestor_api.services.unified_cache_service.UnifiedCacheService.get",
        return_value=None,
    ), patch(
        "workout_ingestor_api.services.adapters.get_adapter",
    ) as mock_get_adapter:
        from workout_ingestor_api.services.url_router import RoutingResult
        from workout_ingestor_api.services.adapters.base import MediaContent
        mock_route.return_value = RoutingResult(platform="instagram", source_id="empty123")
        mock_adapter = MagicMock()
        mock_adapter.fetch.return_value = MediaContent(primary_text="", title="")
        mock_get_adapter.return_value = mock_adapter

        response = client.post("/ingest/url", json={"url": "https://instagram.com/p/empty123/"})
        assert response.status_code == 400


def test_ingest_url_success_includes_provenance(client):
    with patch(
        "workout_ingestor_api.services.url_router.route_url",
    ) as mock_route, patch(
        "workout_ingestor_api.services.unified_cache_service.UnifiedCacheService.get",
        return_value=None,
    ), patch(
        "workout_ingestor_api.services.adapters.get_adapter",
    ) as mock_get_adapter, patch(
        "workout_ingestor_api.services.unified_parser.UnifiedParser.parse",
        return_value=WORKOUT_RESPONSE,
    ), patch(
        "workout_ingestor_api.services.unified_cache_service.UnifiedCacheService.save",
    ):
        from workout_ingestor_api.services.url_router import RoutingResult
        from workout_ingestor_api.services.adapters.base import MediaContent
        mock_route.return_value = RoutingResult(platform="instagram", source_id="ABC123")
        mock_adapter = MagicMock()
        mock_adapter.fetch.return_value = MediaContent(
            primary_text="some workout text", title="Test"
        )
        mock_get_adapter.return_value = mock_adapter

        response = client.post("/ingest/url", json={"url": "https://www.instagram.com/reel/ABC123/"})
        assert response.status_code == 200
        data = response.json()
        assert "_provenance" in data
        assert data["_provenance"]["platform"] == "instagram"
        assert data["_provenance"]["source_id"] == "ABC123"


def test_ingest_url_parse_failure_returns_422(client):
    with patch(
        "workout_ingestor_api.services.url_router.route_url",
    ) as mock_route, patch(
        "workout_ingestor_api.services.unified_cache_service.UnifiedCacheService.get",
        return_value=None,
    ), patch(
        "workout_ingestor_api.services.adapters.get_adapter",
    ) as mock_get_adapter, patch(
        "workout_ingestor_api.services.unified_parser.UnifiedParser.parse",
        side_effect=UnifiedParserError("LLM returned invalid JSON"),
    ):
        from workout_ingestor_api.services.url_router import RoutingResult
        from workout_ingestor_api.services.adapters.base import MediaContent
        mock_route.return_value = RoutingResult(platform="instagram", source_id="ABC123")
        mock_adapter = MagicMock()
        mock_adapter.fetch.return_value = MediaContent(
            primary_text="some workout text", title="Test"
        )
        mock_get_adapter.return_value = mock_adapter

        response = client.post("/ingest/url", json={"url": "https://www.instagram.com/reel/ABC123/"})
        assert response.status_code == 422
