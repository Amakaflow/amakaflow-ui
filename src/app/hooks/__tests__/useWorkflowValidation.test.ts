import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkflowValidation } from '../useWorkflowValidation';
import type { WorkoutStructure } from '../../../types/workout';

const { mockExportWorkoutToDevice } = vi.hoisted(() => ({
  mockExportWorkoutToDevice: vi.fn().mockResolvedValue({ yaml: 'exported' }),
}));

vi.mock('../../../lib/mapper-api', () => ({
  exportWorkoutToDevice: mockExportWorkoutToDevice,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockWorkout: WorkoutStructure = {
  title: 'Test Workout',
  blocks: [],
} as any;

const mockDevice = { id: 'garmin', name: 'Garmin', requiresMapping: true } as any;

function makeProps(overrides = {}) {
  return {
    selectedDevice: 'garmin' as const,
    setCurrentView: vi.fn(),
    ...overrides,
  };
}

describe('useWorkflowValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExportWorkoutToDevice.mockResolvedValue({ yaml: 'exported' });
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  it('starts with validation=null', () => {
    const { result } = renderHook(() => useWorkflowValidation(makeProps()));
    expect(result.current.validation).toBeNull();
  });

  it('starts with exports=null', () => {
    const { result } = renderHook(() => useWorkflowValidation(makeProps()));
    expect(result.current.exports).toBeNull();
  });

  it('starts with exportingWorkout=null', () => {
    const { result } = renderHook(() => useWorkflowValidation(makeProps()));
    expect(result.current.exportingWorkout).toBeNull();
  });

  it('starts with exportingWorkouts=[]', () => {
    const { result } = renderHook(() => useWorkflowValidation(makeProps()));
    expect(result.current.exportingWorkouts).toEqual([]);
  });

  it('starts with exportingDevice=null', () => {
    const { result } = renderHook(() => useWorkflowValidation(makeProps()));
    expect(result.current.exportingDevice).toBeNull();
  });

  // ── setValidation / setExports ─────────────────────────────────────────────

  it('setValidation updates validation state', () => {
    const { result } = renderHook(() => useWorkflowValidation(makeProps()));

    act(() => {
      result.current.setValidation({
        validated_exercises: [],
        needs_review: [],
        unmapped_exercises: [],
        can_proceed: true,
      } as any);
    });

    expect(result.current.validation).not.toBeNull();
    expect(result.current.validation?.can_proceed).toBe(true);
  });

  it('setExports updates exports state', () => {
    const { result } = renderHook(() => useWorkflowValidation(makeProps()));

    act(() => {
      result.current.setExports({ yaml: 'content' } as any);
    });

    expect(result.current.exports).toEqual({ yaml: 'content' });
  });

  // ── handleOpenExportPage ──────────────────────────────────────────────────

  it('handleOpenExportPage sets exportingWorkout, exportingDevice, and navigates to export-page', () => {
    const setCurrentView = vi.fn();
    const { result } = renderHook(() => useWorkflowValidation(makeProps({ setCurrentView })));

    act(() => {
      result.current.handleOpenExportPage(mockWorkout, mockDevice);
    });

    expect(result.current.exportingWorkout).toBe(mockWorkout);
    expect(result.current.exportingDevice).toBe('garmin');
    expect(setCurrentView).toHaveBeenCalledWith('export-page');
  });

  // ── handleInlineExport ────────────────────────────────────────────────────

  it('handleInlineExport calls exportWorkoutToDevice and shows success toast', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useWorkflowValidation(makeProps()));

    await act(async () => {
      await result.current.handleInlineExport(mockWorkout, mockDevice);
    });

    expect(mockExportWorkoutToDevice).toHaveBeenCalledWith(mockWorkout, 'garmin');
    expect(toast.success).toHaveBeenCalledWith('Exported to Garmin!');
  });

  it('handleInlineExport shows error toast when export fails', async () => {
    mockExportWorkoutToDevice.mockRejectedValueOnce(new Error('Connection lost'));
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useWorkflowValidation(makeProps()));

    await act(async () => {
      await result.current.handleInlineExport(mockWorkout, mockDevice);
    });

    expect(toast.error).toHaveBeenCalledWith('Connection lost');
  });

  it('handleInlineExport shows "Export failed" for non-Error exceptions', async () => {
    mockExportWorkoutToDevice.mockRejectedValueOnce('unknown');
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useWorkflowValidation(makeProps()));

    await act(async () => {
      await result.current.handleInlineExport(mockWorkout, mockDevice);
    });

    expect(toast.error).toHaveBeenCalledWith('Export failed');
  });

  // ── handleBatchExport ─────────────────────────────────────────────────────

  it('handleBatchExport sets exportingWorkouts, clears exportingWorkout/Device, navigates to export-page', () => {
    const setCurrentView = vi.fn();
    const { result } = renderHook(() => useWorkflowValidation(makeProps({ setCurrentView })));

    const workouts = [mockWorkout, { ...mockWorkout, title: 'Second' }] as WorkoutStructure[];

    act(() => {
      result.current.handleBatchExport(workouts);
    });

    expect(result.current.exportingWorkouts).toEqual(workouts);
    expect(result.current.exportingWorkout).toBeNull();
    expect(result.current.exportingDevice).toBeNull();
    expect(setCurrentView).toHaveBeenCalledWith('export-page');
  });

  // ── handleExportBack ──────────────────────────────────────────────────────

  it('handleExportBack resets all export state and navigates to workouts', () => {
    const setCurrentView = vi.fn();
    const { result } = renderHook(() => useWorkflowValidation(makeProps({ setCurrentView })));

    // First set up some export state
    act(() => {
      result.current.handleOpenExportPage(mockWorkout, mockDevice);
    });

    expect(result.current.exportingWorkout).not.toBeNull();
    setCurrentView.mockClear();

    act(() => {
      result.current.handleExportBack();
    });

    expect(result.current.exportingWorkout).toBeNull();
    expect(result.current.exportingWorkouts).toEqual([]);
    expect(result.current.exportingDevice).toBeNull();
    expect(setCurrentView).toHaveBeenCalledWith('workouts');
  });

  // ── resetExportState ──────────────────────────────────────────────────────

  it('resetExportState clears export state without navigating', () => {
    const setCurrentView = vi.fn();
    const { result } = renderHook(() => useWorkflowValidation(makeProps({ setCurrentView })));

    act(() => {
      result.current.handleOpenExportPage(mockWorkout, mockDevice);
    });

    setCurrentView.mockClear();

    act(() => {
      result.current.resetExportState();
    });

    expect(result.current.exportingWorkout).toBeNull();
    expect(result.current.exportingWorkouts).toEqual([]);
    expect(result.current.exportingDevice).toBeNull();
    expect(setCurrentView).not.toHaveBeenCalled();
  });
});
