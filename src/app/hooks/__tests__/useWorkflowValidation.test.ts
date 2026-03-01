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

  // --- New tests ---

  it('handleValidate: calls onStepChange("validate") on success', async () => {
    const onStepChange = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowValidation({ ...defaultProps, onStepChange })
    );

    await act(async () => {
      await result.current.handleValidate();
    });

    expect(onStepChange).toHaveBeenCalledWith('validate');
  });

  it('handleValidate: shows warning toast when can_proceed=false', async () => {
    const { validateWorkoutMapping } = await import('../../../lib/mapper-api');
    (validateWorkoutMapping as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      validated_exercises: [],
      needs_review: [{ name: 'Unknown Move' }],
      unmapped_exercises: [],
      can_proceed: false,
    });

    const { toast } = await import('sonner');
    const { result } = renderHook(() => useWorkflowValidation(defaultProps));

    await act(async () => {
      await result.current.handleValidate();
    });

    expect(toast.warning).toHaveBeenCalledWith('Some exercises need review');
  });

  it('handleValidate: returns early (no API call) when workout is null', async () => {
    const { validateWorkoutMapping } = await import('../../../lib/mapper-api');
    const { result } = renderHook(() =>
      useWorkflowValidation({ ...defaultProps, workout: null })
    );

    await act(async () => {
      await result.current.handleValidate();
    });

    expect(validateWorkoutMapping).not.toHaveBeenCalled();
  });

  it('handleReValidate: calls setValidation and setWorkout with the updated workout', async () => {
    const setValidation = vi.fn();
    const setWorkout = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowValidation({ ...defaultProps, setValidation, setWorkout })
    );

    const updatedWorkout = { ...mockWorkout, title: 'Updated' } as any;

    await act(async () => {
      await result.current.handleReValidate(updatedWorkout);
    });

    expect(setValidation).toHaveBeenCalledWith(
      expect.objectContaining({ can_proceed: true })
    );
    expect(setWorkout).toHaveBeenCalledWith(updatedWorkout);
  });

  it('handleProcess: calls setExports, setValidation, onStepChange("export") on success', async () => {
    const setExports = vi.fn();
    const setValidation = vi.fn();
    const onStepChange = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowValidation({ ...defaultProps, setExports, setValidation, onStepChange })
    );

    await act(async () => {
      await result.current.handleProcess(mockWorkout as any);
    });

    expect(setExports).toHaveBeenCalledWith(expect.objectContaining({ yaml: expect.any(String) }));
    expect(setValidation).toHaveBeenCalled();
    expect(onStepChange).toHaveBeenCalledWith('export');
  });

  it('handleProcess: calls saveWorkoutToHistory when user is provided', async () => {
    const { saveWorkoutToHistory } = await import('../../../lib/workout-history');
    const { result } = renderHook(() =>
      useWorkflowValidation({ ...defaultProps, user: { id: 'user-1', mode: 'standard' } as any })
    );

    await act(async () => {
      await result.current.handleProcess(mockWorkout as any);
    });

    expect(saveWorkoutToHistory).toHaveBeenCalledWith(
      'user-1',
      mockWorkout,
      'garmin',
      expect.anything(),
      expect.anything(),
      expect.anything(),
      undefined
    );
  });

  it('handleAutoMap: calls setExports and onStepChange("export") on success', async () => {
    const setExports = vi.fn();
    const onStepChange = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowValidation({ ...defaultProps, setExports, onStepChange })
    );

    await act(async () => {
      await result.current.handleAutoMap();
    });

    expect(setExports).toHaveBeenCalledWith(expect.objectContaining({ yaml: 'export-yaml' }));
    expect(onStepChange).toHaveBeenCalledWith('export');
  });

  it('handleProcess: resets loading to false on error', async () => {
    const { processWorkoutWithValidation } = await import('../../../lib/mapper-api');
    (processWorkoutWithValidation as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Process failed')
    );

    const { result } = renderHook(() => useWorkflowValidation(defaultProps));

    await act(async () => {
      await result.current.handleProcess(mockWorkout as any);
    });

    expect(result.current.loading).toBe(false);
  });
});
