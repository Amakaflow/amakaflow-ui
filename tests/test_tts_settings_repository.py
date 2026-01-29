"""Unit tests for TTS Settings Repository.

Part of AMA-442: Extend Voice Infrastructure for Chat Assistant (TTS)
"""

from datetime import date, timedelta
from unittest.mock import MagicMock

import pytest

from infrastructure.db.tts_settings_repository import (
    SupabaseTTSSettingsRepository,
    TTSSettings,
    TTSSettingsUpdate,
)


class TestTTSSettings:
    """Test TTSSettings dataclass."""

    def test_default_values(self):
        """Test default settings values."""
        settings = TTSSettings()

        assert settings.tts_enabled is True
        assert settings.tts_voice_id is None
        assert settings.tts_speed == 1.0
        assert settings.tts_pitch == 1.0
        assert settings.auto_play_responses is True
        assert settings.tts_daily_chars_used == 0

    def test_daily_chars_remaining(self):
        """Test daily_chars_remaining computed property."""
        settings = TTSSettings(tts_daily_chars_used=30000)

        assert settings.daily_chars_remaining == 20000

    def test_daily_chars_remaining_at_limit(self):
        """Test daily_chars_remaining at limit."""
        settings = TTSSettings(tts_daily_chars_used=50000)

        assert settings.daily_chars_remaining == 0

    def test_daily_chars_remaining_over_limit(self):
        """Test daily_chars_remaining doesn't go negative."""
        settings = TTSSettings(tts_daily_chars_used=60000)

        assert settings.daily_chars_remaining == 0


class TestSupabaseTTSSettingsRepository:
    """Test SupabaseTTSSettingsRepository."""

    @pytest.fixture
    def mock_client(self):
        """Create mock Supabase client."""
        client = MagicMock()
        return client

    @pytest.fixture
    def repo(self, mock_client):
        """Create repository with mock client."""
        return SupabaseTTSSettingsRepository(client=mock_client, daily_char_limit=50000)

    def test_get_settings_returns_defaults_when_no_record(self, repo, mock_client):
        """Test get_settings returns defaults when user has no record."""
        mock_result = MagicMock()
        mock_result.data = []
        mock_client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            mock_result
        )

        settings = repo.get_settings("user-123")

        assert settings.tts_enabled is True
        assert settings.tts_voice_id is None
        assert settings.tts_speed == 1.0

    def test_get_settings_returns_stored_values(self, repo, mock_client):
        """Test get_settings returns values from database."""
        mock_result = MagicMock()
        mock_result.data = [
            {
                "tts_enabled": False,
                "tts_voice_id": "custom-voice",
                "tts_speed": 1.5,
                "tts_pitch": 0.8,
                "auto_play_responses": False,
                "tts_daily_chars_used": 10000,
                "tts_daily_reset_date": "2026-01-29",
            }
        ]
        mock_client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            mock_result
        )

        settings = repo.get_settings("user-123")

        assert settings.tts_enabled is False
        assert settings.tts_voice_id == "custom-voice"
        assert settings.tts_speed == 1.5
        assert settings.tts_pitch == 0.8
        assert settings.auto_play_responses is False
        assert settings.tts_daily_chars_used == 10000
        assert settings.tts_daily_reset_date == date(2026, 1, 29)

    def test_update_settings_upserts_record(self, repo, mock_client):
        """Test update_settings performs upsert."""
        # Mock the upsert
        mock_client.table.return_value.upsert.return_value.execute.return_value = MagicMock()

        # Mock get_settings for return value
        mock_result = MagicMock()
        mock_result.data = [{"tts_enabled": False, "tts_speed": 1.5}]
        mock_client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            mock_result
        )

        update = TTSSettingsUpdate(tts_enabled=False, tts_speed=1.5)
        repo.update_settings("user-123", update)

        # Verify upsert was called
        mock_client.table.return_value.upsert.assert_called_once()
        call_args = mock_client.table.return_value.upsert.call_args[0][0]
        assert call_args["user_id"] == "user-123"
        assert call_args["tts_enabled"] is False
        assert call_args["tts_speed"] == 1.5

    def test_update_settings_only_includes_non_none_fields(self, repo, mock_client):
        """Test that only non-None fields are included in update."""
        mock_client.table.return_value.upsert.return_value.execute.return_value = MagicMock()
        mock_result = MagicMock()
        mock_result.data = [{}]
        mock_client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            mock_result
        )

        # Only update tts_enabled, leave others as None
        update = TTSSettingsUpdate(tts_enabled=True)
        repo.update_settings("user-123", update)

        call_args = mock_client.table.return_value.upsert.call_args[0][0]
        assert "tts_enabled" in call_args
        assert "tts_speed" not in call_args
        assert "tts_voice_id" not in call_args

    def test_increment_daily_chars(self, repo, mock_client):
        """Test incrementing daily character counter using atomic RPC."""
        # Mock the RPC call to return the new total
        mock_rpc_result = MagicMock()
        mock_rpc_result.data = 1500  # Current 1000 + 500 added

        mock_client.rpc.return_value.execute.return_value = mock_rpc_result

        result = repo.increment_daily_chars("user-123", 500)

        # Verify RPC was called with correct parameters
        mock_client.rpc.assert_called_once_with(
            "increment_tts_daily_chars",
            {"p_user_id": "user-123", "p_chars": 500},
        )
        assert result == 1500

    def test_reset_daily_chars_if_new_day(self, repo, mock_client):
        """Test that daily counter resets on new day."""
        yesterday = (date.today() - timedelta(days=1)).isoformat()

        # Mock ensure record exists
        mock_exists_result = MagicMock()
        mock_exists_result.data = [{"user_id": "user-123"}]

        # Mock stored date (yesterday)
        mock_date_result = MagicMock()
        mock_date_result.data = [{"tts_daily_reset_date": yesterday}]

        mock_client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.side_effect = [
            mock_exists_result,
            mock_date_result,
        ]
        mock_client.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()

        repo.reset_daily_chars_if_needed("user-123")

        # Verify reset was called
        update_call = mock_client.table.return_value.update.call_args[0][0]
        assert update_call["tts_daily_chars_used"] == 0
        assert update_call["tts_daily_reset_date"] == date.today().isoformat()

    def test_ensure_record_creates_if_not_exists(self, repo, mock_client):
        """Test that _ensure_record_exists creates record if none exists."""
        # Mock no existing record
        mock_result = MagicMock()
        mock_result.data = []
        mock_client.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = (
            mock_result
        )
        mock_client.table.return_value.insert.return_value.execute.return_value = MagicMock()

        repo._ensure_record_exists("user-123")

        # Verify insert was called with defaults
        mock_client.table.return_value.insert.assert_called_once()
        insert_data = mock_client.table.return_value.insert.call_args[0][0]
        assert insert_data["user_id"] == "user-123"
        assert insert_data["tts_enabled"] is True
        assert insert_data["tts_daily_chars_used"] == 0


class TestTTSSettingsUpdate:
    """Test TTSSettingsUpdate dataclass."""

    def test_all_none_by_default(self):
        """Test that all fields are None by default."""
        update = TTSSettingsUpdate()

        assert update.tts_enabled is None
        assert update.tts_voice_id is None
        assert update.tts_speed is None
        assert update.tts_pitch is None
        assert update.auto_play_responses is None

    def test_partial_update(self):
        """Test creating a partial update."""
        update = TTSSettingsUpdate(tts_enabled=False, tts_speed=1.5)

        assert update.tts_enabled is False
        assert update.tts_speed == 1.5
        assert update.tts_voice_id is None
