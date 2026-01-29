# API Endpoints

## Chat Endpoints

### POST /chat/stream

Stream a chat response as Server-Sent Events.

**Authentication:** Required (Clerk JWT)

**Request:**

```http
POST /chat/stream
Authorization: Bearer <clerk-jwt>
Content-Type: application/json
Accept: text/event-stream
```

```json
{
  "message": "Find me a 30-minute leg workout",
  "session_id": "optional-existing-session-id"
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | User's message (1-10,000 characters) |
| `session_id` | string | No | Existing session ID to continue conversation |

**Response:**

Returns an SSE stream. See [sse-events.md](./sse-events.md) for event format details.

```
event: message_start
data: {"session_id": "sess_abc123"}

event: content_delta
data: {"text": "I found a great leg workout..."}

event: message_end
data: {"session_id": "sess_abc123", "tokens_used": 245, "latency_ms": 1200}
```

**Error Responses:**

| Status | Error Type | Description |
|--------|------------|-------------|
| 401 | Unauthorized | Invalid or missing JWT |
| 429 | `rate_limit_exceeded` | Monthly limit reached |
| 404 | `not_found` | Session not found |
| 503 | `feature_disabled` | Chat not enabled for user |

---

## Health Endpoints

### GET /health

Simple liveness probe. Always returns 200 if the service is running.

**Authentication:** None

**Response:**

```json
{
  "status": "ok",
  "service": "chat-api"
}
```

---

### GET /health/ready

Readiness probe that verifies downstream dependencies (Supabase).

**Authentication:** None

**Response (Healthy):**

```json
{
  "status": "ready",
  "service": "chat-api",
  "checks": {
    "supabase": "ok"
  }
}
```

**Response (Unhealthy - 503):**

```json
{
  "status": "not_ready",
  "service": "chat-api",
  "checks": {
    "supabase": "unavailable"
  }
}
```

---

## Internal Endpoints

These endpoints are for service-to-service communication and require the `X-Internal-Key` header.

### POST /internal/embeddings/generate

Generate embeddings for workouts that don't have them.

**Authentication:** `X-Internal-Key` header

**Request:**

```http
POST /internal/embeddings/generate
X-Internal-Key: <internal-api-key>
Content-Type: application/json
```

```json
{
  "table": "workouts",
  "workout_ids": ["w1", "w2"]
}
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `table` | string | No | Table name: `workouts` or `follow_along_workouts` (default: `workouts`) |
| `workout_ids` | array | No | Specific workout IDs to process (processes all if omitted) |

**Response:**

```json
{
  "total_processed": 100,
  "total_embedded": 95,
  "total_skipped": 5,
  "errors": [],
  "duration_seconds": 12.5
}
```

---

### GET /internal/embeddings/progress/{table}

Get embedding progress for a table.

**Authentication:** `X-Internal-Key` header

**Request:**

```http
GET /internal/embeddings/progress/workouts
X-Internal-Key: <internal-api-key>
```

**Response:**

```json
{
  "table": "workouts",
  "total": 1000,
  "embedded": 950,
  "remaining": 50
}
```

---

### POST /internal/embeddings/webhook

Generate embedding for a single workout. Called by mapper-api on workout create/update.

**Authentication:** `X-Internal-Key` header

**Request:**

```http
POST /internal/embeddings/webhook
X-Internal-Key: <internal-api-key>
Content-Type: application/json
```

```json
{
  "table": "workouts",
  "workout_id": "workout-uuid"
}
```

**Response:**

```json
{
  "status": "embedded",
  "workout_id": "workout-uuid",
  "error": null
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 403 | Invalid internal API key |
| 404 | Workout not found |
| 502 | Embedding generation failed |
| 503 | Internal API key not configured |

---

## OpenAPI Documentation

FastAPI automatically generates interactive API documentation:

- **Swagger UI:** `https://chat-api.amakaflow.com/docs`
- **ReDoc:** `https://chat-api.amakaflow.com/redoc`
- **OpenAPI JSON:** `https://chat-api.amakaflow.com/openapi.json`
