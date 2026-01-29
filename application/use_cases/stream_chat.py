"""Use case: Stream a chat response via SSE.

Orchestrates: rate limit check -> session management -> Claude streaming -> persistence.
"""

import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, Generator, List, Optional

from application.ports.chat_message_repository import ChatMessageRepository
from application.ports.chat_session_repository import ChatSessionRepository
from application.ports.rate_limit_repository import RateLimitRepository
from backend.services.ai_client import AIClient
from backend.services.function_dispatcher import FunctionContext, FunctionDispatcher
from backend.services.tool_schemas import PHASE_1_TOOLS, PHASE_2_TOOLS, PHASE_3_TOOLS
from backend.services.feature_flag_service import FeatureFlagService

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert fitness coach and workout planning assistant for AmakaFlow.

Your expertise includes:
- Workout programming and periodization
- Exercise selection and form guidance
- Recovery and injury prevention
- Nutrition fundamentals for fitness goals
- Training adaptations for different experience levels

Guidelines:
- Be encouraging but evidence-based. Cite exercise science when relevant.
- Ask clarifying questions about the user's goals, experience, and limitations before prescribing workouts.
- Prioritize safety: always mention proper form cues and warn about injury risks.
- When tools are available, use them to look up the user's profile and workout history for personalized advice.
- Keep responses concise but thorough. Use bullet points and structured formatting for workout plans.
- If you're unsure about a medical condition, recommend consulting a healthcare professional.
"""


@dataclass
class SSEEvent:
    """An SSE event to be yielded to the client."""

    event: str
    data: str  # JSON string


def _sse(event: str, data: Any) -> SSEEvent:
    """Helper to create an SSE event with JSON-serialized data."""
    return SSEEvent(event=event, data=json.dumps(data))


class StreamChatUseCase:
    """Core streaming chat orchestration."""

    def __init__(
        self,
        session_repo: ChatSessionRepository,
        message_repo: ChatMessageRepository,
        rate_limit_repo: RateLimitRepository,
        ai_client: AIClient,
        function_dispatcher: FunctionDispatcher,
        feature_flag_service: Optional[FeatureFlagService] = None,
        monthly_limit: int = 50,
    ) -> None:
        self._session_repo = session_repo
        self._message_repo = message_repo
        self._rate_limit_repo = rate_limit_repo
        self._ai_client = ai_client
        self._dispatcher = function_dispatcher
        self._feature_flags = feature_flag_service
        self._monthly_limit = monthly_limit

    def execute(
        self,
        user_id: str,
        message: str,
        session_id: Optional[str] = None,
        auth_token: Optional[str] = None,
    ) -> Generator[SSEEvent, None, None]:
        """Stream a chat response.

        Args:
            user_id: Authenticated user ID.
            message: User's message text.
            session_id: Optional existing session ID; creates new if None.
            auth_token: Optional auth token for forwarding to external services.

        Yields:
            SSEEvent objects for the EventSourceResponse.
        """
        # 0. Feature flag check - is chat enabled for this user?
        if self._feature_flags and not self._feature_flags.is_chat_enabled(user_id):
            yield _sse("error", {
                "type": "feature_disabled",
                "message": "Chat is not available for your account. Please check back later.",
            })
            return

        # 1. Rate limit check with dynamic limit from feature flags
        monthly_limit = self._monthly_limit
        if self._feature_flags:
            monthly_limit = self._feature_flags.get_rate_limit_for_user(user_id)

        usage = self._rate_limit_repo.get_monthly_usage(user_id)
        if usage >= monthly_limit:
            yield _sse("error", {
                "type": "rate_limit_exceeded",
                "message": f"Monthly message limit ({monthly_limit}) reached. Upgrade for more.",
                "usage": usage,
                "limit": monthly_limit,
            })
            return

        # 2. Session management
        try:
            if session_id:
                session = self._session_repo.get(session_id, user_id)
                if not session:
                    yield _sse("error", {
                        "type": "not_found",
                        "message": "Chat session not found.",
                    })
                    return
                is_new_session = False
            else:
                session = self._session_repo.create(user_id)
                session_id = session["id"]
                is_new_session = True
        except Exception as e:
            logger.error("Session error: %s", e)
            yield _sse("error", {
                "type": "internal_error",
                "message": "Failed to create chat session.",
            })
            return

        # 3. Persist user message
        self._message_repo.create({
            "session_id": session_id,
            "role": "user",
            "content": message,
        })

        # 4. Load conversation history
        history = self._message_repo.list_for_session(session_id)
        anthropic_messages = self._build_messages(history)

        # 5. Yield message_start
        yield _sse("message_start", {"session_id": session_id})

        # 6. Create function context for tool execution
        context = FunctionContext(user_id=user_id, auth_token=auth_token)

        # 7. Stream from Claude
        full_text = ""
        tool_calls: List[Dict[str, Any]] = []
        end_data: Dict[str, Any] = {}

        # Track current tool block for accumulating partial_json
        current_tool: Optional[Dict[str, Any]] = None
        tool_input_json = ""

        # Combine Phase 1, Phase 2, and Phase 3 tools for Claude
        tools = PHASE_1_TOOLS + PHASE_2_TOOLS + PHASE_3_TOOLS

        for event in self._ai_client.stream_chat(
            messages=anthropic_messages,
            system=SYSTEM_PROMPT,
            tools=tools,
            user_id=user_id,
        ):
            if event.event == "content_delta":
                text = event.data.get("text", "")
                partial_json = event.data.get("partial_json", "")

                if current_tool and partial_json:
                    # Accumulating tool arguments
                    tool_input_json += partial_json
                elif text:
                    # Normal text response
                    full_text += text
                    yield _sse("content_delta", event.data)

            elif event.event == "function_call":
                # Starting a new tool block
                # First, execute previous tool if one was pending
                if current_tool:
                    yield from self._execute_tool(current_tool, tool_input_json, context)

                # Start tracking new tool
                current_tool = event.data
                tool_input_json = ""
                tool_calls.append(event.data)
                yield _sse("function_call", event.data)

            elif event.event == "message_end":
                # Execute any pending tool before ending
                if current_tool:
                    yield from self._execute_tool(current_tool, tool_input_json, context)
                    current_tool = None

                end_data = event.data

            elif event.event == "error":
                yield _sse("error", event.data)
                return

        # 8. Persist assistant message
        try:
            self._message_repo.create({
                "session_id": session_id,
                "role": "assistant",
                "content": full_text,
                "tool_calls": tool_calls if tool_calls else None,
                "model": end_data.get("model"),
                "input_tokens": end_data.get("input_tokens"),
                "output_tokens": end_data.get("output_tokens"),
                "latency_ms": end_data.get("latency_ms"),
            })
        except Exception as e:
            logger.error("Failed to persist assistant message: %s", e)

        # 9. Increment rate limit
        try:
            self._rate_limit_repo.increment(user_id)
        except Exception as e:
            logger.error("Failed to increment rate limit: %s", e)

        # 10. Auto-title new sessions
        if is_new_session and message:
            try:
                title = message[:80].strip()
                if len(message) > 80:
                    title = title.rsplit(" ", 1)[0] + "..."
                self._session_repo.update_title(session_id, title)
            except Exception as e:
                logger.error("Failed to auto-title session: %s", e)

        # 11. Yield message_end
        yield _sse("message_end", {
            "session_id": session_id,
            "tokens_used": end_data.get("input_tokens", 0) + end_data.get("output_tokens", 0),
            "latency_ms": end_data.get("latency_ms", 0),
        })

    def _execute_tool(
        self,
        tool: Dict[str, Any],
        json_str: str,
        ctx: FunctionContext,
    ) -> Generator[SSEEvent, None, None]:
        """Parse tool arguments and execute via dispatcher.

        Args:
            tool: Tool info with 'id' and 'name'.
            json_str: Accumulated JSON string of tool arguments.
            ctx: Function context with user info and auth.

        Yields:
            SSEEvent for the function result.
        """
        try:
            args = json.loads(json_str) if json_str else {}
        except json.JSONDecodeError:
            # Don't log raw json_str as it may contain sensitive user data
            logger.warning(
                "Failed to parse tool arguments for %s (length: %d)",
                tool.get("name"),
                len(json_str) if json_str else 0,
            )
            # Return explicit error to Claude so it can recover
            yield _sse("function_result", {
                "tool_use_id": tool["id"],
                "name": tool["name"],
                "result": "Error: Invalid tool arguments received. Please try again.",
            })
            return

        result = self._dispatcher.execute(tool["name"], args, ctx)
        yield _sse("function_result", {
            "tool_use_id": tool["id"],
            "name": tool["name"],
            "result": result,
        })

    def _build_messages(
        self, history: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Convert DB messages to Anthropic message format."""
        messages = []
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})
        return messages
