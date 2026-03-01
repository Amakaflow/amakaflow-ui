import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkflowGeneration } from '../useWorkflowGeneration';

vi.mock('../../../lib/api', () => ({
  checkApiHealth: vi.fn().mockResolvedValue(true),
  generateWorkoutStructure: vi.fn(),
  normalizeWorkoutStructure: vi.fn((w: unknown) => w),
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
  beforeEach(() => vi.clearAllMocks());

  it('starts with loading=false', () => {
    const { result } = renderHook(() => useWorkflowGeneration(defaultProps));
    expect(result.current.loading).toBe(false);
  });

  it('sets loading=true during generation, then false on success', async () => {
    const { generateWorkoutStructure } = await import('../../../lib/api');
    (generateWorkoutStructure as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorkout);

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
    const { generateWorkoutStructure } = await import('../../../lib/api');
    (generateWorkoutStructure as ReturnType<typeof vi.fn>).mockResolvedValue(mockWorkout);

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
    const { generateWorkoutStructure } = await import('../../../lib/api');
    (generateWorkoutStructure as ReturnType<typeof vi.fn>).mockImplementation(
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
});
