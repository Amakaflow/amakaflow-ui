/**
 * E2E Smoke Tests for Progression API.
 *
 * These tests validate critical user journeys and should run on every PR.
 * They test against a real mapper-api instance (port 8001).
 *
 * Prerequisites:
 * - mapper-api running on port 8001
 * - Database seeded with test data (see fixtures)
 *
 * Run with: npm run test:e2e:smoke
 *
 * @tags smoke
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ProgressionApiClient } from '../../lib/progression-api';
import {
  E2E_TEST_USER,
  SEEDED_EXERCISES,
  EXPECTED_RECORDS,
  EXPECTED_LAST_WEIGHT,
  ERROR_CASES,
} from '../fixtures/progression-e2e.fixtures';
import { skipIfApiUnavailable, retry } from '../e2e-setup';

// =============================================================================
// Test Configuration
// =============================================================================

const API_BASE = import.meta.env.VITE_MAPPER_API_URL || 'http://localhost:8001';

/**
 * Create a client for testing.
 * In a real implementation, this would include auth headers.
 */
function createTestClient(): ProgressionApiClient {
  return new ProgressionApiClient(API_BASE);
}

// =============================================================================
// Smoke Tests
// =============================================================================

describe('@smoke Progression API Smoke Tests', () => {
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
  // SMOKE-01: View Exercise List
  // =========================================================================

  describe('SMOKE-01: View Exercise List', () => {
    it('returns exercises that user has performed', async () => {
      const result = await retry(() => client.getExercisesWithHistory());

      // Basic structure validation
      expect(result).toHaveProperty('exercises');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.exercises)).toBe(true);

      // If data is seeded, verify expected exercises
      if (result.exercises.length > 0) {
        const exercise = result.exercises[0];
        expect(exercise).toHaveProperty('exerciseId');
        expect(exercise).toHaveProperty('exerciseName');
        expect(exercise).toHaveProperty('sessionCount');
        expect(typeof exercise.exerciseId).toBe('string');
        expect(typeof exercise.sessionCount).toBe('number');
      }
    });

    it('returns exercises sorted by session count (most frequent first)', async () => {
      const result = await retry(() => client.getExercisesWithHistory());

      if (result.exercises.length >= 2) {
        for (let i = 0; i < result.exercises.length - 1; i++) {
          expect(result.exercises[i].sessionCount).toBeGreaterThanOrEqual(
            result.exercises[i + 1].sessionCount
          );
        }
      }
    });

    it('respects limit parameter', async () => {
      const limit = 2;
      const result = await retry(() => client.getExercisesWithHistory({ limit }));

      expect(result.exercises.length).toBeLessThanOrEqual(limit);
    });
  });

  // =========================================================================
  // SMOKE-02: View Exercise History
  // =========================================================================

  describe('SMOKE-02: View Exercise History', () => {
    const testExerciseId = SEEDED_EXERCISES.benchPress.exerciseId;

    it('returns session history with 1RM calculations', async () => {
      const result = await retry(() =>
        client.getExerciseHistory({ exerciseId: testExerciseId })
      );

      // Basic structure validation
      expect(result).toHaveProperty('exerciseId');
      expect(result).toHaveProperty('exerciseName');
      expect(result).toHaveProperty('sessions');
      expect(result).toHaveProperty('supports1Rm');
      expect(result).toHaveProperty('oneRmFormula');
      expect(result).toHaveProperty('totalSessions');

      expect(result.exerciseId).toBe(testExerciseId);
      expect(Array.isArray(result.sessions)).toBe(true);
    });

    it('sessions include all required fields', async () => {
      const result = await retry(() =>
        client.getExerciseHistory({ exerciseId: testExerciseId })
      );

      if (result.sessions.length > 0) {
        const session = result.sessions[0];

        expect(session).toHaveProperty('completionId');
        expect(session).toHaveProperty('workoutDate');
        expect(session).toHaveProperty('exerciseName');
        expect(session).toHaveProperty('sets');
        expect(session).toHaveProperty('sessionBest1Rm');
        expect(session).toHaveProperty('sessionMaxWeight');

        // Verify date format
        expect(session.workoutDate).toMatch(/^\d{4}-\d{2}-\d{2}/);
      }
    });

    it('sets include estimated 1RM and PR flag', async () => {
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

    it('returns 404 for unknown exercise', async () => {
      await expect(
        client.getExerciseHistory({ exerciseId: ERROR_CASES.unknownExerciseId })
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // SMOKE-03: Get Last Weight
  // =========================================================================

  describe('SMOKE-03: Get Last Weight', () => {
    const testExerciseId = SEEDED_EXERCISES.benchPress.exerciseId;

    it('returns last weight used for exercise', async () => {
      try {
        const result = await retry(() => client.getLastWeight(testExerciseId));

        expect(result).toHaveProperty('exerciseId');
        expect(result).toHaveProperty('exerciseName');
        expect(result).toHaveProperty('weight');
        expect(result).toHaveProperty('weightUnit');
        expect(result).toHaveProperty('repsCompleted');
        expect(result).toHaveProperty('workoutDate');
        expect(result).toHaveProperty('completionId');

        expect(result.exerciseId).toBe(testExerciseId);
        expect(typeof result.weight).toBe('number');
        expect(result.weight).toBeGreaterThan(0);
      } catch (error) {
        // 404 is acceptable if no history exists
        if (error instanceof Error && !error.message.includes('404')) {
          throw error;
        }
      }
    });

    it('returns 404 for exercise with no weight history', async () => {
      await expect(
        client.getLastWeight(ERROR_CASES.unknownExerciseId)
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // SMOKE-04: View Personal Records
  // =========================================================================

  describe('SMOKE-04: View Personal Records', () => {
    it('returns personal records', async () => {
      const result = await retry(() => client.getPersonalRecords());

      expect(result).toHaveProperty('records');
      expect(Array.isArray(result.records)).toBe(true);

      if (result.records.length > 0) {
        const record = result.records[0];

        expect(record).toHaveProperty('exerciseId');
        expect(record).toHaveProperty('exerciseName');
        expect(record).toHaveProperty('recordType');
        expect(record).toHaveProperty('value');
        expect(record).toHaveProperty('unit');

        expect(['1rm', 'max_weight', 'max_reps']).toContain(record.recordType);
        expect(typeof record.value).toBe('number');
      }
    });

    it('filters by record type', async () => {
      const result = await retry(() =>
        client.getPersonalRecords({ recordType: '1rm' })
      );

      for (const record of result.records) {
        expect(record.recordType).toBe('1rm');
      }
    });

    it('filters by exercise ID', async () => {
      const exerciseId = SEEDED_EXERCISES.benchPress.exerciseId;
      const result = await retry(() =>
        client.getPersonalRecords({ exerciseId })
      );

      for (const record of result.records) {
        expect(record.exerciseId).toBe(exerciseId);
      }
    });
  });

  // =========================================================================
  // SMOKE-05: API Health Check
  // =========================================================================

  describe('SMOKE-05: API Health Check', () => {
    it('progression endpoints are accessible', async () => {
      // Test each endpoint returns a valid response (200 or expected error)
      const endpoints = [
        { path: '/progression/exercises', expectedOk: true },
        { path: '/progression/records', expectedOk: true },
        { path: '/progression/volume', expectedOk: true },
      ];

      for (const { path, expectedOk } of endpoints) {
        const response = await fetch(`${API_BASE}${path}`, {
          headers: { 'Content-Type': 'application/json' },
        });

        if (expectedOk) {
          // Accept 200 or 401 (auth required) - both indicate endpoint is working
          expect([200, 401]).toContain(response.status);
        }
      }
    });

    it('API returns JSON content type', async () => {
      const response = await fetch(`${API_BASE}/progression/exercises`, {
        headers: { 'Content-Type': 'application/json' },
      });

      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/json');
    });
  });
});

// =============================================================================
// Volume Analytics Smoke Test
// =============================================================================

describe('@smoke Volume Analytics', () => {
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

  it('returns volume analytics with summary', async () => {
    const result = await retry(() => client.getVolumeAnalytics());

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('period');
    expect(result).toHaveProperty('granularity');

    expect(result.summary).toHaveProperty('totalVolume');
    expect(result.summary).toHaveProperty('totalSets');
    expect(result.summary).toHaveProperty('totalReps');
    expect(result.summary).toHaveProperty('muscleGroupBreakdown');

    expect(result.period).toHaveProperty('startDate');
    expect(result.period).toHaveProperty('endDate');
  });

  it('respects granularity parameter', async () => {
    const result = await retry(() =>
      client.getVolumeAnalytics({ granularity: 'weekly' })
    );

    expect(result.granularity).toBe('weekly');
  });
});
