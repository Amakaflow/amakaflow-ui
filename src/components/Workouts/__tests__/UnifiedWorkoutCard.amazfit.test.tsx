import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { UnifiedWorkoutCard } from '../UnifiedWorkoutCard';
import { pushToAmazfit } from '../../../lib/mapper-api';
import { server } from '../../../test/mocks/server';
import type { UnifiedWorkout } from '../../../types/unified-workout';

const MAPPER = 'http://localhost:8001';

function makeWorkout(overrides: Partial<UnifiedWorkout> = {}): UnifiedWorkout {
  return {
    id: 'workout-001',
    title: 'Amazfit Push Test Workout',
    category: 'strength',
    sourceType: 'manual',
    durationSec: 1800,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    exerciseCount: 3,
    exerciseNames: ['Squat', 'Push Up', 'Run'],
    syncStatus: {},
    _original: {
      type: 'history',
      data: {
        id: 'workout-001',
        workout: { blocks: [] },
      } as any,
    },
    searchableText: 'amazfit push test workout squat push up run',
    isFavorite: false,
    timesCompleted: 0,
    tags: [],
    ...overrides,
  };
}

describe('Amazfit workout push', () => {
  it('pushToAmazfit posts to the mapper Amazfit push endpoint', async () => {
    let requestedPath = '';

    server.use(
      http.post(`${MAPPER}/workouts/:workoutId/push/amazfit`, ({ params }) => {
        requestedPath = `/workouts/${params.workoutId}/push/amazfit`;
        return HttpResponse.json({
          success: true,
          workout_id: params.workoutId,
          status: 'pending',
        });
      }),
    );

    const result = await pushToAmazfit('workout-001');

    expect(requestedPath).toBe('/workouts/workout-001/push/amazfit');
    expect(result).toMatchObject({
      success: true,
      workout_id: 'workout-001',
      status: 'pending',
    });
  });

  it('shows a visible Push to Amazfit action and success state without claiming execution', async () => {
    const user = userEvent.setup();
    const workout = makeWorkout();

    render(<UnifiedWorkoutCard workout={workout} />);

    await user.click(screen.getByRole('button', { name: /push to amazfit/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ready on amazfit/i })).toBeInTheDocument();
    });
    expect(screen.queryByText(/executed|completed on amazfit/i)).not.toBeInTheDocument();
  });

  it('allows retry after an Amazfit push failure', async () => {
    const user = userEvent.setup();
    let attempts = 0;

    server.use(
      http.post(`${MAPPER}/workouts/:workoutId/push/amazfit`, () => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json({ detail: 'temporary mapper outage' }, { status: 503 });
        }
        return HttpResponse.json({ success: true, status: 'pending' });
      }),
    );

    render(<UnifiedWorkoutCard workout={makeWorkout()} />);

    await user.click(screen.getByRole('button', { name: /push to amazfit/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /failed.*retry/i })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: /failed.*retry/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ready on amazfit/i })).toBeInTheDocument();
    });
    expect(attempts).toBe(2);
  });
});
