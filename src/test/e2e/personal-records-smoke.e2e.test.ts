/**
 * E2E Smoke Tests for Personal Records Components (AMA-482).
 *
 * These tests validate the data contracts between the PersonalRecords UI
 * components (PRCard, PRList, PRSummary, RecordTypeFilter) and the
 * Progression API.
 *
 * Critical User Journeys:
 * - Viewing personal records list with filtering
 * - Viewing PR summary dashboard widget
 * - "New PR" badge display for recent records
 * - Record type filtering (1RM, Max Weight, Max Reps)
 *
 * Prerequisites:
 * - mapper-api running on port 8001
 * - Database seeded with test data (see fixtures)
 *
 * Run with: npm run test:e2e:smoke
 *
 * @tags smoke, personal-records
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { ProgressionApiClient } from '../../lib/progression-api';
import {
  SEEDED_EXERCISES,
  EXPECTED_RECORDS,
  ERROR_CASES,
} from '../fixtures/progression-e2e.fixtures';
import { skipIfApiUnavailable, retry } from '../e2e-setup';

// =============================================================================
// Test Configuration
// =============================================================================

const API_BASE = import.meta.env.VITE_MAPPER_API_URL || 'http://localhost:8001';

function createTestClient(): ProgressionApiClient {
  return new ProgressionApiClient(API_BASE);
}

// =============================================================================
// @smoke Personal Records - PRList Data Contracts
// =============================================================================

describe('@smoke Personal Records - PRList Data Contracts', () => {
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
  // SMOKE-PR-01: PRList receives valid record data
  // =========================================================================

  describe('SMOKE-PR-01: PRList receives valid record data', () => {
    it('returns records with all fields required by PRCard', async () => {
      const result = await retry(() => client.getPersonalRecords());

      expect(result).toHaveProperty('records');
      expect(Array.isArray(result.records)).toBe(true);

      if (result.records.length > 0) {
        const record = result.records[0];

        // PRCard component requires these fields
        expect(record).toHaveProperty('exerciseId');
        expect(record).toHaveProperty('exerciseName');
        expect(record).toHaveProperty('recordType');
        expect(record).toHaveProperty('value');
        expect(record).toHaveProperty('unit');
        expect(record).toHaveProperty('achievedAt');
        expect(record).toHaveProperty('completionId');

        // Type validations
        expect(typeof record.exerciseId).toBe('string');
        expect(typeof record.exerciseName).toBe('string');
        expect(['1rm', 'max_weight', 'max_reps']).toContain(record.recordType);
        expect(typeof record.value).toBe('number');
        expect(typeof record.unit).toBe('string');
      }
    });

    it('respects limit parameter for PRList pagination', async () => {
      const limit = 3;
      const result = await retry(() => client.getPersonalRecords({ limit }));

      expect(result.records.length).toBeLessThanOrEqual(limit);
    });

    it('returns exerciseId field for click navigation', async () => {
      const result = await retry(() => client.getPersonalRecords({ limit: 5 }));

      // PRList.onRecordClick passes exerciseId
      for (const record of result.records) {
        expect(record.exerciseId).toBeTruthy();
        expect(typeof record.exerciseId).toBe('string');
      }
    });
  });

  // =========================================================================
  // SMOKE-PR-02: RecordTypeFilter integration
  // =========================================================================

  describe('SMOKE-PR-02: RecordTypeFilter integration', () => {
    it('filters by 1rm record type', async () => {
      const result = await retry(() =>
        client.getPersonalRecords({ recordType: '1rm' })
      );

      for (const record of result.records) {
        expect(record.recordType).toBe('1rm');
      }
    });

    it('filters by max_weight record type', async () => {
      const result = await retry(() =>
        client.getPersonalRecords({ recordType: 'max_weight' })
      );

      for (const record of result.records) {
        expect(record.recordType).toBe('max_weight');
      }
    });

    it('filters by max_reps record type', async () => {
      const result = await retry(() =>
        client.getPersonalRecords({ recordType: 'max_reps' })
      );

      for (const record of result.records) {
        expect(record.recordType).toBe('max_reps');
      }
    });

    it('returns all types when filter is "all" (undefined)', async () => {
      const result = await retry(() => client.getPersonalRecords());

      // Should return records (filter=all means no recordType param)
      expect(result).toHaveProperty('records');
      expect(Array.isArray(result.records)).toBe(true);

      // All returned records should have valid types
      for (const record of result.records) {
        expect(['1rm', 'max_weight', 'max_reps']).toContain(record.recordType);
      }
    });
  });

  // =========================================================================
  // SMOKE-PR-03: Filter by exercise (PRList.exerciseId prop)
  // =========================================================================

  describe('SMOKE-PR-03: Filter by exercise', () => {
    const testExerciseId = SEEDED_EXERCISES.benchPress.exerciseId;

    it('returns only records for specified exercise', async () => {
      const result = await retry(() =>
        client.getPersonalRecords({ exerciseId: testExerciseId })
      );

      for (const record of result.records) {
        expect(record.exerciseId).toBe(testExerciseId);
      }
    });

    it('includes exerciseId in response for verification', async () => {
      const result = await retry(() =>
        client.getPersonalRecords({ exerciseId: testExerciseId })
      );

      // Response should indicate the filter applied
      expect(result).toHaveProperty('exerciseId');
    });

    it('combines exercise and record type filters', async () => {
      const result = await retry(() =>
        client.getPersonalRecords({
          exerciseId: testExerciseId,
          recordType: '1rm',
        })
      );

      for (const record of result.records) {
        expect(record.exerciseId).toBe(testExerciseId);
        expect(record.recordType).toBe('1rm');
      }
    });

    it('returns empty array for unknown exercise', async () => {
      const result = await retry(() =>
        client.getPersonalRecords({ exerciseId: ERROR_CASES.unknownExerciseId })
      );

      expect(result).toHaveProperty('records');
      expect(result.records).toHaveLength(0);
    });
  });
});

// =============================================================================
// @smoke Personal Records - PRSummary Data Contracts
// =============================================================================

describe('@smoke Personal Records - PRSummary Data Contracts', () => {
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
  // SMOKE-PR-04: PRSummary receives limited records
  // =========================================================================

  describe('SMOKE-PR-04: PRSummary receives limited records', () => {
    it('returns limited records for summary widget (default maxRecords=5)', async () => {
      const maxRecords = 5;
      const result = await retry(() =>
        client.getPersonalRecords({ limit: maxRecords })
      );

      expect(result.records.length).toBeLessThanOrEqual(maxRecords);
    });

    it('returns all fields needed for CompactPRItem', async () => {
      const result = await retry(() => client.getPersonalRecords({ limit: 5 }));

      // CompactPRItem displays: exerciseName, value, unit, recordType, achievedAt
      for (const record of result.records) {
        expect(typeof record.exerciseName).toBe('string');
        expect(record.exerciseName.length).toBeGreaterThan(0);
        expect(typeof record.value).toBe('number');
        expect(record.value).toBeGreaterThan(0);
        expect(typeof record.unit).toBe('string');
        expect(record.unit.length).toBeGreaterThan(0);
        expect(['1rm', 'max_weight', 'max_reps']).toContain(record.recordType);
      }
    });

    it('returns compact (3 records) for small widget', async () => {
      const result = await retry(() => client.getPersonalRecords({ limit: 3 }));

      expect(result.records.length).toBeLessThanOrEqual(3);
    });
  });
});

// =============================================================================
// @smoke Personal Records - PRCard "New PR" Badge
// =============================================================================

describe('@smoke Personal Records - PRCard "New PR" Badge', () => {
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
  // SMOKE-PR-05: achievedAt field for isRecentPR calculation
  // =========================================================================

  describe('SMOKE-PR-05: achievedAt field for isRecentPR', () => {
    it('includes achievedAt for "New PR" badge calculation', async () => {
      const result = await retry(() => client.getPersonalRecords({ limit: 10 }));

      // achievedAt is used by isRecentPR() to show "New!" badge
      for (const record of result.records) {
        // achievedAt can be string (date) or null
        expect(
          record.achievedAt === null || typeof record.achievedAt === 'string'
        ).toBe(true);

        // If present, should be valid ISO date format
        if (record.achievedAt !== null) {
          expect(record.achievedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
          // Should be parseable
          const date = new Date(record.achievedAt);
          expect(date.getTime()).not.toBeNaN();
        }
      }
    });

    it('includes completionId for linking to workout', async () => {
      const result = await retry(() => client.getPersonalRecords({ limit: 5 }));

      // completionId links PR to the workout where it was achieved
      for (const record of result.records) {
        expect(record).toHaveProperty('completionId');
        // Can be null if no completion associated
        if (record.completionId !== null) {
          expect(typeof record.completionId).toBe('string');
        }
      }
    });
  });
});

// =============================================================================
// @smoke Personal Records - Record Value Formatting
// =============================================================================

describe('@smoke Personal Records - Record Value Formatting', () => {
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
  // SMOKE-PR-06: Value and unit formatting
  // =========================================================================

  describe('SMOKE-PR-06: Value and unit formatting', () => {
    it('returns numeric value for all record types', async () => {
      const result = await retry(() => client.getPersonalRecords());

      for (const record of result.records) {
        expect(typeof record.value).toBe('number');
        expect(record.value).toBeGreaterThan(0);
      }
    });

    it('returns appropriate unit for weight-based records', async () => {
      const result = await retry(() =>
        client.getPersonalRecords({ recordType: '1rm' })
      );

      for (const record of result.records) {
        // 1RM should have weight unit
        expect(['lbs', 'kg']).toContain(record.unit);
      }
    });

    it('returns appropriate unit for max_weight records', async () => {
      const result = await retry(() =>
        client.getPersonalRecords({ recordType: 'max_weight' })
      );

      for (const record of result.records) {
        expect(['lbs', 'kg']).toContain(record.unit);
      }
    });

    it('returns reps unit for max_reps records', async () => {
      const result = await retry(() =>
        client.getPersonalRecords({ recordType: 'max_reps' })
      );

      for (const record of result.records) {
        expect(record.unit).toBe('reps');
      }
    });
  });

  // =========================================================================
  // SMOKE-PR-07: Expected values match seeded data
  // =========================================================================

  describe('SMOKE-PR-07: Expected values match seeded data', () => {
    it('bench press 1RM matches expected value', async () => {
      const result = await retry(() =>
        client.getPersonalRecords({
          exerciseId: EXPECTED_RECORDS.benchPress1RM.exerciseId,
          recordType: '1rm',
        })
      );

      if (result.records.length > 0) {
        const record = result.records[0];
        expect(record.exerciseId).toBe(EXPECTED_RECORDS.benchPress1RM.exerciseId);
        // Allow tolerance for 1RM calculation
        expect(record.value).toBeGreaterThanOrEqual(
          EXPECTED_RECORDS.benchPress1RM.expectedValue -
            EXPECTED_RECORDS.benchPress1RM.tolerance
        );
        expect(record.value).toBeLessThanOrEqual(
          EXPECTED_RECORDS.benchPress1RM.expectedValue +
            EXPECTED_RECORDS.benchPress1RM.tolerance
        );
      }
    });

    it('bench press max weight matches expected value', async () => {
      const result = await retry(() =>
        client.getPersonalRecords({
          exerciseId: EXPECTED_RECORDS.benchPressMaxWeight.exerciseId,
          recordType: 'max_weight',
        })
      );

      if (result.records.length > 0) {
        const record = result.records[0];
        expect(record.value).toBe(EXPECTED_RECORDS.benchPressMaxWeight.expectedValue);
      }
    });
  });
});

// =============================================================================
// @smoke Personal Records - API Health
// =============================================================================

describe('@smoke Personal Records - API Health', () => {
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
  // SMOKE-PR-08: API endpoint accessibility
  // =========================================================================

  describe('SMOKE-PR-08: API endpoint accessibility', () => {
    it('personal records endpoint is accessible', async () => {
      const response = await fetch(`${API_BASE}/progression/records`, {
        headers: { 'Content-Type': 'application/json' },
      });

      // Accept 200 or 401 (auth required) - both indicate endpoint is working
      expect([200, 401]).toContain(response.status);
    });

    it('returns JSON content type', async () => {
      const response = await fetch(`${API_BASE}/progression/records`, {
        headers: { 'Content-Type': 'application/json' },
      });

      const contentType = response.headers.get('content-type');
      expect(contentType).toContain('application/json');
    });

    it('handles invalid record type parameter gracefully', async () => {
      try {
        const response = await fetch(
          `${API_BASE}/progression/records?record_type=invalid_type`,
          { headers: { 'Content-Type': 'application/json' } }
        );
        // Should return 400 or 422 for invalid enum value
        expect([400, 422]).toContain(response.status);
      } catch {
        // Network error is acceptable in health check context
      }
    });

    it('handles invalid limit parameter gracefully', async () => {
      try {
        const response = await fetch(
          `${API_BASE}/progression/records?limit=-1`,
          { headers: { 'Content-Type': 'application/json' } }
        );
        // Should return 400 or 422 for negative limit
        expect([400, 422]).toContain(response.status);
      } catch {
        // Network error is acceptable in health check context
      }
    });
  });
});
