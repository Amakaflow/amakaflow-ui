# SSE Event Format

The `/chat/stream` endpoint returns Server-Sent Events (SSE). This document specifies the event types and their JSON schemas.

## Connection Requirements

### Headers

```http
Accept: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### Client Implementation

```javascript
const eventSource = new EventSource('/chat/stream', {
  headers: {
    'Authorization': `Bearer ${token}`,
  }
});

eventSource.addEventListener('message_start', (e) => {
  const data = JSON.parse(e.data);
  console.log('Session:', data.session_id);
});

eventSource.addEventListener('content_delta', (e) => {
  const data = JSON.parse(e.data);
  appendToChat(data.text);
});

eventSource.addEventListener('error', (e) => {
  const data = JSON.parse(e.data);
  showError(data.message);
});
```

## Event Types

### message_start

Sent at the beginning of a response. Contains session information.

```json
{
  "session_id": "sess_abc123def456"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Unique session identifier. Use this for subsequent messages in the same conversation. |

---

### content_delta

Incremental text chunks from the AI response. Clients should append these to build the full response.

```json
{
  "text": "I found several leg workouts"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `text` | string | Text fragment to append to the response |

**Note:** Text is streamed in small chunks (typically 10-50 characters) for real-time display.

---

### function_call

Emitted when Claude decides to invoke a tool function.

```json
{
  "id": "toolu_01ABC123",
  "name": "search_workout_library"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique tool use identifier |
| `name` | string | Name of the function being called |

**Available Functions:**
- `search_workout_library`
- `add_workout_to_calendar`
- `generate_ai_workout`
- `navigate_to_page`

See [functions.md](./functions.md) for complete function documentation.

---

### function_result

Result from a function execution.

```json
{
  "tool_use_id": "toolu_01ABC123",
  "name": "search_workout_library",
  "result": "Found these workouts:\n1. Leg Day (ID: w1)\n2. Lower Body Blast (ID: w2)"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `tool_use_id` | string | Matches the `id` from `function_call` |
| `name` | string | Function name |
| `result` | string | Function output (may be JSON string for structured data) |

**Special Results:**

Navigation results are JSON:
```json
{
  "tool_use_id": "toolu_01XYZ",
  "name": "navigate_to_page",
  "result": "{\"action\": \"navigate\", \"page\": \"library\"}"
}
```

Error results:
```json
{
  "tool_use_id": "toolu_01ERR",
  "name": "search_workout_library",
  "result": "{\"error\": true, \"code\": \"execution_error\", \"message\": \"Unable to connect to the service.\"}"
}
```

---

### message_end

Sent when the response is complete. Contains usage statistics.

```json
{
  "session_id": "sess_abc123def456",
  "tokens_used": 1245,
  "latency_ms": 2340
}
```

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Session identifier |
| `tokens_used` | integer | Total tokens (input + output) consumed |
| `latency_ms` | integer | Total response time in milliseconds |

---

### error

Sent when an error occurs. The stream ends after this event.

```json
{
  "type": "rate_limit_exceeded",
  "message": "Monthly message limit (50) reached. Upgrade for more.",
  "usage": 50,
  "limit": 50
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Error code (see [errors.md](./errors.md)) |
| `message` | string | Human-readable error message |
| Additional fields vary by error type |

---

## Event Sequence

### Typical Flow

```
message_start → content_delta* → message_end
```

### With Function Calls

```
message_start → content_delta* → function_call → function_result → content_delta* → message_end
```

### Error Flow

```
error (stream ends)
```

or

```
message_start → content_delta* → error (stream ends)
```

### AI Model Error Scenarios

**Rate Limit (Anthropic API busy):**
```
error: {"type": "rate_limit", "message": "AI service is busy..."}
```
Client should auto-retry after 2-5 seconds.

**API Error (service issue):**
```
error: {"type": "api_error", "message": "AI service error..."}
```
Client should offer retry button.

**Function Timeout:**
```
message_start → function_call → [30s timeout] → function_result (error) → content_delta* → message_end
```
Claude receives the error and explains it to the user.

**Function Call with Error Result:**
```
message_start → content_delta → function_call → function_result (with error JSON) → content_delta (Claude explains error) → message_end
```

Example function error result:
```json
{
  "tool_use_id": "toolu_01XYZ",
  "name": "search_workout_library",
  "result": "{\"error\": true, \"code\": \"execution_error\", \"message\": \"Unable to connect to the service.\"}"
}
```

---

## Client Implementation Guide

### React/TypeScript Example

```typescript
interface SSEEvent {
  event: string;
  data: string;
}

function useChatStream() {
  const [response, setResponse] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (message: string) => {
    setIsLoading(true);
    setResponse('');

    const response = await fetch('/chat/stream', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, session_id: sessionId }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const events = parseSSE(chunk);

      for (const event of events) {
        switch (event.event) {
          case 'message_start':
            setSessionId(JSON.parse(event.data).session_id);
            break;
          case 'content_delta':
            setResponse(prev => prev + JSON.parse(event.data).text);
            break;
          case 'function_call':
            // Show loading indicator for function
            break;
          case 'function_result':
            // Handle function result (e.g., navigation)
            break;
          case 'error':
            throw new Error(JSON.parse(event.data).message);
        }
      }
    }

    setIsLoading(false);
  };

  return { response, sessionId, isLoading, sendMessage };
}
```

### Handling Navigation Events

```typescript
function handleFunctionResult(data: FunctionResult) {
  if (data.name === 'navigate_to_page') {
    try {
      const nav = JSON.parse(data.result);
      if (nav.action === 'navigate') {
        router.push(`/${nav.page}${nav.workout_id ? `/${nav.workout_id}` : ''}`);
      }
    } catch {
      // Not a navigation result
    }
  }
}
```

---

## Timeouts and Reconnection

- **Heartbeat:** The server sends a heartbeat ping every 30 seconds to keep the connection alive
- **Client timeout:** Recommended 60 second timeout for idle connections
- **Reconnection:** If disconnected, create a new request (SSE does not support resumption)

## Response Headers

The SSE endpoint sets these headers:

```http
Content-Type: text/event-stream
Cache-Control: no-cache
X-Accel-Buffering: no
```

`X-Accel-Buffering: no` ensures nginx (used by Render) doesn't buffer the stream.
