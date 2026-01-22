"""Unit tests for AIRequestContext header generation."""
import pytest
from unittest.mock import patch

from workout_ingestor_api.ai.client_factory import AIRequestContext


class TestAIRequestContextHeaders:
    """Test Helicone header generation from AIRequestContext."""

    def test_empty_context_includes_environment_only(self):
        """Empty context should still include environment header."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "production"

            context = AIRequestContext()
            headers = context.to_tracking_headers()

            assert headers == {"Helicone-Property-Environment": "production"}

    def test_user_id_maps_to_helicone_user_id_header(self):
        """user_id should map to Helicone-User-Id header."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "development"

            context = AIRequestContext(user_id="user_123")
            headers = context.to_tracking_headers()

            assert headers["Helicone-User-Id"] == "user_123"

    def test_session_id_maps_to_helicone_session_id_header(self):
        """session_id should map to Helicone-Session-Id header."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "development"

            context = AIRequestContext(session_id="sess_abc123")
            headers = context.to_tracking_headers()

            assert headers["Helicone-Session-Id"] == "sess_abc123"

    def test_feature_name_maps_to_helicone_property_feature(self):
        """feature_name should map to Helicone-Property-Feature header."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "development"

            context = AIRequestContext(feature_name="workout_parser")
            headers = context.to_tracking_headers()

            assert headers["Helicone-Property-Feature"] == "workout_parser"

    def test_request_id_maps_to_helicone_request_id(self):
        """request_id should map to Helicone-Request-Id header."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "development"

            context = AIRequestContext(request_id="req_xyz789")
            headers = context.to_tracking_headers()

            assert headers["Helicone-Request-Id"] == "req_xyz789"

    def test_custom_properties_converted_to_title_case_headers(self):
        """Custom properties should be converted to Helicone-Property-* headers."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "development"

            context = AIRequestContext(
                custom_properties={
                    "workout_type": "strength",
                    "source_platform": "youtube",
                }
            )
            headers = context.to_tracking_headers()

            assert headers["Helicone-Property-Workout-Type"] == "strength"
            assert headers["Helicone-Property-Source-Platform"] == "youtube"

    def test_full_context_generates_all_headers(self):
        """Full context should generate all corresponding headers."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "staging"

            context = AIRequestContext(
                user_id="user_456",
                session_id="sess_def",
                feature_name="voice_parser",
                request_id="req_001",
                custom_properties={"model": "gpt-4o"},
            )
            headers = context.to_tracking_headers()

            expected = {
                "Helicone-User-Id": "user_456",
                "Helicone-Session-Id": "sess_def",
                "Helicone-Property-Feature": "voice_parser",
                "Helicone-Request-Id": "req_001",
                "Helicone-Property-Environment": "staging",
                "Helicone-Property-Model": "gpt-4o",
            }
            assert headers == expected

    def test_none_values_are_excluded_from_headers(self):
        """None values should not generate headers."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "development"

            context = AIRequestContext(
                user_id=None,
                session_id=None,
                feature_name="test",
            )
            headers = context.to_tracking_headers()

            assert "Helicone-User-Id" not in headers
            assert "Helicone-Session-Id" not in headers
            assert "Helicone-Property-Feature" in headers

    def test_empty_string_user_id_is_excluded(self):
        """Empty string user_id should be treated same as None."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "development"

            # Note: Current implementation includes empty strings
            # This test documents the behavior - may want to change
            context = AIRequestContext(user_id="")
            headers = context.to_tracking_headers()

            # Empty string is falsy, so should NOT be included
            assert "Helicone-User-Id" not in headers

    def test_environment_always_included(self):
        """Environment header should always be present regardless of context."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "production"

            context = AIRequestContext()  # Empty context
            headers = context.to_tracking_headers()

            assert "Helicone-Property-Environment" in headers
            assert headers["Helicone-Property-Environment"] == "production"

    def test_custom_property_underscore_to_hyphen_conversion(self):
        """Underscores in custom property keys should become hyphens."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "test"

            context = AIRequestContext(
                custom_properties={"my_custom_property": "value"}
            )
            headers = context.to_tracking_headers()

            # workout_type -> Workout-Type (title case with hyphens)
            assert "Helicone-Property-My-Custom-Property" in headers

    def test_custom_property_value_converted_to_string(self):
        """Non-string custom property values should be converted to strings."""
        with patch("workout_ingestor_api.ai.client_factory.settings") as mock_settings:
            mock_settings.ENVIRONMENT = "test"

            context = AIRequestContext(
                custom_properties={
                    "count": 42,
                    "enabled": True,
                }
            )
            headers = context.to_tracking_headers()

            assert headers["Helicone-Property-Count"] == "42"
            assert headers["Helicone-Property-Enabled"] == "True"
