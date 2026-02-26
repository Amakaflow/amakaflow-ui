import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../lib/workout-operations-api', () => ({
  applyWorkoutOperations: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { applyWorkoutOperations } from '../../../lib/workout-operations-api';
import { WorkoutEditSheet } from '../WorkoutEditSheet';

const mockApply = applyWorkoutOperations as ReturnType<typeof vi.fn>;

const WORKOUT = {
  id: 'wk-1',
  title: 'Test Workout',
  updated_at: '2026-01-01T00:00:00Z',
  workout_data: {
    title: 'Test Workout',
    blocks: [{ label: 'Block A', exercises: [{ name: 'Squat', sets: 3, reps: 10 }] }],
  },
};

describe('WorkoutEditSheet', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders workout title when open', () => {
    render(
      <WorkoutEditSheet
        workout={WORKOUT}
        open={true}
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    expect(screen.getByText('Edit Workout')).toBeInTheDocument();
  });

  it('does not render when open=false', () => {
    render(
      <WorkoutEditSheet
        workout={WORKOUT}
        open={false}
        onClose={() => {}}
        onSaved={() => {}}
      />
    );
    expect(screen.queryByText('Edit Workout')).not.toBeInTheDocument();
  });

  it('calls applyWorkoutOperations on Save after an edit', async () => {
    mockApply.mockResolvedValueOnce({ workout: { ...WORKOUT.workout_data, updated_at: '2026-01-02T00:00:00Z', id: 'wk-1', title: 'Test Workout' } });
    const onSaved = vi.fn();
    render(
      <WorkoutEditSheet workout={WORKOUT} open={true} onClose={() => {}} onSaved={onSaved} />
    );

    // Make a change: rename the workout via the title input
    fireEvent.click(screen.getByLabelText('Rename workout'));
    const input = screen.getByDisplayValue('Test Workout');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled());

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockApply).toHaveBeenCalledWith(
        'wk-1',
        expect.arrayContaining([{ op: 'rename_workout', title: 'New Name' }]),
        '2026-01-01T00:00:00Z'
      );
      expect(onSaved).toHaveBeenCalled();
    });
  });

  it('shows conflict banner on 409', async () => {
    const err = Object.assign(new Error('Conflict'), { status: 409 });
    mockApply.mockRejectedValueOnce(err);
    render(
      <WorkoutEditSheet workout={WORKOUT} open={true} onClose={() => {}} onSaved={() => {}} />
    );

    fireEvent.click(screen.getByLabelText('Rename workout'));
    const input = screen.getByDisplayValue('Test Workout');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText(/updated elsewhere/i)).toBeInTheDocument();
    });
  });

  it('Save button is disabled when no ops have been made', () => {
    render(
      <WorkoutEditSheet workout={WORKOUT} open={true} onClose={() => {}} onSaved={() => {}} />
    );
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });
});
