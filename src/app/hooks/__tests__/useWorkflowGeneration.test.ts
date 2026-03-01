import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkflowGeneration } from '../useWorkflowGeneration';

// Use vi.hoisted so these are available when vi.mock factories run (which are hoisted)
const {
  mockGenerateWorkoutStructureReal,
  mockCheckApiHealth,
  mockCreateEmptyWorkout,
} = vi.hoisted(() => ({
  mockGenerateWorkoutStructureReal: vi.fn(),
  mockCheckApiHealth: vi.fn().mockResolvedValue(true),
  mockCreateEmptyWorkout: vi.fn(),
}));

vi.mock('../../../lib/api', () => ({
  checkApiHealth: mockCheckApiHealth,
  generateWorkoutStructure: mockGenerateWorkoutStructureReal,
  normalizeWorkoutStructure: vi.fn((w: unknown) => w),
  createEmptyWorkout: mockCreateEmptyWorkout,
}));

vi.mock('../../../lib/mock-api', () => ({
  generateWorkoutStructure: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(),
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockWorkout = {
  title: 'Test',
  blocks: [],
  workout_type: undefined,
  workout_type_confidence: undefined,
};

const defaultProps = {
  userId: 'user-1',
  selectedDevice: 'garmin' as const,
  refreshHistory: vi.fn().mockResolvedValue(undefined),
  onWorkoutGenerated: vi.fn(),
  onWorkoutTypePending: vi.fn(),
  onWorkoutSaved: vi.fn(),
  onStepChange: vi.fn(),
  onViewChange: vi.fn(),
  onClearWorkout: vi.fn(),
  onClearEditingFlags: vi.fn(),
  clearWorkflowState: vi.fn(),
};

describe('useWorkflowGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckApiHealth.mockResolvedValue(true);
  });

  it('starts with loading=false', () => {
    const { result } = renderHook(() => useWorkflowGeneration(defaultProps));
    expect(result.current.loading).toBe(false);
  });

  it('sets loading=true during generation, then false on success', async () => {
    mockGenerateWorkoutStructureReal.mockResolvedValue(mockWorkout);

    const { result } = renderHook(() => useWorkflowGeneration(defaultProps));

    let promise: Promise<void>;
    act(() => {
      promise = result.current.handleGenerateStructure([
        { id: '1', type: 'text' as const, content: 'test' },
      ]);
    });

    expect(result.current.loading).toBe(true);

    await act(async () => { await promise; });

    expect(result.current.loading).toBe(false);
  });

  it('calls onWorkoutGenerated with workout and sources on success', async () => {
    mockGenerateWorkoutStructureReal.mockResolvedValue(mockWorkout);

    const onWorkoutGenerated = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowGeneration({ ...defaultProps, onWorkoutGenerated })
    );

    const sources = [{ id: '1', type: 'text' as const, content: 'hello' }];
    await act(async () => {
      await result.current.handleGenerateStructure(sources);
    });

    expect(onWorkoutGenerated).toHaveBeenCalledWith(mockWorkout, sources);
  });

  it('abort: handleCancelGeneration resets loading to false', async () => {
    mockGenerateWorkoutStructureReal.mockImplementation(
      (_sources: unknown, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () =>
            reject(Object.assign(new Error('AbortError'), { name: 'AbortError' }))
          );
        })
    );

    const { result } = renderHook(() => useWorkflowGeneration(defaultProps));

    act(() => {
      void result.current.handleGenerateStructure([{ id: '1', type: 'text' as const, content: 'x' }]);
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      result.current.handleCancelGeneration();
      // Wait a tick for the abort to propagate
      await new Promise(r => setTimeout(r, 0));
    });

    expect(result.current.loading).toBe(false);
  });

  // --- New tests ---

  it('handleLoadTemplate: calls onWorkoutGenerated with the template and onStepChange("structure")', () => {
    const onWorkoutGenerated = vi.fn();
    const onStepChange = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowGeneration({ ...defaultProps, onWorkoutGenerated, onStepChange })
    );

    const template = { title: 'My Template', blocks: [], source: '' };
    act(() => {
      result.current.handleLoadTemplate(template as any);
    });

    expect(onWorkoutGenerated).toHaveBeenCalledWith(template, []);
    expect(onStepChange).toHaveBeenCalledWith('structure');
  });

  it('handleCreateNew: calls onWorkoutGenerated with empty workout and onStepChange("structure")', async () => {
    const emptyWorkout = { title: 'New Workout', blocks: [], source: '' };
    mockCreateEmptyWorkout.mockResolvedValue(emptyWorkout);

    const onWorkoutGenerated = vi.fn();
    const onStepChange = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowGeneration({ ...defaultProps, onWorkoutGenerated, onStepChange })
    );

    await act(async () => {
      await result.current.handleCreateNew();
    });

    expect(onWorkoutGenerated).toHaveBeenCalledWith(emptyWorkout, []);
    expect(onStepChange).toHaveBeenCalledWith('structure');
  });

  it('handleCreateNew: shows error toast when API fails', async () => {
    mockCreateEmptyWorkout.mockRejectedValue(new Error('Server error'));

    const { toast } = await import('sonner');
    const { result } = renderHook(() => useWorkflowGeneration(defaultProps));

    await act(async () => {
      await result.current.handleCreateNew();
    });

    expect(toast.error).toHaveBeenCalledWith('Failed to create workout. Please try again.');
  });

  it('handleStartNew: calls onClearWorkout, onStepChange("add-sources"), onViewChange("workflow"), onClearEditingFlags', () => {
    const onClearWorkout = vi.fn();
    const onStepChange = vi.fn();
    const onViewChange = vi.fn();
    const onClearEditingFlags = vi.fn();
    const { result } = renderHook(() =>
      useWorkflowGeneration({
        ...defaultProps,
        onClearWorkout,
        onStepChange,
        onViewChange,
        onClearEditingFlags,
      })
    );

    act(() => {
      result.current.handleStartNew();
    });

    expect(onClearWorkout).toHaveBeenCalledTimes(1);
    expect(onStepChange).toHaveBeenCalledWith('add-sources');
    expect(onViewChange).toHaveBeenCalledWith('workflow');
    expect(onClearEditingFlags).toHaveBeenCalledTimes(1);
  });

  it('handleWelcomeDismiss: sets localStorage key and welcomeDismissed becomes true', () => {
    const { result } = renderHook(() => useWorkflowGeneration(defaultProps));

    expect(result.current.welcomeDismissed).toBe(false);

    act(() => {
      result.current.handleWelcomeDismiss();
    });

    expect(localStorage.getItem('amakaflow_welcome_dismissed')).toBe('true');
    expect(result.current.welcomeDismissed).toBe(true);
  });

  it('welcomeDismissed initial state: reads from localStorage (starts as true when already dismissed)', () => {
    // Pre-populate localStorage before rendering the hook
    localStorage.setItem('amakaflow_welcome_dismissed', 'true');

    const { result } = renderHook(() => useWorkflowGeneration(defaultProps));

    expect(result.current.welcomeDismissed).toBe(true);
  });

  it('handlePinterestBulkClose: resets pinterestBulkModal.open to false', () => {
    const { result } = renderHook(() => useWorkflowGeneration(defaultProps));

    expect(result.current.pinterestBulkModal.open).toBe(false);

    act(() => {
      result.current.handlePinterestBulkClose();
    });

    expect(result.current.pinterestBulkModal.open).toBe(false);
    expect(result.current.pinterestBulkModal.workouts).toEqual([]);
    expect(result.current.pinterestBulkModal.originalTitle).toBe('');
    expect(result.current.pinterestBulkModal.sourceUrl).toBe('');
  });

  it('handleCancelGeneration: no-op when no abort controller (does not throw)', () => {
    const { result } = renderHook(() => useWorkflowGeneration(defaultProps));

    expect(() => {
      act(() => {
        result.current.handleCancelGeneration();
      });
    }).not.toThrow();
  });

  it('handleGenerateStructure: shows error toast (not cancelled) when API throws a non-abort error', async () => {
    mockGenerateWorkoutStructureReal.mockRejectedValue(new Error('Network failure'));

    const { toast } = await import('sonner');
    const { result } = renderHook(() => useWorkflowGeneration(defaultProps));

    await act(async () => {
      await result.current.handleGenerateStructure([
        { id: '1', type: 'text' as const, content: 'test' },
      ]);
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Network failure'),
      expect.anything()
    );
  });
});
