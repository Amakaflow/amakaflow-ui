# Error Reference

This document covers all error types returned by the Chat API.

## SSE Error Events

When an error occurs during streaming, the server emits an `error` event and closes the connection.

### Error Event Structure

```json
{
  "type": "error_code",
  "message": "Human-readable error description",
  // Additional fields vary by error type
}
```

---

## Error Codes

### feature_disabled

The chat feature is not enabled for this user account.

```json
{
  "type": "feature_disabled",
  "message": "Chat is not available for your account. Please check back later."
}
```

**Cause:** User's feature flags don't include chat access (e.g., beta rollout).

**Resolution:** Contact support or wait for feature rollout.

---

### rate_limit_exceeded

User has reached their monthly message limit.

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
| `usage` | integer | Current message count |
| `limit` | integer | Monthly limit for user's tier |

**Cause:** User has sent their maximum allowed messages this month.

**Resolution:**
- Wait until the 1st of next month (UTC) for reset
- Upgrade to paid tier for higher limits

**Limits by Tier:**
| Tier | Limit |
|------|-------|
| Free | 50/month |
| Paid | 500/month |

---

### not_found

The requested chat session does not exist.

```json
{
  "type": "not_found",
  "message": "Chat session not found."
}
```

**Cause:** The `session_id` provided doesn't exist or belongs to another user.

**Resolution:**
- Omit `session_id` to start a new conversation
- Verify the session ID is correct

---

### internal_error

An unexpected server error occurred.

```json
{
  "type": "internal_error",
  "message": "Failed to create chat session."
}
```

**Cause:** Database error, service unavailability, or unexpected exception.

**Resolution:**
- Retry the request
- If persistent, contact support

---

## AI Model Errors

These errors originate from the Anthropic Claude API and are returned as SSE `error` events.

### rate_limit

The Anthropic API is rate-limiting requests (too many concurrent requests or tokens per minute).

```json
{
  "type": "rate_limit",
  "message": "AI service is busy. Please try again shortly."
}
```

**Cause:** Anthropic API returned `RateLimitError` (HTTP 429).

**Resolution:**
- Automatic retry with exponential backoff (client-side)
- Usually resolves within seconds

**Client Handling:**
```typescript
case 'rate_limit':
  // Show brief loading state, auto-retry after 2-5 seconds
  showTemporaryMessage("AI is busy, retrying...");
  setTimeout(() => retryMessage(), 3000);
  break;
```

---

### api_error

General Anthropic API error (service issues, invalid requests, content policy).

```json
{
  "type": "api_error",
  "message": "AI service error. Please try again."
}
```

**Causes:**
- Anthropic service outage or degradation
- Content policy violation (Claude refused the request)
- Invalid API request (internal bug)
- Model overloaded (HTTP 529)

**Resolution:**
- Retry once after a few seconds
- If persistent, check [Anthropic Status](https://status.anthropic.com)

**Content Policy Note:**

When Claude refuses a request due to content policy, it may manifest as:
- An `api_error` with generic message
- A normal response where Claude explains it cannot help

The system prompt instructs Claude to defer medical questions to healthcare professionals, which is a soft content boundary (not a hard refusal).

---

### Anthropic Error Mapping

The AI client maps Anthropic SDK exceptions to user-friendly errors:

| Anthropic Exception | Error Type | User Message |
|--------------------|------------|--------------|
| `RateLimitError` | `rate_limit` | "AI service is busy. Please try again shortly." |
| `APIError` | `api_error` | "AI service error. Please try again." |
| `AuthenticationError` | `api_error` | "AI service error. Please try again." |
| `PermissionDeniedError` | `api_error` | "AI service error. Please try again." |
| Other exceptions | `internal_error` | "An unexpected error occurred." |

**Source:** `backend/services/ai_client.py:135-152`

---

### Context Window Handling

Claude has a context window limit. The Chat API handles this by:

1. **Conversation history:** Only recent messages are loaded (implementation-specific)
2. **Max output tokens:** Capped at 4,096 tokens per response
3. **Message length:** User messages capped at 10,000 characters

If context is exceeded, Claude may:
- Summarize earlier parts of the conversation
- Return a truncated response
- Return an `api_error` (rare)

**Future Enhancement:** Consider implementing explicit context truncation with user notification.

---

### Graceful Degradation

When the AI service is completely unavailable:

| Duration | Behavior |
|----------|----------|
| < 30 seconds | Client auto-retry with backoff |
| 30s - 5 min | Show "AI temporarily unavailable" message |
| > 5 min | Suggest using app features directly (Library, Calendar) |

**Fallback Message Template:**
```
I'm having trouble connecting to the AI service right now.
You can browse your workouts in the Library tab or check your schedule in Calendar.
```

---

## HTTP Error Responses

For non-streaming endpoints or pre-stream errors.

### 401 Unauthorized

```json
{
  "detail": "Invalid or expired token"
}
```

**Causes:**
- Missing `Authorization` header
- Invalid JWT token
- Expired JWT token
- Invalid Clerk signature

**Resolution:** Obtain a fresh JWT from Clerk.

---

### 403 Forbidden

```json
{
  "detail": "Invalid internal API key"
}
```

**Causes:** (Internal endpoints only)
- Missing `X-Internal-Key` header
- Incorrect internal API key

**Resolution:** Verify the internal API key configuration.

---

### 422 Validation Error

```json
{
  "detail": [
    {
      "type": "string_too_short",
      "loc": ["body", "message"],
      "msg": "String should have at least 1 character",
      "input": ""
    }
  ]
}
```

**Causes:**
- Empty message
- Message exceeds 10,000 characters
- Invalid JSON body

**Resolution:** Fix the request body per the validation error.

---

### 503 Service Unavailable

```json
{
  "status": "not_ready",
  "service": "chat-api",
  "checks": {
    "supabase": "unavailable"
  }
}
```

**Causes:**
- Database connection failure
- Missing configuration
- Downstream service unavailable

**Resolution:** Check service health; wait for recovery.

---

## Function Error Responses

Errors returned within `function_result` events.

### unknown_function

```json
{
  "error": true,
  "code": "unknown_function",
  "message": "Unknown function 'invalid_function_name'"
}
```

**Cause:** Claude attempted to call a function that doesn't exist.

**Resolution:** This is typically an AI error; Claude will recover.

---

### validation_error

```json
{
  "error": true,
  "code": "validation_error",
  "message": "Missing required fields: workout_id and date are required."
}
```

**Cause:** Function was called with invalid or missing parameters.

**Resolution:** Claude will typically retry with correct parameters.

---

### execution_error

```json
{
  "error": true,
  "code": "execution_error",
  "message": "Unable to connect to the service."
}
```

**Possible Messages:**
- "The service is taking too long. Please try again."
- "Authentication error. Please try logging in again."
- "The requested item was not found."
- "Service error (500)"
- "Unable to connect to the service."

**Cause:** External service (mapper-api, calendar-api, ingestor-api) returned an error.

**Resolution:** Claude will explain the failure and suggest alternatives.

---

### generation_failed

```json
{
  "error": true,
  "code": "generation_failed",
  "message": "Couldn't generate workout from that description. Please try being more specific."
}
```

**Cause:** The AI workout generator couldn't create a workout from the description.

**Resolution:** Provide more specific workout requirements.

---

## Error Handling Best Practices

### Client-Side

```typescript
eventSource.addEventListener('error', (e) => {
  const data = JSON.parse(e.data);

  switch (data.type) {
    case 'rate_limit_exceeded':
      showUpgradeModal(data.limit);
      break;
    case 'feature_disabled':
      showFeatureDisabledBanner();
      break;
    case 'not_found':
      // Clear stale session, start fresh
      clearSessionId();
      retryMessage();
      break;
    case 'rate_limit':
      // AI service busy - auto-retry
      showTemporaryMessage("AI is busy, retrying...");
      setTimeout(() => retryMessage(), 3000);
      break;
    case 'api_error':
      // AI service error - offer retry
      showRetryButton("AI service error. Try again?");
      break;
    case 'internal_error':
      showRetryButton();
      break;
    default:
      showGenericError(data.message);
  }
});
```

### Retry Logic

```typescript
async function sendMessageWithRetry(message: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await sendMessage(message);
    } catch (error) {
      if (error.type === 'rate_limit_exceeded') {
        throw error; // Don't retry rate limits
      }
      if (attempt === maxRetries) {
        throw error;
      }
      await sleep(1000 * attempt); // Exponential backoff
    }
  }
}
```

### Displaying Errors

| Error Type | User Experience |
|------------|-----------------|
| `rate_limit_exceeded` | Show upgrade CTA with usage stats |
| `feature_disabled` | Explain feature is in beta/coming soon |
| `not_found` | Silently start new session |
| `rate_limit` | Brief "AI busy" message, auto-retry |
| `api_error` | "AI service error" with retry button |
| `internal_error` | "Something went wrong. Please try again." |
| Function errors | Let Claude's response explain the issue |

---

## Monitoring Errors

Errors are tracked in:

- **Sentry:** All 5xx errors and unexpected exceptions
- **Helicone:** LLM-specific errors (token limits, content policy)
- **Application logs:** Structured JSON logging with error codes

See [runbook.md](./runbook.md) for monitoring dashboards and alerting.
