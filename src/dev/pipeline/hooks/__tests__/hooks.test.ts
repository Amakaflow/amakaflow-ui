import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRunHistory } from '../useRunHistory';
import { useServiceHealth } from '../useServiceHealth';
import { usePipelineRunner } from '../usePipelineRunner';

// Mock the store and runner
vi.mock('../../store/runStore', () => ({
  getAllRuns: vi.fn().mockResolvedValue([]),
  saveRun: vi.fn().mockResolvedValue(undefined),
  applyEventToRun: vi.fn((run, _event) => run),
}));

vi.mock('../../runner/pipelineRunner', () => ({
  runPipeline: vi.fn(async function* () {
    yield { type: 'run:started', runId: 'test-run', flowId: 'ingest-only', inputs: {} };
    yield { type: 'run:completed', runId: 'test-run', status: 'success' };
  }),
}));

describe('useRunHistory', () => {
  it('loads runs on mount', async () => {
    const { result } = renderHook(() => useRunHistory());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.runs).toEqual([]);
  });

  it('refresh reloads runs', async () => {
    const { getAllRuns } = await import('../../store/runStore');
    const { result } = renderHook(() => useRunHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.refresh());
    expect(getAllRuns).toHaveBeenCalledTimes(2); // once on mount, once on refresh
  });
});

describe('usePipelineRunner', () => {
  it('starts as not running', () => {
    const { result } = renderHook(() => usePipelineRunner());
    expect(result.current.isRunning).toBe(false);
    expect(result.current.run).toBeNull();
  });

  it('sets isRunning during a run and clears when done', async () => {
    const { result } = renderHook(() => usePipelineRunner());
    await act(async () => {
      await result.current.start('ingest-only', { workoutText: 'bench press 3x10' }, 'auto');
    });
    expect(result.current.isRunning).toBe(false);
    expect(result.current.run).not.toBeNull();
  });

  it('cancel stops the run early', async () => {
    const { runPipeline } = await import('../../runner/pipelineRunner');
    vi.mocked(runPipeline).mockImplementationOnce(async function* () {
      yield { type: 'run:started', runId: 'test-run', flowId: 'ingest-only', inputs: {} };
      // Simulate a slow step — wait before yielding completed
      await new Promise(resolve => setTimeout(resolve, 100));
      yield { type: 'run:completed', runId: 'test-run', status: 'success' };
    });

    const { result } = renderHook(() => usePipelineRunner());

    // Start without awaiting so we can cancel mid-run
    let startPromise: Promise<void>;
    act(() => {
      startPromise = result.current.start('ingest-only', { workoutText: 'test' }, 'auto');
    });

    // Cancel immediately
    act(() => {
      result.current.cancel();
    });

    await waitFor(() => expect(result.current.isRunning).toBe(false));
  });
});

describe('useServiceHealth', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts in checking state', () => {
    const { result } = renderHook(() => useServiceHealth());
    // All 6 services should be present
    expect(Object.keys(result.current.health)).toHaveLength(6);
    expect(Object.values(result.current.health).every(s => s.status === 'checking')).toBe(true);
  });

  it('transitions to up when fetch succeeds', async () => {
    const { result } = renderHook(() => useServiceHealth());
    await waitFor(() =>
      Object.values(result.current.health).every(s => s.status !== 'checking')
    );
    expect(result.current.health.ingestor.status).toBe('up');
  });
});
