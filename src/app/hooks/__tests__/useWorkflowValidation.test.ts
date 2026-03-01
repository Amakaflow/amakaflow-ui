import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkflowValidation } from '../useWorkflowValidation';

vi.mock('../../../lib/mapper-api', () => ({
  checkMapperApiHealth: vi.fn().mockResolvedValue(true),
  validateWorkoutMapping: vi.fn().mockResolvedValue({
    validated_exercises: [{ name: 'Push Up' }],
    needs_review: [],
    unmapped_exercises: [],
    can_proceed: true,
  }),
  processWorkoutWithValidation: vi.fn().mockResolvedValue({
    validation: {
      validated_exercises: [],
      needs_review: [],
      unmapped_exercises: [],
      can_proceed: true,
    },
    yaml: 'yaml-content',
  }),
  exportWorkoutToDevice: vi.fn().mockResolvedValue({ yaml: 'export-yaml' }),
}));

vi.mock('../../../lib/workout-history', () => ({
  saveWorkoutToHistory: vi.fn().mockResolvedValue(undefined),
  getWorkoutHistory: vi.fn().mockResolvedValue([]),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

const mockWorkout = { title: 'Test', blocks: [], name: 'Test' };

const defaultProps = {
  workout: mockWorkout as any,
  userId: 'user-1',
  selectedDevice: 'garmin' as const,
  user: { id: 'user-1', mode: 'standard' } as any,
  sources: [] as any[],
  stravaConnected: false,
  editingWorkoutId: null as string | null,
  setWorkout: vi.fn(),
  setWorkoutSaved: vi.fn(),
  setValidation: vi.fn(),
  setExports: vi.fn(),
  onStepChange: vi.fn(),
  refreshHistory: vi.fn().mockResolvedValue(undefined),
};

describe('useWorkflowValidation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts with loading=false', () => {
    const { result } = renderHook(() => useWorkflowValidation(defaultProps));
    expect(result.current.loading).toBe(false);
  });

  it('handleValidate: calls setValidation with result on success and resets loading', async () => {
    const setValidation = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowValidation({ ...defaultProps, setValidation })
    );

    await act(async () => {
      await result.current.handleValidate();
    });

    expect(setValidation).toHaveBeenCalledWith(
      expect.objectContaining({ can_proceed: true })
    );
    expect(result.current.loading).toBe(false);
  });

  it('handleValidate: loading resets to false on API error', async () => {
    const { validateWorkoutMapping } = await import('../../../lib/mapper-api');
    (validateWorkoutMapping as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('API error')
    );

    const { result } = renderHook(() => useWorkflowValidation(defaultProps));

    await act(async () => {
      await result.current.handleValidate();
    });

    expect(result.current.loading).toBe(false);
  });
});
