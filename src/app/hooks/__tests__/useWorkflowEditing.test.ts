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
});
