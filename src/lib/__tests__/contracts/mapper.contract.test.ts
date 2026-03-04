// src/lib/__tests__/contracts/mapper.contract.test.ts
import { ValidationResponseSchema } from '../../../api/schemas/mapper';
import { API_URLS } from '../../../lib/config';

const TEST_EXERCISES = ['bench press', 'overhead press', 'squat'];

async function isMapperAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URLS.MAPPER}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

describe('mapper-api contract', () => {
  it('POST /exercises/match returns a shape conforming to ValidationResponseSchema', async ({ skip }) => {
    if (!await isMapperAvailable()) skip();

    const res = await fetch(`${API_URLS.MAPPER}/exercises/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user-id': 'contract-test',
      },
      body: JSON.stringify({ exercises: TEST_EXERCISES }),
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(() => ValidationResponseSchema.parse(data)).not.toThrow();
  });
});
