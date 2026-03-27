import { describe, it, expect } from 'vitest';
import { WorkoutEventSchema } from '../../../api/schemas/calendar';
import { API_URLS } from '../../config';

const BASE = API_URLS.CALENDAR;

async function isApiAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

const today = new Date().toISOString().slice(0, 10);
const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

describe('calendar-api contract', () => {
  it('GET /calendar returns array of valid WorkoutEvent shapes', async () => {
    if (!await isApiAvailable()) return;
    const r = await fetch(`${BASE}/calendar?start=${today}&end=${nextWeek}`, {
      headers: { 'x-test-user-id': 'contract-test-user' },
    });
    expect(r.ok).toBe(true);
    const data = await r.json();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      for (const event of data) {
        expect(() => WorkoutEventSchema.parse(event)).not.toThrow();
      }
    }
  });
});
