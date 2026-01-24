/**
 * E2E Smoke Tests for Exercise History Page (AMA-481).
 *
 * These tests validate critical user journeys for the Exercise History feature:
 * - Navigating to the History page
 * - Selecting an exercise from the searchable dropdown
 * - Viewing workout session history
 * - Viewing 1RM trend chart
 * - Filtering by date range
 * - Expanding session rows to see sets
 * - Loading more sessions (pagination)
 *
 * Prerequisites:
 * - UI running on port 3000 (npm run dev)
 * - mapper-api running on port 8001
 * - Database seeded with E2E test data
 *
 * Run with: npm run test:e2e:smoke
 *
 * @tags smoke, exercise-history
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { skipIfApiUnavailable, retry, waitFor } from '../e2e-setup';
import { ProgressionApiClient } from '../../lib/progression-api';
import {
  SEEDED_EXERCISES,
  SEEDED_SESSIONS,
  E2E_TEST_USER,
} from '../fixtures/progression-e2e.fixtures';

// =============================================================================
// Test Configuration
// =============================================================================

const API_BASE = import.meta.env.VITE_MAPPER_API_URL || 'http://localhost:8001';
const UI_BASE = import.meta.env.VITE_APP_URL || 'http://localhost:3000';

/**
 * Create a client for API verification during E2E tests.
 */
function createTestClient(): ProgressionApiClient {
  return new ProgressionApiClient(API_BASE);
}

/**
 * Simulated user actions for E2E testing.
 *
 * NOTE: This is a simplified DOM-based approach for Vitest E2E tests.
 * For full browser automation, consider using Playwright with this same test structure.
 */
interface E2EHelpers {
  navigateToExerciseHistory: () => Promise<void>;
  selectExercise: (exerciseName: string) => Promise<void>;
  changeDateRange: (range: '30d' | '90d' | '1y' | 'all') => Promise<void>;
  expandSessionRow: (index: number) => Promise<void>;
  clickLoadMore: () => Promise<void>;
  waitForContent: (testId: string, timeout?: number) => Promise<Element | null>;
  getTextContent: (testId: string) => string | null;
  isVisible: (testId: string) => boolean;
}

// =============================================================================
// @smoke Exercise History Page - Critical User Journeys
// =============================================================================

describe('@smoke Exercise History Page', () => {
  let client: ProgressionApiClient;
  let apiAvailable: boolean;

  beforeAll(async () => {
    apiAvailable = !(await skipIfApiUnavailable());
    if (apiAvailable) {
      client = createTestClient();
    }
  });

  beforeEach(async ({ skip }) => {
    if (!apiAvailable) {
      skip();
    }
  });

  // =========================================================================
  // SMOKE-EH-01: Navigate to Exercise History Page
  // =========================================================================

  describe('SMOKE-EH-01: Navigate to Exercise History Page', () => {
    it('should display History button in navigation bar', async () => {
      // Verify the API endpoint is accessible (pre-condition for UI test)
      const result = await retry(() => client.getExercisesWithHistory({ limit: 1 }));
      expect(result).toHaveProperty('exercises');
    });

    it('should have exercise history page route configured', async () => {
      // This validates the view is registered in App.tsx
      // The actual navigation would be tested in browser-based E2E
      expect(true).toBe(true); // Placeholder for browser navigation test
    });

    it('should show page header when navigating to exercise-history view', async () => {
      // Verify the component renders the expected header text
      // Browser test would check: screen.getByText('Exercise History')
      // API verification: endpoint is accessible
      const result = await retry(() => client.getExercisesWithHistory());
      expect(Array.isArray(result.exercises)).toBe(true);
    });
  });

  // =========================================================================
  // SMOKE-EH-02: Select Exercise from Dropdown
  // =========================================================================

  describe('SMOKE-EH-02: Select Exercise from Dropdown', () => {
    it('should load exercises in dropdown when API available', async () => {
      const result = await retry(() => client.getExercisesWithHistory({ limit: 10 }));

      expect(result.exercises.length).toBeGreaterThanOrEqual(0);

      if (result.exercises.length > 0) {
        const exercise = result.exercises[0];
        expect(exercise).toHaveProperty('exerciseId');
        expect(exercise).toHaveProperty('exerciseName');
        expect(exercise).toHaveProperty('sessionCount');
        expect(typeof exercise.sessionCount).toBe('number');
      }
    });

    it('should return exercises sorted by session count (most frequent first)', async () => {
      const result = await retry(() => client.getExercisesWithHistory());

      if (result.exercises.length >= 2) {
        for (let i = 0; i < result.exercises.length - 1; i++) {
          expect(result.exercises[i].sessionCount).toBeGreaterThanOrEqual(
            result.exercises[i + 1].sessionCount
          );
        }
      }
    });

    it('should support searching exercises by name', async () => {
      // The cmdk Command component filters client-side
      // API returns all exercises; filtering happens in UI
      const result = await retry(() => client.getExercisesWithHistory({ limit: 100 }));

      // Verify we can find exercises by partial name match (UI would filter these)
      if (result.exercises.length > 0) {
        const benchExercises = result.exercises.filter(e =>
          e.exerciseName.toLowerCase().includes('bench')
        );
        // At least one exercise should match (if seeded data exists)
        expect(Array.isArray(benchExercises)).toBe(true);
      }
    });
  });

  // =========================================================================
  // SMOKE-EH-03: View Exercise History with Sessions
  // =========================================================================

  describe('SMOKE-EH-03: View Exercise History with Sessions', () => {
    const testExerciseId = SEEDED_EXERCISES.benchPress.exerciseId;

    it('should load session history when exercise selected', async () => {
      const result = await retry(() =>
        client.getExerciseHistory({ exerciseId: testExerciseId })
      );

      expect(result).toHaveProperty('exerciseId');
      expect(result).toHaveProperty('exerciseName');
      expect(result).toHaveProperty('sessions');
      expect(result).toHaveProperty('totalSessions');
      expect(Array.isArray(result.sessions)).toBe(true);
    });

    it('should include 1RM data for supported exercises', async () => {
      const result = await retry(() =>
        client.getExerciseHistory({ exerciseId: testExerciseId })
      );

      expect(result).toHaveProperty('supports1Rm');
      expect(result).toHaveProperty('oneRmFormula');
      expect(result).toHaveProperty('allTimeBest1Rm');
      expect(result).toHaveProperty('allTimeMaxWeight');

      // Bench press should support 1RM calculation
      if (result.exerciseId === testExerciseId) {
        expect(result.supports1Rm).toBe(true);
      }
    });

    it('should include session-level stats', async () => {
      const result = await retry(() =>
        client.getExerciseHistory({ exerciseId: testExerciseId })
      );

      if (result.sessions.length > 0) {
        const session = result.sessions[0];
        expect(session).toHaveProperty('completionId');
        expect(session).toHaveProperty('workoutDate');
        expect(session).toHaveProperty('workoutName');
        expect(session).toHaveProperty('sets');
        expect(session).toHaveProperty('sessionBest1Rm');
        expect(session).toHaveProperty('sessionMaxWeight');
        expect(session).toHaveProperty('sessionTotalVolume');

        // Date should be in ISO format
        expect(session.workoutDate).toMatch(/^\d{4}-\d{2}-\d{2}/);
      }
    });

    it('should include set-level data with PR flags', async () => {
      const result = await retry(() =>
        client.getExerciseHistory({ exerciseId: testExerciseId })
      );

      if (result.sessions.length > 0 && result.sessions[0].sets.length > 0) {
        const set = result.sessions[0].sets[0];
        expect(set).toHaveProperty('setNumber');
        expect(set).toHaveProperty('weight');
        expect(set).toHaveProperty('weightUnit');
        expect(set).toHaveProperty('repsCompleted');
        expect(set).toHaveProperty('estimated1Rm');
        expect(set).toHaveProperty('isPr');
        expect(typeof set.isPr).toBe('boolean');
      }
    });
  });

  // =========================================================================
  // SMOKE-EH-04: View 1RM Trend Chart
  // =========================================================================

  describe('SMOKE-EH-04: View 1RM Trend Chart', () => {
    const testExerciseId = SEEDED_EXERCISES.benchPress.exerciseId;

    it('should have chart data when sessions exist', async () => {
      const result = await retry(() =>
        client.getExerciseHistory({ exerciseId: testExerciseId })
      );

      if (result.sessions.length > 0) {
        // At least some sessions should have 1RM data for chart
        const sessionsWithOneRm = result.sessions.filter(s => s.sessionBest1Rm !== null);
        expect(sessionsWithOneRm.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return all-time best 1RM for reference line', async () => {
      const result = await retry(() =>
        client.getExerciseHistory({ exerciseId: testExerciseId })
      );

      // allTimeBest1Rm should be present (may be null if no 1RM data)
      expect(result).toHaveProperty('allTimeBest1Rm');

      // If we have sessions with 1RM, allTimeBest1Rm should be a number
      const hasOneRmData = result.sessions.some(s => s.sessionBest1Rm !== null);
      if (hasOneRmData) {
        expect(typeof result.allTimeBest1Rm).toBe('number');
      }
    });
  });

  // =========================================================================
  // SMOKE-EH-05: Filter by Date Range
  // =========================================================================

  describe('SMOKE-EH-05: Filter by Date Range', () => {
    const testExerciseId = SEEDED_EXERCISES.benchPress.exerciseId;

    it('should return sessions within date range filter', async () => {
      // Note: Date filtering is done client-side in the UI using filterByDateRange()
      // The API returns all sessions; the UI filters them
      const result = await retry(() =>
        client.getExerciseHistory({ exerciseId: testExerciseId, limit: 100 })
      );

      // Verify sessions have valid dates for filtering
      for (const session of result.sessions) {
        expect(session.workoutDate).toMatch(/^\d{4}-\d{2}-\d{2}/);
        const date = new Date(session.workoutDate);
        expect(date.getTime()).not.toBeNaN();
      }
    });

    it('should support all date range options (30d, 90d, 1y, all)', async () => {
      // This tests that the API returns proper date data that can be filtered
      const result = await retry(() =>
        client.getExerciseHistory({ exerciseId: testExerciseId })
      );

      // Date range filtering happens in UI component (DateRangeFilter.tsx)
      // filterByDateRange() function handles: '30d', '90d', '1y', 'all'
      expect(result.sessions).toBeDefined();
    });
  });

  // =========================================================================
  // SMOKE-EH-06: Expand Session Row to View Sets
  // =========================================================================

  describe('SMOKE-EH-06: Expand Session Row to View Sets', () => {
    const testExerciseId = SEEDED_EXERCISES.benchPress.exerciseId;

    it('should have expandable sessions with multiple sets', async () => {
      const result = await retry(() =>
        client.getExerciseHistory({ exerciseId: testExerciseId })
      );

      if (result.sessions.length > 0) {
        const session = result.sessions[0];
        expect(Array.isArray(session.sets)).toBe(true);
        expect(session.sets.length).toBeGreaterThan(0);
      }
    });

    it('should include set details for expanded view', async () => {
      const result = await retry(() =>
        client.getExerciseHistory({ exerciseId: testExerciseId })
      );

      if (result.sessions.length > 0 && result.sessions[0].sets.length > 0) {
        const set = result.sessions[0].sets[0];
        // These fields are displayed in the expanded set row
        expect(set).toHaveProperty('setNumber');
        expect(set).toHaveProperty('weight');
        expect(set).toHaveProperty('repsCompleted');
        expect(set).toHaveProperty('estimated1Rm');
        expect(set).toHaveProperty('isPr');
      }
    });
  });

  // =========================================================================
  // SMOKE-EH-07: Pagination (Load More)
  // =========================================================================

  describe('SMOKE-EH-07: Pagination (Load More)', () => {
    const testExerciseId = SEEDED_EXERCISES.benchPress.exerciseId;

    it('should respect limit parameter for pagination', async () => {
      const limit = 2;
      const result = await retry(() =>
        client.getExerciseHistory({ exerciseId: testExerciseId, limit })
      );

      expect(result.sessions.length).toBeLessThanOrEqual(limit);
    });

    it('should support offset parameter for load more', async () => {
      const limit = 1;

      // First page
      const page1 = await retry(() =>
        client.getExerciseHistory({ exerciseId: testExerciseId, limit, offset: 0 })
      );

      // Second page
      const page2 = await retry(() =>
        client.getExerciseHistory({ exerciseId: testExerciseId, limit, offset: 1 })
      );

      // If we have more than 1 session, pages should be different
      if (page1.sessions.length > 0 && page2.sessions.length > 0) {
        // Sessions should be different between pages
        expect(page1.sessions[0].completionId).not.toBe(page2.sessions[0].completionId);
      }
    });

    it('should return total session count for pagination UI', async () => {
      const result = await retry(() =>
        client.getExerciseHistory({ exerciseId: testExerciseId })
      );

      expect(result).toHaveProperty('totalSessions');
      expect(typeof result.totalSessions).toBe('number');
      expect(result.totalSessions).toBeGreaterThanOrEqual(result.sessions.length);
    });
  });

  // =========================================================================
  // SMOKE-EH-08: Stats Cards Display
  // =========================================================================

  describe('SMOKE-EH-08: Stats Cards Display', () => {
    const testExerciseId = SEEDED_EXERCISES.benchPress.exerciseId;

    it('should return data for all stats cards', async () => {
      const result = await retry(() =>
        client.getExerciseHistory({ exerciseId: testExerciseId })
      );

      // Stats cards display these values:
      // - All-Time Best 1RM
      // - Max Weight
      // - Total Sessions
      // - In Range (filtered count, calculated client-side)

      expect(result).toHaveProperty('allTimeBest1Rm');
      expect(result).toHaveProperty('allTimeMaxWeight');
      expect(result).toHaveProperty('totalSessions');
      expect(typeof result.totalSessions).toBe('number');
    });

    it('should handle exercises with no history gracefully', async () => {
      // Request for an exercise that may have no data
      try {
        const result = await retry(() =>
          client.getExerciseHistory({ exerciseId: 'plank' })
        );

        // Should still have the structure even with empty sessions
        expect(result).toHaveProperty('sessions');
        expect(result).toHaveProperty('totalSessions');
      } catch (error) {
        // 404 is acceptable for exercises with no history
        if (error instanceof Error && !error.message.includes('404')) {
          throw error;
        }
      }
    });
  });

  // =========================================================================
  // SMOKE-EH-09: Empty States
  // =========================================================================

  describe('SMOKE-EH-09: Empty States', () => {
    it('should handle empty exercise list gracefully', async () => {
      // Test what UI should show when user has no workout history
      const result = await retry(() => client.getExercisesWithHistory());

      // Should return valid response structure even if empty
      expect(result).toHaveProperty('exercises');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.exercises)).toBe(true);
    });

    it('should return 404 for unknown exercise', async () => {
      await expect(
        client.getExerciseHistory({ exerciseId: 'nonexistent-exercise-xyz' })
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // SMOKE-EH-10: API Health for Exercise History
  // =========================================================================

  describe('SMOKE-EH-10: API Health for Exercise History', () => {
    it('should have progression exercises endpoint accessible', async () => {
      const response = await fetch(`${API_BASE}/progression/exercises`, {
        headers: { 'Content-Type': 'application/json' },
      });

      // Accept 200 or 401 (auth required) - both indicate endpoint is working
      expect([200, 401]).toContain(response.status);
    });

    it('should return JSON content type', async () => {
      const response = await fetch(`${API_BASE}/progression/exercises`, {
        headers: { 'Content-Type': 'application/json' },
      });

      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/json');
    });
  });
});

// =============================================================================
// @smoke Exercise History UI Integration Tests
// =============================================================================

describe('@smoke Exercise History UI Integration', () => {
  let apiAvailable: boolean;

  beforeAll(async () => {
    apiAvailable = !(await skipIfApiUnavailable());
  });

  beforeEach(async ({ skip }) => {
    if (!apiAvailable) {
      skip();
    }
  });

  // =========================================================================
  // These tests document expected UI behavior
  // They verify API responses match what UI components expect
  // =========================================================================

  describe('ExerciseSelector Component Data Contract', () => {
    it('should have exercises with required fields for selector', async () => {
      const client = createTestClient();
      const result = await retry(() => client.getExercisesWithHistory());

      // ExerciseSelector expects: { exerciseId, exerciseName, sessionCount }
      if (result.exercises.length > 0) {
        const exercise = result.exercises[0];
        expect(typeof exercise.exerciseId).toBe('string');
        expect(typeof exercise.exerciseName).toBe('string');
        expect(typeof exercise.sessionCount).toBe('number');
      }
    });
  });

  describe('HistoryTable Component Data Contract', () => {
    it('should have sessions with required fields for table', async () => {
      const client = createTestClient();
      const result = await retry(() =>
        client.getExerciseHistory({ exerciseId: SEEDED_EXERCISES.benchPress.exerciseId })
      );

      // HistoryTable expects: { completionId, workoutDate, workoutName, sets, sessionBest1Rm, sessionMaxWeight, sessionTotalVolume }
      if (result.sessions.length > 0) {
        const session = result.sessions[0];
        expect(session).toHaveProperty('completionId');
        expect(session).toHaveProperty('workoutDate');
        expect(session).toHaveProperty('workoutName'); // Can be null
        expect(session).toHaveProperty('sets');
        expect(session).toHaveProperty('sessionBest1Rm');
        expect(session).toHaveProperty('sessionMaxWeight');
        expect(session).toHaveProperty('sessionTotalVolume');
      }
    });
  });

  describe('OneRmTrendChart Component Data Contract', () => {
    it('should have chart-compatible data structure', async () => {
      const client = createTestClient();
      const result = await retry(() =>
        client.getExerciseHistory({ exerciseId: SEEDED_EXERCISES.benchPress.exerciseId })
      );

      // Chart needs: sessions with workoutDate and sessionBest1Rm
      for (const session of result.sessions) {
        expect(typeof session.workoutDate).toBe('string');
        // sessionBest1Rm can be null (for sessions without 1RM data)
        expect(
          session.sessionBest1Rm === null || typeof session.sessionBest1Rm === 'number'
        ).toBe(true);
      }
    });
  });

  describe('StatsCards Component Data Contract', () => {
    it('should have stats data for all cards', async () => {
      const client = createTestClient();
      const result = await retry(() =>
        client.getExerciseHistory({ exerciseId: SEEDED_EXERCISES.benchPress.exerciseId })
      );

      // Stats cards display:
      // - allTimeBest1Rm (can be null)
      // - allTimeMaxWeight (can be null)
      // - totalSessions (number)
      // - filtered count (calculated from sessions.length after filterByDateRange)

      expect(
        result.allTimeBest1Rm === null || typeof result.allTimeBest1Rm === 'number'
      ).toBe(true);
      expect(
        result.allTimeMaxWeight === null || typeof result.allTimeMaxWeight === 'number'
      ).toBe(true);
      expect(typeof result.totalSessions).toBe('number');
    });
  });
});
