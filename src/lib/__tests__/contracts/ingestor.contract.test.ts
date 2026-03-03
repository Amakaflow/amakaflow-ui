import { describe, it, expect } from 'vitest';
import { WorkoutStructureResponseSchema } from '../../../api/schemas/ingestor';
import { API_URLS } from '../../config';

const BASE = API_URLS.INGESTOR;

async function isApiAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

describe('ingestor-api contract', () => {
  it('POST /ingest/ai_workout returns valid WorkoutStructure shape', async () => {
    if (!await isApiAvailable()) return;
    const r = await fetch(`${BASE}/ingest/ai_workout`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', 'x-test-user-id': 'contract-test-user' },
      body: 'Push day: bench press 3x10, overhead press 3x8, lateral raises 3x15',
    });
    expect(r.ok).toBe(true);
    const data = await r.json();
    expect(() => WorkoutStructureResponseSchema.parse(data)).not.toThrow();
  });
});
