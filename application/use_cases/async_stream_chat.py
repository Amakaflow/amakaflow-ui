"""Use case: Async stream a chat response via SSE.

Orchestrates: rate limit check -> session management -> Claude streaming -> persistence.
Async version of StreamChatUseCase for non-blocking I/O operations.

Part of AMA-505: Convert Streaming to Async Patterns
Updated in AMA-506: Add OpenTelemetry tracing and metrics
"""

import asyncio
import base64
import json
import logging
import time
from dataclasses import dataclass
from typing import Any, AsyncGenerator, Dict, List, Optional, TYPE_CHECKING

from backend.services.ai_client import AsyncAIClient
from backend.services.async_function_dispatcher import (
    AsyncFunctionDispatcher,
    FunctionContext,
)
from backend.services.tool_schemas import ALL_TOOLS
from backend.services.feature_flag_service import FeatureFlagService
from backend.observability import get_tracer, ChatMetrics, get_current_trace_id

if TYPE_CHECKING:
    from backend.services.tts_service import TTSService
    from infrastructure.db.async_chat_session_repository import (
        AsyncSupabaseChatSessionRepository,
    )
    from infrastructure.db.async_chat_message_repository import (
        AsyncSupabaseChatMessageRepository,
    )
    from infrastructure.db.async_rate_limit_repository import (
        AsyncSupabaseRateLimitRepository,
    )
    from infrastructure.db.async_tts_settings_repository import (
        AsyncSupabaseTTSSettingsRepository,
    )

logger = logging.getLogger(__name__)

# Heartbeat interval in seconds during tool execution
HEARTBEAT_INTERVAL_SECONDS = 5.0

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

## CRITICAL: Two-Step Confirm-Before-Save Workflow

All create/import operations use a two-step generate→preview→save pattern:

### AI Workout Generation (Two-Step)
1. Call `generate_workout` to create and preview a workout
2. Present the preview to the user and ask: "Would you like me to save this?"
3. **STOP and wait for user confirmation**
4. When confirmed, call `save_and_push_workout` with the `preview_id`

### Content Import (Two-Step)
1. Call the appropriate import tool (import_from_youtube, etc.) to extract
2. Present the workout summary and ask: "Save to library?"
3. **STOP and wait for user confirmation**
4. When confirmed, call `save_imported_workout` with the `source_url`

### STRICT RULES:
1. **NEVER call generate and save tools in the same response**
2. After generate/import, you MUST stop and wait for user confirmation
3. generate/import only creates a PREVIEW — never claim "saved" or "added to library"
4. Only claim success after save returns persisted: true
5. If you see a "Pending Import State" section below, the item is already extracted
   — call the save tool directly

### Correct Example:
```
User: "Create a leg workout"
You: [Call generate_workout] → "Here's 'Leg Blast' with 5 exercises. Save to library?"
[STOP - wait for user]
User: "Yes"
You: [Call save_and_push_workout(preview_id="...")] → "Saved to your library!"
```
"""


@dataclass
class SSEEvent:
    """An SSE event to be yielded to the client."""

    event: str
    data: str  # JSON string


def _sse(event: str, data: Any) -> SSEEvent:
    """Helper to create an SSE event with JSON-serialized data."""
    return SSEEvent(event=event, data=json.dumps(data))


class AsyncStreamChatUseCase:
    """Async core streaming chat orchestration."""

    def __init__(
        self,
        session_repo: "AsyncSupabaseChatSessionRepository",
        message_repo: "AsyncSupabaseChatMessageRepository",
        rate_limit_repo: "AsyncSupabaseRateLimitRepository",
        ai_client: AsyncAIClient,
        function_dispatcher: AsyncFunctionDispatcher,
        feature_flag_service: Optional[FeatureFlagService] = None,
        monthly_limit: int = 50,
        tts_service: Optional["TTSService"] = None,
        tts_settings_repo: Optional["AsyncSupabaseTTSSettingsRepository"] = None,
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

    async def execute(
        self,
        user_id: str,
        message: str,
        session_id: Optional[str] = None,
        auth_token: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> AsyncGenerator[SSEEvent, None]:
        """Async stream a chat response.

        Args:
            user_id: Authenticated user ID.
            message: User's message text.
            session_id: Optional existing session ID; creates new if None.
            auth_token: Optional auth token for forwarding to external services.
            context: Optional context about what the user is viewing in the app.

        Yields:
            SSEEvent objects for the EventSourceResponse.
        """
        tracer = get_tracer()

        with tracer.start_as_current_span(
            "chat.stream",
            attributes={
                "user.id": user_id,
                "session.id": session_id or "new",
            },
        ) as span:
            async for event in self._execute_inner(
                user_id, message, session_id, auth_token, context, span
            ):
                yield event

    async def _execute_inner(
        self,
        user_id: str,
        message: str,
        session_id: Optional[str],
        auth_token: Optional[str],
        context: Optional[Dict[str, Any]],
        span,
    ) -> AsyncGenerator[SSEEvent, None]:
        """Inner execute method wrapped by the span."""
        # 0. Feature flag check - is chat enabled for this user?
        if self._feature_flags and not self._feature_flags.is_chat_enabled(user_id):
            yield _sse("error", {
                "type": "feature_disabled",
                "message": "Chat is not available for your account. Please check back later.",
            })
            ChatMetrics.chat_requests_total().add(1, {"status": "feature_disabled"})
            return

        # 1. Rate limit check with dynamic limit from feature flags
        monthly_limit = self._monthly_limit
        if self._feature_flags:
            monthly_limit = self._feature_flags.get_rate_limit_for_user(user_id)

        usage = await self._rate_limit_repo.get_monthly_usage(user_id)
        if usage >= monthly_limit:
            yield _sse("error", {
                "type": "rate_limit_exceeded",
                "message": f"Monthly message limit ({monthly_limit}) reached. Upgrade for more.",
                "usage": usage,
                "limit": monthly_limit,
            })
            ChatMetrics.chat_requests_total().add(1, {"status": "rate_limited"})
            ChatMetrics.rate_limit_hits_total().add(1, {"limit_type": "monthly_messages"})
            return

        # 2. Session management
        try:
            if session_id:
                session = await self._session_repo.get(session_id, user_id)
                if not session:
                    yield _sse("error", {
                        "type": "not_found",
                        "message": "Chat session not found.",
                    })
                    return
                is_new_session = False
            else:
                session = await self._session_repo.create(user_id)
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
        await self._message_repo.create({
            "session_id": session_id,
            "role": "user",
            "content": message,
        })

        # Update span with actual session ID
        span.set_attribute("session.id", session_id)

        # 4. Load conversation history
        history = await self._message_repo.list_for_session(session_id)
        anthropic_messages = self._build_messages(history)

        # 5. Yield message_start with trace_id for client correlation
        trace_id = get_current_trace_id()
        message_start_data: Dict[str, Any] = {"session_id": session_id}
        if trace_id:
            message_start_data["trace_id"] = trace_id
        yield _sse("message_start", message_start_data)

        # 6. Create function context for tool execution
        fn_context = FunctionContext(user_id=user_id, auth_token=auth_token)

        # 6b. Build context-aware system prompt
        system_prompt = self._build_system_prompt(context)

        # 7. Stream from Claude with multi-turn tool loop
        full_text = ""
        all_tool_calls: List[Dict[str, Any]] = []
        total_input_tokens = 0
        total_output_tokens = 0
        total_latency_ms = 0
        ai_call_count = 0
        end_data: Dict[str, Any] = {}
        pending_imports: List[Dict[str, Any]] = []  # Track pending imports for prompt injection

        tools = ALL_TOOLS
        MAX_TOOL_ITERATIONS = 10

        for iteration in range(MAX_TOOL_ITERATIONS):
            current_tool: Optional[Dict[str, Any]] = None
            tool_input_json = ""
            tool_uses_this_turn: List[Dict[str, Any]] = []

            async for event in self._ai_client.stream_chat(
                messages=anthropic_messages,
                system=system_prompt,
                tools=tools,
                user_id=user_id,
            ):
                if event.event == "content_delta":
                    text = event.data.get("text", "")
                    partial_json = event.data.get("partial_json", "")

                    if current_tool and partial_json:
                        tool_input_json += partial_json
                    elif text:
                        full_text += text
                        yield _sse("content_delta", event.data)

                elif event.event == "function_call":
                    if current_tool:
                        tool_input, parse_ok = self._parse_tool_input(tool_input_json)
                        current_tool["input"] = tool_input
                        current_tool["_parse_error"] = not parse_ok
                        tool_uses_this_turn.append(current_tool)

                    current_tool = event.data.copy()
                    tool_input_json = ""
                    yield _sse("function_call", event.data)

                elif event.event == "message_end":
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

            stop_reason = end_data.get("stop_reason", "end_turn")

            if not tool_uses_this_turn:
                break

            # Execute tools and yield results to client
            tool_results: List[Dict[str, Any]] = []
            assistant_content: List[Dict[str, Any]] = []

            for tool_use in tool_uses_this_turn:
                if tool_use.get("_parse_error"):
                    result = "Error: Invalid tool arguments received. Please try again."
                    yield _sse("function_result", {
                        "tool_use_id": tool_use["id"],
                        "name": tool_use["name"],
                        "result": result,
                    })
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_use["id"],
                        "content": result,
                        "is_error": True,
                    })
                    # Fire-and-forget persistence for error
                    asyncio.create_task(self._persist_tool_result(
                        session_id, tool_use["id"], tool_use["name"],
                        tool_use.get("input", {}), result, is_error=True
                    ))
                    continue

                assistant_content.append({
                    "type": "tool_use",
                    "id": tool_use["id"],
                    "name": tool_use["name"],
                    "input": tool_use["input"],
                })

                # Execute tool with heartbeats using asyncio.shield
                tool_name = tool_use["name"]

                async for result_or_heartbeat in self._execute_tool_with_heartbeats(
                    tool_name, tool_use["input"], fn_context
                ):
                    if isinstance(result_or_heartbeat, SSEEvent):
                        # It's a heartbeat
                        yield result_or_heartbeat
                    else:
                        # It's the final result
                        result = result_or_heartbeat

                yield _sse("function_result", {
                    "tool_use_id": tool_use["id"],
                    "name": tool_use["name"],
                    "result": result,
                })

                result_content = (
                    json.dumps(result) if not isinstance(result, str) else result
                )
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use["id"],
                    "content": result_content,
                })

                all_tool_calls.append({
                    "id": tool_use["id"],
                    "name": tool_use["name"],
                    "input": tool_use["input"],
                    "result": result,
                })

                # Track pending imports for dynamic system prompt injection
                if tool_name.startswith("import_from_"):
                    try:
                        result_dict = json.loads(result) if isinstance(result, str) else result
                        if result_dict.get("success") and not result_dict.get("persisted"):
                            # Extract workout info from the result
                            workout = result_dict.get("workout", {})
                            source_url = (
                                tool_use["input"].get("url")
                                or tool_use["input"].get("image_data", "image_upload")
                            )
                            pending_imports.append({
                                "source_url": source_url,
                                "title": workout.get("title", "Untitled Workout"),
                                "exercise_count": len(workout.get("blocks", [])) if workout.get("blocks") else None,
                            })
                            logger.debug("Tracked pending import: %s", source_url)
                    except (json.JSONDecodeError, TypeError) as e:
                        logger.warning("Failed to parse import result for pending tracking: %s", e)

                # Clear pending import when successfully saved
                elif tool_name == "save_imported_workout":
                    try:
                        result_dict = json.loads(result) if isinstance(result, str) else result
                        if result_dict.get("success") and result_dict.get("persisted"):
                            saved_url = tool_use["input"].get("source_url")
                            if saved_url:
                                pending_imports = [p for p in pending_imports if p.get("source_url") != saved_url]
                                logger.debug("Cleared pending import after save: %s", saved_url)
                    except (json.JSONDecodeError, TypeError) as e:
                        logger.warning("Failed to parse save result for pending tracking: %s", e)

                # Fire-and-forget persistence
                asyncio.create_task(self._persist_tool_result(
                    session_id, tool_use["id"], tool_name,
                    tool_use["input"], result_content, is_error=False
                ))

            if stop_reason != "tool_use":
                break

            anthropic_messages.append({"role": "assistant", "content": assistant_content})
            anthropic_messages.append({"role": "user", "content": tool_results})

            # Update system prompt with pending imports for next iteration
            if pending_imports:
                system_prompt = self._build_system_prompt(context, pending_imports)

            logger.debug(
                "Tool loop iteration %d: executed %d tools, continuing...",
                iteration + 1,
                len(tool_uses_this_turn),
            )
        else:
            if tool_uses_this_turn and stop_reason == "tool_use":
                logger.warning(
                    "Tool loop hit MAX_TOOL_ITERATIONS (%d) for user %s, session %s",
                    MAX_TOOL_ITERATIONS,
                    user_id,
                    session_id,
                )

        end_data["input_tokens"] = total_input_tokens
        end_data["output_tokens"] = total_output_tokens
        end_data["latency_ms"] = total_latency_ms

        # 8-10: Persistence - assistant message is CRITICAL (must complete before message_end)
        # to prevent race conditions where next request loads stale history
        await self._persist_assistant_message(
            session_id, full_text, all_tool_calls, end_data
        )

        # Non-critical tasks can remain fire-and-forget
        asyncio.create_task(self._increment_rate_limit(user_id, ai_call_count))
        if is_new_session and message:
            asyncio.create_task(self._auto_title_session(session_id, message))

        # 11. Generate TTS if enabled (this we await since user expects the voice data)
        voice_response = None
        voice_error = None

        if self._tts_service and self._tts_settings_repo and full_text:
            voice_response, voice_error = await self._generate_tts(user_id, full_text)

        # 12. Yield message_end with optional voice response and pending imports
        message_end_data: Dict[str, Any] = {
            "session_id": session_id,
            "tokens_used": end_data.get("input_tokens", 0) + end_data.get("output_tokens", 0),
            "latency_ms": end_data.get("latency_ms", 0),
        }

        # Include pending imports for frontend to track and send back on next request
        if pending_imports:
            message_end_data["pending_imports"] = pending_imports

        if voice_response:
            message_end_data["voice_response"] = voice_response
        elif voice_error:
            message_end_data["voice_response"] = None
            message_end_data["voice_error"] = voice_error

        # Record success metric
        ChatMetrics.chat_requests_total().add(1, {"status": "success"})

        yield _sse("message_end", message_end_data)

    async def _execute_tool_with_heartbeats(
        self,
        tool_name: str,
        tool_input: Dict[str, Any],
        context: FunctionContext,
    ) -> AsyncGenerator[Any, None]:
        """Execute a tool with periodic heartbeats while waiting.

        Uses asyncio.shield to protect the tool execution task from cancellation
        while yielding heartbeats every HEARTBEAT_INTERVAL_SECONDS.

        Yields:
            SSEEvent heartbeats while waiting, then the final result string.
        """
        tool_start_time = time.time()

        # Create the tool execution task
        task = asyncio.create_task(
            self._dispatcher.execute(tool_name, tool_input, context)
        )

        while not task.done():
            try:
                # Wait for completion with timeout, shielding from cancellation
                result = await asyncio.wait_for(
                    asyncio.shield(task),
                    timeout=HEARTBEAT_INTERVAL_SECONDS
                )
                # Task completed, yield the result
                yield result
                return
            except asyncio.TimeoutError:
                # Tool still running - yield heartbeat and continue waiting
                elapsed = int(time.time() - tool_start_time)
                yield _sse("heartbeat", {
                    "status": "executing_tool",
                    "tool_name": tool_name,
                    "elapsed_seconds": elapsed,
                })

        # Task finished (possibly with exception)
        try:
            result = task.result()
            yield result
        except Exception as e:
            logger.exception("Tool %s failed", tool_name)
            yield json.dumps({
                "error": True,
                "code": "execution_error",
                "message": f"Tool execution failed: {e}",
            })

    async def _persist_tool_result(
        self,
        session_id: str,
        tool_use_id: str,
        tool_name: str,
        tool_input: Dict[str, Any],
        result: str,
        is_error: bool,
    ) -> None:
        """Fire-and-forget: persist tool result as separate message."""
        try:
            await self._message_repo.create({
                "session_id": session_id,
                "role": "tool_result",
                "content": result,
                "tool_use_id": tool_use_id,
                "tool_calls": [{
                    "name": tool_name,
                    "input": tool_input,
                    "is_error": is_error,
                }],
            })
        except Exception as e:
            logger.error("Failed to persist tool result for %s: %s", tool_name, e)

    async def _persist_assistant_message(
        self,
        session_id: str,
        full_text: str,
        all_tool_calls: List[Dict[str, Any]],
        end_data: Dict[str, Any],
    ) -> None:
        """Persist assistant message to database.

        This is awaited synchronously (not fire-and-forget) to ensure
        persistence completes before message_end is yielded to the client.
        """
        try:
            await self._message_repo.create({
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

    async def _increment_rate_limit(self, user_id: str, ai_call_count: int) -> None:
        """Fire-and-forget: increment rate limit for each AI call."""
        try:
            for _ in range(ai_call_count):
                await self._rate_limit_repo.increment(user_id)
        except Exception as e:
            logger.error("Failed to increment rate limit: %s", e)

    async def _auto_title_session(self, session_id: str, message: str) -> None:
        """Fire-and-forget: auto-title new sessions."""
        try:
            title = message[:80].strip()
            if len(message) > 80:
                title = title.rsplit(" ", 1)[0] + "..."
            await self._session_repo.update_title(session_id, title)
        except Exception as e:
            logger.error("Failed to auto-title session: %s", e)

    async def _generate_tts(
        self, user_id: str, full_text: str
    ) -> tuple[Optional[Dict[str, Any]], Optional[str]]:
        """Generate TTS for the response if enabled and within limits."""
        voice_response = None
        voice_error = None

        try:
            tts_settings = await self._tts_settings_repo.get_settings(user_id)

            if tts_settings.tts_enabled:
                await self._tts_settings_repo.reset_daily_chars_if_needed(user_id)

                chars_needed = len(full_text)
                allowed, remaining = self._tts_service.check_daily_limit(
                    tts_settings.tts_daily_chars_used, chars_needed
                )

                if allowed:
                    # Note: TTS service is synchronous - run in thread pool if needed
                    # For now, keeping it simple as TTS is typically fast
                    tts_result = self._tts_service.synthesize(
                        text=full_text,
                        voice_id=tts_settings.tts_voice_id,
                        speed=tts_settings.tts_speed,
                    )

                    if tts_result.success:
                        await self._tts_settings_repo.increment_daily_chars(
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

        return voice_response, voice_error

    def _build_system_prompt(
        self,
        context: Optional[Dict[str, Any]],
        pending_imports: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """Build the system prompt with optional context and pending import injection."""
        prompt = SYSTEM_PROMPT

        # Merge pending imports from context (frontend-tracked) with current session
        all_pending = list(pending_imports) if pending_imports else []
        if context and context.get("pending_imports"):
            # Frontend can send pending imports from previous conversation turns
            for imp in context["pending_imports"]:
                # Avoid duplicates by source_url
                if not any(p.get("source_url") == imp.get("source_url") for p in all_pending):
                    all_pending.append(imp)

        # Inject pending import state to prevent re-imports
        if all_pending:
            prompt += "\n\n## Pending Import State\n"
            prompt += "The following workout(s) have been extracted and are awaiting user confirmation.\n"
            prompt += "**IMPORTANT:** DO NOT call import_from_* again for these URLs.\n"
            prompt += "When user confirms, call `save_imported_workout(source_url=\"<url>\")` with the URL below:\n\n"
            for imp in all_pending:
                url = imp.get('source_url', 'unknown')
                prompt += f"- **Source URL**: `{url}`\n"
                prompt += f"  **Title**: {imp.get('title', 'Untitled')}\n"
                if imp.get('exercise_count'):
                    prompt += f"  **Exercises**: {imp['exercise_count']}\n"
                prompt += f"  **To save**: `save_imported_workout(source_url=\"{url}\")`\n\n"

        if not context:
            return prompt

        current_page = context.get("current_page")
        selected_workout_id = context.get("selected_workout_id")
        selected_date = context.get("selected_date")

        context_parts = []

        if current_page == "workout_detail" and selected_workout_id:
            context_parts.append(
                f"The user is currently viewing workout ID: {selected_workout_id}. "
                "When they refer to 'this workout' or 'this', they mean this workout."
            )
        elif current_page == "library":
            context_parts.append(
                "The user is browsing their workout library."
            )
        elif current_page == "calendar" and selected_date:
            context_parts.append(
                f"The user is viewing their calendar for: {selected_date}. "
                "When they refer to 'this day' or 'today', they mean this date."
            )
        elif current_page == "calendar":
            context_parts.append(
                "The user is viewing their workout calendar."
            )

        if context_parts:
            prompt += "\n\n## Current Context\n" + "\n".join(context_parts)

        return prompt

    def _parse_tool_input(self, json_str: str) -> tuple[Dict[str, Any], bool]:
        """Parse accumulated JSON string into tool input dict."""
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
        blocks from persisted tool_calls data.
        """
        messages = []
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            tool_calls = msg.get("tool_calls")

            if role == "tool_result":
                continue

            if role == "user" and content:
                messages.append({"role": "user", "content": content})

            elif role == "assistant":
                if tool_calls:
                    assistant_content: List[Dict[str, Any]] = []

                    if content:
                        assistant_content.append({
                            "type": "text",
                            "text": content,
                        })

                    for tc in tool_calls:
                        assistant_content.append({
                            "type": "tool_use",
                            "id": tc["id"],
                            "name": tc["name"],
                            "input": tc.get("input", {}),
                        })

                    messages.append({"role": "assistant", "content": assistant_content})

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
                    messages.append({"role": "assistant", "content": content})

        return messages
