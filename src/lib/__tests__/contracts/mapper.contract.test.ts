import { describe, it, expect } from 'vitest';
import { SavedWorkoutSchema } from '../../../api/schemas/mapper';
import { API_URLS } from '../../config';

const BASE = API_URLS.MAPPER;

async function isApiAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

describe('mapper-api contract', () => {
  it('GET /workouts returns array with valid SavedWorkout shapes', async () => {
    if (!await isApiAvailable()) return;
    const r = await fetch(`${BASE}/workouts?profile_id=contract-test-user`, {
      headers: { 'x-test-user-id': 'contract-test-user' },
    });
    expect(r.ok).toBe(true);
    const data = await r.json();
    expect(data).toHaveProperty('workouts');
    expect(Array.isArray(data.workouts)).toBe(true);
    for (const w of data.workouts) {
      expect(() => SavedWorkoutSchema.parse(w)).not.toThrow();
    }
  });
});
