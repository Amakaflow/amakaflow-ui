/**
 * Contract tests for Progression API.
 *
 * These tests validate that the mapper-api responses match the expected
 * JSON schemas, ensuring the TypeScript client can correctly transform
 * the responses into application types.
 *
 * Contract tests run against a real mapper-api instance (not mocks).
 *
 * Run with: npm run test:contracts
 * Requires: mapper-api running on port 8001
 *
 * @tags contract
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  allSchemas,
  exerciseHistorySchema,
  exercisesWithHistoryResponseSchema,
  personalRecordsResponseSchema,
  lastWeightSchema,
  volumeAnalyticsResponseSchema,
  errorResponseSchema,
} from './schemas/progression.schemas';

// =============================================================================
// Test Configuration
// =============================================================================

const API_BASE = import.meta.env.VITE_MAPPER_API_URL || 'http://localhost:8001';

// Skip contract tests if API is not available
const isApiAvailable = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/health`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
};

// Test data - should match seeded data
const TEST_EXERCISE_ID = 'barbell-bench-press';
const UNKNOWN_EXERCISE_ID = 'nonexistent-exercise-xyz';

// =============================================================================
// Schema Validator Setup
// =============================================================================

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  validateFormats: true,
});
addFormats(ajv);

// Register all schemas
allSchemas.forEach(schema => {
  if (schema.$id) {
    ajv.addSchema(schema);
  }
});

// Helper to validate and report errors
function validateSchema(schema: object, data: unknown): { valid: boolean; errors: string[] } {
  const validate = ajv.compile(schema);
  const valid = validate(data);

  const errors = valid
    ? []
    : (validate.errors || []).map(err => {
        return `${err.instancePath || '/'}: ${err.message} (${JSON.stringify(err.params)})`;
      });

  return { valid, errors };
}

// =============================================================================
// Mock Auth Token (for testing against real API)
// =============================================================================

/**
 * Get an auth token for the test user.
 * In a real implementation, this would authenticate with Clerk.
 *
 * For local development, you may need to:
 * 1. Use a service role key that bypasses auth
 * 2. Set up a test user in Clerk and get a real token
 * 3. Mock the auth at the API level
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  // TODO: Replace with real auth when running against authenticated endpoints
  // For now, we assume the API allows unauthenticated access in test mode
  // or we use a service key
  const serviceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

  if (serviceKey) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    };
  }

  // Fallback for local development without auth
  return {
    'Content-Type': 'application/json',
    'x-test-user-id': 'e2e-test-user-001',
  };
}

// =============================================================================
// Contract Tests
// =============================================================================

describe('@contract Progression API Response Schemas', () => {
  let apiAvailable: boolean;
  let authHeaders: HeadersInit;

  beforeAll(async () => {
    apiAvailable = await isApiAvailable();
    if (apiAvailable) {
      authHeaders = await getAuthHeaders();
    }
  });

  beforeEach(async ({ skip }) => {
    if (!apiAvailable) {
      skip();
    }
  });

  // =========================================================================
  // GET /progression/exercises
  // =========================================================================

  describe('GET /progression/exercises', () => {
    it('response matches ExercisesWithHistoryResponse schema', async () => {
      const response = await fetch(`${API_BASE}/progression/exercises`, {
        headers: authHeaders,
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      const { valid, errors } = validateSchema(exercisesWithHistoryResponseSchema, data);

      if (!valid) {
        console.error('Schema validation errors:', errors);
      }
      expect(valid).toBe(true);
    });

    it('respects limit parameter', async () => {
      const response = await fetch(`${API_BASE}/progression/exercises?limit=5`, {
        headers: authHeaders,
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.exercises.length).toBeLessThanOrEqual(5);
    });

    it('returns snake_case field names (API convention)', async () => {
      const response = await fetch(`${API_BASE}/progression/exercises`, {
        headers: authHeaders,
      });

      const data = await response.json();

      // Verify snake_case (API response) not camelCase (TypeScript)
      expect(data).toHaveProperty('exercises');
      expect(data).toHaveProperty('total');

      if (data.exercises.length > 0) {
        expect(data.exercises[0]).toHaveProperty('exercise_id');
        expect(data.exercises[0]).toHaveProperty('exercise_name');
        expect(data.exercises[0]).toHaveProperty('session_count');
        // Should NOT have camelCase
        expect(data.exercises[0]).not.toHaveProperty('exerciseId');
        expect(data.exercises[0]).not.toHaveProperty('exerciseName');
        expect(data.exercises[0]).not.toHaveProperty('sessionCount');
      }
    });
  });

  // =========================================================================
  // GET /progression/exercises/{id}/history
  // =========================================================================

  describe('GET /progression/exercises/{id}/history', () => {
    it('response matches ExerciseHistory schema', async () => {
      const response = await fetch(
        `${API_BASE}/progression/exercises/${TEST_EXERCISE_ID}/history`,
        { headers: authHeaders }
      );

      expect(response.ok).toBe(true);
      const data = await response.json();

      const { valid, errors } = validateSchema(exerciseHistorySchema, data);

      if (!valid) {
        console.error('Schema validation errors:', errors);
      }
      expect(valid).toBe(true);
    });

    it('includes all required fields for sessions', async () => {
      const response = await fetch(
        `${API_BASE}/progression/exercises/${TEST_EXERCISE_ID}/history`,
        { headers: authHeaders }
      );

      const data = await response.json();

      expect(data).toHaveProperty('exercise_id');
      expect(data).toHaveProperty('exercise_name');
      expect(data).toHaveProperty('supports_1rm');
      expect(data).toHaveProperty('one_rm_formula');
      expect(data).toHaveProperty('sessions');
      expect(data).toHaveProperty('total_sessions');
      expect(data).toHaveProperty('all_time_best_1rm');
      expect(data).toHaveProperty('all_time_max_weight');
    });

    it('includes all required fields for sets within sessions', async () => {
      const response = await fetch(
        `${API_BASE}/progression/exercises/${TEST_EXERCISE_ID}/history`,
        { headers: authHeaders }
      );

      const data = await response.json();

      if (data.sessions.length > 0 && data.sessions[0].sets.length > 0) {
        const set = data.sessions[0].sets[0];
        expect(set).toHaveProperty('set_number');
        expect(set).toHaveProperty('weight_unit');
        expect(set).toHaveProperty('status');
        expect(set).toHaveProperty('is_pr');
      }
    });

    it('returns 404 with error schema for unknown exercise', async () => {
      const response = await fetch(
        `${API_BASE}/progression/exercises/${UNKNOWN_EXERCISE_ID}/history`,
        { headers: authHeaders }
      );

      expect(response.status).toBe(404);
      const data = await response.json();

      const { valid, errors } = validateSchema(errorResponseSchema, data);
      if (!valid) {
        console.error('Error schema validation errors:', errors);
      }
      expect(valid).toBe(true);
      expect(data.detail).toContain('not found');
    });

    it('returns 400 for invalid exercise_id format', async () => {
      const response = await fetch(
        `${API_BASE}/progression/exercises/INVALID_UPPERCASE/history`,
        { headers: authHeaders }
      );

      expect(response.status).toBe(400);
      const data = await response.json();

      expect(data).toHaveProperty('detail');
      expect(data.detail).toContain('Invalid exercise_id');
    });

    it('respects pagination parameters', async () => {
      const response = await fetch(
        `${API_BASE}/progression/exercises/${TEST_EXERCISE_ID}/history?limit=5&offset=0`,
        { headers: authHeaders }
      );

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.sessions.length).toBeLessThanOrEqual(5);
    });
  });

  // =========================================================================
  // GET /progression/exercises/{id}/last-weight
  // =========================================================================

  describe('GET /progression/exercises/{id}/last-weight', () => {
    it('response matches LastWeight schema', async () => {
      const response = await fetch(
        `${API_BASE}/progression/exercises/${TEST_EXERCISE_ID}/last-weight`,
        { headers: authHeaders }
      );

      // May be 404 if no history - that's valid
      if (response.ok) {
        const data = await response.json();
        const { valid, errors } = validateSchema(lastWeightSchema, data);

        if (!valid) {
          console.error('Schema validation errors:', errors);
        }
        expect(valid).toBe(true);
      } else {
        expect(response.status).toBe(404);
      }
    });

    it('returns 404 with error schema when no history exists', async () => {
      const response = await fetch(
        `${API_BASE}/progression/exercises/${UNKNOWN_EXERCISE_ID}/last-weight`,
        { headers: authHeaders }
      );

      expect(response.status).toBe(404);
      const data = await response.json();

      const { valid } = validateSchema(errorResponseSchema, data);
      expect(valid).toBe(true);
    });
  });

  // =========================================================================
  // GET /progression/records
  // =========================================================================

  describe('GET /progression/records', () => {
    it('response matches PersonalRecordsResponse schema', async () => {
      const response = await fetch(`${API_BASE}/progression/records`, {
        headers: authHeaders,
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      const { valid, errors } = validateSchema(personalRecordsResponseSchema, data);

      if (!valid) {
        console.error('Schema validation errors:', errors);
      }
      expect(valid).toBe(true);
    });

    it('filters by record_type parameter', async () => {
      const response = await fetch(`${API_BASE}/progression/records?record_type=1rm`, {
        headers: authHeaders,
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      for (const record of data.records) {
        expect(record.record_type).toBe('1rm');
      }
    });

    it('filters by exercise_id parameter', async () => {
      const response = await fetch(
        `${API_BASE}/progression/records?exercise_id=${TEST_EXERCISE_ID}`,
        { headers: authHeaders }
      );

      expect(response.ok).toBe(true);
      const data = await response.json();

      for (const record of data.records) {
        expect(record.exercise_id).toBe(TEST_EXERCISE_ID);
      }
      expect(data.exercise_id).toBe(TEST_EXERCISE_ID);
    });

    it('record_type enum only accepts valid values', async () => {
      const response = await fetch(
        `${API_BASE}/progression/records?record_type=invalid_type`,
        { headers: authHeaders }
      );

      expect(response.status).toBe(422); // Validation error
    });
  });

  // =========================================================================
  // GET /progression/volume
  // =========================================================================

  describe('GET /progression/volume', () => {
    it('response matches VolumeAnalyticsResponse schema', async () => {
      const response = await fetch(`${API_BASE}/progression/volume`, {
        headers: authHeaders,
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      const { valid, errors } = validateSchema(volumeAnalyticsResponseSchema, data);

      if (!valid) {
        console.error('Schema validation errors:', errors);
      }
      expect(valid).toBe(true);
    });

    it('includes required summary fields', async () => {
      const response = await fetch(`${API_BASE}/progression/volume`, {
        headers: authHeaders,
      });

      const data = await response.json();

      expect(data.summary).toHaveProperty('total_volume');
      expect(data.summary).toHaveProperty('total_sets');
      expect(data.summary).toHaveProperty('total_reps');
      expect(data.summary).toHaveProperty('muscle_group_breakdown');
    });

    it('respects granularity parameter', async () => {
      const response = await fetch(`${API_BASE}/progression/volume?granularity=weekly`, {
        headers: authHeaders,
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.granularity).toBe('weekly');
    });

    it('respects date range parameters', async () => {
      const response = await fetch(
        `${API_BASE}/progression/volume?start_date=2026-01-01&end_date=2026-01-31`,
        { headers: authHeaders }
      );

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.period.start_date).toBe('2026-01-01');
      expect(data.period.end_date).toBe('2026-01-31');
    });

    it('granularity enum only accepts valid values', async () => {
      const response = await fetch(
        `${API_BASE}/progression/volume?granularity=invalid`,
        { headers: authHeaders }
      );

      expect(response.status).toBe(422);
    });
  });

  // =========================================================================
  // Cross-Cutting Contract Validations
  // =========================================================================

  describe('API Response Conventions', () => {
    it('all endpoints return JSON content type', async () => {
      const endpoints = [
        '/progression/exercises',
        `/progression/exercises/${TEST_EXERCISE_ID}/history`,
        '/progression/records',
        '/progression/volume',
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(`${API_BASE}${endpoint}`, {
          headers: authHeaders,
        });

        const contentType = response.headers.get('content-type');
        expect(contentType).toContain('application/json');
      }
    });

    it('error responses include detail field', async () => {
      const response = await fetch(
        `${API_BASE}/progression/exercises/${UNKNOWN_EXERCISE_ID}/history`,
        { headers: authHeaders }
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toHaveProperty('detail');
      expect(typeof data.detail).toBe('string');
    });
  });
});
