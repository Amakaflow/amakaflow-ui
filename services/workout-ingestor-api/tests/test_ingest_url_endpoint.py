import uuid as _uuid
from unittest.mock import patch, MagicMock
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


class TestIngestUrlBlockPortability:
    """Block ID and source injection via POST /ingest/url."""

    def _make_workout_data(self, blocks=None):
        return {
            "title": "Test Workout",
            "blocks": blocks or [
                {"label": "Block 1", "exercises": [{"name": "Squat", "sets": 3, "reps": 10, "type": "strength"}], "supersets": []},
            ],
        }

    def _post_ingest(self, client, workout_data, url="https://www.instagram.com/p/ABC123/"):
        """Helper: patch all ingest_url dependencies and POST /ingest/url."""
        from workout_ingestor_api.services.url_router import RoutingResult
        from workout_ingestor_api.services.adapters.base import MediaContent
        with patch(
            "workout_ingestor_api.services.url_router.route_url",
        ) as mock_route, patch(
            "workout_ingestor_api.services.unified_cache_service.UnifiedCacheService.get",
            return_value=None,
        ), patch(
            "workout_ingestor_api.services.adapters.get_adapter",
        ) as mock_get_adapter, patch(
            "workout_ingestor_api.services.unified_parser.UnifiedParser.parse",
            return_value=workout_data,
        ), patch(
            "workout_ingestor_api.services.unified_cache_service.UnifiedCacheService.save",
        ):
            mock_route.return_value = RoutingResult(platform="instagram", source_id="ABC123")
            mock_adapter = MagicMock()
            mock_adapter.fetch.return_value = MediaContent(
                primary_text="some workout text", title="Test"
            )
            mock_get_adapter.return_value = mock_adapter
            return client.post("/ingest/url", json={"url": url})

    def test_each_block_gets_a_uuid_id(self, client):
        response = self._post_ingest(client, self._make_workout_data())
        assert response.status_code == 200
        blocks = response.json()["blocks"]
        assert len(blocks) == 1
        _uuid.UUID(blocks[0]["id"])  # raises if not valid UUID

    def test_block_ids_are_unique_across_blocks(self, client):
        data = self._make_workout_data(blocks=[
            {"label": "A", "exercises": [{"name": "Squat", "sets": 3, "reps": 10, "type": "strength"}], "supersets": []},
            {"label": "B", "exercises": [{"name": "Deadlift", "sets": 3, "reps": 5, "type": "strength"}], "supersets": []},
        ])
        response = self._post_ingest(client, data)
        assert response.status_code == 200
        ids = [b["id"] for b in response.json()["blocks"]]
        assert ids[0] != ids[1]

    def test_block_source_reflects_ingest_url(self, client):
        response = self._post_ingest(client, self._make_workout_data())
        assert response.status_code == 200
        source = response.json()["blocks"][0]["source"]
        assert source["platform"] == "instagram"
        assert source["source_id"] == "ABC123"
        assert "instagram.com" in source["source_url"]

    def test_needs_clarification_false_when_all_blocks_confident(self, client):
        data = self._make_workout_data()
        data["blocks"][0]["structure_confidence"] = 1.0
        response = self._post_ingest(client, data)
        assert response.status_code == 200
        assert response.json()["needs_clarification"] is False

    def test_needs_clarification_true_when_block_has_low_confidence(self, client):
        data = self._make_workout_data()
        data["blocks"][0]["structure_confidence"] = 0.4
        data["blocks"][0]["structure_options"] = ["circuit", "straight_sets"]
        response = self._post_ingest(client, data)
        assert response.status_code == 200
        assert response.json()["needs_clarification"] is True

    def test_needs_clarification_threshold_boundary(self, client):
        """AMA-208: needs_clarification fires at < 0.5, NOT at < 0.8.
        The 0.5–0.79 band is a soft flag only (needs_clarification stays False).
        """
        # Exactly 0.5 → no clarification (boundary is exclusive below)
        data = self._make_workout_data()
        data["blocks"][0]["structure_confidence"] = 0.5
        data["blocks"][0]["structure_options"] = ["circuit", "regular"]
        response = self._post_ingest(client, data)
        assert response.status_code == 200
        assert response.json()["needs_clarification"] is False

        # 0.49 → needs_clarification
        data["blocks"][0]["structure_confidence"] = 0.49
        data["blocks"][0]["structure_options"] = ["circuit", "regular"]
        response = self._post_ingest(client, data)
        assert response.status_code == 200
        assert response.json()["needs_clarification"] is True

        # 0.79 is in the soft-flag zone → no clarification (was incorrectly True before AMA-208)
        data["blocks"][0]["structure_confidence"] = 0.79
        data["blocks"][0]["structure_options"] = ["circuit", "regular"]
        response = self._post_ingest(client, data)
        assert response.status_code == 200
        assert response.json()["needs_clarification"] is False

        # 0.8 → confident, no clarification
        data["blocks"][0]["structure_confidence"] = 0.8
        data["blocks"][0]["structure_options"] = []
        response = self._post_ingest(client, data)
        assert response.status_code == 200
        assert response.json()["needs_clarification"] is False

    def test_soft_flag_range_structure_options_populated(self, client):
        """AMA-208: In the 0.5–0.79 soft-flag range, structure_options must be non-empty.
        If the LLM forgot to populate them, the route layer adds a fallback placeholder
        using the block's chosen structure value.
        """
        data = self._make_workout_data(blocks=[{
            "label": "Block 1",
            "structure": "circuit",
            "structure_confidence": 0.65,
            # Deliberately omit structure_options to simulate LLM forgetting
            "exercises": [{"name": "Squat", "sets": 3, "reps": 10, "type": "strength"}],
            "supersets": [],
        }])
        response = self._post_ingest(client, data)
        assert response.status_code == 200
        block = response.json()["blocks"][0]
        # structure_options must be non-empty (route fills in a fallback)
        assert block["structure_options"]

    def test_clarification_range_structure_options_populated(self, client):
        """AMA-208: Below 0.5, structure_options must also be non-empty."""
        data = self._make_workout_data(blocks=[{
            "label": "Block 1",
            "structure": "regular",
            "structure_confidence": 0.3,
            # Deliberately omit structure_options to simulate LLM forgetting
            "exercises": [{"name": "Squat", "sets": 3, "reps": 10, "type": "strength"}],
            "supersets": [],
        }])
        response = self._post_ingest(client, data)
        assert response.status_code == 200
        block = response.json()["blocks"][0]
        assert block["structure_options"]
        assert response.json()["needs_clarification"] is True

    def test_missing_structure_confidence_defaults_to_1(self, client):
        """AMA-208: If the LLM omits structure_confidence entirely, it defaults to 1.0."""
        data = self._make_workout_data()
        data["blocks"][0].pop("structure_confidence", None)
        data["blocks"][0].pop("structure_options", None)
        response = self._post_ingest(client, data)
        assert response.status_code == 200
        result = response.json()
        assert result["needs_clarification"] is False
        assert result["blocks"][0]["structure_confidence"] == 1.0

    def test_existing_block_id_is_preserved(self, client):
        fixed_id = str(_uuid.uuid4())
        data = self._make_workout_data()
        data["blocks"][0]["id"] = fixed_id
        response = self._post_ingest(client, data)
        assert response.status_code == 200
        assert response.json()["blocks"][0]["id"] == fixed_id
