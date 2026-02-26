import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock authenticatedFetch before importing the module under test
vi.mock('../authenticated-fetch', () => ({
  authenticatedFetch: vi.fn(),
}));

import { authenticatedFetch } from '../authenticated-fetch';
import { applyWorkoutOperations, mixWorkouts } from '../workout-operations-api';

const mockFetch = authenticatedFetch as ReturnType<typeof vi.fn>;

function mockOk(data: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
}

function mockErr(status: number, body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve(body),
  } as Response);
}

describe('applyWorkoutOperations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POSTs to /workouts/{id}/operations and returns response', async () => {
    const responseData = { workout: { id: 'wk-1', title: 'Renamed', workout_data: {}, updated_at: '2026-01-01T00:00:00Z' } };
    mockOk(responseData);

    const result = await applyWorkoutOperations(
      'wk-1',
      [{ op: 'rename_workout', title: 'Renamed' }],
      '2026-01-01T00:00:00Z'
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/workouts/wk-1/operations'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.workout.title).toBe('Renamed');
  });

  it('throws with status on 409 conflict', async () => {
    mockErr(409, { current_workout: { id: 'wk-1' } });
    await expect(
      applyWorkoutOperations('wk-1', [], '2020-01-01T00:00:00Z')
    ).rejects.toMatchObject({ status: 409 });
  });

  it('throws with status on 422 invalid op', async () => {
    mockErr(422, { error: 'operation_invalid', detail: 'bad op' });
    await expect(
      applyWorkoutOperations('wk-1', [{ op: 'delete_exercise', block_index: 0, exercise_index: 99 }], '2026-01-01T00:00:00Z')
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe('mixWorkouts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POSTs to /workouts/mix and returns preview', async () => {
    const preview = {
      preview: {
        id: 'mix-1', title: 'Mixed', workout: { title: 'Mixed', blocks: [], metadata: { mixer_sources: {} } },
        exercise_count: 2, block_count: 2,
      },
    };
    mockOk(preview);

    const result = await mixWorkouts(
      [{ workout_id: 'wk-1', block_indices: [0] }, { workout_id: 'wk-2', block_indices: [0] }],
      'Mixed'
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/workouts/mix'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(result.preview.title).toBe('Mixed');
  });

  it('throws on 404 source not found', async () => {
    mockErr(404, { detail: { workout_id: 'missing' } });
    await expect(
      mixWorkouts([{ workout_id: 'missing', block_indices: [0] }], 'x')
    ).rejects.toMatchObject({ status: 404 });
  });
});
