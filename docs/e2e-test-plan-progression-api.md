# E2E Test Plan: Progression API

**Date:** 2026-01-24
**Scope:** Progression API TypeScript Client (amakaflow-ui) + mapper-api endpoints
**Ticket Reference:** AMA-480

---

## 1. Overview

This document outlines the E2E testing strategy for the Progression API, which provides exercise history, personal records, last weight, and volume analytics features. The API client in `amakaflow-ui` connects to `mapper-api` (port 8001).

### Current Test Coverage

| Layer | Tests | Location |
|-------|-------|----------|
| Unit Tests | 42 | `/src/lib/__tests__/progression-api.test.ts` |
| Hook Integration | 32 | `/src/hooks/__tests__/useProgressionApi.test.tsx` |
| E2E / Contract | 0 | (this plan) |

### API Endpoints Under Test

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/progression/exercises` | GET | List exercises with user history |
| `/progression/exercises/{id}/history` | GET | Exercise session history with 1RM |
| `/progression/exercises/{id}/last-weight` | GET | Last weight used (companion app) |
| `/progression/records` | GET | Personal records (1RM, max weight, max reps) |
| `/progression/volume` | GET | Volume analytics by muscle group |

---

## 2. Critical User Journeys

### 2.1 Smoke Suite (PR Checks) - 5 tests, ~30 seconds

These tests validate core functionality and should run on every PR.

| ID | Journey | Priority | Description |
|----|---------|----------|-------------|
| SMOKE-01 | View Exercise List | P0 | User can see exercises they have performed |
| SMOKE-02 | View Exercise History | P0 | User can see session history for a specific exercise |
| SMOKE-03 | Get Last Weight | P0 | "Use Last Weight" feature works for active workout |
| SMOKE-04 | View Personal Records | P0 | User can see their PRs (1RM, max weight) |
| SMOKE-05 | API Health Check | P0 | All progression endpoints return 200 on health check |

### 2.2 Regression Suite (Nightly) - 25+ tests, ~5 minutes

Full coverage including edge cases, error handling, and performance.

**Exercise List Tests (5 tests)**
| ID | Test Case |
|----|-----------|
| REG-EX-01 | Returns exercises sorted by session count (most frequent first) |
| REG-EX-02 | Respects limit parameter |
| REG-EX-03 | Returns empty list for new user with no history |
| REG-EX-04 | Returns correct session counts |
| REG-EX-05 | Handles pagination correctly |

**Exercise History Tests (8 tests)**
| ID | Test Case |
|----|-----------|
| REG-HIST-01 | Returns sessions in reverse chronological order |
| REG-HIST-02 | Calculates estimated 1RM using Brzycki formula |
| REG-HIST-03 | Marks PR sets correctly with `is_pr: true` |
| REG-HIST-04 | Pagination with limit/offset works correctly |
| REG-HIST-05 | Returns 404 for unknown exercise ID |
| REG-HIST-06 | Validates exercise ID format (rejects invalid characters) |
| REG-HIST-07 | Returns all_time_best_1rm across all sessions |
| REG-HIST-08 | Handles exercise with only bodyweight sets (no 1RM) |

**Last Weight Tests (4 tests)**
| ID | Test Case |
|----|-----------|
| REG-LW-01 | Returns most recent weight from completed set |
| REG-LW-02 | Returns 404 when no weight history exists |
| REG-LW-03 | Ignores skipped sets when finding last weight |
| REG-LW-04 | Returns correct weight unit (lbs/kg) |

**Personal Records Tests (5 tests)**
| ID | Test Case |
|----|-----------|
| REG-PR-01 | Returns all record types by default |
| REG-PR-02 | Filters by record_type parameter |
| REG-PR-03 | Filters by exercise_id parameter |
| REG-PR-04 | Returns details with weight/reps used for 1RM calculation |
| REG-PR-05 | Returns empty records for new user |

**Volume Analytics Tests (5 tests)**
| ID | Test Case |
|----|-----------|
| REG-VOL-01 | Calculates volume correctly (weight * reps) |
| REG-VOL-02 | Groups by muscle group correctly |
| REG-VOL-03 | Respects date range filtering |
| REG-VOL-04 | Aggregates by granularity (daily/weekly/monthly) |
| REG-VOL-05 | Filters by specific muscle groups |

---

## 3. Contract Tests

Contract tests validate that the API response shapes match the TypeScript interfaces. These catch breaking changes when mapper-api is modified.

### 3.1 Contract Test File Structure

```
src/
  lib/
    __tests__/
      contracts/
        progression.contract.test.ts    # API response shape validation
        schemas/
          exercise-history.schema.ts    # JSON Schema for validation
          personal-records.schema.ts
          volume-analytics.schema.ts
```

### 3.2 Contract Test Implementation

```typescript
// src/lib/__tests__/contracts/progression.contract.test.ts

import { describe, it, expect, beforeAll } from 'vitest';
import Ajv from 'ajv';
import { exerciseHistorySchema } from './schemas/exercise-history.schema';

const ajv = new Ajv({ allErrors: true });

describe('Progression API Contract Tests', () => {
  const API_BASE = process.env.VITE_MAPPER_API_URL || 'http://localhost:8001';
  let authToken: string;

  beforeAll(async () => {
    // Get auth token from test user (see seeding strategy)
    authToken = await getTestUserToken();
  });

  describe('GET /progression/exercises/{id}/history', () => {
    it('response matches ExerciseHistory schema', async () => {
      const response = await fetch(
        `${API_BASE}/progression/exercises/barbell-bench-press/history`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      expect(response.ok).toBe(true);
      const data = await response.json();

      const validate = ajv.compile(exerciseHistorySchema);
      const valid = validate(data);

      if (!valid) {
        console.error('Schema validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
    });

    it('response transforms correctly to TypeScript types', async () => {
      const response = await fetch(
        `${API_BASE}/progression/exercises/barbell-bench-press/history`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      const data = await response.json();

      // Verify snake_case fields exist (API contract)
      expect(data).toHaveProperty('exercise_id');
      expect(data).toHaveProperty('exercise_name');
      expect(data).toHaveProperty('supports_1rm');
      expect(data).toHaveProperty('one_rm_formula');
      expect(data).toHaveProperty('total_sessions');
      expect(data).toHaveProperty('all_time_best_1rm');

      // Verify sessions structure
      if (data.sessions.length > 0) {
        const session = data.sessions[0];
        expect(session).toHaveProperty('completion_id');
        expect(session).toHaveProperty('workout_date');
        expect(session).toHaveProperty('session_best_1rm');

        if (session.sets.length > 0) {
          const set = session.sets[0];
          expect(set).toHaveProperty('set_number');
          expect(set).toHaveProperty('weight');
          expect(set).toHaveProperty('weight_unit');
          expect(set).toHaveProperty('estimated_1rm');
          expect(set).toHaveProperty('is_pr');
        }
      }
    });
  });

  // Similar tests for other endpoints...
});
```

### 3.3 JSON Schema Definitions

```typescript
// src/lib/__tests__/contracts/schemas/exercise-history.schema.ts

export const setDetailSchema = {
  type: 'object',
  properties: {
    set_number: { type: 'integer' },
    weight: { type: ['number', 'null'] },
    weight_unit: { type: 'string' },
    reps_completed: { type: ['integer', 'null'] },
    reps_planned: { type: ['integer', 'null'] },
    status: { type: 'string' },
    estimated_1rm: { type: ['number', 'null'] },
    is_pr: { type: 'boolean' },
  },
  required: ['set_number', 'weight_unit', 'status', 'is_pr'],
};

export const sessionSchema = {
  type: 'object',
  properties: {
    completion_id: { type: 'string' },
    workout_date: { type: 'string' },
    workout_name: { type: ['string', 'null'] },
    exercise_name: { type: 'string' },
    sets: { type: 'array', items: setDetailSchema },
    session_best_1rm: { type: ['number', 'null'] },
    session_max_weight: { type: ['number', 'null'] },
    session_total_volume: { type: ['number', 'null'] },
  },
  required: ['completion_id', 'workout_date', 'exercise_name', 'sets'],
};

export const exerciseHistorySchema = {
  type: 'object',
  properties: {
    exercise_id: { type: 'string' },
    exercise_name: { type: 'string' },
    supports_1rm: { type: 'boolean' },
    one_rm_formula: { type: 'string' },
    sessions: { type: 'array', items: sessionSchema },
    total_sessions: { type: 'integer' },
    all_time_best_1rm: { type: ['number', 'null'] },
    all_time_max_weight: { type: ['number', 'null'] },
  },
  required: [
    'exercise_id',
    'exercise_name',
    'supports_1rm',
    'one_rm_formula',
    'sessions',
    'total_sessions',
  ],
};
```

---

## 4. Test Data Seeding Strategy

### 4.1 Seeding Approaches

| Approach | When to Use | Pros | Cons |
|----------|-------------|------|------|
| **Database Seeding** | Contract tests, nightly E2E | Deterministic, fast | Requires DB access |
| **API Seeding** | E2E tests | Works through auth | Slower, less control |
| **Mock Server** | CI without mapper-api | Fast, isolated | Less realistic |

### 4.2 Database Seeding (Recommended for Contract/E2E)

Create a seed script that runs before E2E tests:

```sql
-- supabase/seed/progression-e2e-seed.sql

-- Test user profile (matches Clerk test user)
INSERT INTO profiles (id, clerk_user_id, email, display_name)
VALUES (
  'e2e-test-user-001',
  'user_e2e_test_progression',
  'e2e-progression@test.amakaflow.com',
  'E2E Progression Test User'
) ON CONFLICT (clerk_user_id) DO NOTHING;

-- Seed workout completions with exercise history
INSERT INTO workout_completions (id, profile_id, workout_id, completed_at, execution_log)
VALUES
  ('comp-e2e-001', 'e2e-test-user-001', 'workout-001', '2026-01-15 10:00:00', '{
    "exercises": [
      {
        "exercise_id": "barbell-bench-press",
        "exercise_name": "Barbell Bench Press",
        "muscle_group": "chest",
        "sets": [
          {"set_number": 1, "weight": 135, "weight_unit": "lbs", "reps_completed": 10, "status": "completed"},
          {"set_number": 2, "weight": 155, "weight_unit": "lbs", "reps_completed": 8, "status": "completed"},
          {"set_number": 3, "weight": 175, "weight_unit": "lbs", "reps_completed": 6, "status": "completed"}
        ]
      }
    ]
  }'::jsonb),
  ('comp-e2e-002', 'e2e-test-user-001', 'workout-002', '2026-01-12 10:00:00', '{
    "exercises": [
      {
        "exercise_id": "barbell-bench-press",
        "exercise_name": "Barbell Bench Press",
        "muscle_group": "chest",
        "sets": [
          {"set_number": 1, "weight": 135, "weight_unit": "lbs", "reps_completed": 8, "status": "completed"}
        ]
      },
      {
        "exercise_id": "barbell-squat",
        "exercise_name": "Barbell Squat",
        "muscle_group": "legs",
        "sets": [
          {"set_number": 1, "weight": 225, "weight_unit": "lbs", "reps_completed": 5, "status": "completed"}
        ]
      }
    ]
  }'::jsonb);
```

### 4.3 Test Fixtures Module

```typescript
// src/test/fixtures/progression-e2e.fixtures.ts

export const E2E_TEST_USER = {
  clerkUserId: 'user_e2e_test_progression',
  email: 'e2e-progression@test.amakaflow.com',
  profileId: 'e2e-test-user-001',
};

export const SEEDED_EXERCISES = {
  benchPress: {
    exerciseId: 'barbell-bench-press',
    exerciseName: 'Barbell Bench Press',
    expectedSessionCount: 2,
  },
  squat: {
    exerciseId: 'barbell-squat',
    exerciseName: 'Barbell Squat',
    expectedSessionCount: 1,
  },
};

export const EXPECTED_RECORDS = {
  benchPress1RM: {
    exerciseId: 'barbell-bench-press',
    recordType: '1rm',
    // 175 lbs x 6 reps = ~203 lbs 1RM (Brzycki)
    expectedValue: 203,
    tolerance: 5,
  },
};
```

---

## 5. Recommended Test IDs and Selectors

### 5.1 Component Test IDs

Add these `data-testid` attributes to progression-related UI components:

```typescript
// Exercise List Component
<div data-testid="progression-exercise-list">
  {exercises.map(ex => (
    <div
      key={ex.exerciseId}
      data-testid={`exercise-item-${ex.exerciseId}`}
      data-exercise-id={ex.exerciseId}
    >
      <span data-testid="exercise-name">{ex.exerciseName}</span>
      <span data-testid="session-count">{ex.sessionCount}</span>
    </div>
  ))}
</div>

// Exercise History Component
<div data-testid="progression-history">
  <h2 data-testid="exercise-title">{history.exerciseName}</h2>
  <span data-testid="all-time-1rm">{history.allTimeBest1Rm}</span>

  {history.sessions.map(session => (
    <div
      key={session.completionId}
      data-testid={`session-${session.completionId}`}
    >
      <span data-testid="workout-date">{session.workoutDate}</span>
      {session.sets.map(set => (
        <div
          key={set.setNumber}
          data-testid={`set-${set.setNumber}`}
          data-is-pr={set.isPr}
        >
          <span data-testid="weight">{set.weight}</span>
          <span data-testid="reps">{set.repsCompleted}</span>
          {set.isPr && <span data-testid="pr-badge">PR</span>}
        </div>
      ))}
    </div>
  ))}
</div>

// Personal Records Component
<div data-testid="progression-records">
  {records.map(record => (
    <div
      key={`${record.exerciseId}-${record.recordType}`}
      data-testid={`record-${record.exerciseId}-${record.recordType}`}
    >
      <span data-testid="record-value">{record.value}</span>
      <span data-testid="record-unit">{record.unit}</span>
    </div>
  ))}
</div>

// Last Weight Display
<div data-testid="last-weight-display">
  <span data-testid="last-weight-value">{lastWeight.weight}</span>
  <span data-testid="last-weight-unit">{lastWeight.weightUnit}</span>
</div>

// Loading States
<div data-testid="progression-loading-skeleton" />
<div data-testid="progression-error-message" />
<div data-testid="progression-empty-state" />
```

### 5.2 Selector Best Practices

```typescript
// DO: Use specific test IDs
await page.getByTestId('exercise-item-barbell-bench-press').click();
await expect(page.getByTestId('all-time-1rm')).toHaveText('203 lbs');

// DO: Use data attributes for dynamic elements
await page.locator('[data-exercise-id="barbell-squat"]').click();
await page.locator('[data-is-pr="true"]').first().waitFor();

// DON'T: Rely on CSS classes (can change with styling)
// await page.locator('.exercise-card').click();

// DON'T: Use text content that may change
// await page.locator('text=Barbell Bench Press').click();

// DON'T: Use index-based selectors (fragile)
// await page.locator('.set-row').nth(2).click();
```

---

## 6. Flake-Proof Patterns

### 6.1 Explicit Waits (No Arbitrary Sleeps)

```typescript
// BAD: Arbitrary sleep
await page.waitForTimeout(2000);
await expect(page.getByTestId('exercise-list')).toBeVisible();

// GOOD: Wait for specific condition
await page.getByTestId('exercise-list').waitFor({ state: 'visible' });

// GOOD: Wait for loading to complete
await page.getByTestId('progression-loading-skeleton').waitFor({ state: 'detached' });
await expect(page.getByTestId('exercise-list')).toBeVisible();

// GOOD: Wait for network idle after navigation
await Promise.all([
  page.waitForResponse(resp => resp.url().includes('/progression/exercises')),
  page.goto('/progression'),
]);
```

### 6.2 Network Request Interception

```typescript
// Wait for specific API response before asserting
const responsePromise = page.waitForResponse(
  resp => resp.url().includes('/progression/exercises/barbell-bench-press/history')
);
await page.getByTestId('exercise-item-barbell-bench-press').click();
const response = await responsePromise;
expect(response.status()).toBe(200);
```

### 6.3 Retry Patterns for API Tests

```typescript
// Use Vitest retry for flaky network conditions
describe('Progression API E2E', () => {
  it('fetches exercise history', { retry: 2 }, async () => {
    const response = await progressionApi.getExerciseHistory({
      exerciseId: 'barbell-bench-press',
    });
    expect(response.sessions.length).toBeGreaterThan(0);
  });
});
```

### 6.4 Deterministic Test Data

```typescript
// Use fixed dates in seeds, not relative dates
const SEED_DATES = {
  session1: '2026-01-15T10:00:00Z', // Fixed
  session2: '2026-01-12T10:00:00Z',
};

// BAD: Relative dates cause flakes
// const today = new Date().toISOString();
```

---

## 7. CI/CD Configuration

### 7.1 Test Commands

```json
// package.json additions
{
  "scripts": {
    "test:e2e": "vitest run --config vitest.e2e.config.ts",
    "test:e2e:smoke": "vitest run --config vitest.e2e.config.ts --grep '@smoke'",
    "test:contracts": "vitest run --config vitest.e2e.config.ts --grep '@contract'",
    "test:e2e:ci": "vitest run --config vitest.e2e.config.ts --reporter=junit --outputFile=test-results/e2e.xml"
  }
}
```

### 7.2 Vitest E2E Configuration

```typescript
// vitest.e2e.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.e2e.test.ts', 'src/**/*.contract.test.ts'],
    testTimeout: 30000, // 30s for E2E
    hookTimeout: 60000, // 60s for setup/teardown
    retry: 1, // Retry once for network flakes
    pool: 'forks', // Isolate tests
    poolOptions: {
      forks: {
        singleFork: true, // Sequential for E2E
      },
    },
    env: {
      VITE_MAPPER_API_URL: 'http://localhost:8001',
    },
    globalSetup: './src/test/e2e-global-setup.ts',
    setupFiles: './src/test/e2e-setup.ts',
  },
});
```

### 7.3 GitHub Actions Workflow

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *' # Nightly at 2 AM

jobs:
  smoke-tests:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start services
        run: docker-compose up -d mapper-api

      - name: Wait for API
        run: |
          timeout 60 bash -c 'until curl -s http://localhost:8001/health; do sleep 2; done'

      - name: Seed test data
        run: npx supabase db reset --db-url ${{ secrets.SUPABASE_DB_URL }}

      - name: Run smoke tests
        run: npm run test:e2e:smoke
        env:
          VITE_MAPPER_API_URL: http://localhost:8001

  nightly-regression:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start full stack
        run: docker-compose --profile full up -d

      - name: Wait for services
        run: ./scripts/wait-for-services.sh

      - name: Seed test data
        run: npm run db:seed:e2e

      - name: Run full E2E suite
        run: npm run test:e2e:ci

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: e2e-results
          path: test-results/
```

---

## 8. Anti-Patterns to Avoid

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| `await page.waitForTimeout(2000)` | Arbitrary wait, wastes time or flakes | Use explicit waits for elements/network |
| Shared mutable test data | Tests interfere with each other | Isolate data per test or use transactions |
| Testing internal implementation | Brittle to refactoring | Test behavior through public APIs |
| Hardcoded localhost URLs | Breaks in CI | Use environment variables |
| `expect(array.length).toBe(3)` | Flaky if seed data changes | Use `.toBeGreaterThan(0)` or known fixtures |
| CSS class selectors | Break with styling changes | Use `data-testid` attributes |
| Testing auth flow in every test | Slow, redundant | Use shared auth setup, test auth separately |
| Console.log debugging | Pollutes output | Use proper test reporters |

---

## 9. File Locations Summary

| File | Purpose |
|------|---------|
| `/src/lib/__tests__/contracts/progression.contract.test.ts` | Contract tests |
| `/src/lib/__tests__/contracts/schemas/*.schema.ts` | JSON schemas |
| `/src/test/e2e/progression.e2e.test.ts` | Full E2E tests |
| `/src/test/fixtures/progression-e2e.fixtures.ts` | Test fixtures |
| `/src/test/e2e-global-setup.ts` | Global setup (seeding) |
| `/src/test/e2e-setup.ts` | Per-file setup |
| `/vitest.e2e.config.ts` | E2E Vitest config |
| `/supabase/seed/progression-e2e-seed.sql` | Database seed script |

---

## 10. Implementation Priority

### Phase 1: Foundation (Week 1)
1. Add `data-testid` attributes to progression components
2. Create contract test schemas
3. Set up E2E Vitest configuration
4. Create database seed script

### Phase 2: Smoke Suite (Week 2)
1. Implement 5 smoke tests
2. Add to PR workflow
3. Document test maintenance procedures

### Phase 3: Full Regression (Week 3)
1. Implement remaining 20+ regression tests
2. Set up nightly workflow
3. Add Slack notifications for failures

---

## Appendix: Example E2E Test File

```typescript
// src/test/e2e/progression.e2e.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { progressionApi, ProgressionApiClient } from '../../lib/progression-api';
import { E2E_TEST_USER, SEEDED_EXERCISES, EXPECTED_RECORDS } from '../fixtures/progression-e2e.fixtures';
import { seedProgressionData, cleanupProgressionData } from '../helpers/e2e-seed';

describe('Progression API E2E', () => {
  let client: ProgressionApiClient;

  beforeAll(async () => {
    await seedProgressionData();
    client = new ProgressionApiClient(process.env.VITE_MAPPER_API_URL);
  });

  afterAll(async () => {
    await cleanupProgressionData();
  });

  describe('@smoke Exercise List', () => {
    it('SMOKE-01: returns exercises user has performed', async () => {
      const result = await client.getExercisesWithHistory();

      expect(result.exercises.length).toBeGreaterThan(0);
      expect(result.total).toBe(result.exercises.length);

      const benchPress = result.exercises.find(
        e => e.exerciseId === SEEDED_EXERCISES.benchPress.exerciseId
      );
      expect(benchPress).toBeDefined();
      expect(benchPress?.sessionCount).toBe(
        SEEDED_EXERCISES.benchPress.expectedSessionCount
      );
    });
  });

  describe('@smoke Exercise History', () => {
    it('SMOKE-02: returns session history with 1RM calculations', async () => {
      const result = await client.getExerciseHistory({
        exerciseId: SEEDED_EXERCISES.benchPress.exerciseId,
      });

      expect(result.exerciseId).toBe(SEEDED_EXERCISES.benchPress.exerciseId);
      expect(result.sessions.length).toBeGreaterThan(0);
      expect(result.supports1Rm).toBe(true);
      expect(result.allTimeBest1Rm).toBeGreaterThan(0);

      // Verify session structure
      const session = result.sessions[0];
      expect(session.sets.length).toBeGreaterThan(0);
      expect(session.sets[0]).toHaveProperty('estimated1Rm');
    });
  });

  describe('@smoke Last Weight', () => {
    it('SMOKE-03: returns last weight for exercise', async () => {
      const result = await client.getLastWeight(
        SEEDED_EXERCISES.benchPress.exerciseId
      );

      expect(result.exerciseId).toBe(SEEDED_EXERCISES.benchPress.exerciseId);
      expect(result.weight).toBeGreaterThan(0);
      expect(result.weightUnit).toBe('lbs');
    });
  });

  describe('@smoke Personal Records', () => {
    it('SMOKE-04: returns personal records', async () => {
      const result = await client.getPersonalRecords();

      expect(result.records.length).toBeGreaterThan(0);

      const benchPr = result.records.find(
        r =>
          r.exerciseId === EXPECTED_RECORDS.benchPress1RM.exerciseId &&
          r.recordType === '1rm'
      );
      expect(benchPr).toBeDefined();
      expect(benchPr?.value).toBeCloseTo(
        EXPECTED_RECORDS.benchPress1RM.expectedValue,
        EXPECTED_RECORDS.benchPress1RM.tolerance
      );
    });
  });

  describe('@contract Response Shapes', () => {
    it('exercise history response matches TypeScript interface', async () => {
      const result = await client.getExerciseHistory({
        exerciseId: SEEDED_EXERCISES.benchPress.exerciseId,
      });

      // Type-level validation (compile-time)
      const typed: ExerciseHistory = result;

      // Runtime validation of required fields
      expect(typeof result.exerciseId).toBe('string');
      expect(typeof result.exerciseName).toBe('string');
      expect(typeof result.supports1Rm).toBe('boolean');
      expect(typeof result.oneRmFormula).toBe('string');
      expect(Array.isArray(result.sessions)).toBe(true);
      expect(typeof result.totalSessions).toBe('number');
    });
  });
});
```
