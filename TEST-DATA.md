# Test Data Strategy

This document describes how test data is managed for the AmakaFlow automation framework.

## Principles

1. **Isolation**: Each test run should be independent and not affect other tests
2. **Determinism**: Tests should produce the same results with the same inputs
3. **Clean State**: Mobile tests use `clearState: true` to reset app state
4. **API Seeding**: Web/API tests can seed data via test endpoints

## Test Data Types

### 1. Static Test Fixtures

Located in `fixtures/` directory (if created):

```
fixtures/
├── test-user.json       # Test account credentials
├── test-workouts.json   # Sample workout definitions
└── test-completions.json # Sample completed workouts
```

### 2. Dynamic Test Data

Created at runtime via API calls to test endpoints:

```bash
# Seed test user
curl -X POST http://localhost:8005/test/seed/user \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "name": "Test User"}'

# Seed sample workouts
curl -X POST http://localhost:8005/test/seed/workouts \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user-id", "count": 5}'
```

### 3. App State (Mobile)

Maestro flows use `clearState: true` to ensure a fresh start:

```yaml
- launchApp:
    clearState: true
    stopApp: true
```

## Test Account

For tests requiring authentication:

| Field | Value |
|-------|-------|
| Email | `test@example.com` |
| Password | `${TEST_PASSWORD}` (from env) |
| User ID | `test-user-id` |

**Note**: Never commit actual credentials. Use environment variables.

## Data Requirements by Test Type

### Smoke Tests
- **No data required**: Tests only verify app launches and navigation works
- Uses `clearState: true` for clean environment

### Golden Path Tests
- **Optional data**: Some steps are marked `optional: true` because they depend on existing data
- Works both with and without test data

### API Contract Tests
- **No user data required**: Tests validate schema and structure
- Uses health endpoints and public OpenAPI specs

## Setting Up Test Data

### Option 1: Manual Seeding (Development)

```bash
# Before running tests
cd amakaflow-dev-workspace
./scripts/seed-test-data.sh  # If you create this script
```

### Option 2: API Seeding (CI)

Add to `run-full-suite.sh`:

```bash
# Seed test data if TEST_SEED is set
if [[ "${TEST_SEED:-false}" == "true" ]]; then
  echo "Seeding test data..."
  curl -sf http://localhost:8005/test/seed || echo "Seeding skipped"
fi
```

### Option 3: Maestro Setup Flow

Create a setup flow that runs before tests:

```yaml
# flows/shared/setup-test-data.yaml
appId: com.amakaflow.app
---
- launchApp:
    clearState: true
# Navigate to create sample data via app UI
# (not recommended - prefer API seeding)
```

## Data Cleanup

### After Smoke/Golden Tests
- `clearState: true` handles mobile app cleanup
- No database cleanup needed (tests are read-only)

### After Full Suite
```bash
# Optional cleanup
curl -X DELETE http://localhost:8005/test/cleanup
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `TEST_PASSWORD` | Password for test account | For auth tests |
| `TEST_SEED` | Enable data seeding | Optional |
| `TEST_USER_ID` | Override test user ID | Optional |

## Best Practices

1. **Don't depend on specific data** - Tests should handle empty lists gracefully
2. **Use `optional: true`** only for data-dependent steps, not core navigation
3. **Prefer API seeding** over manual setup
4. **Never use production data** in tests
5. **Clean up after destructive tests** (those that modify data)

## Adding Test Endpoints

To support test data seeding, add these endpoints to your APIs:

### Chat API (`/test/*`)

```python
# Only available in development/test environments
@router.post("/test/seed/user")
async def seed_test_user(data: TestUserData):
    # Create test user
    pass

@router.post("/test/seed/workouts")
async def seed_test_workouts(data: TestWorkoutData):
    # Create sample workouts
    pass

@router.delete("/test/cleanup")
async def cleanup_test_data():
    # Remove all test data
    pass
```

### Security

Test endpoints should:
- Only be available in `development` or `test` environments
- Require a test API key
- Never be deployed to production
