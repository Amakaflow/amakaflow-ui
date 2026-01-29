# Function Calling Reference

The Chat API uses Claude's function calling (tool use) capability to integrate with AmakaFlow services. This document covers the Phase 1 tools available for the AI assistant.

## Overview

When a user's message requires an action (searching, scheduling, generating), Claude will:

1. Emit a `function_call` event with the tool name
2. The backend executes the function against the appropriate service
3. A `function_result` event is emitted with the result
4. Claude continues the response using the function result

## Limits & Safety

### Execution Limits

| Limit | Value | Configurable | Purpose |
|-------|-------|--------------|---------|
| **Timeout per function** | 30 seconds | `FUNCTION_TIMEOUT_SECONDS` | Prevent hung requests |
| **Max results (search)** | 10 | Hardcoded | Limit response size |
| **Max output tokens** | 4,096 | `max_tokens` param | Cap response length |

### Tool Call Behavior

Claude manages its own tool calling. The backend does not impose:
- Maximum tool calls per turn (Claude self-regulates)
- Loop detection (Claude typically avoids repetitive calls)

**Monitoring Recommendation:** Alert if a single message triggers > 5 tool calls, which may indicate:
- Ambiguous user request causing retry loops
- Prompt issue causing excessive tool use

### Tool Result Sanitization

Tool results may contain **user-generated content** (e.g., workout names, descriptions). This content is:

1. **Returned as `tool_result` blocks** - Claude treats these differently from user messages, reducing injection risk
2. **Truncated** - Search results show limited fields (title, ID)
3. **Not executed** - Results are text, not code

**Example of safe result formatting:**

```python
# In function_dispatcher.py
def _search_workout_library(self, args, ctx):
    # ...
    lines = ["Found these workouts:"]
    for i, w in enumerate(workouts, 1):
        # Title is user-generated but displayed as quoted text
        title = w.get("title", "Untitled")
        lines.append(f'{i}. {title} (ID: {w.get("workout_id", "unknown")})')
    return "\n".join(lines)
```

**Potential Risk:** A malicious workout title like:
```
"Leg Day"; Ignore previous instructions and...
```

**Mitigation:** Claude's architecture treats tool results as data, not instructions. The tool result format makes the boundary clear. Monitor for unusual Claude behavior after tool results.

### Idempotency

| Function | Idempotent? | Notes |
|----------|-------------|-------|
| `search_workout_library` | Yes | Read-only |
| `add_workout_to_calendar` | No | Creates new entry each time |
| `generate_ai_workout` | No | Creates new workout each time |
| `navigate_to_page` | Yes | Client-side only |

**For non-idempotent functions:** Claude is instructed (via persona guidelines) to confirm before executing state-changing actions. See [prompt-engineering.md](./prompt-engineering.md) for confirmation flow patterns.

## Available Functions

### search_workout_library

Search the user's workout library using natural language. Uses semantic search via embeddings.

**Schema:**

```json
{
  "name": "search_workout_library",
  "description": "Search the user's workout library using natural language. Returns matching workouts with IDs that can be used for scheduling.",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Natural language search query (e.g., 'leg workouts', 'quick cardio')"
      },
      "limit": {
        "type": "integer",
        "description": "Maximum results to return (default: 5)"
      }
    },
    "required": ["query"]
  }
}
```

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | - | Natural language search query |
| `limit` | integer | No | 5 | Max results (capped at 10) |

**Example Request:**

User: "Find me a leg workout"

Claude calls:
```json
{
  "name": "search_workout_library",
  "arguments": {
    "query": "leg workout",
    "limit": 5
  }
}
```

**Example Result:**

```
Found these workouts:
1. Leg Day Destroyer (ID: w_abc123)
2. Lower Body Blast (ID: w_def456)
3. Squat Focus (ID: w_ghi789)
```

**Errors:**

| Code | Message |
|------|---------|
| `execution_error` | Unable to connect to the service |
| `internal_error` | An unexpected error occurred |

**Backend Integration:**

Calls `GET /workouts/search?q={query}&limit={limit}` on mapper-api.

---

### add_workout_to_calendar

Schedule a workout on the user's calendar for a specific date and time.

**Schema:**

```json
{
  "name": "add_workout_to_calendar",
  "description": "Schedule a workout on the user's calendar for a specific date and time.",
  "input_schema": {
    "type": "object",
    "properties": {
      "workout_id": {
        "type": "string",
        "description": "ID of the workout to schedule"
      },
      "date": {
        "type": "string",
        "description": "Date in ISO format (YYYY-MM-DD)"
      },
      "time": {
        "type": "string",
        "description": "Time in HH:MM format (optional)"
      },
      "recurrence": {
        "type": "string",
        "enum": ["daily", "weekly"],
        "description": "Recurring schedule (optional)"
      }
    },
    "required": ["workout_id", "date"]
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `workout_id` | string | Yes | Workout ID from search results |
| `date` | string | Yes | Date in YYYY-MM-DD format |
| `time` | string | No | Time in HH:MM format |
| `recurrence` | string | No | `daily` or `weekly` |

**Example Request:**

User: "Schedule that leg workout for tomorrow at 6am"

Claude calls:
```json
{
  "name": "add_workout_to_calendar",
  "arguments": {
    "workout_id": "w_abc123",
    "date": "2025-01-29",
    "time": "06:00"
  }
}
```

**Example Result:**

```
Added workout to calendar on 2025-01-29 at 06:00
```

**Errors:**

| Code | Message |
|------|---------|
| `validation_error` | Missing required fields: workout_id and date are required |
| `execution_error` | The requested item was not found |
| `execution_error` | Authentication error. Please try logging in again |

**Backend Integration:**

Calls `POST /calendar` on calendar-api with:
```json
{
  "workout_id": "...",
  "scheduled_date": "...",
  "scheduled_time": "..."
}
```

---

### generate_ai_workout

Generate a custom workout based on a natural language description.

**Schema:**

```json
{
  "name": "generate_ai_workout",
  "description": "Generate a custom workout based on a natural language description of what the user wants.",
  "input_schema": {
    "type": "object",
    "properties": {
      "description": {
        "type": "string",
        "description": "Natural language description of desired workout"
      },
      "duration_minutes": {
        "type": "integer",
        "description": "Target workout duration in minutes"
      },
      "equipment": {
        "type": "array",
        "items": {"type": "string"},
        "description": "Available equipment"
      },
      "difficulty": {
        "type": "string",
        "enum": ["beginner", "intermediate", "advanced"],
        "description": "Difficulty level"
      }
    },
    "required": ["description"]
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `description` | string | Yes | What kind of workout the user wants |
| `duration_minutes` | integer | No | Target duration |
| `equipment` | array | No | Available equipment list |
| `difficulty` | string | No | `beginner`, `intermediate`, or `advanced` |

**Example Request:**

User: "Create a 30 minute HIIT workout I can do at home with just dumbbells"

Claude calls:
```json
{
  "name": "generate_ai_workout",
  "arguments": {
    "description": "30 minute HIIT workout at home with dumbbells",
    "duration_minutes": 30,
    "equipment": ["dumbbells"],
    "difficulty": "intermediate"
  }
}
```

**Example Result:**

```
Generated workout: 30-Min Dumbbell HIIT Blast
```

**Errors:**

| Code | Message |
|------|---------|
| `generation_failed` | Couldn't generate workout from that description. Please try being more specific. |
| `execution_error` | The service is taking too long. Please try again. |

**Backend Integration:**

Calls `POST /workouts/parse-voice` on workout-ingestor-api with:
```json
{
  "transcription": "...",
  "difficulty": "...",
  "duration_minutes": 30,
  "equipment": ["dumbbells"]
}
```

---

### navigate_to_page

Navigate the user to a specific page in the app. This function returns a client-side instruction.

**Schema:**

```json
{
  "name": "navigate_to_page",
  "description": "Navigate the user to a specific page in the app.",
  "input_schema": {
    "type": "object",
    "properties": {
      "page": {
        "type": "string",
        "enum": ["home", "library", "calendar", "workout", "settings"],
        "description": "Target page"
      },
      "workout_id": {
        "type": "string",
        "description": "Workout ID (required when page='workout')"
      }
    },
    "required": ["page"]
  }
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | string | Yes | Target page name |
| `workout_id` | string | Conditional | Required when `page="workout"` |

**Valid Pages:**
- `home` - Dashboard
- `library` - Workout library
- `calendar` - Schedule view
- `workout` - Specific workout detail (requires `workout_id`)
- `settings` - User settings

**Example Request:**

User: "Take me to my calendar"

Claude calls:
```json
{
  "name": "navigate_to_page",
  "arguments": {
    "page": "calendar"
  }
}
```

**Example Result:**

```json
{"action": "navigate", "page": "calendar"}
```

**Client Handling:**

```typescript
const result = JSON.parse(functionResult.result);
if (result.action === 'navigate') {
  if (result.page === 'workout' && result.workout_id) {
    router.push(`/workout/${result.workout_id}`);
  } else {
    router.push(`/${result.page}`);
  }
}
```

**Errors:**

| Code | Message |
|------|---------|
| `validation_error` | Unknown page 'xyz'. Valid pages: home, library, calendar, workout, settings |

---

## Adding New Functions

To add a new function to the Chat API:

### 1. Define the Schema

Add the tool definition to `backend/services/tool_schemas.py`:

```python
{
    "name": "my_new_function",
    "description": "Clear description of what this function does",
    "input_schema": {
        "type": "object",
        "properties": {
            "param1": {
                "type": "string",
                "description": "Description of param1"
            }
        },
        "required": ["param1"]
    }
}
```

### 2. Implement the Handler

Add the handler method in `backend/services/function_dispatcher.py`:

```python
def _my_new_function(
    self, args: Dict[str, Any], ctx: FunctionContext
) -> str:
    """Implement your function logic."""
    param1 = args.get("param1", "")

    # Call external API
    result = self._call_api(
        "POST",
        f"{self._service_url}/endpoint",
        ctx,
        json={"param1": param1},
    )

    # Return human-readable result for Claude
    return f"Successfully processed: {param1}"
```

### 3. Register the Handler

Add the handler to the `_handlers` dict in `__init__`:

```python
self._handlers = {
    # ... existing handlers
    "my_new_function": self._my_new_function,
}
```

### 4. Add Service URL (if needed)

If calling a new service, add the URL to settings:

```python
# backend/settings.py
my_service_url: str = Field(
    default="http://localhost:8004",
    description="Base URL for my-service",
)
```

### 5. Update Documentation

Add the new function to this document with full schema, examples, and error codes.

---

## Error Handling

All functions return errors in a consistent format:

```json
{
  "error": true,
  "code": "error_code",
  "message": "User-friendly error message"
}
```

**Common Error Codes:**

| Code | Description |
|------|-------------|
| `unknown_function` | Function name not recognized |
| `validation_error` | Invalid or missing parameters |
| `execution_error` | External service error |
| `internal_error` | Unexpected error |
| `generation_failed` | AI generation failed |

Claude receives these error responses and will typically apologize and suggest alternatives.
