# Developer Guide

This guide covers local development setup, testing, and contributing to the Chat API.

## Prerequisites

- Python 3.11+
- Poetry (dependency management)
- Docker (optional, for local Supabase)
- Access to Anthropic API (or use mocks)

## Local Setup

### 1. Clone and Install Dependencies

```bash
cd chat-api
poetry install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```bash
# Core Settings
ENVIRONMENT=development

# Database
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Authentication - Clerk
CLERK_DOMAIN=your-clerk-domain.clerk.accounts.dev

# AI Services
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Helicone Observability (optional for local dev)
HELICONE_API_KEY=
HELICONE_ENABLED=false

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limits
RATE_LIMIT_FREE=50
RATE_LIMIT_PAID=500

# Internal API
INTERNAL_API_KEY=dev-internal-key

# AI Model
DEFAULT_MODEL=claude-sonnet-4-20250514

# External Services (defaults work for local development)
# MAPPER_API_URL=http://localhost:8001
# CALENDAR_API_URL=http://localhost:8002
# WORKOUT_INGESTOR_API_URL=http://localhost:8003
```

### 3. Run the Server

```bash
poetry run uvicorn backend.main:app --reload --port 8000
```

The API is now available at `http://localhost:8000`.

### 4. Verify Setup

```bash
# Health check
curl http://localhost:8000/health

# OpenAPI docs
open http://localhost:8000/docs
```

## Project Structure

```
chat-api/
├── api/
│   ├── deps.py              # FastAPI dependency injection
│   └── routers/
│       ├── chat.py          # /chat/stream endpoint
│       ├── health.py        # /health endpoints
│       └── embeddings.py    # /internal/embeddings endpoints
├── application/
│   ├── ports/               # Repository interfaces (protocols)
│   │   ├── chat_session_repository.py
│   │   ├── chat_message_repository.py
│   │   └── rate_limit_repository.py
│   └── use_cases/
│       ├── stream_chat.py   # Main chat orchestration
│       └── generate_embeddings.py
├── backend/
│   ├── main.py              # FastAPI app factory
│   ├── settings.py          # Pydantic settings
│   ├── auth.py              # Clerk JWT validation
│   └── services/
│       ├── ai_client.py     # Anthropic client wrapper
│       ├── tool_schemas.py  # Function definitions
│       ├── function_dispatcher.py  # Tool execution
│       └── feature_flag_service.py
├── infrastructure/
│   └── db/
│       ├── chat_session_repository.py
│       ├── chat_message_repository.py
│       └── rate_limit_repository.py
├── tests/
│   ├── unit/
│   ├── integration/
│   └── conftest.py
├── pyproject.toml
└── .env.example
```

### Architecture Layers

| Layer | Purpose | Example |
|-------|---------|---------|
| **api/** | HTTP routing, request/response handling | `chat.py` router |
| **application/** | Business logic, use cases | `stream_chat.py` |
| **backend/** | Services, external integrations | `ai_client.py` |
| **infrastructure/** | Database implementations | `chat_session_repository.py` |

## Testing

### Run All Tests

```bash
poetry run pytest
```

### Run Specific Test Categories

```bash
# Unit tests only
poetry run pytest tests/unit/

# Integration tests (requires database)
poetry run pytest tests/integration/

# With coverage
poetry run pytest --cov=. --cov-report=html
```

### Test Configuration

Tests use these environment overrides:

```python
# tests/conftest.py
@pytest.fixture
def test_settings():
    return Settings(
        environment="test",
        supabase_url="https://test.supabase.co",
        supabase_service_role_key="test-key",
        # ...
    )
```

### Mocking AI Responses

```python
# tests/unit/test_stream_chat.py
@pytest.fixture
def mock_ai_client():
    client = Mock(spec=AIClient)
    client.stream_chat.return_value = iter([
        AIEvent(event="content_delta", data={"text": "Hello"}),
        AIEvent(event="message_end", data={"input_tokens": 10, "output_tokens": 5}),
    ])
    return client

def test_stream_chat_basic(mock_ai_client):
    use_case = StreamChatUseCase(
        session_repo=mock_session_repo,
        message_repo=mock_message_repo,
        rate_limit_repo=mock_rate_limit_repo,
        ai_client=mock_ai_client,
        function_dispatcher=mock_dispatcher,
    )

    events = list(use_case.execute(
        user_id="user_123",
        message="Hello",
    ))

    assert events[0].event == "message_start"
    assert events[-1].event == "message_end"
```

### E2E Testing with Test Auth

For development/staging, use the test auth bypass:

```bash
# Set in .env (never in production!)
TEST_AUTH_SECRET=your-secure-random-string
```

```bash
curl -X POST http://localhost:8000/chat/stream \
  -H "X-Test-Auth: your-secure-random-string" \
  -H "X-Test-User-Id: test-user-123" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'
```

## Adding New Functions

### Step 1: Define the Schema

Add to `backend/services/tool_schemas.py`:

```python
{
    "name": "get_workout_stats",
    "description": "Get workout statistics for the user over a time period.",
    "input_schema": {
        "type": "object",
        "properties": {
            "period": {
                "type": "string",
                "enum": ["week", "month", "year"],
                "description": "Time period for stats"
            }
        },
        "required": ["period"]
    }
}
```

### Step 2: Implement the Handler

Add to `backend/services/function_dispatcher.py`:

```python
def _get_workout_stats(
    self, args: Dict[str, Any], ctx: FunctionContext
) -> str:
    """Get workout stats from mapper-api."""
    period = args.get("period", "week")

    result = self._call_api(
        "GET",
        f"{self._mapper_url}/users/{ctx.user_id}/stats",
        ctx,
        params={"period": period},
    )

    return f"In the last {period}, you completed {result['workout_count']} workouts!"
```

### Step 3: Register the Handler

```python
self._handlers = {
    # ... existing handlers
    "get_workout_stats": self._get_workout_stats,
}
```

### Step 4: Add Tests

```python
# tests/unit/test_function_dispatcher.py
def test_get_workout_stats():
    dispatcher = FunctionDispatcher(
        mapper_api_url="http://mapper",
        calendar_api_url="http://calendar",
        ingestor_api_url="http://ingestor",
    )

    with responses.RequestsMock() as rsps:
        rsps.add(
            responses.GET,
            "http://mapper/users/user_123/stats",
            json={"workout_count": 5},
        )

        result = dispatcher.execute(
            "get_workout_stats",
            {"period": "week"},
            FunctionContext(user_id="user_123"),
        )

        assert "5 workouts" in result
```

### Step 5: Update Documentation

Add the new function to `docs/chat-api/functions.md`.

## Code Style

### Formatting

```bash
# Format code
poetry run black .
poetry run isort .

# Check formatting
poetry run black --check .
poetry run isort --check .
```

### Linting

```bash
poetry run ruff check .
poetry run mypy .
```

### Pre-commit Hooks

```bash
# Install hooks
poetry run pre-commit install

# Run manually
poetry run pre-commit run --all-files
```

## Common Development Tasks

### Regenerate OpenAPI Schema

```bash
curl http://localhost:8000/openapi.json > openapi.json
```

### Debug SSE Locally

```bash
# Use curl with unbuffered output
curl -N -X POST http://localhost:8000/chat/stream \
  -H "X-Test-Auth: secret" \
  -H "X-Test-User-Id: test-user" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello"}'
```

### Test Function Calls

```bash
# Trigger a function call
curl -N -X POST http://localhost:8000/chat/stream \
  -H "X-Test-Auth: secret" \
  -H "X-Test-User-Id: test-user" \
  -H "Content-Type: application/json" \
  -d '{"message": "Find me a leg workout"}'
```

### View Helicone Logs Locally

Set `HELICONE_ENABLED=true` and `HELICONE_API_KEY` in `.env`, then view requests at https://helicone.ai/dashboard.

## Debugging

### Enable Debug Logging

```python
# In development, set log level
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Inspect AI Client Calls

```python
# Add to ai_client.py for debugging
logger.debug("Sending to Claude: %s", messages)
logger.debug("Claude response: %s", response)
```

### Database Queries

Use Supabase dashboard → SQL Editor for ad-hoc queries:

```sql
-- Recent chat sessions
SELECT * FROM chat_sessions
WHERE user_id = 'user_123'
ORDER BY created_at DESC
LIMIT 10;

-- Rate limit status
SELECT * FROM chat_rate_limits
WHERE user_id = 'user_123';
```

## Troubleshooting

### "ANTHROPIC_API_KEY not configured"

Ensure `ANTHROPIC_API_KEY` is set in `.env` and the file is in the `chat-api/` directory.

### "Database not available"

Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct. Test connectivity:

```python
from supabase import create_client
client = create_client(url, key)
client.table("profiles").select("id").limit(1).execute()
```

### SSE Not Streaming

Ensure you're using `-N` flag with curl (unbuffered). In browsers, check the `Accept: text/event-stream` header.

### Function Calls Failing

1. Check downstream service is running
2. Verify `MAPPER_API_URL`, `CALENDAR_API_URL`, etc.
3. Check auth token forwarding

## Contributing

1. Create a feature branch from `main`
2. Make changes with tests
3. Run full test suite
4. Submit PR with description
5. Address review feedback
6. Merge after approval
