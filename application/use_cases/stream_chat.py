"""Use case: Stream a chat response via SSE.

Orchestrates: rate limit check -> session management -> Claude streaming -> persistence.
Updated in AMA-442 to support TTS voice responses.
"""

import base64
import json
import logging
from dataclasses import dataclass
from typing import Any, Dict, Generator, List, Optional, TYPE_CHECKING

from application.ports.chat_message_repository import ChatMessageRepository
from application.ports.chat_session_repository import ChatSessionRepository
from application.ports.rate_limit_repository import RateLimitRepository
from backend.services.ai_client import AIClient
from backend.services.function_dispatcher import FunctionContext, FunctionDispatcher
from backend.services.tool_schemas import PHASE_1_TOOLS, PHASE_2_TOOLS, PHASE_3_TOOLS
from backend.services.feature_flag_service import FeatureFlagService

if TYPE_CHECKING:
    from backend.services.tts_service import TTSService
    from infrastructure.db.tts_settings_repository import SupabaseTTSSettingsRepository

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
        tts_service: Optional["TTSService"] = None,
        tts_settings_repo: Optional["SupabaseTTSSettingsRepository"] = None,
    ) -> None:
        self._session_repo = session_repo
        self._message_repo = message_repo
        self._rate_limit_repo = rate_limit_repo
        self._ai_client = ai_client
        self._dispatcher = function_dispatcher
        self._feature_flags = feature_flag_service
        self._monthly_limit = monthly_limit
        self._tts_service = tts_service
        self._tts_settings_repo = tts_settings_repo

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

        # 7. Stream from Claude with multi-turn tool loop
        # Per Anthropic protocol: tool results must be fed back to Claude for synthesis
        full_text = ""
        all_tool_calls: List[Dict[str, Any]] = []  # For persistence
        total_input_tokens = 0
        total_output_tokens = 0
        total_latency_ms = 0
        ai_call_count = 0
        end_data: Dict[str, Any] = {}

        # Combine Phase 1, Phase 2, and Phase 3 tools for Claude
        tools = PHASE_1_TOOLS + PHASE_2_TOOLS + PHASE_3_TOOLS

        # Maximum tool loop iterations to prevent infinite loops
        MAX_TOOL_ITERATIONS = 10

        for iteration in range(MAX_TOOL_ITERATIONS):
            # Track tool blocks for this iteration
            current_tool: Optional[Dict[str, Any]] = None
            tool_input_json = ""
            tool_uses_this_turn: List[Dict[str, Any]] = []

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
                    # Finalize previous tool if pending
                    if current_tool:
                        tool_input, parse_ok = self._parse_tool_input(tool_input_json)
                        current_tool["input"] = tool_input
                        current_tool["_parse_error"] = not parse_ok
                        tool_uses_this_turn.append(current_tool)

                    # Start tracking new tool
                    current_tool = event.data.copy()
                    tool_input_json = ""
                    yield _sse("function_call", event.data)

                elif event.event == "message_end":
                    # Finalize pending tool
                    if current_tool:
                        tool_input, parse_ok = self._parse_tool_input(tool_input_json)
                        current_tool["input"] = tool_input
                        current_tool["_parse_error"] = not parse_ok
                        tool_uses_this_turn.append(current_tool)
                        current_tool = None

                    end_data = event.data
                    total_input_tokens += end_data.get("input_tokens", 0)
                    total_output_tokens += end_data.get("output_tokens", 0)
                    total_latency_ms += end_data.get("latency_ms", 0)
                    ai_call_count += 1

                elif event.event == "error":
                    yield _sse("error", event.data)
                    return

            # Check if we should continue the tool loop
            stop_reason = end_data.get("stop_reason", "end_turn")

            if not tool_uses_this_turn:
                break

            # Execute tools and yield results to client
            tool_results: List[Dict[str, Any]] = []
            assistant_content: List[Dict[str, Any]] = []

            for tool_use in tool_uses_this_turn:
                # Check for parse error
                if tool_use.get("_parse_error"):
                    result = "Error: Invalid tool arguments received. Please try again."
                    yield _sse("function_result", {
                        "tool_use_id": tool_use["id"],
                        "name": tool_use["name"],
                        "result": result,
                    })
                    # Build tool_result for error case
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_use["id"],
                        "content": result,
                        "is_error": True,
                    })
                    continue

                # Build assistant content block
                assistant_content.append({
                    "type": "tool_use",
                    "id": tool_use["id"],
                    "name": tool_use["name"],
                    "input": tool_use["input"],
                })

                # Execute tool
                result = self._dispatcher.execute(
                    tool_use["name"], tool_use["input"], context
                )

                # Yield result to client
                yield _sse("function_result", {
                    "tool_use_id": tool_use["id"],
                    "name": tool_use["name"],
                    "result": result,
                })

                # Build tool_result content block
                result_content = (
                    json.dumps(result) if not isinstance(result, str) else result
                )
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use["id"],
                    "content": result_content,
                })

                # Track for persistence
                all_tool_calls.append({
                    "id": tool_use["id"],
                    "name": tool_use["name"],
                    "input": tool_use["input"],
                    "result": result,
                })

            # Only loop back to Claude if it expects tool results
            # If stop_reason is "end_turn", Claude already provided final response
            if stop_reason != "tool_use":
                break

            # Append messages for next Claude call
            anthropic_messages.append({"role": "assistant", "content": assistant_content})
            anthropic_messages.append({"role": "user", "content": tool_results})

            logger.debug(
                "Tool loop iteration %d: executed %d tools, continuing...",
                iteration + 1,
                len(tool_uses_this_turn),
            )
        else:
            # Loop exhausted MAX_TOOL_ITERATIONS without Claude finishing
            if tool_uses_this_turn and stop_reason == "tool_use":
                logger.warning(
                    "Tool loop hit MAX_TOOL_ITERATIONS (%d) for user %s, session %s",
                    MAX_TOOL_ITERATIONS,
                    user_id,
                    session_id,
                )

        # Update end_data with total tokens and latency
        end_data["input_tokens"] = total_input_tokens
        end_data["output_tokens"] = total_output_tokens
        end_data["latency_ms"] = total_latency_ms

        # 8. Persist assistant message
        try:
            self._message_repo.create({
                "session_id": session_id,
                "role": "assistant",
                "content": full_text,
                "tool_calls": all_tool_calls if all_tool_calls else None,
                "model": end_data.get("model"),
                "input_tokens": end_data.get("input_tokens"),
                "output_tokens": end_data.get("output_tokens"),
                "latency_ms": end_data.get("latency_ms"),
            })
        except Exception as e:
            logger.error("Failed to persist assistant message: %s", e)

        # 9. Increment rate limit based on AI calls (each iteration counts)
        try:
            for _ in range(ai_call_count):
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

        # 11. Generate TTS if enabled
        voice_response = None
        voice_error = None

        if self._tts_service and self._tts_settings_repo and full_text:
            try:
                tts_settings = self._tts_settings_repo.get_settings(user_id)

                if tts_settings.tts_enabled:
                    # Reset daily counter if needed
                    self._tts_settings_repo.reset_daily_chars_if_needed(user_id)

                    # Check daily limit before synthesizing
                    chars_needed = len(full_text)
                    allowed, remaining = self._tts_service.check_daily_limit(
                        tts_settings.tts_daily_chars_used, chars_needed
                    )

                    if allowed:
                        # Synthesize the response
                        tts_result = self._tts_service.synthesize(
                            text=full_text,
                            voice_id=tts_settings.tts_voice_id,
                            speed=tts_settings.tts_speed,
                        )

                        if tts_result.success:
                            # Track usage
                            self._tts_settings_repo.increment_daily_chars(
                                user_id, tts_result.chars_used
                            )

                            voice_response = {
                                "audio_base64": base64.b64encode(
                                    tts_result.audio_data
                                ).decode("utf-8"),
                                "duration_ms": tts_result.duration_ms,
                                "voice_id": tts_result.voice_id,
                                "chars_used": tts_result.chars_used,
                            }
                        else:
                            voice_error = tts_result.error
                    else:
                        voice_error = f"Daily TTS limit reached. {remaining} characters remaining."
            except Exception as e:
                logger.error("TTS synthesis failed: %s", e)
                voice_error = "TTS synthesis failed"

        # 12. Yield message_end with optional voice response
        message_end_data: Dict[str, Any] = {
            "session_id": session_id,
            "tokens_used": end_data.get("input_tokens", 0) + end_data.get("output_tokens", 0),
            "latency_ms": end_data.get("latency_ms", 0),
        }

        if voice_response:
            message_end_data["voice_response"] = voice_response
        elif voice_error:
            message_end_data["voice_response"] = None
            message_end_data["voice_error"] = voice_error

        yield _sse("message_end", message_end_data)

    def _parse_tool_input(self, json_str: str) -> tuple[Dict[str, Any], bool]:
        """Parse accumulated JSON string into tool input dict.

        Args:
            json_str: Accumulated JSON string of tool arguments.

        Returns:
            Tuple of (parsed dict, success bool). Returns ({}, True) for empty input.
        """
        if not json_str:
            return {}, True
        try:
            return json.loads(json_str), True
        except json.JSONDecodeError:
            logger.warning(
                "Failed to parse tool arguments (length: %d)",
                len(json_str),
            )
            return {}, False

    def _build_messages(
        self, history: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Convert DB messages to Anthropic message format.

        Handles tool call history by reconstructing tool_use and tool_result
        blocks from persisted tool_calls data, ensuring Claude has full context
        when resuming sessions.
        """
        messages = []
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            tool_calls = msg.get("tool_calls")

            if role == "user" and content:
                messages.append({"role": "user", "content": content})

            elif role == "assistant":
                # Check if this message had tool calls
                if tool_calls:
                    # Reconstruct assistant message with tool_use blocks
                    assistant_content: List[Dict[str, Any]] = []

                    # Add text content if present
                    if content:
                        assistant_content.append({
                            "type": "text",
                            "text": content,
                        })

                    # Add tool_use blocks
                    for tc in tool_calls:
                        assistant_content.append({
                            "type": "tool_use",
                            "id": tc["id"],
                            "name": tc["name"],
                            "input": tc.get("input", {}),
                        })

                    messages.append({"role": "assistant", "content": assistant_content})

                    # Add user message with tool_result blocks
                    tool_results = []
                    for tc in tool_calls:
                        result = tc.get("result", "")
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": tc["id"],
                            "content": result if isinstance(result, str) else json.dumps(result),
                        })

                    messages.append({"role": "user", "content": tool_results})

                elif content:
                    # Simple text-only assistant message
                    messages.append({"role": "assistant", "content": content})

        return messages
