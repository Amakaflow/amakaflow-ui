"""
E2E test fixtures for AmakaFlow Chat API.

These tests exercise the full HTTP contract at the router level with
dependency-injected fakes for external services (Supabase, Anthropic, OpenAI).
No real network calls are made, but the FastAPI routing, middleware, SSE
serialization, and auth pipelines run end-to-end.

Architecture:
    TestClient --> FastAPI app --> routers --> dependency overrides (fakes)
    Fakes: in-memory repos, deterministic AI client, deterministic embedder.
"""

import json
import os
import sys
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional
from unittest.mock import MagicMock

import jwt as pyjwt
import pytest
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Environment setup (must precede backend imports)
# ---------------------------------------------------------------------------
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-supabase-key")

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.main import create_app
from backend.settings import Settings
from backend.auth import get_current_user as backend_get_current_user
from backend.services.ai_client import StreamEvent
from api.deps import (
    get_current_user as deps_get_current_user,
    get_auth_context,
    get_chat_message_repository,
    get_chat_session_repository,
    get_stream_chat_use_case,
    get_generate_embeddings_use_case,
    get_settings,
    AuthContext,
)
from application.use_cases.stream_chat import StreamChatUseCase
from application.use_cases.generate_embeddings import GenerateEmbeddingsUseCase
from backend.services.function_dispatcher import FunctionContext
from backend.services.tts_service import TTSResult, VoiceInfo
from infrastructure.db.tts_settings_repository import TTSSettings, TTSSettingsUpdate


# ============================================================================
# Constants
# ============================================================================

TEST_USER_ID = "user_e2e_test_12345"
SECOND_USER_ID = "user_e2e_second_67890"
INTERNAL_API_KEY = "e2e-internal-key-secure-random"
TEST_AUTH_SECRET = "e2e-test-auth-secret-xyz"
MOBILE_JWT_SECRET = "amakaflow-mobile-jwt-secret-change-in-production"


# ============================================================================
# In-Memory Fakes (deterministic, no network)
# ============================================================================


class FakeChatSessionRepository:
    """In-memory session store keyed by (session_id, user_id)."""

    def __init__(self) -> None:
        self._sessions: Dict[str, Dict[str, Any]] = {}

    def create(self, user_id: str, title: Optional[str] = None) -> Dict[str, Any]:
        sid = f"sess-{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow().isoformat()
        session = {
            "id": sid,
            "user_id": user_id,
            "title": title or "New Chat",
            "created_at": now,
            "updated_at": now,
        }
        self._sessions[sid] = session
        return session

    def get(self, session_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        session = self._sessions.get(session_id)
        if session and session["user_id"] == user_id:
            return session
        return None

    def update_title(self, session_id: str, title: str) -> None:
        if session_id in self._sessions:
            self._sessions[session_id]["title"] = title
            self._sessions[session_id]["updated_at"] = datetime.utcnow().isoformat()

    def list_for_user(
        self, user_id: str, limit: int = 20, offset: int = 0
    ) -> List[Dict[str, Any]]:
        user_sessions = [
            s for s in self._sessions.values() if s["user_id"] == user_id
        ]
        # Sort by updated_at DESC to match real repository behavior
        user_sessions.sort(key=lambda s: s.get("updated_at", ""), reverse=True)
        return user_sessions[offset:offset + limit]

    def reset(self) -> None:
        self._sessions.clear()


class FakeChatMessageRepository:
    """In-memory message store."""

    def __init__(self) -> None:
        self._messages: List[Dict[str, Any]] = []

    def create(self, message: Dict[str, Any]) -> Dict[str, Any]:
        msg = {**message, "id": f"msg-{uuid.uuid4().hex[:8]}",
               "created_at": datetime.utcnow().isoformat()}
        self._messages.append(msg)
        return msg

    def list_for_session(
        self,
        session_id: str,
        limit: int = 100,
        before: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List messages for a session with optional cursor-based pagination.

        Args:
            session_id: The session ID to fetch messages for.
            limit: Maximum number of messages to return.
            before: Optional cursor - message ID to fetch messages before.

        Returns:
            List of messages in chronological order (oldest first).
        """
        # Filter by session
        session_messages = [
            m for m in self._messages if m.get("session_id") == session_id
        ]

        # Sort by created_at ascending (chronological)
        session_messages.sort(key=lambda m: m.get("created_at", ""))

        # Apply cursor filter if provided
        if before:
            # Cursor must exist within THIS session (security: prevent cross-session leaks)
            cursor_msg = next((m for m in session_messages if m["id"] == before), None)
            if not cursor_msg:
                # Invalid cursor: message doesn't exist in this session
                return []
            cursor_time = cursor_msg.get("created_at", "")
            session_messages = [
                m for m in session_messages if m.get("created_at", "") < cursor_time
            ]

        return session_messages[:limit]

    def reset(self) -> None:
        self._messages.clear()


class FakeRateLimitRepository:
    """In-memory rate limit tracker."""

    def __init__(self) -> None:
        self._usage: Dict[str, int] = {}

    def get_monthly_usage(self, user_id: str) -> int:
        return self._usage.get(user_id, 0)

    def increment(self, user_id: str) -> int:
        self._usage[user_id] = self._usage.get(user_id, 0) + 1
        return self._usage[user_id]

    def set_usage(self, user_id: str, count: int) -> None:
        """Test helper to preset usage."""
        self._usage[user_id] = count

    def reset(self) -> None:
        self._usage.clear()


class FakeAIClient:
    """Deterministic AI client that yields predictable SSE events.

    Supports configurable responses per test:
    - Set .response_events for single-turn responses
    - Set .response_sequences for multi-turn tool loops (list of response lists)

    Thread-safe for sequential test execution (not concurrent).
    """

    def __init__(self) -> None:
        self.response_events: Optional[List[StreamEvent]] = None
        self.response_sequences: Optional[List[List[StreamEvent]]] = None
        self._sequence_index: int = 0
        self.last_call_kwargs: Optional[Dict[str, Any]] = None
        self.all_call_kwargs: List[Dict[str, Any]] = []
        self.call_count: int = 0

    def stream_chat(
        self,
        messages: List[Dict[str, Any]],
        system: str,
        model: Optional[str] = None,
        tools: Optional[List[Dict[str, Any]]] = None,
        max_tokens: int = 4096,
        user_id: Optional[str] = None,
    ) -> Generator[StreamEvent, None, None]:
        self.call_count += 1
        call_kwargs = {
            "messages": messages,
            "system": system,
            "model": model,
            "tools": tools,
            "user_id": user_id,
        }
        self.last_call_kwargs = call_kwargs
        self.all_call_kwargs.append(call_kwargs)

        # Multi-turn: use response_sequences if configured
        if self.response_sequences is not None:
            if self._sequence_index < len(self.response_sequences):
                events = self.response_sequences[self._sequence_index]
                self._sequence_index += 1
                yield from events
                return
            # Fallback if more calls than sequences (shouldn't happen in tests)

        # Single-turn: use response_events if configured
        if self.response_events is not None:
            yield from self.response_events
            return

        # Default: simple text response
        yield StreamEvent(event="content_delta", data={"text": "I can help "})
        yield StreamEvent(event="content_delta", data={"text": "with your workout!"})
        yield StreamEvent(event="message_end", data={
            "model": "claude-sonnet-4-20250514",
            "input_tokens": 120,
            "output_tokens": 30,
            "latency_ms": 850,
            "stop_reason": "end_turn",
        })

    def reset(self) -> None:
        self.response_events = None
        self.response_sequences = None
        self._sequence_index = 0
        self.last_call_kwargs = None
        self.all_call_kwargs.clear()
        self.call_count = 0


class FakeEmbeddingRepository:
    """In-memory embedding repository."""

    def __init__(self) -> None:
        self._workouts: List[Dict[str, Any]] = []
        self._embeddings: Dict[str, List[float]] = {}
        self._content_hashes: Dict[str, str] = {}

    def get_workouts_without_embeddings(
        self,
        table: str,
        limit: int,
        workout_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        result = [
            w for w in self._workouts
            if w["id"] not in self._embeddings
            and (not workout_ids or w["id"] in workout_ids)
        ]
        return result[:limit]

    def save_embedding(
        self,
        table: str,
        workout_id: str,
        embedding: List[float],
        content_hash: str,
    ) -> None:
        self._embeddings[workout_id] = embedding
        self._content_hashes[workout_id] = content_hash

    def get_workout_by_id(
        self,
        table: str,
        workout_id: str,
    ) -> Optional[Dict[str, Any]]:
        for w in self._workouts:
            if w["id"] == workout_id:
                result = dict(w)
                # Include content hash if previously saved
                ch = self._content_hashes.get(workout_id)
                if ch:
                    result["embedding_content_hash"] = ch
                return result
        return None

    def get_progress(self, table: str) -> Dict[str, int]:
        total = len(self._workouts)
        embedded = len(self._embeddings)
        return {"total": total, "embedded": embedded, "remaining": total - embedded}

    def seed_workouts(self, workouts: List[Dict[str, Any]]) -> None:
        """Test helper."""
        self._workouts.extend(workouts)

    def reset(self) -> None:
        self._workouts.clear()
        self._embeddings.clear()
        self._content_hashes.clear()


class FakeEmbeddingService:
    """Deterministic embedding service returning fixed vectors."""

    def __init__(self) -> None:
        self.call_count: int = 0
        self.should_fail: bool = False

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        if self.should_fail:
            raise RuntimeError("Simulated embedding API failure")
        self.call_count += 1
        return [[0.1, 0.2, 0.3] for _ in texts]

    def embed_single(self, text: str) -> List[float]:
        return self.embed_batch([text])[0]

    def reset(self) -> None:
        self.call_count = 0
        self.should_fail = False


class FakeFunctionDispatcher:
    """Deterministic function dispatcher for E2E tests.

    Returns predictable results for each tool. Can be configured per test.
    Supports error injection and auth token capture for verification.
    """

    def __init__(self) -> None:
        self.call_count: int = 0
        self.last_call: Optional[Dict[str, Any]] = None
        self.all_calls: List[Dict[str, Any]] = []
        self.custom_results: Dict[str, str] = {}
        self.error_results: Dict[str, str] = {}

    def execute(
        self,
        function_name: str,
        arguments: Dict[str, Any],
        context: FunctionContext,
    ) -> str:
        self.call_count += 1
        call_info = {
            "function_name": function_name,
            "arguments": arguments,
            "user_id": context.user_id,
            "auth_token": context.auth_token,
        }
        self.last_call = call_info
        self.all_calls.append(call_info)

        # Return error if configured
        if function_name in self.error_results:
            return f"I couldn't complete that action: {self.error_results[function_name]}"

        # Return custom result if configured
        if function_name in self.custom_results:
            return self.custom_results[function_name]

        # Default deterministic responses
        if function_name == "search_workout_library":
            query = arguments.get("query", "")
            return f"Found these workouts:\n1. Test Workout for '{query}' (ID: w-test-1)"

        if function_name == "add_workout_to_calendar":
            date = arguments.get("date", "unknown")
            time = arguments.get("time")
            result = f"Added workout to calendar on {date}"
            if time:
                result += f" at {time}"
            return result

        if function_name == "generate_ai_workout":
            return "Generated workout: E2E Test Workout"

        if function_name == "navigate_to_page":
            page = arguments.get("page", "home")
            workout_id = arguments.get("workout_id")
            nav = {"action": "navigate", "page": page}
            if workout_id:
                nav["workout_id"] = workout_id
            return json.dumps(nav)

        # Phase 2: Content Ingestion handlers
        if function_name == "import_from_youtube":
            url = arguments.get("url", "")
            return json.dumps({
                "success": True,
                "source": "YouTube video",
                "workout": {
                    "title": f"Imported from {url[:30]}..." if len(url) > 30 else f"Imported from {url}",
                    "id": "w-yt-fake-1",
                    "exercise_count": 8,
                },
            })

        if function_name == "import_from_tiktok":
            mode = arguments.get("mode", "auto")
            return json.dumps({
                "success": True,
                "source": "TikTok video",
                "mode_used": mode,
                "workout": {
                    "title": "TikTok Fitness Routine",
                    "id": "w-tt-fake-1",
                    "exercise_count": 5,
                },
            })

        if function_name == "import_from_instagram":
            return json.dumps({
                "success": True,
                "source": "Instagram post",
                "workout": {
                    "title": "IG Workout Import",
                    "id": "w-ig-fake-1",
                    "exercise_count": 6,
                },
            })

        if function_name == "import_from_pinterest":
            url = arguments.get("url", "")
            # Simulate board vs pin detection
            if "/board" in url or url.count("/") > 4:
                return json.dumps({
                    "success": True,
                    "multiple_workouts": True,
                    "total": 3,
                    "workouts": [
                        {"title": "Pin Workout 1", "id": "w-pin-1"},
                        {"title": "Pin Workout 2", "id": "w-pin-2"},
                        {"title": "Pin Workout 3", "id": "w-pin-3"},
                    ],
                })
            return json.dumps({
                "success": True,
                "source": "Pinterest",
                "workout": {
                    "title": "Pinterest Pin Workout",
                    "id": "w-pin-single",
                    "exercise_count": 4,
                },
            })

        if function_name == "import_from_image":
            return json.dumps({
                "success": True,
                "source": "image",
                "workout": {
                    "title": "Imported from Screenshot",
                    "id": "w-img-fake-1",
                    "exercise_count": 10,
                },
            })

        # Phase 3: Workout Management handlers
        if function_name == "edit_workout":
            workout_id = arguments.get("workout_id", "unknown")
            return json.dumps({
                "success": True,
                "message": "Workout updated successfully",
                "workout_id": workout_id,
            })

        if function_name == "export_workout":
            workout_id = arguments.get("workout_id", "unknown")
            export_format = arguments.get("format", "yaml")
            format_names = {
                "yaml": "Garmin YAML",
                "zwo": "Zwift ZWO",
                "workoutkit": "Apple WorkoutKit",
                "fit_metadata": "FIT metadata",
            }
            return json.dumps({
                "success": True,
                "format": export_format,
                "format_name": format_names.get(export_format, export_format),
                "workout_id": workout_id,
                "content": f"<fake {export_format} content>",
                "download_url": f"https://api.amakaflow.com/export/{workout_id}.{export_format}",
            })

        if function_name == "duplicate_workout":
            workout_id = arguments.get("workout_id", "unknown")
            new_title = arguments.get("new_title", "Workout (Copy)")
            return json.dumps({
                "success": True,
                "message": "Workout duplicated successfully",
                "original_id": workout_id,
                "new_workout": {
                    "id": f"w-dup-{workout_id}",
                    "title": new_title,
                },
            })

        if function_name == "log_workout_completion":
            workout_id = arguments.get("workout_id", "unknown")
            return json.dumps({
                "success": True,
                "message": "Workout completion logged",
                "workout_id": workout_id,
                "completion_id": f"comp-{workout_id}-1",
            })

        if function_name == "get_workout_history":
            return json.dumps({
                "success": True,
                "completions": [
                    {
                        "workout_title": "Morning HIIT",
                        "completed_at": "2024-01-15T08:30:00Z",
                        "duration_minutes": 30,
                        "rating": 4,
                    },
                    {
                        "workout_title": "Leg Day",
                        "completed_at": "2024-01-14T17:00:00Z",
                        "duration_minutes": 45,
                        "rating": 5,
                    },
                ],
            })

        if function_name == "get_workout_details":
            workout_id = arguments.get("workout_id", "unknown")
            return json.dumps({
                "success": True,
                "workout": {
                    "id": workout_id,
                    "title": "Test Workout",
                    "description": "A test workout for E2E testing",
                    "exercise_count": 5,
                    "tags": ["strength", "test"],
                    "exercises": [
                        {"name": "Squats", "sets": 3, "reps": 10},
                        {"name": "Lunges", "sets": 3, "reps": 12},
                        {"name": "Deadlifts", "sets": 3, "reps": 8},
                    ],
                },
            })

        return f"Unknown function '{function_name}'"

    def set_result(self, function_name: str, result: str) -> None:
        """Configure custom result for a function (test helper)."""
        self.custom_results[function_name] = result

    def set_error(self, function_name: str, error_message: str) -> None:
        """Configure error response for a function (test helper)."""
        self.error_results[function_name] = error_message

    def reset(self) -> None:
        self.call_count = 0
        self.last_call = None
        self.all_calls.clear()
        self.custom_results.clear()
        self.error_results.clear()


class FakeTTSService:
    """Deterministic TTS service for E2E tests.

    Returns predictable audio data. Supports configuration for failure simulation.
    """

    # Fake MP3 header + padding (valid enough for testing)
    FAKE_AUDIO = b'\xff\xfb\x90\x00' + b'\x00' * 1000

    def __init__(self) -> None:
        self.call_count: int = 0
        self.last_call: Optional[Dict[str, Any]] = None
        self.should_fail: bool = False
        self.fail_error: str = "TTS service error"
        self.daily_char_limit: int = 50_000

    def synthesize(
        self,
        text: str,
        voice_id: Optional[str] = None,
        speed: float = 1.0,
    ) -> TTSResult:
        self.call_count += 1
        self.last_call = {"text": text, "voice_id": voice_id, "speed": speed}

        if self.should_fail:
            return TTSResult(
                success=False,
                audio_data=None,
                duration_ms=None,
                chars_used=0,
                provider="elevenlabs-fake",
                voice_id=voice_id or "default-voice",
                error=self.fail_error,
            )

        return TTSResult(
            success=True,
            audio_data=self.FAKE_AUDIO,
            duration_ms=len(text) * 50,  # ~50ms per char
            chars_used=len(text),
            provider="elevenlabs-fake",
            voice_id=voice_id or "default-voice",
        )

    def synthesize_streaming(
        self,
        text: str,
        voice_id: Optional[str] = None,
        speed: float = 1.0,
        chunk_size: int = 4096,
    ) -> Generator[bytes, None, None]:
        if self.should_fail:
            return
        # Yield fake audio in chunks
        audio = self.FAKE_AUDIO * 3
        for i in range(0, len(audio), chunk_size):
            yield audio[i:i + chunk_size]

    def get_available_voices(self) -> List[VoiceInfo]:
        return [
            VoiceInfo(
                voice_id="voice-rachel",
                name="Rachel",
                preview_url="https://example.com/rachel.mp3",
                labels={"accent": "american", "gender": "female"},
            ),
            VoiceInfo(
                voice_id="voice-adam",
                name="Adam",
                preview_url="https://example.com/adam.mp3",
                labels={"accent": "british", "gender": "male"},
            ),
        ]

    def check_daily_limit(
        self,
        chars_used: int,
        chars_needed: int,
    ) -> tuple:
        remaining = self.daily_char_limit - chars_used
        allowed = chars_needed <= remaining
        return (allowed, max(0, remaining))

    def set_failure(self, should_fail: bool, error: str = "TTS service error") -> None:
        """Test helper to simulate TTS failure."""
        self.should_fail = should_fail
        self.fail_error = error

    def reset(self) -> None:
        self.call_count = 0
        self.last_call = None
        self.should_fail = False
        self.fail_error = "TTS service error"
        self.daily_char_limit = 50_000


class FakeTTSSettingsRepository:
    """In-memory TTS settings repository for E2E tests."""

    def __init__(self) -> None:
        self._settings: Dict[str, TTSSettings] = {}
        self._usage: Dict[str, int] = {}
        self._reset_dates: Dict[str, date] = {}

    def get_settings(self, user_id: str) -> TTSSettings:
        if user_id not in self._settings:
            return TTSSettings(
                tts_enabled=True,
                tts_voice_id=None,
                tts_speed=1.0,
                tts_pitch=1.0,
                auto_play_responses=True,
                tts_daily_chars_used=self._usage.get(user_id, 0),
            )
        settings = self._settings[user_id]
        # Update with current usage
        return TTSSettings(
            tts_enabled=settings.tts_enabled,
            tts_voice_id=settings.tts_voice_id,
            tts_speed=settings.tts_speed,
            tts_pitch=settings.tts_pitch,
            auto_play_responses=settings.auto_play_responses,
            tts_daily_chars_used=self._usage.get(user_id, 0),
        )

    def update_settings(self, user_id: str, update: TTSSettingsUpdate) -> TTSSettings:
        current = self._settings.get(user_id, TTSSettings())

        updated = TTSSettings(
            tts_enabled=update.tts_enabled if update.tts_enabled is not None else current.tts_enabled,
            tts_voice_id=update.tts_voice_id if update.tts_voice_id is not None else current.tts_voice_id,
            tts_speed=update.tts_speed if update.tts_speed is not None else current.tts_speed,
            tts_pitch=update.tts_pitch if update.tts_pitch is not None else current.tts_pitch,
            auto_play_responses=(
                update.auto_play_responses
                if update.auto_play_responses is not None
                else current.auto_play_responses
            ),
            tts_daily_chars_used=self._usage.get(user_id, 0),
        )
        self._settings[user_id] = updated
        return updated

    def increment_daily_chars(self, user_id: str, chars: int) -> int:
        current = self._usage.get(user_id, 0)
        new_total = current + chars
        self._usage[user_id] = new_total
        return new_total

    def reset_daily_chars_if_needed(self, user_id: str) -> None:
        # In tests, we control this manually - no automatic date reset
        pass

    def set_settings(self, user_id: str, settings: TTSSettings) -> None:
        """Test helper to preset settings."""
        self._settings[user_id] = settings
        self._usage[user_id] = settings.tts_daily_chars_used

    def set_usage(self, user_id: str, chars: int) -> None:
        """Test helper to preset usage."""
        self._usage[user_id] = chars

    def reset(self) -> None:
        self._settings.clear()
        self._usage.clear()
        self._reset_dates.clear()


# ============================================================================
# Shared fake instances (reset per test)
# ============================================================================

_session_repo = FakeChatSessionRepository()
_message_repo = FakeChatMessageRepository()
_rate_limit_repo = FakeRateLimitRepository()
_ai_client = FakeAIClient()
_embedding_repo = FakeEmbeddingRepository()
_embedding_service = FakeEmbeddingService()
_function_dispatcher = FakeFunctionDispatcher()
_tts_service = FakeTTSService()
_tts_settings_repo = FakeTTSSettingsRepository()


# ============================================================================
# Settings
# ============================================================================


def _make_test_settings() -> Settings:
    return Settings(
        environment="test",
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="test-key",
        internal_api_key=INTERNAL_API_KEY,
        rate_limit_free=50,
        rate_limit_paid=500,
        embedding_batch_size=5,
        _env_file=None,
    )


_test_settings = _make_test_settings()


# ============================================================================
# Dependency override factories
# ============================================================================


def _override_settings() -> Settings:
    return _test_settings


async def _override_auth() -> str:
    return TEST_USER_ID


async def _override_auth_context() -> AuthContext:
    return AuthContext(user_id=TEST_USER_ID, auth_token="Bearer e2e-test-token")


def _override_stream_chat_use_case() -> StreamChatUseCase:
    return StreamChatUseCase(
        session_repo=_session_repo,
        message_repo=_message_repo,
        rate_limit_repo=_rate_limit_repo,
        ai_client=_ai_client,
        function_dispatcher=_function_dispatcher,
        monthly_limit=_test_settings.rate_limit_free,
        tts_service=_tts_service,
        tts_settings_repo=_tts_settings_repo,
    )


def _override_generate_embeddings_use_case() -> GenerateEmbeddingsUseCase:
    return GenerateEmbeddingsUseCase(
        repository=_embedding_repo,
        embedding_service=_embedding_service,
        batch_size=_test_settings.embedding_batch_size,
    )


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture(autouse=True)
def _reset_fakes():
    """Reset all in-memory fakes before each test."""
    _session_repo.reset()
    _message_repo.reset()
    _rate_limit_repo.reset()
    _ai_client.reset()
    _embedding_repo.reset()
    _embedding_service.reset()
    _function_dispatcher.reset()
    _tts_service.reset()
    _tts_settings_repo.reset()
    yield


def _override_chat_session_repository() -> FakeChatSessionRepository:
    return _session_repo


def _override_chat_message_repository() -> FakeChatMessageRepository:
    return _message_repo


@pytest.fixture(scope="module")
def app():
    """Create the FastAPI app with all dependency overrides."""
    application = create_app(settings=_test_settings)
    application.dependency_overrides[backend_get_current_user] = _override_auth
    application.dependency_overrides[deps_get_current_user] = _override_auth
    application.dependency_overrides[get_auth_context] = _override_auth_context
    application.dependency_overrides[get_chat_session_repository] = _override_chat_session_repository
    application.dependency_overrides[get_chat_message_repository] = _override_chat_message_repository
    application.dependency_overrides[get_stream_chat_use_case] = _override_stream_chat_use_case
    application.dependency_overrides[get_generate_embeddings_use_case] = _override_generate_embeddings_use_case
    application.dependency_overrides[get_settings] = _override_settings
    yield application
    application.dependency_overrides.clear()


@pytest.fixture(scope="module")
def noauth_app():
    """App WITHOUT auth overrides -- for testing auth rejection paths."""
    application = create_app(settings=_test_settings)
    application.dependency_overrides[get_chat_session_repository] = _override_chat_session_repository
    application.dependency_overrides[get_chat_message_repository] = _override_chat_message_repository
    application.dependency_overrides[get_stream_chat_use_case] = _override_stream_chat_use_case
    application.dependency_overrides[get_generate_embeddings_use_case] = _override_generate_embeddings_use_case
    application.dependency_overrides[get_settings] = _override_settings
    yield application
    application.dependency_overrides.clear()


@pytest.fixture
def client(app) -> TestClient:
    """Authenticated TestClient."""
    return TestClient(app)


@pytest.fixture
def noauth_client(noauth_app) -> TestClient:
    """Unauthenticated TestClient (no auth override)."""
    return TestClient(noauth_app)


@pytest.fixture
def session_repo() -> FakeChatSessionRepository:
    return _session_repo


@pytest.fixture
def message_repo() -> FakeChatMessageRepository:
    return _message_repo


@pytest.fixture
def rate_limit_repo() -> FakeRateLimitRepository:
    return _rate_limit_repo


@pytest.fixture
def ai_client() -> FakeAIClient:
    return _ai_client


@pytest.fixture
def embedding_repo() -> FakeEmbeddingRepository:
    return _embedding_repo


@pytest.fixture
def embedding_service() -> FakeEmbeddingService:
    return _embedding_service


@pytest.fixture
def function_dispatcher() -> FakeFunctionDispatcher:
    return _function_dispatcher


@pytest.fixture
def tts_service() -> FakeTTSService:
    return _tts_service


@pytest.fixture
def tts_settings_repo() -> FakeTTSSettingsRepository:
    return _tts_settings_repo


# ============================================================================
# SSE parsing utility
# ============================================================================


def parse_sse_events(response_text: str) -> List[Dict[str, Any]]:
    """Parse an SSE response body into a list of {event, data} dicts.

    Handles multi-line data fields and blank-line event boundaries per the
    SSE specification (https://html.spec.whatwg.org/multipage/server-sent-events.html).

    Returns a list of dicts, each with:
        - "event": str (event type)
        - "data": parsed JSON object
    """
    events: List[Dict[str, Any]] = []
    current_event: Optional[str] = None
    data_lines: List[str] = []

    for line in response_text.split("\n"):
        stripped = line.strip()

        if stripped.startswith("event:"):
            current_event = stripped[len("event:"):].strip()

        elif stripped.startswith("data:"):
            data_lines.append(stripped[len("data:"):].strip())

        elif stripped == "":
            # Blank line = event boundary
            if current_event is not None and data_lines:
                raw = "\n".join(data_lines)
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    parsed = raw
                events.append({"event": current_event, "data": parsed})
            current_event = None
            data_lines = []

    # Flush any trailing event without final blank line
    if current_event is not None and data_lines:
        raw = "\n".join(data_lines)
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = raw
        events.append({"event": current_event, "data": parsed})

    return events


def extract_event_types(events: List[Dict[str, Any]]) -> List[str]:
    """Return just the event type strings from parsed SSE events."""
    return [e["event"] for e in events]


def find_events(events: List[Dict[str, Any]], event_type: str) -> List[Dict[str, Any]]:
    """Filter parsed SSE events to only those matching event_type."""
    return [e for e in events if e["event"] == event_type]
