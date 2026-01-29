# Chat API Documentation

The Chat API is AmakaFlow's AI coaching and conversation service. It provides real-time streaming chat with Claude, enabling users to get personalized fitness coaching, workout recommendations, and schedule management through natural conversation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Clients                                  │
│              (Web App, iOS App, Android App)                    │
└─────────────────────────────┬───────────────────────────────────┘
                              │ SSE Stream
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Chat API (FastAPI)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Routers    │  │    Auth      │  │   Health Checks      │  │
│  │  /chat/*     │  │  Clerk JWT   │  │  /health, /ready     │  │
│  └──────┬───────┘  └──────────────┘  └──────────────────────┘  │
│         │                                                        │
│  ┌──────▼───────────────────────────────────────────────────┐   │
│  │               Application Layer (Use Cases)               │   │
│  │  ┌─────────────────────┐  ┌─────────────────────────┐    │   │
│  │  │   StreamChatUseCase │  │ GenerateEmbeddingsUseCase│    │   │
│  │  └─────────┬───────────┘  └─────────────────────────┘    │   │
│  └────────────┼──────────────────────────────────────────────┘  │
│               │                                                  │
│  ┌────────────▼──────────────────────────────────────────────┐  │
│  │                   Backend Services                         │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │  │
│  │  │   AIClient   │  │  Dispatcher  │  │  FeatureFlags  │   │  │
│  │  │   (Claude)   │  │  (Tools)     │  │   Service      │   │  │
│  │  └──────────────┘  └──────┬───────┘  └────────────────┘   │  │
│  └───────────────────────────┼────────────────────────────────┘ │
└──────────────────────────────┼──────────────────────────────────┘
                               │ HTTP
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
   │ mapper-api  │      │calendar-api │      │workout-api  │
   │  (Search)   │      │ (Schedule)  │      │ (Generate)  │
   └─────────────┘      └─────────────┘      └─────────────┘
```

## Quick Start

### Making a Chat Request

```bash
curl -X POST https://chat-api.amakaflow.com/chat/stream \
  -H "Authorization: Bearer <clerk-jwt>" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"message": "Find me a leg workout"}'
```

### Response (SSE Stream)

```
event: message_start
data: {"session_id": "abc123"}

event: content_delta
data: {"text": "I found several leg workouts in your library..."}

event: function_call
data: {"id": "tool_1", "name": "search_workout_library"}

event: function_result
data: {"tool_use_id": "tool_1", "result": "Found these workouts:\n1. Leg Day (ID: w1)"}

event: message_end
data: {"session_id": "abc123", "tokens_used": 245, "latency_ms": 1200}
```

## Authentication

All chat endpoints require authentication via Clerk JWT:

```http
Authorization: Bearer <clerk-jwt-token>
```

The JWT is validated against Clerk's JWKS endpoint. The `user_id` claim is extracted and used for:
- Session ownership
- Rate limit tracking
- Feature flag evaluation
- Forwarding to downstream services

## Rate Limits

| Tier | Monthly Limit | Upgrade Path |
|------|---------------|--------------|
| Free | 50 messages | Upgrade to paid |
| Paid | 500 messages | Contact support |

Rate limits reset on the 1st of each month (UTC).

## Documentation Index

| Document | Description |
|----------|-------------|
| [endpoints.md](./endpoints.md) | API endpoint reference |
| [sse-events.md](./sse-events.md) | SSE event format specification |
| [functions.md](./functions.md) | Function calling reference |
| [errors.md](./errors.md) | Error code reference |
| [prompt-engineering.md](./prompt-engineering.md) | System prompt and AI guidelines |
| [runbook.md](./runbook.md) | Operations and incident response |
| [developer-guide.md](./developer-guide.md) | Local setup and development |

## Key Technologies

- **FastAPI** - Web framework with automatic OpenAPI docs at `/docs`
- **sse-starlette** - Server-Sent Events streaming
- **Anthropic Claude** - AI model (claude-sonnet-4-20250514)
- **Supabase** - PostgreSQL database and auth
- **Clerk** - JWT authentication
- **Helicone** - LLM observability
- **Sentry** - Error tracking
