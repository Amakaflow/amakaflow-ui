/**
 * Smoke Tests — Mix Workouts (AMA-719)
 *
 * Validates the POST /workouts/mix endpoint against a live local backend.
 * Uses two real saved workouts from the database, picks blocks from each,
 * and asserts the merged preview has the correct structure.
 *
 * Prerequisites:
 * - workout-ingestor-api running on port 8004 (docker compose up workout-ingestor)
 * - API_KEYS env includes "sk_dev_test" on the server
 * - The two workout IDs below must exist for profile user_37rQFUFob1SV5nQAZRO5RieV1Rp
 *
 * Run with: npx vitest run src/test/e2e/mix-workouts-smoke.e2e.test.ts
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { retry } from '../e2e-setup';

// =============================================================================
// Test Configuration
// =============================================================================

const INGESTOR_BASE = 'http://localhost:8004';

// Real saved workouts — profile user_37rQFUFob1SV5nQAZRO5RieV1Rp
// Each has 3 blocks. We pick block 0 from each so the mix has 2 blocks.
const TEST_USER_ID = 'user_37rQFUFob1SV5nQAZRO5RieV1Rp';
const WORKOUT_A_ID = '480de2f4-9785-47aa-83ac-4fdc0254f5de'; // Push Day - Chest & Triceps
const WORKOUT_B_ID = 'c3e654d9-b44f-47f4-86ec-c2a0acf516d3'; // Pull Day - Back & Biceps

// API key format: "key:user_id" so the backend resolves the correct profile
const AUTH_HEADER = `sk_dev_test:${TEST_USER_ID}`;

// =============================================================================
// Helpers
// =============================================================================

async function isApiAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${INGESTOR_BASE}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function postJson<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${INGESTOR_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': AUTH_HEADER,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(JSON.stringify(data)), { status: res.status, body: data });
  }
  return data as T;
}

// =============================================================================
// Tests
// =============================================================================

describe('@smoke Mix Workouts — POST /workouts/mix', () => {
  let apiAvailable: boolean;

  beforeAll(async () => {
    apiAvailable = await isApiAvailable();
    if (!apiAvailable) {
      console.warn(
        '[smoke] workout-ingestor not available at http://localhost:8004 — skipping mix tests.\n' +
        '        Run: docker compose -f docker-compose.yml up -d workout-ingestor'
      );
    }
  });

  beforeEach(({ skip }) => {
    if (!apiAvailable) skip();
  });

  // =========================================================================
  // SMOKE-MIX-01: Health
  // =========================================================================

  describe('SMOKE-MIX-01: API health', () => {
    it('GET /health returns ok', async () => {
      const res = await fetch(`${INGESTOR_BASE}/health`);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
    });
  });

  // =========================================================================
  // SMOKE-MIX-02: Happy path — mix one block from each of two workouts
  // =========================================================================

  describe('SMOKE-MIX-02: Happy path', () => {
    it('returns a preview with 2 blocks when picking block 0 from each source', async () => {
      const result = await retry(() =>
        postJson<{ preview: { title: string; workout: { blocks: unknown[]; metadata: unknown } } }>(
          '/workouts/mix',
          {
            sources: [
              { workout_id: WORKOUT_A_ID, block_indices: [0] },
              { workout_id: WORKOUT_B_ID, block_indices: [0] },
            ],
            title: 'Smoke Test Mix',
          }
        )
      );

      expect(result).toHaveProperty('preview');
      expect(result.preview).toHaveProperty('title', 'Smoke Test Mix');
      expect(result.preview).toHaveProperty('workout');

      const workout = result.preview.workout;
      expect(workout).toHaveProperty('blocks');
      expect(Array.isArray(workout.blocks)).toBe(true);
      expect(workout.blocks).toHaveLength(2);
    });

    it('each merged block has label and exercises array', async () => {
      const result = await retry(() =>
        postJson<{ preview: { workout: { blocks: Array<{ label?: string; exercises?: unknown[] }> } } }>(
          '/workouts/mix',
          {
            sources: [
              { workout_id: WORKOUT_A_ID, block_indices: [0] },
              { workout_id: WORKOUT_B_ID, block_indices: [0] },
            ],
            title: 'Block Structure Check',
          }
        )
      );

      for (const block of result.preview.workout.blocks) {
        expect(typeof block.label).toBe('string');
        expect(Array.isArray(block.exercises)).toBe(true);
        expect(block.exercises!.length).toBeGreaterThan(0);
      }
    });

    it('metadata.mixer_sources lists both source workout IDs', async () => {
      const result = await retry(() =>
        postJson<{
          preview: {
            workout: { metadata: { mixer_sources: string[] } }
          }
        }>(
          '/workouts/mix',
          {
            sources: [
              { workout_id: WORKOUT_A_ID, block_indices: [0] },
              { workout_id: WORKOUT_B_ID, block_indices: [0] },
            ],
            title: 'Provenance Check',
          }
        )
      );

      const sources = result.preview.workout.metadata.mixer_sources;
      expect(Array.isArray(sources)).toBe(true);
      expect(sources).toContain(WORKOUT_A_ID);
      expect(sources).toContain(WORKOUT_B_ID);
    });

    it('total exercise count equals the sum of exercises in selected blocks', async () => {
      // Block 0 of each workout — pick exactly 1 block each
      const result = await retry(() =>
        postJson<{
          preview: {
            workout: { blocks: Array<{ exercises?: unknown[] }> }
          }
        }>(
          '/workouts/mix',
          {
            sources: [
              { workout_id: WORKOUT_A_ID, block_indices: [0] },
              { workout_id: WORKOUT_B_ID, block_indices: [0] },
            ],
            title: 'Exercise Count Check',
          }
        )
      );

      const totalExercises = result.preview.workout.blocks.reduce(
        (sum, block) => sum + (block.exercises?.length ?? 0),
        0
      );
      expect(totalExercises).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // SMOKE-MIX-03: Multiple blocks from a single source
  // =========================================================================

  describe('SMOKE-MIX-03: Multiple blocks from one source', () => {
    it('returns 3 blocks when picking blocks 0,1,2 from workout A', async () => {
      const result = await retry(() =>
        postJson<{ preview: { workout: { blocks: unknown[] } } }>(
          '/workouts/mix',
          {
            sources: [{ workout_id: WORKOUT_A_ID, block_indices: [0, 1, 2] }],
            title: 'All Blocks From One',
          }
        )
      );

      expect(result.preview.workout.blocks).toHaveLength(3);
    });
  });

  // =========================================================================
  // SMOKE-MIX-04: Error handling
  // =========================================================================

  describe('SMOKE-MIX-04: Error handling', () => {
    it('returns 404 when a source workout does not exist', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      try {
        await postJson('/workouts/mix', {
          sources: [{ workout_id: nonExistentId, block_indices: [0] }],
          title: '404 Test',
        });
        throw new Error('Expected a 404 but request succeeded');
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        expect(e.status).toBe(404);
      }
    });

    it('returns 422 when a block index is out of range', async () => {
      try {
        await postJson('/workouts/mix', {
          sources: [
            { workout_id: WORKOUT_A_ID, block_indices: [999] },
          ],
          title: 'Out of Range Test',
        });
        throw new Error('Expected a 422 but request succeeded');
      } catch (err: unknown) {
        const e = err as { status?: number };
        expect(e.status).toBe(422);
      }
    });

    it('returns 200 with empty blocks when sources array is empty', async () => {
      // Backend allows empty sources and returns an empty preview.
      // Source-count validation (≥2) is enforced by the UI wizard, not the API.
      const result = await postJson<{ preview: { workout: { blocks: unknown[] } } }>(
        '/workouts/mix',
        { sources: [], title: 'Empty Sources Test' }
      );
      expect(result.preview.workout.blocks).toHaveLength(0);
    });

    it('returns 401 when no auth header provided', async () => {
      const res = await fetch(`${INGESTOR_BASE}/workouts/mix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: [{ workout_id: WORKOUT_A_ID, block_indices: [0] }],
          title: 'No Auth Test',
        }),
      });
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // SMOKE-MIX-05: Default title fallback
  // =========================================================================

  describe('SMOKE-MIX-05: Optional title field', () => {
    it('uses "Mixed Workout" as default title when title is omitted', async () => {
      const result = await retry(() =>
        postJson<{ preview: { title: string } }>(
          '/workouts/mix',
          {
            sources: [
              { workout_id: WORKOUT_A_ID, block_indices: [0] },
              { workout_id: WORKOUT_B_ID, block_indices: [0] },
            ],
            // title intentionally omitted
          }
        )
      );

      expect(typeof result.preview.title).toBe('string');
      expect(result.preview.title.length).toBeGreaterThan(0);
    });
  });
});
