// src/lib/__tests__/contracts/ingestor.contract.test.ts
import { WorkoutStructureSchema } from '../../../api/schemas/ingestor';
import { API_URLS } from '../../../lib/config';

const TEST_BODY = 'bench press 3x10, overhead press 3x8, squat 3x8';

async function isIngestorAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URLS.INGESTOR}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

describe('ingestor-api contract', () => {
  it('POST /ingest/ai_workout returns a shape conforming to WorkoutStructureSchema', async () => {
    if (!await isIngestorAvailable()) return;

    const res = await fetch(`${API_URLS.INGESTOR}/ingest/ai_workout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'x-test-user-id': 'contract-test',
      },
      body: TEST_BODY,
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(() => WorkoutStructureSchema.parse(data)).not.toThrow();
  });
});
