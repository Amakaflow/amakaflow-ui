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
    get_stream_chat_use_case,
    get_generate_embeddings_use_case,
    get_settings,
    AuthContext,
)
from application.use_cases.stream_chat import StreamChatUseCase
from application.use_cases.generate_embeddings import GenerateEmbeddingsUseCase
from backend.services.function_dispatcher import FunctionContext


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
        session = {
            "id": sid,
            "user_id": user_id,
            "title": title or "New Chat",
            "created_at": datetime.utcnow().isoformat(),
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

    def list_for_user(
        self, user_id: str, limit: int = 50, offset: int = 0
    ) -> List[Dict[str, Any]]:
        return [
            s for s in self._sessions.values() if s["user_id"] == user_id
        ][:limit]

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
        self, session_id: str, limit: int = 100
    ) -> List[Dict[str, Any]]:
        return [
            m for m in self._messages if m.get("session_id") == session_id
        ][:limit]

    def reset(self) -> None:
        self._messages.clear()


class FakeRateLimitRepository:
    """In-memory rate limit tracker."""

    def __init__(self) -> None:
        self._usage: Dict[str, int] = {}

    def get_monthly_usage(self, user_id: str) -> int:
        return self._usage.get(user_id, 0)

    def increment(self, user_id: str) -> None:
        self._usage[user_id] = self._usage.get(user_id, 0) + 1

    def set_usage(self, user_id: str, count: int) -> None:
        """Test helper to preset usage."""
        self._usage[user_id] = count

    def reset(self) -> None:
        self._usage.clear()


class FakeAIClient:
    """Deterministic AI client that yields predictable SSE events.

    Supports configurable responses per test by setting .response_events.
    Thread-safe for sequential test execution (not concurrent).
    """

    def __init__(self) -> None:
        self.response_events: Optional[List[StreamEvent]] = None
        self.last_call_kwargs: Optional[Dict[str, Any]] = None
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
        self.last_call_kwargs = {
            "messages": messages,
            "system": system,
            "model": model,
            "tools": tools,
            "user_id": user_id,
        }

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
        })

    def reset(self) -> None:
        self.response_events = None
        self.last_call_kwargs = None
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
    yield


@pytest.fixture(scope="module")
def app():
    """Create the FastAPI app with all dependency overrides."""
    application = create_app(settings=_test_settings)
    application.dependency_overrides[backend_get_current_user] = _override_auth
    application.dependency_overrides[deps_get_current_user] = _override_auth
    application.dependency_overrides[get_auth_context] = _override_auth_context
    application.dependency_overrides[get_stream_chat_use_case] = _override_stream_chat_use_case
    application.dependency_overrides[get_generate_embeddings_use_case] = _override_generate_embeddings_use_case
    application.dependency_overrides[get_settings] = _override_settings
    yield application
    application.dependency_overrides.clear()


@pytest.fixture(scope="module")
def noauth_app():
    """App WITHOUT auth overrides -- for testing auth rejection paths."""
    application = create_app(settings=_test_settings)
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
