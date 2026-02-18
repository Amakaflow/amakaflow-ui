"""MCP (Model Context Protocol) support for chat-api.

This package provides MCP server functionality to expose chat-api tools
via the Model Context Protocol.

Usage:
    from backend.mcp import MCPServer
    
    server = MCPServer()
    result = server.handle_request(request)
"""

from backend.mcp.server import (
    MCPServer,
    MCPTool,
    MCPRequest,
    MCPResponse,
    MCPError,
    create_mcp_server,
    # Error codes
    JSONRPC_PARSE_ERROR,
    JSONRPC_INVALID_REQUEST,
    JSONRPC_METHOD_NOT_FOUND,
    JSONRPC_INVALID_PARAMS,
    JSONRPC_INTERNAL_ERROR,
    MCP_SERVER_INITIALIZATION_ERROR,
    MCP_TOOL_NOT_FOUND,
    MCP_INVALID_TOOL_ARGUMENTS,
    MCP_TOOL_EXECUTION_ERROR,
)

__all__ = [
    "MCPServer",
    "MCPTool",
    "MCPRequest", 
    "MCPResponse",
    "MCPError",
    "create_mcp_server",
    # Error codes
    "JSONRPC_PARSE_ERROR",
    "JSONRPC_INVALID_REQUEST", 
    "JSONRPC_METHOD_NOT_FOUND",
    "JSONRPC_INVALID_PARAMS",
    "JSONRPC_INTERNAL_ERROR",
    "MCP_SERVER_INITIALIZATION_ERROR",
    "MCP_TOOL_NOT_FOUND",
    "MCP_INVALID_TOOL_ARGUMENTS",
    "MCP_TOOL_EXECUTION_ERROR",
]
