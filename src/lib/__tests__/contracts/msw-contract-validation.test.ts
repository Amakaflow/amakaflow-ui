/**
 * MSW Contract Validation Tests
 *
 * Validates that MSW mock response shapes match the API contract schemas.
 * This ensures mocks stay in sync with the real API — if a mock returns the
 * wrong shape, these tests fail before any downstream test is misled.
 *
 * Unlike the per-service contract tests (progression.contract.test.ts etc.)
 * which hit real APIs, these always run against MSW mocks and always execute
 * in CI — no silent skips.
 *
 * @tags contract, msw
 */

import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { API_URLS } from '../../config';
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
// Schema Validator Setup
// =============================================================================

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  validateFormats: true,
});
addFormats(ajv);

allSchemas.forEach(schema => {
  if (schema.$id) {
    ajv.addSchema(schema);
  }
});

function validateSchema(schema: object, data: unknown): { valid: boolean; errors: string[] } {
  const validate = ajv.compile(schema);
  const valid = validate(data);
  const errors = valid
    ? []
    : (validate.errors || []).map(err =>
        `${err.instancePath || '/'}: ${err.message} (${JSON.stringify(err.params)})`
      );
  return { valid, errors };
}

// =============================================================================
// Helper — fetch from MSW (global server from setup.ts intercepts these)
// =============================================================================

async function mswFetch(path: string, base = API_URLS.MAPPER): Promise<Response> {
  return fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  });
}

// =============================================================================
// Progression API — MSW Mock Contract Validation
// =============================================================================

describe('@contract MSW Mock Shapes — Progression API', () => {
  describe('GET /progression/exercises', () => {
    it('MSW response matches ExercisesWithHistoryResponse schema', async () => {
      const response = await mswFetch('/progression/exercises');
      expect(response.ok).toBe(true);

      const data = await response.json();
      const { valid, errors } = validateSchema(exercisesWithHistoryResponseSchema, data);

      if (!valid) console.error('Schema errors:', errors);
      expect(valid).toBe(true);
    });

    it('returns snake_case field names', async () => {
      const response = await mswFetch('/progression/exercises');
      const data = await response.json();

      expect(data).toHaveProperty('exercises');
      expect(data).toHaveProperty('total');
      if (data.exercises.length > 0) {
        expect(data.exercises[0]).toHaveProperty('exercise_id');
        expect(data.exercises[0]).toHaveProperty('exercise_name');
        expect(data.exercises[0]).toHaveProperty('session_count');
        expect(data.exercises[0]).not.toHaveProperty('exerciseId');
      }
    });
  });

  describe('GET /progression/exercises/{id}/history', () => {
    it('MSW response matches ExerciseHistory schema', async () => {
      const response = await mswFetch('/progression/exercises/barbell-bench-press/history');
      expect(response.ok).toBe(true);

      const data = await response.json();
      const { valid, errors } = validateSchema(exerciseHistorySchema, data);

      if (!valid) console.error('Schema errors:', errors);
      expect(valid).toBe(true);
    });

    it('sessions include all required set fields', async () => {
      const response = await mswFetch('/progression/exercises/barbell-bench-press/history');
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
      const response = await mswFetch('/progression/exercises/nonexistent-exercise-xyz/history');
      expect(response.status).toBe(404);

      const data = await response.json();
      const { valid, errors } = validateSchema(errorResponseSchema, data);

      if (!valid) console.error('Error schema errors:', errors);
      expect(valid).toBe(true);
    });

    it('returns empty sessions for bodyweight exercises', async () => {
      const response = await mswFetch('/progression/exercises/pull-up/history');
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.sessions).toHaveLength(0);
      expect(data.supports_1rm).toBe(false);
    });
  });

  describe('GET /progression/exercises/{id}/last-weight', () => {
    it('MSW response matches LastWeight schema', async () => {
      const response = await mswFetch('/progression/exercises/barbell-bench-press/last-weight');
      expect(response.ok).toBe(true);

      const data = await response.json();
      const { valid, errors } = validateSchema(lastWeightSchema, data);

      if (!valid) console.error('Schema errors:', errors);
      expect(valid).toBe(true);
    });

    it('returns 404 for unknown exercise', async () => {
      const response = await mswFetch('/progression/exercises/nonexistent-exercise-xyz/last-weight');
      expect(response.status).toBe(404);
    });
  });

  describe('GET /progression/records', () => {
    it('MSW response matches PersonalRecordsResponse schema', async () => {
      const response = await mswFetch('/progression/records');
      expect(response.ok).toBe(true);

      const data = await response.json();
      const { valid, errors } = validateSchema(personalRecordsResponseSchema, data);

      if (!valid) console.error('Schema errors:', errors);
      expect(valid).toBe(true);
    });

    it('filters by record_type', async () => {
      const response = await mswFetch('/progression/records?record_type=1rm');
      const data = await response.json();

      for (const record of data.records) {
        expect(record.record_type).toBe('1rm');
      }
    });

    it('filters by exercise_id', async () => {
      const response = await mswFetch('/progression/records?exercise_id=barbell-bench-press');
      const data = await response.json();

      for (const record of data.records) {
        expect(record.exercise_id).toBe('barbell-bench-press');
      }
      expect(data.exercise_id).toBe('barbell-bench-press');
    });
  });

  describe('GET /progression/volume', () => {
    it('MSW response matches VolumeAnalyticsResponse schema', async () => {
      const response = await mswFetch('/progression/volume');
      expect(response.ok).toBe(true);

      const data = await response.json();
      const { valid, errors } = validateSchema(volumeAnalyticsResponseSchema, data);

      if (!valid) console.error('Schema errors:', errors);
      expect(valid).toBe(true);
    });

    it('includes required summary fields', async () => {
      const response = await mswFetch('/progression/volume');
      const data = await response.json();

      expect(data.summary).toHaveProperty('total_volume');
      expect(data.summary).toHaveProperty('total_sets');
      expect(data.summary).toHaveProperty('total_reps');
      expect(data.summary).toHaveProperty('muscle_group_breakdown');
    });
  });
});

// =============================================================================
// Health Endpoints — all services return { status: 'ok' }
// =============================================================================

describe('@contract MSW Mock Shapes — Health Endpoints', () => {
  const services = [
    { name: 'Mapper', base: API_URLS.MAPPER },
    { name: 'Ingestor', base: API_URLS.INGESTOR },
    { name: 'Calendar', base: API_URLS.CALENDAR },
    { name: 'Chat', base: API_URLS.CHAT },
  ];

  for (const { name, base } of services) {
    it(`${name} /health returns { status: 'ok' }`, async () => {
      const response = await fetch(`${base}/health`);
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data.status).toBe('ok');
    });
  }
});

// =============================================================================
// Ingestor API — core endpoints
// =============================================================================

describe('@contract MSW Mock Shapes — Ingestor API', () => {
  it('POST /ingest/text returns workout structure', async () => {
    const response = await fetch(`${API_URLS.INGESTOR}/ingest/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '3x10 bench press' }),
    });
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('workout');
    expect(data.workout).toHaveProperty('blocks');
  });

  it('POST /workouts/mix returns preview wrapper', async () => {
    const response = await fetch(`${API_URLS.INGESTOR}/workouts/mix`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'test:user-001',
      },
      body: JSON.stringify({
        sources: [
          { workout_id: 'workout-001', block_indices: [0] },
          { workout_id: 'workout-002', block_indices: [0] },
        ],
        title: 'Contract Test Mix',
      }),
    });
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('preview');
    expect(data.preview).toHaveProperty('title');
    expect(data.preview).toHaveProperty('workout');
    expect(data.preview.workout).toHaveProperty('blocks');
    expect(data.preview.workout).toHaveProperty('metadata');
    expect(data.preview.workout.metadata).toHaveProperty('mixer_sources');
  });

  it('POST /export/csv returns CSV content', async () => {
    const response = await fetch(`${API_URLS.INGESTOR}/export/csv`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.ok).toBe(true);
    expect(response.headers.get('content-type')).toContain('text/csv');
  });

  it('POST /import/detect/file returns format detection', async () => {
    const response = await fetch(`${API_URLS.INGESTOR}/import/detect/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('format');
    expect(data).toHaveProperty('confidence');
  });
});

// =============================================================================
// Calendar API — core endpoints
// =============================================================================

describe('@contract MSW Mock Shapes — Calendar API', () => {
  it('GET /training-programs returns success wrapper', async () => {
    const response = await fetch(`${API_URLS.CALENDAR}/training-programs`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('programs');
    expect(Array.isArray(data.programs)).toBe(true);
    expect(data).toHaveProperty('count');
  });

  it('GET /training-programs/:id returns program with weeks', async () => {
    const response = await fetch(`${API_URLS.CALENDAR}/training-programs/tp-001`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('program');
    expect(data.program).toHaveProperty('weeks');
    expect(Array.isArray(data.program.weeks)).toBe(true);
  });

  it('GET /planning/days returns day states', async () => {
    const response = await fetch(`${API_URLS.CALENDAR}/planning/days`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });
});

// =============================================================================
// Chat API — core endpoints
// =============================================================================

describe('@contract MSW Mock Shapes — Chat API', () => {
  it('POST /chat/stream returns SSE with message_start/end', async () => {
    const response = await fetch(`${API_URLS.CHAT}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.ok).toBe(true);
    expect(response.headers.get('content-type')).toContain('text/event-stream');

    const text = await response.text();
    expect(text).toContain('message_start');
    expect(text).toContain('message_end');
  });

  it('GET /chat/settings returns settings shape', async () => {
    const response = await fetch(`${API_URLS.CHAT}/chat/settings`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('voice_enabled');
    expect(data).toHaveProperty('model');
  });

  it('GET /gamification/streak returns streak shape', async () => {
    const response = await fetch(`${API_URLS.CHAT}/gamification/streak`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('current');
    expect(data).toHaveProperty('longest');
    expect(data).toHaveProperty('target');
  });

  it('GET /coach/usage returns usage shape', async () => {
    const response = await fetch(`${API_URLS.CHAT}/coach/usage`);
    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data).toHaveProperty('messages_today');
    expect(data).toHaveProperty('daily_limit');
    expect(data).toHaveProperty('tier');
  });
});
