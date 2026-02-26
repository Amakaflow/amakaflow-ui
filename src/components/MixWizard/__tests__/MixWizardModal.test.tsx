import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../lib/workout-operations-api', () => ({
  mixWorkouts: vi.fn(),
}));

import { mixWorkouts } from '../../../lib/workout-operations-api';
import { MixWizardModal } from '../MixWizardModal';

const mockMix = mixWorkouts as ReturnType<typeof vi.fn>;

const WORKOUTS = [
  {
    id: 'wk-1', title: 'Workout A', sourceType: 'device',
    _original: { type: 'history', data: { id: 'wk-1', title: 'Workout A', workout_data: { blocks: [{ label: 'Push', exercises: [{ name: 'Bench', sets: 3, reps: 8 }] }] }, updated_at: '2026-01-01T00:00:00Z' } }
  },
  {
    id: 'wk-2', title: 'Workout B', sourceType: 'device',
    _original: { type: 'history', data: { id: 'wk-2', title: 'Workout B', workout_data: { blocks: [{ label: 'Legs', exercises: [{ name: 'Squat', sets: 4, reps: 10 }] }] }, updated_at: '2026-01-01T00:00:00Z' } }
  },
];

describe('MixWizardModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders step 1 when open', () => {
    render(<MixWizardModal open={true} workouts={WORKOUTS as any} onClose={() => {}} onSave={() => {}} />);
    expect(screen.getByText(/select workouts/i)).toBeInTheDocument();
  });

  it('does not render when open=false', () => {
    render(<MixWizardModal open={false} workouts={WORKOUTS as any} onClose={() => {}} onSave={() => {}} />);
    expect(screen.queryByText(/select workouts/i)).not.toBeInTheDocument();
  });

  it('advances to step 2 after selecting workouts', async () => {
    render(<MixWizardModal open={true} workouts={WORKOUTS as any} onClose={() => {}} onSave={() => {}} />);

    fireEvent.click(screen.getByText('Workout A'));
    fireEvent.click(screen.getByText('Workout B'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/select blocks/i)).toBeInTheDocument();
    });
  });

  it('calls mixWorkouts when reaching step 3', async () => {
    mockMix.mockResolvedValueOnce({
      preview: {
        id: 'mix-1', title: 'Push + Legs',
        workout: { title: 'Push + Legs', blocks: [{ label: 'Push', exercises: [] }, { label: 'Legs', exercises: [] }], metadata: { mixer_sources: { 'wk-1': ['Push'], 'wk-2': ['Legs'] } } },
        exercise_count: 2, block_count: 2,
      },
    });

    render(<MixWizardModal open={true} workouts={WORKOUTS as any} onClose={() => {}} onSave={() => {}} />);

    // Step 1
    fireEvent.click(screen.getByText('Workout A'));
    fireEvent.click(screen.getByText('Workout B'));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => screen.getByText(/select blocks/i));

    // Step 2 → step 3
    fireEvent.click(screen.getByRole('button', { name: /preview/i }));

    await waitFor(() => {
      expect(mockMix).toHaveBeenCalled();
    });
  });
});
