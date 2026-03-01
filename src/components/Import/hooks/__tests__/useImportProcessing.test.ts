import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useImportProcessing } from '../useImportProcessing';
import type { QueueItem } from '../../../../types/import';

// ── Mock bulkImportApi ────────────────────────────────────────────────────────
// vi.mock is hoisted to the top of the file, so we must use vi.hoisted to
// declare the mock function before the factory closure captures it.

const { mockDetect } = vi.hoisted(() => ({ mockDetect: vi.fn() }));

vi.mock('../../../../lib/bulk-import-api', () => ({
  bulkImportApi: {
    detect: mockDetect,
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal DetectedItem factory */
function makeDetectedItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'det-1',
    sourceIndex: 0,
    sourceType: 'url' as const,
    sourceRef: 'https://example.com',
    rawData: { title: 'Push Day', blocks: [] },
    parsedTitle: 'Push Day',
    parsedExerciseCount: 6,
    parsedBlockCount: 2,
    confidence: 97,
    ...overrides,
  };
}

/** Minimal BulkDetectResponse factory */
function makeDetectResponse(items: ReturnType<typeof makeDetectedItem>[]) {
  return {
    success: true,
    job_id: 'job-1',
    total: items.length,
    success_count: items.length,
    error_count: 0,
    metadata: { programName: 'Test Program' },
    items,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useImportProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test 1 ─────────────────────────────────────────────────────────────────

  it('detect maps API response to ProcessedItem[]', async () => {
    const detectedItem = makeDetectedItem({ parsedTitle: 'Push Day', parsedExerciseCount: 6, parsedBlockCount: 2 });
    mockDetect.mockResolvedValueOnce(makeDetectResponse([detectedItem]));

    const { result } = renderHook(() => useImportProcessing());

    await act(async () => {
      await result.current.detect('user-1', {
        urls: ['https://example.com'],
        base64Items: [],
        urlQueueIds: ['q-url-1'],
        base64QueueIds: [],
      });
    });

    expect(result.current.processedItems).toHaveLength(1);
    const item = result.current.processedItems[0];
    expect(item.queueId).toBe('q-url-1');
    expect(item.status).toBe('done');
    expect(item.workoutTitle).toBe('Push Day');
    expect(item.exerciseCount).toBe(6);
    expect(item.blockCount).toBe(2);
    expect(item.workout).toEqual(detectedItem.rawData);
  });

  // ── Test 2 ─────────────────────────────────────────────────────────────────

  it('detect marks all items as error on API failure', async () => {
    mockDetect.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useImportProcessing());

    await act(async () => {
      await result.current.detect('user-1', {
        urls: ['https://a.com', 'https://b.com'],
        base64Items: [],
        urlQueueIds: ['q-1', 'q-2'],
        base64QueueIds: [],
      });
    });

    expect(result.current.processedItems).toHaveLength(2);
    expect(result.current.processedItems[0].status).toBe('error');
    expect(result.current.processedItems[1].status).toBe('error');
    expect(result.current.processedItems[0].errorMessage).toBeTruthy();
  });

  // ── Test 3 ─────────────────────────────────────────────────────────────────

  it('retry resets item to pending then updates with result', async () => {
    // First, set up an error processedItem by calling detect with a rejection
    mockDetect.mockRejectedValueOnce(new Error('Initial failure'));

    const { result } = renderHook(() => useImportProcessing());

    await act(async () => {
      await result.current.detect('user-1', {
        urls: ['https://example.com'],
        base64Items: [],
        urlQueueIds: ['q-retry-1'],
        base64QueueIds: [],
      });
    });

    // Verify it's in error state
    expect(result.current.processedItems[0].status).toBe('error');

    // Set up a deferred promise so we can inspect state mid-flight
    let resolveRetry!: (val: ReturnType<typeof makeDetectResponse>) => void;
    const retryPromise = new Promise<ReturnType<typeof makeDetectResponse>>(res => {
      resolveRetry = res;
    });
    mockDetect.mockReturnValueOnce(retryPromise);

    const queueItem = { id: 'q-retry-1', type: 'url' as const, label: 'example.com', raw: 'https://example.com' };

    // Start the retry but do not await — we want to inspect the pending state first
    act(() => {
      void result.current.retry('q-retry-1', 'user-1', queueItem);
    });

    // Flush the synchronous state update (the setProcessedItems to 'pending')
    await act(async () => {});

    // Assert the item is in pending state before the API resolves
    expect(result.current.processedItems[0].status).toBe('pending');

    // Now resolve the deferred promise and let the hook finish
    const detectedItem = makeDetectedItem({ parsedTitle: 'Retry Day', parsedExerciseCount: 3, parsedBlockCount: 1 });
    await act(async () => {
      resolveRetry(makeDetectResponse([detectedItem]));
      await retryPromise;
    });

    expect(result.current.processedItems).toHaveLength(1);
    const item = result.current.processedItems[0];
    expect(item.queueId).toBe('q-retry-1');
    expect(item.status).toBe('done');
    expect(item.workoutTitle).toBe('Retry Day');
  });

  // ── Test 4 ─────────────────────────────────────────────────────────────────

  it('removeResult removes item by queueId', async () => {
    const item1 = makeDetectedItem({ id: 'det-1', parsedTitle: 'Workout A' });
    const item2 = makeDetectedItem({ id: 'det-2', parsedTitle: 'Workout B' });
    mockDetect.mockResolvedValueOnce(makeDetectResponse([item1, item2]));

    const { result } = renderHook(() => useImportProcessing());

    await act(async () => {
      await result.current.detect('user-1', {
        urls: ['https://a.com', 'https://b.com'],
        base64Items: [],
        urlQueueIds: ['q-a', 'q-b'],
        base64QueueIds: [],
      });
    });

    expect(result.current.processedItems).toHaveLength(2);

    act(() => {
      result.current.removeResult('q-a');
    });

    expect(result.current.processedItems).toHaveLength(1);
    expect(result.current.processedItems[0].queueId).toBe('q-b');
  });

  // ── Test 5 ─────────────────────────────────────────────────────────────────

  it('retry preserves workout data while pending', async () => {
    // Set up a successful item first
    mockDetect.mockResolvedValueOnce(makeDetectResponse([makeDetectedItem({ parsedTitle: 'Morning Run', rawData: { title: 'Morning Run' } })]));
    const { result } = renderHook(() => useImportProcessing());
    await act(async () => {
      await result.current.detect('user-1', {
        urls: ['https://example.com'],
        urlQueueIds: ['q1'],
        base64Items: [],
        base64QueueIds: [],
      });
    });
    expect(result.current.processedItems[0].status).toBe('done');
    const workoutBeforeRetry = result.current.processedItems[0].workout;

    // Start retry with deferred promise
    let resolveRetry!: (val: any) => void;
    const retryPromise = new Promise(res => { resolveRetry = res; });
    mockDetect.mockReturnValueOnce(retryPromise);
    const queueItem: QueueItem = { id: 'q1', type: 'url', label: 'Example', raw: 'https://example.com' };
    act(() => { void result.current.retry('q1', 'user-1', queueItem); });
    await act(async () => {});

    // Workout data should be preserved during pending state
    expect(result.current.processedItems[0].status).toBe('pending');
    expect(result.current.processedItems[0].workout).toEqual(workoutBeforeRetry);

    resolveRetry(makeDetectResponse([makeDetectedItem({ parsedTitle: 'Updated', rawData: { title: 'Updated' } })]));
    await act(async () => { await retryPromise; });
    expect(result.current.processedItems[0].status).toBe('done');
  });

  // ── Test 6 ─────────────────────────────────────────────────────────────────

  it('detect handles mixed URLs and base64 items, mapping results by position', async () => {
    mockDetect
      .mockResolvedValueOnce(makeDetectResponse([makeDetectedItem({ parsedTitle: 'URL Workout', rawData: {} })]))
      .mockResolvedValueOnce(makeDetectResponse([makeDetectedItem({ parsedTitle: 'Photo Workout', rawData: { title: 'Photo Workout' } })]));

    const { result } = renderHook(() => useImportProcessing());
    await act(async () => {
      await result.current.detect('user-1', {
        urls: ['https://example.com'],
        urlQueueIds: ['q-url'],
        base64Items: [{ base64: 'base64data', type: 'image' }],
        base64QueueIds: ['q-img'],
      });
    });

    expect(result.current.processedItems).toHaveLength(2);
    expect(result.current.processedItems[0].queueId).toBe('q-url');
    expect(result.current.processedItems[1].queueId).toBe('q-img');
    expect(result.current.processedItems[1].workout).toEqual({ title: 'Photo Workout' });
  });

  // ── Test 7 ─────────────────────────────────────────────────────────────────

  it('clearResults empties processedItems', async () => {
    const item1 = makeDetectedItem({ id: 'det-1', parsedTitle: 'Workout A' });
    const item2 = makeDetectedItem({ id: 'det-2', parsedTitle: 'Workout B' });
    mockDetect.mockResolvedValueOnce(makeDetectResponse([item1, item2]));

    const { result } = renderHook(() => useImportProcessing());

    await act(async () => {
      await result.current.detect('user-1', {
        urls: ['https://a.com', 'https://b.com'],
        base64Items: [],
        urlQueueIds: ['q-a', 'q-b'],
        base64QueueIds: [],
      });
    });

    expect(result.current.processedItems).toHaveLength(2);

    act(() => {
      result.current.clearResults();
    });

    expect(result.current.processedItems).toHaveLength(0);
  });
});
