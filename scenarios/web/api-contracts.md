# API Contract Scenarios

Validate API endpoints return expected response shapes and status codes.

## Prerequisites

- All API services must be healthy
- Tests do not require authentication (public endpoints only)
- Tests validate response structure, not business logic

---

## Scenario: Chat API Contracts

### Step 1: Health endpoint returns expected shape
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8005/health`
- **Expected**:
  ```json
  {
    "status": "healthy"
  }
  ```
- **Validation**: Response has `status` field

### Step 2: Readiness endpoint returns dependencies
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8005/health/ready`
- **Expected**: HTTP 200 with JSON body
- **Validation**: Response indicates service readiness

### Step 3: OpenAPI spec is valid JSON
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8005/openapi.json | jq -e '.openapi'`
- **Expected**: Returns OpenAPI version string (e.g., "3.1.0")

### Step 4: API has expected endpoints documented
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8005/openapi.json | jq -e '.paths | keys[]' | head -10`
- **Expected**: Lists endpoint paths including `/health`, `/chat`

---

## Scenario: Mapper API Contracts

### Step 1: Health endpoint returns expected shape
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8001/health`
- **Expected**: HTTP 200 with healthy status

### Step 2: OpenAPI spec is valid
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8001/openapi.json | jq -e '.openapi'`
- **Expected**: Returns OpenAPI version string

### Step 3: API documents mapping endpoints
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8001/openapi.json | jq -e '.paths | keys[]'`
- **Expected**: Lists available endpoints

---

## Scenario: Calendar API Contracts

### Step 1: Health endpoint returns expected shape
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8003/health`
- **Expected**: HTTP 200 with healthy status

### Step 2: OpenAPI spec is valid
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8003/openapi.json | jq -e '.openapi'`
- **Expected**: Returns OpenAPI version string

### Step 3: API documents calendar endpoints
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8003/openapi.json | jq -e '.paths | keys[]'`
- **Expected**: Lists available endpoints

---

## Scenario: Workout Ingestor API Contracts

### Step 1: Health endpoint returns expected shape
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8004/health`
- **Expected**: HTTP 200 with healthy status

### Step 2: OpenAPI spec is valid
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8004/openapi.json | jq -e '.openapi'`
- **Expected**: Returns OpenAPI version string

### Step 3: API documents ingestor endpoints
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8004/openapi.json | jq -e '.paths | keys[]'`
- **Expected**: Lists available endpoints including workout ingestion

---

## Scenario: CORS Headers Present

### Step 1: Chat API allows localhost origin
- **Tool**: Exec
- **Action**: `curl -sf -I -X OPTIONS http://localhost:8005/health -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: GET" 2>&1 | grep -i "access-control"`
- **Expected**: Returns Access-Control-Allow-Origin header

### Step 2: Mapper API allows localhost origin
- **Tool**: Exec
- **Action**: `curl -sf -I -X OPTIONS http://localhost:8001/health -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: GET" 2>&1 | grep -i "access-control"`
- **Expected**: Returns Access-Control-Allow-Origin header

---

## Scenario: Error Response Format

### Step 1: Chat API returns proper 404
- **Tool**: Exec
- **Action**: `curl -s -w "\n%{http_code}" http://localhost:8005/nonexistent-endpoint`
- **Expected**: HTTP 404 with JSON error body

### Step 2: Verify error has expected shape
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8005/nonexistent-endpoint 2>&1 || true`
- **Expected**: Response contains `detail` or `error` field

---

## Contract Summary

| API | Health | OpenAPI | CORS |
|-----|--------|---------|------|
| Chat (8005) | /health, /health/ready | /openapi.json | Yes |
| Mapper (8001) | /health | /openapi.json | Yes |
| Calendar (8003) | /health | /openapi.json | Yes |
| Ingestor (8004) | /health | /openapi.json | Yes |

## Pass Criteria

- All health endpoints return HTTP 200
- All OpenAPI specs are valid JSON with `.openapi` field
- CORS headers present for localhost:3000 origin
- Error responses have consistent shape
