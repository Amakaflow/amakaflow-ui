"""MCP Server implementation for chat-api.

This module provides an MCP (Model Context Protocol) server that exposes
chat-api tools to AI models and external clients.

MCP Protocol Reference: https://modelcontextprotocol.io/
"""

import json
import logging
from typing import Any, Dict, List, Optional, Union
from dataclasses import dataclass, field

from backend.services.tool_schemas import ALL_TOOLS, PHASE_1_TOOLS, PHASE_2_TOOLS

logger = logging.getLogger(__name__)


# =============================================================================
# MCP Protocol Types
# =============================================================================


@dataclass
class MCPRequest:
    """Base class for MCP requests."""
    jsonrpc: str = "2.0"


@dataclass
class MCPResponse:
    """Base class for MCP responses."""
    jsonrpc: str = "2.0"


@dataclass
class MCPError:
    """MCP error response."""
    code: int
    message: str
    data: Optional[Any] = None


# MCP Error Codes
JSONRPC_PARSE_ERROR = -32700
JSONRPC_INVALID_REQUEST = -32600
JSONRPC_METHOD_NOT_FOUND = -32601
JSONRPC_INVALID_PARAMS = -32602
JSONRPC_INTERNAL_ERROR = -32603

# MCP Specific Error Codes
MCP_SERVER_INITIALIZATION_ERROR = -32000
MCP_TOOL_NOT_FOUND = -32001
MCP_INVALID_TOOL_ARGUMENTS = -32002
MCP_TOOL_EXECUTION_ERROR = -32003


class ToolNotFoundError(Exception):
    """Error when a requested tool is not found."""
    
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


@dataclass
class MCPInitializeRequest(MCPRequest):
    """MCP initialize request."""
    id: Union[str, int, None] = None
    method: str = "initialize"
    params: Optional[Dict[str, Any]] = None


@dataclass
class MCPInitializeResult:
    """MCP initialize result."""
    protocolVersion: str
    capabilities: Dict[str, Any]
    serverInfo: Dict[str, Any]


@dataclass
class MCPTool:
    """MCP tool definition."""
    name: str
    description: str
    inputSchema: Dict[str, Any]


@dataclass 
class MCPToolsListResult:
    """MCP tools/list result."""
    tools: List[MCPTool]


@dataclass
class MCPToolCallRequest:
    """MCP tools/call request."""
    name: str
    arguments: Dict[str, Any]


# =============================================================================
# MCP Server Implementation
# =============================================================================


class MCPServer:
    """MCP Server that exposes chat-api tools via the Model Context Protocol.
    
    This server implements the MCP specification to allow AI models and external
    clients to invoke chat-api tools (workout search, calendar scheduling, etc.)
    via a standardized protocol.
    
    Usage:
        server = MCPServer(function_dispatcher=dispatcher)
        result = server.handle_request(request)
    """

    # MCP Protocol version this server supports
    PROTOCOL_VERSION = "2024-11-05"

    # Server capabilities
    CAPABILITIES = {
        "tools": {}
    }

    def __init__(
        self,
        function_dispatcher: Optional[Any] = None,
        async_function_dispatcher: Optional[Any] = None,
    ):
        """Initialize the MCP server.
        
        Args:
            function_dispatcher: Sync FunctionDispatcher for Phase 1-4 tools
            async_function_dispatcher: AsyncFunctionDispatcher for all tools
        """
        self._function_dispatcher = function_dispatcher
        self._async_function_dispatcher = async_function_dispatcher
        self._initialized = False
        self._server_info = {
            "name": "chat-api",
            "version": "1.0.0",
        }

    def _convert_tool_schema(self, tool_schema: Dict[str, Any]) -> MCPTool:
        """Convert tool_schemas.py format to MCP tool format.
        
        Args:
            tool_schema: Tool schema from tool_schemas.py
            
        Returns:
            MCPTool in MCP format
        """
        return MCPTool(
            name=tool_schema["name"],
            description=tool_schema["description"],
            inputSchema=tool_schema["input_schema"],
        )

    def get_tools(self) -> List[MCPTool]:
        """Get all available tools in MCP format.
        
        Returns:
            List of MCPTool objects
        """
        return [self._convert_tool_schema(tool) for tool in ALL_TOOLS]

    def get_tools_by_phase(self, phase: int) -> List[MCPTool]:
        """Get tools for a specific phase.
        
        Args:
            phase: Phase number (1-5)
            
        Returns:
            List of MCPTool objects for the specified phase
        """
        phase_tools = {
            1: PHASE_1_TOOLS,
            2: PHASE_2_TOOLS,
        }
        
        tools = phase_tools.get(phase, [])
        return [self._convert_tool_schema(tool) for tool in tools]

    def find_tool(self, name: str) -> Optional[Dict[str, Any]]:
        """Find a tool by name.
        
        Args:
            name: Tool name to find
            
        Returns:
            Tool schema if found, None otherwise
        """
        for tool in ALL_TOOLS:
            if tool["name"] == name:
                return tool
        return None

    def initialize(self, params: Optional[Dict[str, Any]] = None) -> MCPInitializeResult:
        """Initialize the MCP server.
        
        Args:
            params: Optional initialization parameters from client
            
        Returns:
            MCPInitializeResult with server capabilities
        """
        self._initialized = True
        logger.info("MCP Server initialized")
        
        return MCPInitializeResult(
            protocolVersion=self.PROTOCOL_VERSION,
            capabilities=self.CAPABILITIES,
            serverInfo=self._server_info,
        )

    def list_tools(self) -> MCPToolsListResult:
        """List all available tools.
        
        Returns:
            MCPToolsListResult with all tools
        """
        return MCPToolsListResult(tools=self.get_tools())

    def call_tool(
        self,
        name: str,
        arguments: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Call a tool with the given arguments.
        
        Args:
            name: Tool name to call
            arguments: Tool arguments
            
        Returns:
            Tool execution result
            
        Raises:
            ToolNotFoundError: If tool not found
            ValueError: If invalid arguments
        """
        tool = self.find_tool(name)
        if not tool:
            raise ToolNotFoundError(f"Tool not found: {name}")
        
        # Validate required arguments
        required = tool["input_schema"].get("required", [])
        missing = [field for field in required if field not in arguments]
        if missing:
            raise ValueError(f"Missing required arguments: {missing}")
        
        # In a real implementation, this would call the function dispatcher
        # For now, return a mock response for contract testing
        return {
            "success": True,
            "tool": name,
            "result": f"Tool {name} executed successfully",
        }

    def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Handle an MCP JSON-RPC request.
        
        Args:
            request: JSON-RPC request dictionary
            
        Returns:
            JSON-RPC response dictionary
        """
        # Handle notification (no id)
        request_id = request.get("id")
        method = request.get("method")
        
        try:
            # Validate JSON-RPC version
            if request.get("jsonrpc") != "2.0":
                return self._error_response(
                    request_id,
                    JSONRPC_INVALID_REQUEST,
                    "Invalid JSON-RPC version",
                )
            
            # Handle methods
            if method == "initialize":
                result = self.initialize(request.get("params"))
                return self._success_response(
                    request_id,
                    {
                        "protocolVersion": result.protocolVersion,
                        "capabilities": result.capabilities,
                        "serverInfo": result.serverInfo,
                    }
                )
            
            elif method == "tools/list":
                result = self.list_tools()
                return self._success_response(
                    request_id,
                    {
                        "tools": [
                            {
                                "name": t.name,
                                "description": t.description,
                                "inputSchema": t.inputSchema,
                            }
                            for t in result.tools
                        ]
                    }
                )
            
            elif method == "tools/call":
                params = request.get("params", {})
                tool_name = params.get("name")
                arguments = params.get("arguments", {})
                
                if not tool_name:
                    return self._error_response(
                        request_id,
                        JSONRPC_INVALID_PARAMS,
                        "Missing tool name",
                    )
                
                result = self.call_tool(tool_name, arguments)
                return self._success_response(
                    request_id,
                    {"content": [{"type": "text", "text": json.dumps(result)}]}
                )
            
            else:
                return self._error_response(
                    request_id,
                    JSONRPC_METHOD_NOT_FOUND,
                    f"Method not found: {method}",
                )
                
        except ToolNotFoundError as e:
            return self._error_response(
                request_id,
                MCP_TOOL_NOT_FOUND,
                str(e),
            )
        except ValueError as e:
            return self._error_response(
                request_id,
                MCP_INVALID_TOOL_ARGUMENTS,
                str(e),
            )
        except Exception as e:
            logger.exception("Error handling MCP request")
            return self._error_response(
                request_id,
                MCP_TOOL_EXECUTION_ERROR,
                str(e),
            )

    def _success_response(
        self,
        request_id: Optional[Union[str, int]],
        result: Any,
    ) -> Dict[str, Any]:
        """Create a success response."""
        response: Dict[str, Any] = {
            "jsonrpc": "2.0",
            "result": result,
        }
        if request_id is not None:
            response["id"] = request_id
        return response

    def _error_response(
        self,
        request_id: Optional[Union[str, int]],
        code: int,
        message: str,
        data: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """Create an error response."""
        error: Dict[str, Any] = {
            "jsonrpc": "2.0",
            "error": {
                "code": code,
                "message": message,
            },
        }
        if data is not None:
            error["error"]["data"] = data
        if request_id is not None:
            error["id"] = request_id
        return error


# =============================================================================
# Factory function
# =============================================================================


def create_mcp_server(
    mapper_api_url: str = "http://localhost:8000",
    calendar_api_url: str = "http://localhost:8001",
    ingestor_api_url: str = "http://localhost:8002",
) -> MCPServer:
    """Create and configure an MCP server.
    
    Args:
        mapper_api_url: URL for mapper API
        calendar_api_url: URL for calendar API  
        ingestor_api_url: URL for workout ingestor API
        
    Returns:
        Configured MCPServer instance
    """
    # Import here to avoid circular imports
    from backend.services.function_dispatcher import FunctionDispatcher
    from backend.services.async_function_dispatcher import AsyncFunctionDispatcher
    
    sync_dispatcher = FunctionDispatcher(
        mapper_api_url=mapper_api_url,
        calendar_api_url=calendar_api_url,
        ingestor_api_url=ingestor_api_url,
    )
    
    # Return server without async dispatcher for simpler setup
    return MCPServer(function_dispatcher=sync_dispatcher)
