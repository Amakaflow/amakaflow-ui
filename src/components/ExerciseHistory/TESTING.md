# Exercise History - E2E Testing Guide

This document provides guidance for E2E testing the Exercise History feature (AMA-481).

## Test File Location

- E2E Smoke Tests: `src/test/e2e/exercise-history-smoke.e2e.test.ts`
- Unit Tests: `src/components/ExerciseHistory/__tests__/`

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run smoke tests only (includes Exercise History)
npm run test:e2e:smoke

# Run with specific pattern
npm run test:e2e -- --testNamePattern='Exercise History'
```

## Recommended data-testid Attributes

To ensure stable E2E tests, add the following `data-testid` attributes to components:

### ExerciseHistory.tsx (Main Page)

```tsx
// Page container
<div data-testid="exercise-history-page">

// Page header
<h2 data-testid="exercise-history-title">Exercise History</h2>

// Error messages
<div data-testid="exercise-history-error-exercises">...</div>
<div data-testid="exercise-history-error-history">...</div>

// Empty states
<div data-testid="exercise-history-empty-no-exercises">...</div>
<div data-testid="exercise-history-empty-select-prompt">...</div>

// Stats cards container
<div data-testid="exercise-history-stats">...</div>

// Exercise name badge
<Badge data-testid="exercise-history-selected-exercise">...</Badge>
<Badge data-testid="exercise-history-1rm-badge">1RM Supported</Badge>
```

### ExerciseSelector.tsx

```tsx
// Trigger button
<Button data-testid="exercise-selector-trigger">...</Button>

// Popover content
<PopoverContent data-testid="exercise-selector-popover">

// Search input
<CommandInput data-testid="exercise-selector-search" />

// Empty state
<CommandEmpty data-testid="exercise-selector-empty">No exercises found.</CommandEmpty>

// Exercise items
<CommandItem data-testid={`exercise-selector-item-${exercise.exerciseId}`}>
```

### HistoryTable.tsx

```tsx
// Table container
<Table data-testid="history-table">

// Session rows (use completionId for uniqueness)
<TableRow data-testid={`session-row-${session.completionId}`}>

// Expand button
<Button data-testid={`session-expand-${session.completionId}`}>

// Set rows (expanded)
<TableRow data-testid={`set-row-${session.completionId}-${set.setNumber}`}>

// Empty state
<div data-testid="history-table-empty">No sessions in this date range</div>

// Loading skeleton
<div data-testid="history-table-loading">...</div>
```

### DateRangeFilter.tsx

```tsx
// Select trigger
<SelectTrigger data-testid="date-range-filter-trigger">

// Select content
<SelectContent data-testid="date-range-filter-content">

// Options
<SelectItem data-testid={`date-range-option-${option.value}`}>
```

### OneRmTrendChart.tsx

```tsx
// Chart container
<Card data-testid="1rm-trend-chart">

// Chart title
<CardTitle data-testid="1rm-trend-chart-title">1RM Trend</CardTitle>

// All-time best label
<span data-testid="1rm-trend-all-time-best">All-time best: {value} lbs</span>

// Empty state
<div data-testid="1rm-trend-empty">No 1RM data available</div>

// Loading state
<Skeleton data-testid="1rm-trend-loading" />
```

### StatsCards (in ExerciseHistory.tsx)

```tsx
// Individual stat cards
<Card data-testid="stat-card-all-time-1rm">
<Card data-testid="stat-card-max-weight">
<Card data-testid="stat-card-total-sessions">
<Card data-testid="stat-card-in-range">

// Values
<div data-testid="stat-value-all-time-1rm">{value}</div>
<div data-testid="stat-value-max-weight">{value}</div>
<div data-testid="stat-value-total-sessions">{value}</div>
<div data-testid="stat-value-in-range">{value}</div>
```

## Selector Strategy

For E2E tests, prefer selectors in this order:

1. **data-testid** - Most stable, won't break with UI changes
2. **Role + accessible name** - e.g., `getByRole('button', { name: 'Load More' })`
3. **Label text** - For form elements
4. **Text content** - Last resort, fragile to copy changes

## Waiting Strategies

### DO: Use explicit waits tied to data loading

```typescript
// Wait for loading to complete
await waitFor(() => !page.locator('[data-testid="history-table-loading"]').isVisible());

// Wait for content to appear
await page.waitForSelector('[data-testid="history-table"]');
```

### DON'T: Use arbitrary sleeps

```typescript
// BAD - Flaky and slow
await page.waitForTimeout(2000);
```

## Test Data Seeding

### Option 1: Pre-seeded Database (Recommended for CI)

Use the SQL seed file to populate test data before running E2E tests:

```sql
-- File: supabase/seed/progression-e2e-seed.sql

-- Create test user
INSERT INTO profiles (id, clerk_user_id, email, name)
VALUES ('e2e-test-user-001', 'user_e2e_test_progression', 'e2e@test.amakaflow.com', 'E2E Test User')
ON CONFLICT DO NOTHING;

-- Create workout completions with exercise history
INSERT INTO workout_completions (...)
...
```

### Option 2: API Mocking (for Isolated Tests)

Mock the API at the network boundary using MSW or similar:

```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const handlers = [
  http.get('*/progression/exercises', () => {
    return HttpResponse.json({
      exercises: MOCK_EXERCISES,
      total: MOCK_EXERCISES.length,
    });
  }),
  http.get('*/progression/exercises/:id/history', ({ params }) => {
    return HttpResponse.json(MOCK_EXERCISE_HISTORY);
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Option 3: Test Fixtures (for Unit/Integration Tests)

Use the existing fixtures for component-level tests:

```typescript
import { MOCK_EXERCISES, MOCK_EXERCISE_HISTORY } from './fixtures/exercise-history.fixtures';
```

## CI/CD Integration

### Smoke Suite (PR Checks)

Run on every PR - fast, critical paths only:

```yaml
- name: Run E2E Smoke Tests
  run: npm run test:e2e:smoke
```

### Regression Suite (Nightly)

Run full E2E suite nightly:

```yaml
- name: Run Full E2E Suite
  run: npm run test:e2e
  if: github.event_name == 'schedule'
```

## Common Flakiness Causes

1. **Race conditions** - Data loading not complete before assertion
2. **Animation timing** - Expand/collapse animations in HistoryTable
3. **Network variability** - API response time fluctuations
4. **State leakage** - Tests affecting each other's data

## Anti-Patterns to Avoid

1. Testing implementation details (internal state, component structure)
2. Using CSS selectors that depend on styling
3. Hardcoding specific dates (use relative dates or seeded data)
4. Testing third-party components (Recharts rendering)
5. Over-mocking (test real integration when possible)
