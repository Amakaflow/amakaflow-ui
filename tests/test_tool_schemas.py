"""Tests for tool schema validation.

Ensures tool schemas are valid and match dispatcher handlers.
"""

import pytest

from backend.services.tool_schemas import PHASE_1_TOOLS, PHASE_2_TOOLS, PHASE_3_TOOLS, PHASE_4_TOOLS, ALL_TOOLS
from backend.services.function_dispatcher import FunctionDispatcher


class TestToolSchemaStructure:
    """Verify tool schemas have required fields for Anthropic API."""

    def test_all_tools_have_required_fields(self):
        """Each tool must have name, description, and input_schema."""
        required_fields = {"name", "description", "input_schema"}

        for tool in ALL_TOOLS:
            missing = required_fields - set(tool.keys())
            assert not missing, f"Tool missing fields {missing}: {tool.get('name', 'unknown')}"

    def test_all_tools_have_valid_name(self):
        """Tool names must be non-empty strings."""
        for tool in ALL_TOOLS:
            assert isinstance(tool["name"], str), f"Tool name must be string: {tool}"
            assert len(tool["name"]) > 0, f"Tool name must not be empty: {tool}"

    def test_all_tools_have_valid_description(self):
        """Tool descriptions must be non-empty strings."""
        for tool in ALL_TOOLS:
            assert isinstance(tool["description"], str), f"Description must be string: {tool['name']}"
            assert len(tool["description"]) > 0, f"Description must not be empty: {tool['name']}"

    def test_input_schemas_are_valid_json_schema(self):
        """Input schemas must have type=object and properties dict."""
        for tool in ALL_TOOLS:
            schema = tool["input_schema"]
            assert schema.get("type") == "object", f"Schema type must be 'object': {tool['name']}"
            assert isinstance(schema.get("properties"), dict), f"Schema must have properties dict: {tool['name']}"

    def test_required_fields_exist_in_properties(self):
        """All required fields must be defined in properties."""
        for tool in ALL_TOOLS:
            schema = tool["input_schema"]
            required = schema.get("required", [])
            properties = schema.get("properties", {})

            for field in required:
                assert field in properties, (
                    f"Required field '{field}' not in properties for {tool['name']}"
                )


class TestToolSchemaDispatcherAlignment:
    """Verify schemas match dispatcher handlers."""

    def test_tool_names_match_dispatcher_handlers(self):
        """Every tool schema name must have a corresponding dispatcher handler."""
        dispatcher = FunctionDispatcher(
            mapper_api_url="http://test",
            calendar_api_url="http://test",
            ingestor_api_url="http://test",
        )

        schema_names = {tool["name"] for tool in ALL_TOOLS}
        handler_names = set(dispatcher._handlers.keys())

        # All schema names should have handlers
        missing_handlers = schema_names - handler_names
        assert not missing_handlers, f"Schema tools without handlers: {missing_handlers}"

        # All handlers should have schemas
        missing_schemas = handler_names - schema_names
        assert not missing_schemas, f"Handlers without schema tools: {missing_schemas}"

    def test_tool_count_matches(self):
        """Number of tools should match number of handlers."""
        dispatcher = FunctionDispatcher(
            mapper_api_url="http://test",
            calendar_api_url="http://test",
            ingestor_api_url="http://test",
        )

        assert len(ALL_TOOLS) == len(dispatcher._handlers), (
            f"Tool count mismatch: {len(ALL_TOOLS)} schemas vs {len(dispatcher._handlers)} handlers"
        )

    def test_all_tools_is_combination_of_phases(self):
        """ALL_TOOLS should be Phase 1 + Phase 2 + Phase 3 + Phase 4."""
        expected_count = len(PHASE_1_TOOLS) + len(PHASE_2_TOOLS) + len(PHASE_3_TOOLS) + len(PHASE_4_TOOLS)
        assert len(ALL_TOOLS) == expected_count
        assert ALL_TOOLS == PHASE_1_TOOLS + PHASE_2_TOOLS + PHASE_3_TOOLS + PHASE_4_TOOLS


class TestToolSchemaContent:
    """Verify specific tool schema content is correct."""

    def test_search_workout_library_schema(self):
        """Verify search_workout_library has correct schema."""
        tool = next(t for t in PHASE_1_TOOLS if t["name"] == "search_workout_library")

        assert "query" in tool["input_schema"]["properties"]
        assert "limit" in tool["input_schema"]["properties"]
        assert "query" in tool["input_schema"]["required"]

    def test_add_workout_to_calendar_schema(self):
        """Verify add_workout_to_calendar has correct required fields."""
        tool = next(t for t in PHASE_1_TOOLS if t["name"] == "add_workout_to_calendar")

        assert "workout_id" in tool["input_schema"]["properties"]
        assert "date" in tool["input_schema"]["properties"]
        assert set(tool["input_schema"]["required"]) == {"workout_id", "date"}

    def test_generate_ai_workout_schema(self):
        """Verify generate_ai_workout has description required."""
        tool = next(t for t in PHASE_1_TOOLS if t["name"] == "generate_ai_workout")

        assert "description" in tool["input_schema"]["properties"]
        assert "description" in tool["input_schema"]["required"]

    def test_navigate_to_page_schema(self):
        """Verify navigate_to_page has valid enum values."""
        tool = next(t for t in PHASE_1_TOOLS if t["name"] == "navigate_to_page")

        page_prop = tool["input_schema"]["properties"]["page"]
        assert "enum" in page_prop
        assert "home" in page_prop["enum"]
        assert "library" in page_prop["enum"]
        assert "calendar" in page_prop["enum"]
        assert "workout" in page_prop["enum"]
        assert "settings" in page_prop["enum"]


class TestPhase2ToolSchemaContent:
    """Verify Phase 2 content ingestion tool schemas are correct."""

    def test_import_from_youtube_schema(self):
        """Verify import_from_youtube has url required and skip_cache optional."""
        tool = next(t for t in PHASE_2_TOOLS if t["name"] == "import_from_youtube")

        assert "url" in tool["input_schema"]["properties"]
        assert "skip_cache" in tool["input_schema"]["properties"]
        assert tool["input_schema"]["required"] == ["url"]

    def test_import_from_tiktok_schema(self):
        """Verify import_from_tiktok has url required and mode enum."""
        tool = next(t for t in PHASE_2_TOOLS if t["name"] == "import_from_tiktok")

        assert "url" in tool["input_schema"]["properties"]
        assert "mode" in tool["input_schema"]["properties"]
        assert tool["input_schema"]["required"] == ["url"]

        mode_prop = tool["input_schema"]["properties"]["mode"]
        assert "enum" in mode_prop
        assert set(mode_prop["enum"]) == {"oembed", "auto", "hybrid"}

    def test_import_from_instagram_schema(self):
        """Verify import_from_instagram has url required."""
        tool = next(t for t in PHASE_2_TOOLS if t["name"] == "import_from_instagram")

        assert "url" in tool["input_schema"]["properties"]
        assert tool["input_schema"]["required"] == ["url"]

    def test_import_from_pinterest_schema(self):
        """Verify import_from_pinterest has url required."""
        tool = next(t for t in PHASE_2_TOOLS if t["name"] == "import_from_pinterest")

        assert "url" in tool["input_schema"]["properties"]
        assert tool["input_schema"]["required"] == ["url"]

    def test_import_from_image_schema(self):
        """Verify import_from_image has image_data required and filename optional."""
        tool = next(t for t in PHASE_2_TOOLS if t["name"] == "import_from_image")

        assert "image_data" in tool["input_schema"]["properties"]
        assert "filename" in tool["input_schema"]["properties"]
        assert tool["input_schema"]["required"] == ["image_data"]


class TestPhase3ToolSchemaContent:
    """Verify Phase 3 workout management tool schemas are correct."""

    def test_edit_workout_schema(self):
        """Verify edit_workout has workout_id and operations required."""
        tool = next(t for t in PHASE_3_TOOLS if t["name"] == "edit_workout")

        assert "workout_id" in tool["input_schema"]["properties"]
        assert "operations" in tool["input_schema"]["properties"]
        assert set(tool["input_schema"]["required"]) == {"workout_id", "operations"}

        # Verify operations is an array with proper item schema
        ops_schema = tool["input_schema"]["properties"]["operations"]
        assert ops_schema["type"] == "array"
        assert "items" in ops_schema
        assert ops_schema["items"]["properties"]["op"]["enum"] == ["replace", "add", "remove"]

    def test_export_workout_schema(self):
        """Verify export_workout has workout_id and format required with valid enum."""
        tool = next(t for t in PHASE_3_TOOLS if t["name"] == "export_workout")

        assert "workout_id" in tool["input_schema"]["properties"]
        assert "format" in tool["input_schema"]["properties"]
        assert set(tool["input_schema"]["required"]) == {"workout_id", "format"}

        format_prop = tool["input_schema"]["properties"]["format"]
        assert "enum" in format_prop
        assert set(format_prop["enum"]) == {"yaml", "zwo", "workoutkit", "fit_metadata"}

    def test_duplicate_workout_schema(self):
        """Verify duplicate_workout has workout_id required and optional fields."""
        tool = next(t for t in PHASE_3_TOOLS if t["name"] == "duplicate_workout")

        assert "workout_id" in tool["input_schema"]["properties"]
        assert "new_title" in tool["input_schema"]["properties"]
        assert "modifications" in tool["input_schema"]["properties"]
        assert tool["input_schema"]["required"] == ["workout_id"]

    def test_log_workout_completion_schema(self):
        """Verify log_workout_completion has workout_id required and optional metrics."""
        tool = next(t for t in PHASE_3_TOOLS if t["name"] == "log_workout_completion")

        assert "workout_id" in tool["input_schema"]["properties"]
        assert "duration_minutes" in tool["input_schema"]["properties"]
        assert "notes" in tool["input_schema"]["properties"]
        assert "rating" in tool["input_schema"]["properties"]
        assert tool["input_schema"]["required"] == ["workout_id"]

        # Verify rating constraints
        rating_prop = tool["input_schema"]["properties"]["rating"]
        assert rating_prop.get("minimum") == 1
        assert rating_prop.get("maximum") == 5

    def test_get_workout_history_schema(self):
        """Verify get_workout_history has optional filtering params."""
        tool = next(t for t in PHASE_3_TOOLS if t["name"] == "get_workout_history")

        assert "limit" in tool["input_schema"]["properties"]
        assert "start_date" in tool["input_schema"]["properties"]
        assert "end_date" in tool["input_schema"]["properties"]
        # No required fields
        assert "required" not in tool["input_schema"] or not tool["input_schema"]["required"]

    def test_get_workout_details_schema(self):
        """Verify get_workout_details has workout_id required."""
        tool = next(t for t in PHASE_3_TOOLS if t["name"] == "get_workout_details")

        assert "workout_id" in tool["input_schema"]["properties"]
        assert tool["input_schema"]["required"] == ["workout_id"]


class TestPhase4ToolSchemaContent:
    """Verify Phase 4 calendar & sync tool schemas are correct."""

    def test_get_calendar_events_schema(self):
        """Verify get_calendar_events has required date params."""
        tool = next(t for t in PHASE_4_TOOLS if t["name"] == "get_calendar_events")

        assert "start_date" in tool["input_schema"]["properties"]
        assert "end_date" in tool["input_schema"]["properties"]
        assert set(tool["input_schema"]["required"]) == {"start_date", "end_date"}

    def test_reschedule_workout_schema(self):
        """Verify reschedule_workout has event_id required and optional date/time."""
        tool = next(t for t in PHASE_4_TOOLS if t["name"] == "reschedule_workout")

        assert "event_id" in tool["input_schema"]["properties"]
        assert "new_date" in tool["input_schema"]["properties"]
        assert "new_time" in tool["input_schema"]["properties"]
        assert tool["input_schema"]["required"] == ["event_id"]

    def test_cancel_scheduled_workout_schema(self):
        """Verify cancel_scheduled_workout requires event_id and confirm."""
        tool = next(t for t in PHASE_4_TOOLS if t["name"] == "cancel_scheduled_workout")

        assert "event_id" in tool["input_schema"]["properties"]
        assert "confirm" in tool["input_schema"]["properties"]
        confirm_prop = tool["input_schema"]["properties"]["confirm"]
        assert confirm_prop["type"] == "boolean"
        assert set(tool["input_schema"]["required"]) == {"event_id", "confirm"}

    def test_sync_strava_schema(self):
        """Verify sync_strava has optional days_back param."""
        tool = next(t for t in PHASE_4_TOOLS if t["name"] == "sync_strava")

        assert "days_back" in tool["input_schema"]["properties"]
        # No required fields
        assert "required" not in tool["input_schema"] or not tool["input_schema"]["required"]

    def test_sync_garmin_schema(self):
        """Verify sync_garmin requires workout_ids array."""
        tool = next(t for t in PHASE_4_TOOLS if t["name"] == "sync_garmin")

        assert "workout_ids" in tool["input_schema"]["properties"]
        workout_ids_prop = tool["input_schema"]["properties"]["workout_ids"]
        assert workout_ids_prop["type"] == "array"
        assert workout_ids_prop["items"]["type"] == "string"
        assert tool["input_schema"]["required"] == ["workout_ids"]

    def test_get_strava_activities_schema(self):
        """Verify get_strava_activities has optional limit param."""
        tool = next(t for t in PHASE_4_TOOLS if t["name"] == "get_strava_activities")

        assert "limit" in tool["input_schema"]["properties"]
        # No required fields
        assert "required" not in tool["input_schema"] or not tool["input_schema"]["required"]


class TestSafetyBoundaries:
    """Verify safety constraints are enforced at schema level."""

    def test_no_delete_workout_tool_exists(self):
        """Critical: Verify delete_workout is NOT in the tool list."""
        tool_names = {tool["name"] for tool in ALL_TOOLS}
        assert "delete_workout" not in tool_names
        assert "remove_workout" not in tool_names
        assert "bulk_delete" not in tool_names

    def test_edit_operations_exclude_destructive_ops(self):
        """Verify edit_workout only allows safe operations."""
        tool = next(t for t in PHASE_3_TOOLS if t["name"] == "edit_workout")
        allowed_ops = tool["input_schema"]["properties"]["operations"]["items"]["properties"]["op"]["enum"]

        # Only these operations should be allowed
        assert set(allowed_ops) == {"replace", "add", "remove"}

        # These destructive/dangerous operations should NOT be allowed
        assert "delete" not in allowed_ops
        assert "move" not in allowed_ops
        assert "copy" not in allowed_ops
        assert "test" not in allowed_ops

    def test_export_format_restricted_to_known_formats(self):
        """Verify export format is limited to known safe formats."""
        tool = next(t for t in PHASE_3_TOOLS if t["name"] == "export_workout")
        allowed_formats = tool["input_schema"]["properties"]["format"]["enum"]

        # Should only contain known, safe export formats
        assert set(allowed_formats) == {"yaml", "zwo", "workoutkit", "fit_metadata"}

    def test_rating_has_bounds(self):
        """Verify rating field has min/max constraints."""
        tool = next(t for t in PHASE_3_TOOLS if t["name"] == "log_workout_completion")
        rating_schema = tool["input_schema"]["properties"]["rating"]

        assert rating_schema.get("minimum") == 1
        assert rating_schema.get("maximum") == 5
