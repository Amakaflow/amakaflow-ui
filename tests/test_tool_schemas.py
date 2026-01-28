"""Tests for tool schema validation.

Ensures PHASE_1_TOOLS schemas are valid and match dispatcher handlers.
"""

import pytest

from backend.services.tool_schemas import PHASE_1_TOOLS
from backend.services.function_dispatcher import FunctionDispatcher


class TestToolSchemaStructure:
    """Verify tool schemas have required fields for Anthropic API."""

    def test_all_tools_have_required_fields(self):
        """Each tool must have name, description, and input_schema."""
        required_fields = {"name", "description", "input_schema"}

        for tool in PHASE_1_TOOLS:
            missing = required_fields - set(tool.keys())
            assert not missing, f"Tool missing fields {missing}: {tool.get('name', 'unknown')}"

    def test_all_tools_have_valid_name(self):
        """Tool names must be non-empty strings."""
        for tool in PHASE_1_TOOLS:
            assert isinstance(tool["name"], str), f"Tool name must be string: {tool}"
            assert len(tool["name"]) > 0, f"Tool name must not be empty: {tool}"

    def test_all_tools_have_valid_description(self):
        """Tool descriptions must be non-empty strings."""
        for tool in PHASE_1_TOOLS:
            assert isinstance(tool["description"], str), f"Description must be string: {tool['name']}"
            assert len(tool["description"]) > 0, f"Description must not be empty: {tool['name']}"

    def test_input_schemas_are_valid_json_schema(self):
        """Input schemas must have type=object and properties dict."""
        for tool in PHASE_1_TOOLS:
            schema = tool["input_schema"]
            assert schema.get("type") == "object", f"Schema type must be 'object': {tool['name']}"
            assert isinstance(schema.get("properties"), dict), f"Schema must have properties dict: {tool['name']}"

    def test_required_fields_exist_in_properties(self):
        """All required fields must be defined in properties."""
        for tool in PHASE_1_TOOLS:
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

        schema_names = {tool["name"] for tool in PHASE_1_TOOLS}
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

        assert len(PHASE_1_TOOLS) == len(dispatcher._handlers), (
            f"Tool count mismatch: {len(PHASE_1_TOOLS)} schemas vs {len(dispatcher._handlers)} handlers"
        )


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
