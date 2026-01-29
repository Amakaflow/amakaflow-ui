# Operations Runbook

This runbook covers deployment, monitoring, and incident response for the Chat API.

## Deployment

### Platform

Chat API is deployed on **Render** as a web service.

### Deployment Process

1. **Automatic:** Push to `main` branch triggers deployment
2. **Manual:** Use Render dashboard to trigger deploy

### Pre-Deployment Checklist

- [ ] All tests passing in CI
- [ ] Environment variables updated in Render (if changed)
- [ ] Database migrations applied (if any)
- [ ] Downstream services compatible with changes

### Rollback

1. Go to Render dashboard → chat-api service
2. Click "Deploys" tab
3. Find last known good deploy
4. Click "Redeploy"

### Zero-Downtime Deploys

Render handles rolling deploys automatically:
- New instance starts and passes health check
- Traffic shifts to new instance
- Old instance drains and terminates

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `ENVIRONMENT` | Runtime environment | Yes | `development` |
| `SUPABASE_URL` | Supabase project URL | Yes | - |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes | - |
| `CLERK_DOMAIN` | Clerk domain for JWT validation | Yes | - |
| `ANTHROPIC_API_KEY` | Anthropic API key | Yes | - |
| `OPENAI_API_KEY` | OpenAI API key (embeddings) | Yes | - |
| `HELICONE_API_KEY` | Helicone API key | No | - |
| `HELICONE_ENABLED` | Enable Helicone logging | No | `false` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | Yes | - |
| `SENTRY_DSN` | Sentry DSN | No | - |
| `RATE_LIMIT_FREE` | Free tier message limit | No | `50` |
| `RATE_LIMIT_PAID` | Paid tier message limit | No | `500` |
| `INTERNAL_API_KEY` | Service-to-service auth | Yes | - |
| `DEFAULT_MODEL` | Claude model ID | No | `claude-sonnet-4-20250514` |
| `MAPPER_API_URL` | mapper-api base URL | No | `http://localhost:8001` |
| `CALENDAR_API_URL` | calendar-api base URL | No | `http://localhost:8002` |
| `WORKOUT_INGESTOR_API_URL` | workout-ingestor-api base URL | No | `http://localhost:8003` |
| `FUNCTION_TIMEOUT_SECONDS` | External function call timeout | No | `30.0` |

### Secrets Management

- Store secrets in Render's environment variables (encrypted at rest)
- Never commit secrets to git
- Rotate keys quarterly or after any suspected compromise

## Monitoring

### Health Checks

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `GET /health` | Liveness probe | `{"status": "ok"}` |
| `GET /health/ready` | Readiness probe | `{"status": "ready"}` |

Render uses `/health` for load balancer health checks.

### Helicone (LLM Observability)

**Dashboard:** https://helicone.ai/dashboard

Monitor:
- Request volume and latency
- Token usage and costs
- Error rates by model
- User-level usage patterns

**Alerts to configure:**
- Error rate > 5%
- P95 latency > 10s
- Daily spend > threshold

### Sentry (Error Tracking)

**Dashboard:** https://sentry.io/organizations/amakaflow/

Configuration in `backend/main.py`:
```python
sentry_sdk.init(
    dsn=settings.sentry_dsn,
    environment=settings.environment,
    release=settings.render_git_commit,
    traces_sample_rate=0.1,
)
```

**Key Views:**
- Issues → New errors
- Performance → Slow endpoints
- Releases → Deploy impact

**Alerts configured:**
- New error types
- Error spike (> 10/hour)
- Performance regression

### Render Metrics

**Dashboard:** Render → chat-api → Metrics

Monitor:
- CPU usage
- Memory usage
- Request count
- Response time

### SSE Connection Monitoring

The service tracks active SSE connections:

```python
# In backend/main.py
_sse_connection_count = 0
```

Log warnings are emitted at thresholds:
- Warning: 150 connections
- Critical: 200 connections

## Incident Response

### Severity Levels

| Level | Definition | Response Time |
|-------|------------|---------------|
| P1 | Service down, all users affected | Immediate |
| P2 | Major feature broken, many users affected | 1 hour |
| P3 | Minor issue, workaround available | 24 hours |
| P4 | Low impact, cosmetic | Next sprint |

### Common Issues

#### High Error Rate in Claude API

**Symptoms:** `error` events in SSE, Helicone showing failures

**Diagnosis:**
1. Check Helicone for error details
2. Check Anthropic status page
3. Review recent prompt changes

**Resolution:**
- If Anthropic outage: Wait, consider fallback to OpenAI
- If prompt issue: Rollback prompt changes
- If rate limit: Implement request queuing

#### Database Connection Failures

**Symptoms:** `/health/ready` returning 503, "supabase unavailable"

**Diagnosis:**
1. Check Supabase dashboard for status
2. Verify connection string in env vars
3. Check for connection pool exhaustion

**Resolution:**
- If Supabase outage: Wait for recovery
- If config issue: Fix and redeploy
- If pool exhaustion: Restart service, investigate cause

#### High Latency

**Symptoms:** `message_end.latency_ms` > 5000, user complaints

**Diagnosis:**
1. Check Helicone for Claude latency
2. Check downstream service latency (mapper, calendar, ingestor)
3. Review function call patterns

**Resolution:**
- If Claude slow: Usually transient, may switch models
- If downstream slow: Investigate specific service
- If function timeout: Increase `FUNCTION_TIMEOUT_SECONDS`

#### Rate Limit Complaints

**Symptoms:** Users reporting "limit reached" unexpectedly

**Diagnosis:**
1. Query `chat_rate_limits` table in Supabase
2. Verify user's tier in feature flags
3. Check for duplicate requests

**Resolution:**
- If legitimate usage: Upgrade user or adjust limits
- If bug: Fix counting logic
- If abuse: Consider IP-based limits

### Escalation Path

1. On-call engineer (PagerDuty)
2. Engineering lead
3. CTO (P1 only)

### Post-Incident

1. Resolve incident
2. Update status page
3. Write incident report within 48 hours
4. Schedule post-mortem if P1/P2

## Cost Monitoring

### Anthropic Spend

- Track in Helicone dashboard
- Set budget alerts in Anthropic console
- Review token efficiency monthly

**Cost Optimization:**
- Use Claude Sonnet (not Opus) for most queries
- Limit conversation history length
- Cache common responses where appropriate

### OpenAI Spend (Embeddings)

- Monitor in OpenAI dashboard
- Batch embedding generation (off-peak)
- One-time cost per workout (cached in DB)

### Supabase Usage

- Monitor in Supabase dashboard
- Watch for query performance issues
- Index optimization as needed

## Model Upgrade Procedures

### Upgrading Claude Model

1. Update `DEFAULT_MODEL` in staging `.env`
2. Run test suite against staging
3. Monitor Helicone for quality/latency
4. A/B test with 10% of production traffic
5. If metrics acceptable, full rollout
6. Update `DEFAULT_MODEL` in production `.env`

### Rollback

1. Revert `DEFAULT_MODEL` to previous value
2. Redeploy
3. Verify in Helicone

## Graceful Shutdown

The service handles SIGTERM for graceful shutdown:

```python
# backend/main.py
@app.on_event("shutdown")
async def shutdown_event():
    # Wait up to 5s for SSE connections to drain
    ...
```

Render sends SIGTERM and waits 30s before SIGKILL.

## Scaling Considerations

### Current Limits

- Single Render instance
- ~200 concurrent SSE connections
- 50/500 messages per user per month

### Scaling Triggers

- SSE connection warnings in logs
- Response time degradation
- User growth milestones

### Scaling Options

1. **Vertical:** Upgrade Render instance size
2. **Horizontal:** Multiple instances (requires sticky sessions for SSE)
3. **Queue-based:** Add Redis for request queuing
