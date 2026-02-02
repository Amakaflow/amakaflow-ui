# Smoke Test Suite

Quick validation suite designed to run in under 2 minutes. Covers critical paths only.

## Purpose

Run this suite:
- Before deploying to staging/production
- After infrastructure changes
- As a quick sanity check during development
- In CI/CD pipelines for fast feedback

---

## Scenario: All Services Are Running

### Step 1: Check Chat API
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8005/health --max-time 5 || echo "FAILED"`
- **Expected**: Returns healthy status
- **Timeout**: 5s

### Step 2: Check Mapper API
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8001/health --max-time 5 || echo "FAILED"`
- **Expected**: Returns healthy status
- **Timeout**: 5s

### Step 3: Check Calendar API
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8003/health --max-time 5 || echo "FAILED"`
- **Expected**: Returns healthy status
- **Timeout**: 5s

### Step 4: Check Workout Ingestor API
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8004/health --max-time 5 || echo "FAILED"`
- **Expected**: Returns healthy status
- **Timeout**: 5s

---

## Scenario: UI Loads Successfully

### Step 1: Navigate to homepage
- **Tool**: Browser
- **Action**: open http://localhost:3000
- **Wait**: networkidle
- **Timeout**: 30s
- **Screenshot**: smoke-homepage.png

### Step 2: Verify no critical errors
- **Tool**: Browser
- **Action**: console
- **Expected**: No ERROR level messages, no uncaught exceptions

### Step 3: Verify main content renders
- **Tool**: Browser
- **Action**: wait body
- **Expected**: Body element has content (not blank page)
- **Screenshot**: smoke-content.png

---

## Scenario: Chat API Responds

### Step 1: Verify Chat API OpenAPI spec
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8005/openapi.json --max-time 5 | jq -e '.info.title'`
- **Expected**: Returns API title

### Step 2: Verify readiness endpoint
- **Tool**: Exec
- **Action**: `curl -sf http://localhost:8005/health/ready --max-time 5`
- **Expected**: HTTP 200

---

## Scenario: Frontend-Backend Connection

### Step 1: Load UI
- **Tool**: Browser
- **Action**: open http://localhost:3000
- **Wait**: networkidle
- **Screenshot**: smoke-fe-be-start.png

### Step 2: Check network requests succeeded
- **Tool**: Browser
- **Action**: console
- **Expected**: No network errors to localhost:800x endpoints

### Step 3: Final state capture
- **Tool**: Browser
- **Action**: screenshot smoke-fe-be-final.png
- **Expected**: Page in stable state

---

## Timing Budget

| Scenario | Max Duration |
|----------|--------------|
| All Services Running | 20s |
| UI Loads Successfully | 45s |
| Chat API Responds | 15s |
| Frontend-Backend Connection | 30s |
| **Total** | **< 2 minutes** |

---

## Pass Criteria

For the smoke suite to PASS:
1. All 4 API health checks return HTTP 200
2. UI loads without JavaScript errors
3. Chat API OpenAPI spec is accessible
4. No console errors indicating broken frontend-backend connection

## Failure Actions

If smoke suite fails:
1. Check which specific scenario failed
2. Review artifacts/screenshots for visual context
3. Check artifacts/logs for detailed error messages
4. Do NOT proceed with deployment until smoke passes

---

## Quick Reference

```bash
# Run smoke suite
./scripts/run-full-suite.sh smoke

# Expected output on success:
# PASS: All Services Running (4/4)
# PASS: UI Loads Successfully (3/3)
# PASS: Chat API Responds (2/2)
# PASS: Frontend-Backend Connection (3/3)
#
# SMOKE SUITE: PASSED (12/12 steps)
# Duration: 1m 23s
```
