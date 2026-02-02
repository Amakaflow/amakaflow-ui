# Health Check Scenarios

Verify all AmakaFlow services are running and responding to health endpoints.

## Scenario: UI Service Health

### Step 1: Check UI is accessible
- **Tool**: Exec
- **Action**: `curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000 --max-time 5`
- **Expected**: HTTP status 200
- **Timeout**: 5s

### Step 2: Verify page loads in browser
- **Tool**: Browser
- **Action**: open http://localhost:3000
- **Wait**: networkidle
- **Expected**: Page loads without errors
- **Screenshot**: health-ui-loaded.png

---

## Scenario: Chat API Health

### Step 1: Basic health endpoint
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8005/health --max-time 5`
- **Expected**: HTTP 200, JSON response with `{"status": "healthy"}`

### Step 2: Readiness check
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8005/health/ready --max-time 5`
- **Expected**: HTTP 200, confirms dependencies are connected

### Step 3: OpenAPI schema accessible
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8005/openapi.json --max-time 5 | jq '.info.title'`
- **Expected**: Returns API title string

---

## Scenario: Mapper API Health

### Step 1: Health endpoint
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8001/health --max-time 5`
- **Expected**: HTTP 200, JSON response with healthy status

### Step 2: OpenAPI schema accessible
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8001/openapi.json --max-time 5 | jq '.info.title'`
- **Expected**: Returns API title string

---

## Scenario: Calendar API Health

### Step 1: Health endpoint
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8003/health --max-time 5`
- **Expected**: HTTP 200, JSON response with healthy status

### Step 2: OpenAPI schema accessible
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8003/openapi.json --max-time 5 | jq '.info.title'`
- **Expected**: Returns API title string

---

## Scenario: Workout Ingestor API Health

### Step 1: Health endpoint
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8004/health --max-time 5`
- **Expected**: HTTP 200, JSON response with healthy status

### Step 2: OpenAPI schema accessible
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8004/openapi.json --max-time 5 | jq '.info.title'`
- **Expected**: Returns API title string

---

## Summary

| Service | Port | Health Endpoint | Readiness Endpoint |
|---------|------|-----------------|-------------------|
| UI | 3000 | / (page load) | N/A |
| Chat API | 8005 | /health | /health/ready |
| Mapper API | 8001 | /health | N/A |
| Calendar API | 8003 | /health | N/A |
| Workout Ingestor | 8004 | /health | N/A |

## Pass Criteria

- All 5 services respond to health checks
- Response time < 5s for each
- No error-level console messages in UI
