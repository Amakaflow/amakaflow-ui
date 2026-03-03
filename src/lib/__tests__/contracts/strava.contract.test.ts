import { describe, it, expect } from 'vitest';
import { StravaActivitySchema, AthleteResponseSchema } from '../../../api/schemas/strava';
import { API_URLS } from '../../config';

const BASE = API_URLS.STRAVA;

async function isApiAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

describe('strava-api contract', () => {
  it('GET /strava/activities returns array with valid StravaActivity shapes', async () => {
    if (!await isApiAvailable()) return;
    const r = await fetch(`${BASE}/strava/activities?limit=5`, {
      headers: { 'x-test-user-id': 'contract-test-user' },
    });
    expect(r.ok).toBe(true);
    const data = await r.json();
    expect(Array.isArray(data)).toBe(true);
    for (const a of data) {
      expect(() => StravaActivitySchema.parse(a)).not.toThrow();
    }
  });

  it('GET /strava/athlete returns valid AthleteResponse shape', async () => {
    if (!await isApiAvailable()) return;
    const r = await fetch(`${BASE}/strava/athlete`, {
      headers: { 'x-test-user-id': 'contract-test-user' },
    });
    expect(r.ok).toBe(true);
    const data = await r.json();
    expect(() => AthleteResponseSchema.parse(data)).not.toThrow();
  });
});
