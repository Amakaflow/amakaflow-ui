import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('../../../lib/bulk-import-api', () => ({
  bulkImportApi: {
    applyPreviewOperations: vi.fn(),
  },
}));

vi.mock('../../../context/BulkImportContext', () => ({
  useBulkImport: () => ({
    state: {
      jobId: 'job-1',
      preview: {
        workouts: [
          {
            id: 'item-1',
            detectedItemId: 'item-1',
            title: 'Test Workout',
            exerciseCount: 1,
            blockCount: 1,
            validationIssues: [],
            workout: {
              title: 'Test Workout',
              blocks: [{ label: 'Block A', exercises: [{ name: 'Squat', sets: 3, reps: 10 }] }],
            },
            selected: true,
            isDuplicate: false,
          },
        ],
        stats: { totalSelected: 1, exercisesMatched: 1, validationErrors: 0, validationWarnings: 0, duplicatesFound: 0 },
      },
      loading: false,
    },
    dispatch: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useBulkImportApi', () => ({
  useBulkImportApi: () => ({ generatePreview: vi.fn() }),
}));

import { bulkImportApi } from '../../../lib/bulk-import-api';
import { PreviewStep } from '../PreviewStep';

const mockApply = (bulkImportApi.applyPreviewOperations as ReturnType<typeof vi.fn>);

describe('PreviewStep inline editing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows Edit button for each workout card', () => {
    render(<PreviewStep userId="user-1" onStartImport={() => {}} />);
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('expands editor when Edit is clicked', async () => {
    render(<PreviewStep userId="user-1" onStartImport={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    await waitFor(() => {
      expect(screen.getByText('Squat')).toBeInTheDocument();
    });
  });

  it('calls applyPreviewOperations when a rename op is made', async () => {
    mockApply.mockResolvedValueOnce({
      preview: {
        id: 'item-1', title: 'Test Workout',
        workout: { title: 'Test Workout', blocks: [{ label: 'Block A', exercises: [{ name: 'Goblet Squat', sets: 3, reps: 10 }] }] },
        exercise_count: 1, block_count: 1,
      },
    });

    render(<PreviewStep userId="user-1" onStartImport={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    await waitFor(() => screen.getByText('Squat'));

    fireEvent.click(screen.getByLabelText('Rename Squat'));
    const input = screen.getByDisplayValue('Squat');
    fireEvent.change(input, { target: { value: 'Goblet Squat' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockApply).toHaveBeenCalledWith(
        'job-1',
        'item-1',
        expect.arrayContaining([{ op: 'rename_exercise', block_index: 0, exercise_index: 0, name: 'Goblet Squat' }])
      );
    });
  });

  it('collapses editor when Edit is clicked again', async () => {
    render(<PreviewStep userId="user-1" onStartImport={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    await waitFor(() => screen.getByText('Squat'));
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    await waitFor(() => {
      expect(screen.queryByText('Squat')).not.toBeInTheDocument();
    });
  });
});
