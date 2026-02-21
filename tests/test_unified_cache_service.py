from unittest.mock import patch, MagicMock
import pytest
from workout_ingestor_api.services.unified_cache_service import UnifiedCacheService

SAMPLE_WORKOUT = {"title": "Test", "blocks": []}


def _mock_supabase(return_data=None, raise_exc=None):
    client = MagicMock()
    table = client.table.return_value
    select = table.select.return_value
    eq1 = select.eq.return_value
    eq2 = eq1.eq.return_value
    single = eq2.single.return_value
    if raise_exc:
        single.execute.side_effect = raise_exc
    else:
        single.execute.return_value = MagicMock(data=return_data)
    return client


def test_get_returns_workout_on_cache_hit():
    mock_client = _mock_supabase(return_data={"workout_data": SAMPLE_WORKOUT})
    with patch("workout_ingestor_api.services.unified_cache_service._get_supabase_client", return_value=mock_client):
        result = UnifiedCacheService.get("abc123", "instagram")
        assert result == SAMPLE_WORKOUT


def test_get_returns_none_on_cache_miss():
    mock_client = _mock_supabase(raise_exc=Exception("no rows found"))
    with patch("workout_ingestor_api.services.unified_cache_service._get_supabase_client", return_value=mock_client):
        result = UnifiedCacheService.get("abc123", "instagram")
        assert result is None


def test_get_returns_none_when_supabase_unavailable():
    with patch("workout_ingestor_api.services.unified_cache_service._get_supabase_client", return_value=None):
        result = UnifiedCacheService.get("abc123", "instagram")
        assert result is None


def test_save_calls_insert():
    mock_client = MagicMock()
    mock_client.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[{"id": 1}])
    with patch("workout_ingestor_api.services.unified_cache_service._get_supabase_client", return_value=mock_client):
        UnifiedCacheService.save("abc123", "instagram", SAMPLE_WORKOUT)
        mock_client.table.assert_called_once_with("video_workout_cache")
        mock_client.table.return_value.insert.assert_called_once()
        # Assert the payload content
        call_args = mock_client.table.return_value.insert.call_args
        payload = call_args[0][0]
        assert payload["video_id"] == "abc123"
        assert payload["platform"] == "instagram"
        assert payload["workout_data"] == SAMPLE_WORKOUT
        assert "ingested_at" in payload


def test_save_returns_false_when_supabase_unavailable():
    with patch("workout_ingestor_api.services.unified_cache_service._get_supabase_client", return_value=None):
        result = UnifiedCacheService.save("abc123", "instagram", SAMPLE_WORKOUT)
        assert result is False
