"""Contract tests for MCP (Model Context Protocol) server.

These tests verify MCP protocol conformance, tool registration, and schema consistency
between the MCP server and tool_schemas.py (single source of truth).

Usage:
    pytest -m mcp -v
    pytest tests/mcp/ --tb=short
"""

import json
import pytest

from backend.mcp import MCPServer
from backend.mcp.server import (
    MCP_SERVER_INITIALIZATION_ERROR,
    MCP_TOOL_NOT_FOUND,
    MCP_INVALID_TOOL_ARGUMENTS,
    MCP_TOOL_EXECUTION_ERROR,
    JSONRPC_PARSE_ERROR,
    JSONRPC_INVALID_REQUEST,
    JSONRPC_METHOD_NOT_FOUND,
    JSONRPC_INVALID_PARAMS,
)
from backend.services.tool_schemas import (
    ALL_TOOLS,
    PHASE_1_TOOLS,
    PHASE_2_TOOLS,
    PHASE_3_TOOLS,
    PHASE_4_TOOLS,
    PHASE_5_TOOLS,
)


# =============================================================================
# MCP Server Startup Tests
# =============================================================================


@pytest.mark.mcp
class TestMCPServerStartup:
    """Tests for MCP server initialization and startup."""

    def test_server_can_be_instantiated(self):
        """MCP server can be created without errors."""
        server = MCPServer()
        assert server is not None

    def test_server_starts_uninitialized(self):
        """Server starts in uninitialized state."""
        server = MCPServer()
        assert not server._initialized

    def test_initialize_method_sets_initialized_state(self):
        """Initialize method sets server to initialized state."""
        server = MCPServer()
        result = server.initialize()
        
        assert server._initialized is True
        assert result.protocolVersion == MCPServer.PROTOCOL_VERSION

    def test_initialize_returns_capabilities(self):
        """Initialize returns server capabilities."""
        server = MCPServer()
        result = server.initialize()
        
        assert "tools" in result.capabilities
        assert hasattr(result, "serverInfo")
        assert result.serverInfo["name"] == "chat-api"

    def test_initialize_request_via_jsonrpc(self):
        """Can initialize via JSON-RPC handle_request."""
        server = MCPServer()
        
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {"protocolVersion": "2024-11-05"},
        }
        
        response = server.handle_request(request)
        
        assert response["jsonrpc"] == "2.0"
        assert response["id"] == 1
        assert "result" in response
        assert "protocolVersion" in response["result"]


@pytest.mark.mcp
class TestMCPToolRegistration:
    """Tests for MCP tool registration and discovery."""

    def test_get_tools_returns_list(self):
        """get_tools returns a list of tools."""
        server = MCPServer()
        tools = server.get_tools()
        
        assert isinstance(tools, list)
        assert len(tools) > 0

    def test_get_tools_count_matches_all_tools(self):
        """Tool count matches ALL_TOOLS from tool_schemas.py."""
        server = MCPServer()
        tools = server.get_tools()
        
        assert len(tools) == len(ALL_TOOLS)

    def test_all_phase1_tools_registered(self):
        """All Phase 1 tools are registered."""
        server = MCPServer()
        mcp_tools = {t.name for t in server.get_tools()}
        schema_tools = {t["name"] for t in PHASE_1_TOOLS}
        
        assert schema_tools.issubset(mcp_tools)

    def test_all_phase2_tools_registered(self):
        """All Phase 2 tools are registered."""
        server = MCPServer()
        mcp_tools = {t.name for t in server.get_tools()}
        schema_tools = {t["name"] for t in PHASE_2_TOOLS}
        
        assert schema_tools.issubset(mcp_tools)

    def test_all_phase3_tools_registered(self):
        """All Phase 3 tools are registered."""
        server = MCPServer()
        mcp_tools = {t.name for t in server.get_tools()}
        schema_tools = {t["name"] for t in PHASE_3_TOOLS}
        
        assert schema_tools.issubset(mcp_tools)

    def test_all_phase4_tools_registered(self):
        """All Phase 4 tools are registered."""
        server = MCPServer()
        mcp_tools = {t.name for t in server.get_tools()}
        schema_tools = {t["name"] for t in PHASE_4_TOOLS}
        
        assert schema_tools.issubset(mcp_tools)

    def test_all_phase5_tools_registered(self):
        """All Phase 5 tools are registered."""
        server = MCPServer()
        mcp_tools = {t.name for t in server.get_tools()}
        schema_tools = {t["name"] for t in PHASE_5_TOOLS}
        
        assert schema_tools.issubset(mcp_tools)

    def test_tools_list_via_jsonrpc(self):
        """Can list tools via JSON-RPC."""
        server = MCPServer()
        
        request = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {},
        }
        
        response = server.handle_request(request)
        
        assert "result" in response
        assert "tools" in response["result"]
        assert len(response["result"]["tools"]) == len(ALL_TOOLS)


# =============================================================================
# Schema Consistency Tests
# =============================================================================


@pytest.mark.mcp
class TestMCPSchemaConsistency:
    """Tests verifying MCP tool schemas match tool_schemas.py."""

    def test_tool_names_match_schema(self):
        """MCP tool names exactly match tool_schemas.py."""
        server = MCPServer()
        mcp_tool_names = {t.name for t in server.get_tools()}
        schema_tool_names = {t["name"] for t in ALL_TOOLS}
        
        assert mcp_tool_names == schema_tool_names

    def test_tool_descriptions_match_schema(self):
        """MCP tool descriptions match tool_schemas.py."""
        server = MCPServer()
        mcp_tools = {t.name: t for t in server.get_tools()}
        
        for schema_tool in ALL_TOOLS:
            mcp_tool = mcp_tools[schema_tool["name"]]
            assert mcp_tool.description == schema_tool["description"]

    def test_input_schemas_match_schema(self):
        """MCP input schemas match tool_schemas.py exactly."""
        server = MCPServer()
        mcp_tools = {t.name: t for t in server.get_tools()}
        
        for schema_tool in ALL_TOOLS:
            mcp_tool = mcp_tools[schema_tool["name"]]
            assert mcp_tool.inputSchema == schema_tool["input_schema"]

    def test_required_fields_in_schema(self):
        """Required fields in MCP match tool_schemas.py."""
        server = MCPServer()
        mcp_tools = {t.name: t for t in server.get_tools()}
        
        for schema_tool in ALL_TOOLS:
            mcp_tool = mcp_tools[schema_tool["name"]]
            schema_required = schema_tool["input_schema"].get("required", [])
            mcp_required = mcp_tool.inputSchema.get("required", [])
            
            assert set(mcp_required) == set(schema_required)

    def test_search_workout_library_schema_consistency(self):
        """search_workout_library schema matches between MCP and tool_schemas."""
        server = MCPServer()
        mcp_tool = next(t for t in server.get_tools() if t.name == "search_workout_library")
        schema_tool = next(t for t in ALL_TOOLS if t["name"] == "search_workout_library")
        
        assert mcp_tool.name == schema_tool["name"]
        assert mcp_tool.description == schema_tool["description"]
        assert mcp_tool.inputSchema == schema_tool["input_schema"]

    def test_generate_workout_schema_consistency(self):
        """generate_workout schema matches between MCP and tool_schemas."""
        server = MCPServer()
        mcp_tool = next(t for t in server.get_tools() if t.name == "generate_workout")
        schema_tool = next(t for t in ALL_TOOLS if t["name"] == "generate_workout")
        
        assert mcp_tool.inputSchema["type"] == schema_tool["input_schema"]["type"]
        assert "description" in mcp_tool.inputSchema["properties"]
        assert "description" in schema_tool["input_schema"]["properties"]

    def test_navigate_to_page_enum_consistency(self):
        """navigate_to_page enum values match between MCP and tool_schemas."""
        server = MCPServer()
        mcp_tool = next(t for t in server.get_tools() if t.name == "navigate_to_page")
        
        page_enum = mcp_tool.inputSchema["properties"]["page"]["enum"]
        assert "home" in page_enum
        assert "library" in page_enum
        assert "calendar" in page_enum
        assert "workout" in page_enum
        assert "settings" in page_enum


# =============================================================================
# Browser Control Contract Tests (Phase 1-2 Tools)
# =============================================================================


@pytest.mark.mcp
class TestMCPBrowserControlContracts:
    """Contract tests for browser control tools (Phase 1-2)."""

    def test_phase1_tools_have_required_fields(self):
        """Phase 1 tools have all required fields per MCP spec."""
        server = MCPServer()
        
        for tool in server.get_tools():
            # Each MCP tool must have name, description, inputSchema
            assert tool.name, "Tool must have name"
            assert tool.description, "Tool must have description"
            assert tool.inputSchema, "Tool must have inputSchema"

    def test_search_workout_library_accepts_query(self):
        """search_workout_library accepts query parameter."""
        server = MCPServer()
        
        result = server.call_tool(
            "search_workout_library",
            {"query": "HIIT workouts"}
        )
        
        assert result["success"] is True
        assert result["tool"] == "search_workout_library"

    def test_add_workout_to_calendar_requires_workout_id_and_date(self):
        """add_workout_to_calendar requires workout_id and date."""
        server = MCPServer()
        
        # Missing required fields should raise ValueError
        with pytest.raises(ValueError, match="Missing required arguments"):
            server.call_tool("add_workout_to_calendar", {})

    def test_add_workout_to_calendar_accepts_valid_args(self):
        """add_workout_to_calendar accepts valid arguments."""
        server = MCPServer()
        
        result = server.call_tool(
            "add_workout_to_calendar",
            {"workout_id": "w-123", "date": "2024-01-15"}
        )
        
        assert result["success"] is True

    def test_generate_workout_requires_description(self):
        """generate_workout requires description field."""
        server = MCPServer()
        
        with pytest.raises(ValueError, match="Missing required arguments"):
            server.call_tool("generate_workout", {})

    def test_navigate_to_page_accepts_page_param(self):
        """navigate_to_page accepts valid page parameter."""
        server = MCPServer()
        
        result = server.call_tool(
            "navigate_to_page",
            {"page": "calendar"}
        )
        
        assert result["success"] is True

    def test_phase2_import_tools_exist(self):
        """Phase 2 content import tools are available."""
        server = MCPServer()
        tool_names = {t.name for t in server.get_tools()}
        
        assert "import_from_youtube" in tool_names
        assert "import_from_tiktok" in tool_names
        assert "import_from_instagram" in tool_names
        assert "import_from_pinterest" in tool_names


# =============================================================================
# Error Handling Contract Tests
# =============================================================================


@pytest.mark.mcp
class TestMCPErrorHandling:
    """Contract tests for MCP error handling."""

    def test_invalid_jsonrpc_version(self):
        """Invalid JSON-RPC version returns error."""
        server = MCPServer()
        
        request = {
            "jsonrpc": "1.0",  # Invalid version
            "id": 1,
            "method": "initialize",
        }
        
        response = server.handle_request(request)
        
        assert "error" in response
        assert response["error"]["code"] == JSONRPC_INVALID_REQUEST

    def test_missing_method(self):
        """Missing method returns error."""
        server = MCPServer()
        
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            # No method field
        }
        
        response = server.handle_request(request)
        
        assert "error" in response

    def test_unknown_method(self):
        """Unknown method returns METHOD_NOT_FOUND error."""
        server = MCPServer()
        
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "unknown_method",
        }
        
        response = server.handle_request(request)
        
        assert "error" in response
        assert response["error"]["code"] == JSONRPC_METHOD_NOT_FOUND

    def test_tool_not_found_error(self):
        """Calling non-existent tool returns error."""
        server = MCPServer()
        
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "nonexistent_tool",
                "arguments": {}
            }
        }
        
        response = server.handle_request(request)
        
        assert "error" in response
        assert response["error"]["code"] == MCP_TOOL_NOT_FOUND

    def test_missing_tool_name_in_call(self):
        """Calling tools/call without name returns error."""
        server = MCPServer()
        
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "arguments": {}
            }
        }
        
        response = server.handle_request(request)
        
        assert "error" in response
        assert response["error"]["code"] == JSONRPC_INVALID_PARAMS

    def test_missing_required_arguments(self):
        """Missing required arguments returns error."""
        server = MCPServer()
        
        # add_workout_to_calendar requires workout_id and date
        with pytest.raises(ValueError, match="Missing required arguments"):
            server.call_tool("add_workout_to_calendar", {"workout_id": "w-123"})
            
    def test_invalid_arguments_type(self):
        """Invalid argument types are handled gracefully."""
        server = MCPServer()
        
        # Passing wrong type (string instead of integer for limit)
        result = server.call_tool(
            "search_workout_library",
            {"query": "test", "limit": "not_an_integer"}
        )
        
        # Should still succeed (validation happens at dispatcher level)
        assert result["success"] is True

    def test_empty_arguments_allowed(self):
        """Tools with no required args accept empty arguments."""
        server = MCPServer()
        
        # get_workout_history has no required fields
        result = server.call_tool("get_workout_history", {})
        
        assert result["success"] is True

    def test_notification_without_id(self):
        """Notifications (no id) are handled without response."""
        server = MCPServer()
        
        request = {
            "jsonrpc": "2.0",
            # No id - this is a notification
            "method": "initialize",
        }
        
        # Should not raise and returns the result
        response = server.handle_request(request)
        
        assert response is not None
        assert "id" not in response  # Notifications don't include id in response

    def test_error_response_includes_code_and_message(self):
        """Error responses include code and message."""
        server = MCPServer()
        
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "nonexistent_tool",
                "arguments": {}
            }
        }
        
        response = server.handle_request(request)
        
        assert "error" in response
        assert "code" in response["error"]
        assert "message" in response["error"]
        assert response["error"]["code"] == MCP_TOOL_NOT_FOUND

    def test_error_response_preserves_request_id(self):
        """Error responses include the request id."""
        server = MCPServer()
        
        request = {
            "jsonrpc": "2.0",
            "id": 42,
            "method": "unknown_method",
        }
        
        response = server.handle_request(request)
        
        assert response["id"] == 42


# =============================================================================
# MCP Protocol Conformance Tests
# =============================================================================


@pytest.mark.mcp
class TestMCPProtocolConformance:
    """Tests for MCP protocol specification conformance."""

    def test_jsonrpc_version_in_request(self):
        """Requests include JSON-RPC 2.0 version."""
        server = MCPServer()
        
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
        }
        
        response = server.handle_request(request)
        
        assert response["jsonrpc"] == "2.0"

    def test_jsonrpc_version_in_error_response(self):
        """Error responses include JSON-RPC 2.0 version."""
        server = MCPServer()
        
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "invalid_method",
        }
        
        response = server.handle_request(request)
        
        assert response["jsonrpc"] == "2.0"

    def test_initialize_returns_protocol_version(self):
        """Initialize returns protocol version."""
        server = MCPServer()
        
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
        }
        
        response = server.handle_request(request)
        
        assert "protocolVersion" in response["result"]

    def test_tools_list_returns_tools_array(self):
        """tools/list returns tools as array."""
        server = MCPServer()
        
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/list",
        }
        
        response = server.handle_request(request)
        
        assert "tools" in response["result"]
        assert isinstance(response["result"]["tools"], list)

    def test_tools_call_returns_content_array(self):
        """tools/call returns content array."""
        server = MCPServer()
        
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "search_workout_library",
                "arguments": {"query": "test"}
            }
        }
        
        response = server.handle_request(request)
        
        assert "content" in response["result"]
        assert isinstance(response["result"]["content"], list)
        assert response["result"]["content"][0]["type"] == "text"

    def test_server_info_in_initialize_response(self):
        """Initialize response includes server info."""
        server = MCPServer()
        
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
        }
        
        response = server.handle_request(request)
        
        assert "serverInfo" in response["result"]
        assert "name" in response["result"]["serverInfo"]
        assert "version" in response["result"]["serverInfo"]

    def test_capabilities_in_initialize_response(self):
        """Initialize response includes capabilities."""
        server = MCPServer()
        
        request = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
        }
        
        response = server.handle_request(request)
        
        assert "capabilities" in response["result"]
