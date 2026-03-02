import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkflowEditing } from '../useWorkflowEditing';
import type { ProcessedItem } from '../../../types/import';

vi.mock('../../../lib/workout-history', () => ({
  saveWorkoutToHistory: vi.fn().mockResolvedValue(undefined),
  deleteWorkoutFromHistory: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../lib/api', () => ({
  normalizeWorkoutStructure: vi.fn((w: unknown) => w),
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
  userId: 'user-1',
  selectedDevice: 'garmin' as const,
  setSelectedDevice: vi.fn(),
  refreshHistory: vi.fn().mockResolvedValue(undefined),
  onStepChange: vi.fn(),
  onViewChange: vi.fn(),
  setWorkout: vi.fn(),
  setWorkoutSaved: vi.fn(),
  setSources: vi.fn(),
  setValidation: vi.fn(),
  setExports: vi.fn(),
  setConfirmDialog: vi.fn(),
  workout: null as any,
  workoutSaved: false,
  importProcessedItems: [] as ProcessedItem[],
  setImportProcessedItems: vi.fn() as any,
};

describe('useWorkflowEditing', () => {
  beforeEach(() => vi.clearAllMocks());

  it('starts with all editing flags false', () => {
    const { result } = renderHook(() => useWorkflowEditing(defaultProps));
    expect(result.current.isEditingFromHistory).toBe(false);
    expect(result.current.isEditingFromImport).toBe(false);
    expect(result.current.isCreatingFromScratch).toBe(false);
    expect(result.current.editingWorkoutId).toBeNull();
  });

  it('handleEditFromHistory sets isEditingFromHistory=true and calls setWorkout', () => {
    const setWorkout = vi.fn();
    const { result } = renderHook(() => useWorkflowEditing({ ...defaultProps, setWorkout }));

    const historyItem = {
      id: 'hist-1',
      workout: mockWorkout,
      sources: [],
      device: 'garmin',
      validation: null,
      exports: null,
    };

    act(() => {
      result.current.handleEditFromHistory(historyItem);
    });

    expect(result.current.isEditingFromHistory).toBe(true);
    expect(result.current.editingWorkoutId).toBe('hist-1');
    expect(setWorkout).toHaveBeenCalled();
  });

  it('handleEditFromImport sets isEditingFromImport=true', () => {
    const { result } = renderHook(() => useWorkflowEditing(defaultProps));

    act(() => {
      result.current.handleEditFromImport('queue-1', mockWorkout as any);
    });

    expect(result.current.isEditingFromImport).toBe(true);
    expect(result.current.editingImportQueueId).toBe('queue-1');
  });

  it('handleBackToImport calls onViewChange with import and resets flags', () => {
    const onViewChange = vi.fn();
    const setImportProcessedItems = vi.fn();
    const processedItem: ProcessedItem = {
      queueId: 'queue-1',
      status: 'done',
      workout: mockWorkout as any,
      workoutTitle: 'Test',
      blockCount: 0,
      exerciseCount: 0,
      sourceIcon: 'file',
    };

    const { result } = renderHook(() =>
      useWorkflowEditing({
        ...defaultProps,
        onViewChange,
        setImportProcessedItems,
        importProcessedItems: [processedItem],
      })
    );

    act(() => {
      result.current.handleEditFromImport('queue-1', mockWorkout as any);
    });

    act(() => {
      result.current.handleBackToImport(mockWorkout as any);
    });

    expect(onViewChange).toHaveBeenCalledWith('import');
    expect(result.current.isEditingFromImport).toBe(false);
  });

  // --- New tests ---

  it('handleLoadFromHistory: calls setWorkout, setValidation, setExports, setWorkoutSaved(true), onViewChange("workflow"), onStepChange("export"), sets isEditingFromHistory=true and editingWorkoutId', () => {
    const setWorkout = vi.fn();
    const setValidation = vi.fn();
    const setExports = vi.fn();
    const setWorkoutSaved = vi.fn();
    const onViewChange = vi.fn();
    const onStepChange = vi.fn();

    const historyItem = {
      id: 'hist-42',
      workout: mockWorkout,
      sources: ['text:hello'],
      device: 'garmin',
      validation: { can_proceed: true },
      exports: { yaml: 'yaml-content' },
    };

    const { result } = renderHook(() =>
      useWorkflowEditing({
        ...defaultProps,
        setWorkout,
        setValidation,
        setExports,
        setWorkoutSaved,
        onViewChange,
        onStepChange,
      })
    );

    act(() => {
      result.current.handleLoadFromHistory(historyItem);
    });

    expect(setWorkout).toHaveBeenCalledWith(mockWorkout);
    expect(setValidation).toHaveBeenCalledWith({ can_proceed: true });
    expect(setExports).toHaveBeenCalledWith({ yaml: 'yaml-content' });
    expect(setWorkoutSaved).toHaveBeenCalledWith(true);
    expect(onViewChange).toHaveBeenCalledWith('workflow');
    expect(onStepChange).toHaveBeenCalledWith('export');
    expect(result.current.isEditingFromHistory).toBe(true);
    expect(result.current.editingWorkoutId).toBe('hist-42');
  });

  it('handleBulkDeleteWorkouts: calls deleteWorkoutFromHistory for each ID and refreshHistory on success', async () => {
    const { deleteWorkoutFromHistory } = await import('../../../lib/workout-history');
    const refreshHistory = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useWorkflowEditing({ ...defaultProps, refreshHistory })
    );

    await act(async () => {
      await result.current.handleBulkDeleteWorkouts(['id-1', 'id-2']);
    });

    expect(deleteWorkoutFromHistory).toHaveBeenCalledWith('id-1', 'user-1');
    expect(deleteWorkoutFromHistory).toHaveBeenCalledWith('id-2', 'user-1');
    expect(refreshHistory).toHaveBeenCalledTimes(1);
  });

  it('handleBulkDeleteWorkouts: shows warning toast when some fail and some succeed', async () => {
    const { deleteWorkoutFromHistory } = await import('../../../lib/workout-history');
    // First call succeeds, second fails
    (deleteWorkoutFromHistory as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const { toast } = await import('sonner');
    const { result } = renderHook(() => useWorkflowEditing(defaultProps));

    await act(async () => {
      await result.current.handleBulkDeleteWorkouts(['id-1', 'id-2']);
    });

    expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining('Deleted 1 workout(s). Failed to delete 1.')
    );
  });

  it('handleBulkDeleteWorkouts: no-op when called with empty array', async () => {
    const { deleteWorkoutFromHistory } = await import('../../../lib/workout-history');
    const refreshHistory = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useWorkflowEditing({ ...defaultProps, refreshHistory })
    );

    await act(async () => {
      await result.current.handleBulkDeleteWorkouts([]);
    });

    expect(deleteWorkoutFromHistory).not.toHaveBeenCalled();
    expect(refreshHistory).not.toHaveBeenCalled();
  });

  it('handleSaveFromStructure: calls saveWorkoutToHistory, sets workoutSaved, navigates to "workouts" when isEditingFromHistory', async () => {
    const { saveWorkoutToHistory } = await import('../../../lib/workout-history');
    const setWorkoutSaved = vi.fn();
    const onViewChange = vi.fn();
    const refreshHistory = vi.fn().mockResolvedValue(undefined);

    const historyItem = {
      id: 'hist-10',
      workout: mockWorkout,
      sources: [],
      device: 'garmin',
      validation: null,
      exports: null,
    };

    const { result } = renderHook(() =>
      useWorkflowEditing({
        ...defaultProps,
        workout: mockWorkout as any,
        setWorkoutSaved,
        onViewChange,
        refreshHistory,
      })
    );

    // First load from history so isEditingFromHistory=true
    act(() => {
      result.current.handleLoadFromHistory(historyItem);
    });

    await act(async () => {
      await result.current.handleSaveFromStructure(null, [], null);
    });

    expect(saveWorkoutToHistory).toHaveBeenCalled();
    expect(setWorkoutSaved).toHaveBeenCalledWith(true);
    expect(onViewChange).toHaveBeenCalledWith('workouts');
  });

  it('handleSaveFromStructure: shows error toast when saveWorkoutToHistory throws', async () => {
    const { saveWorkoutToHistory } = await import('../../../lib/workout-history');
    (saveWorkoutToHistory as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('DB error')
    );

    const { toast } = await import('sonner');
    const { result } = renderHook(() =>
      useWorkflowEditing({ ...defaultProps, workout: mockWorkout as any })
    );

    await act(async () => {
      await result.current.handleSaveFromStructure(null, [], null);
    });

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('DB error'));
  });

  it('reset: resets all editing flags to false and IDs to null', () => {
    const { result } = renderHook(() => useWorkflowEditing(defaultProps));

    // Put the hook into an editing state
    act(() => {
      result.current.handleEditFromImport('queue-99', mockWorkout as any);
    });

    expect(result.current.isEditingFromImport).toBe(true);
    expect(result.current.editingImportQueueId).toBe('queue-99');

    act(() => {
      result.current.reset();
    });

    expect(result.current.isEditingFromHistory).toBe(false);
    expect(result.current.isCreatingFromScratch).toBe(false);
    expect(result.current.isEditingFromImport).toBe(false);
    expect(result.current.editingWorkoutId).toBeNull();
    expect(result.current.editingImportQueueId).toBeNull();
  });
});
