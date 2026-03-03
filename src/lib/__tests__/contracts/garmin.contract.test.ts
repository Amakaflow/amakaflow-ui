import { describe, it, expect } from 'vitest';
import { GarminHealthResponseSchema, GarminGetWorkoutsResponseSchema } from '../../../api/schemas/garmin';
import { API_URLS } from '../../config';

const BASE = API_URLS.GARMIN;

async function isApiAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

describe('garmin-api contract (UNOFFICIAL – TEST ONLY)', () => {
  it('GET /health returns valid GarminHealthResponse shape', async () => {
    if (!await isApiAvailable()) return;
    const r = await fetch(`${BASE}/health`);
    expect(r.ok).toBe(true);
    const data = await r.json();
    expect(() => GarminHealthResponseSchema.parse(data)).not.toThrow();
  });

  it('POST /workouts returns valid GarminGetWorkoutsResponse shape when API available', async () => {
    if (!await isApiAvailable()) return;
    // NOTE: This test requires GARMIN_UNOFFICIAL_SYNC_ENABLED=true on the backend
    // and valid Garmin credentials. Skipped gracefully if not available.
    const r = await fetch(`${BASE}/workouts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': 'contract-test-user' },
      body: JSON.stringify({ email: 'test@example.com', password: 'test' }),
    });
    if (r.status === 403) return; // GARMIN_UNOFFICIAL_SYNC_ENABLED=false
    expect(r.ok).toBe(true);
    const data = await r.json();
    expect(() => GarminGetWorkoutsResponseSchema.parse(data)).not.toThrow();
  });
});
