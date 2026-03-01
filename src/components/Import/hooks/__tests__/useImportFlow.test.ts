import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { useImportFlow } from '../useImportFlow';
import type { ImportQueueResult } from '../useImportQueue';
import type { ImportProcessingResult } from '../useImportProcessing';
import type { ProcessedItem, QueueItem } from '../../../../types/import';

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../useImportQueue', () => ({ useImportQueue: vi.fn() }));
vi.mock('../useImportProcessing', () => ({ useImportProcessing: vi.fn() }));
vi.mock('../../../../lib/workout-history', () => ({
  saveWorkoutToHistory: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../../../lib/bulk-import-api', () => ({
  bulkImportApi: {
    detectFile: vi.fn().mockResolvedValue({
      job_id: 'job-1',
      items: [
        {
          raw_data: {
            column_info: [
              { name: 'Exercise', index: 0, detected_type: 'exercise_name', confidence: 90, sample_values: ['Squat'] },
            ],
          },
          patterns: [],
        },
      ],
    }),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

import { useImportQueue } from '../useImportQueue';
import { useImportProcessing } from '../useImportProcessing';
import { saveWorkoutToHistory } from '../../../../lib/workout-history';

const mockUseImportQueue = useImportQueue as Mock;
const mockUseImportProcessing = useImportProcessing as Mock;
const mockSaveWorkoutToHistory = saveWorkoutToHistory as Mock;

function makeQueueItem(overrides: Partial<QueueItem & { type: 'url'; raw: string }> = {}): QueueItem {
  return {
    id: 'q-1',
    type: 'url',
    label: 'example.com',
    raw: 'https://example.com',
    ...overrides,
  } as QueueItem;
}

function makeProcessedItem(overrides: Partial<ProcessedItem> = {}): ProcessedItem {
  return {
    queueId: 'q-1',
    status: 'done',
    workoutTitle: 'Push Day',
    blockCount: 2,
    exerciseCount: 6,
    workout: { title: 'Push Day', blocks: [] },
    ...overrides,
  };
}

function makeQueueMock(overrides: Partial<ImportQueueResult> = {}): ImportQueueResult {
  return {
    queue: [],
    addUrls: vi.fn(),
    addFiles: vi.fn(),
    removeItem: vi.fn(),
    clearQueue: vi.fn(),
    toDetectPayload: vi.fn().mockResolvedValue({ urls: [], base64Items: [] }),
    ...overrides,
  };
}

function makeProcessingMock(overrides: Partial<ImportProcessingResult> = {}): ImportProcessingResult {
  return {
    processedItems: [],
    detect: vi.fn().mockResolvedValue(undefined),
    retry: vi.fn().mockResolvedValue(undefined),
    removeResult: vi.fn(),
    clearResults: vi.fn(),
    setItems: vi.fn(),
    ...overrides,
  };
}

const defaultProps = {
  userId: 'user-1',
  onDone: vi.fn(),
  onEditWorkout: vi.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useImportFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseImportQueue.mockReturnValue(makeQueueMock());
    mockUseImportProcessing.mockReturnValue(makeProcessingMock());
    defaultProps.onDone = vi.fn();
    defaultProps.onEditWorkout = vi.fn();
  });

  // ── Test 1 ─────────────────────────────────────────────────────────────────

  it('handleImport transitions: input → processing → results', async () => {
    const urlQueueItem = makeQueueItem({ id: 'q-url-1', type: 'url', raw: 'https://example.com' });

    const detectMock = vi.fn().mockResolvedValue(undefined);
    const processingMock = makeProcessingMock({ detect: detectMock });
    const queueMock = makeQueueMock({
      queue: [urlQueueItem],
      toDetectPayload: vi.fn().mockResolvedValue({
        urls: ['https://example.com'],
        base64Items: [],
      }),
    });

    mockUseImportQueue.mockReturnValue(queueMock);
    mockUseImportProcessing.mockReturnValue(processingMock);

    const { result } = renderHook(() => useImportFlow(defaultProps));

    expect(result.current.phase).toBe('input');

    await act(async () => {
      await result.current.handleImport();
    });

    expect(result.current.phase).toBe('results');
    expect(detectMock).toHaveBeenCalledOnce();
    expect(detectMock).toHaveBeenCalledWith('user-1', {
      urls: ['https://example.com'],
      base64Items: [],
      urlQueueIds: ['q-url-1'],
      base64QueueIds: [],
    });
  });

  // ── Test 2 ─────────────────────────────────────────────────────────────────

  it('handleFilesDetected transitions: input → column-mapping', async () => {
    const addFilesMock = vi.fn();
    const queueMock = makeQueueMock({ addFiles: addFilesMock });
    mockUseImportQueue.mockReturnValue(queueMock);

    const { result } = renderHook(() => useImportFlow(defaultProps));

    expect(result.current.phase).toBe('input');

    const files = [new File(['content'], 'workout.csv', { type: 'text/csv' })];

    await act(async () => {
      await result.current.handleFilesDetected(files);
    });

    expect(result.current.phase).toBe('column-mapping');
    expect(addFilesMock).toHaveBeenCalledWith(files);
  });

  // ── Test 3 ─────────────────────────────────────────────────────────────────

  it('handleColumnMappingComplete transitions: column-mapping → results', async () => {
    const setItemsMock = vi.fn();
    const processingMock = makeProcessingMock({ setItems: setItemsMock });
    mockUseImportProcessing.mockReturnValue(processingMock);

    const files = [new File(['content'], 'workout.csv', { type: 'text/csv' })];
    const { result } = renderHook(() => useImportFlow(defaultProps));

    // Get to column-mapping phase first
    await act(async () => {
      await result.current.handleFilesDetected(files);
    });
    expect(result.current.phase).toBe('column-mapping');

    const mappingResults: ProcessedItem[] = [
      makeProcessedItem({ queueId: 'q-file-1', workoutTitle: 'Leg Day' }),
    ];

    act(() => {
      result.current.handleColumnMappingComplete(mappingResults);
    });

    expect(result.current.phase).toBe('results');
    expect(setItemsMock).toHaveBeenCalledWith(mappingResults);
  });

  // ── Test 4 ─────────────────────────────────────────────────────────────────

  it('handleSaveAll calls saveWorkoutToHistory for each done item', async () => {
    const doneItem1 = makeProcessedItem({ queueId: 'q-1', workout: { title: 'Push Day', blocks: [] } });
    const doneItem2 = makeProcessedItem({ queueId: 'q-2', workoutTitle: 'Pull Day', workout: { title: 'Pull Day', blocks: [] } });
    const failedItem = makeProcessedItem({ queueId: 'q-3', status: 'failed', workout: undefined });

    const processingMock = makeProcessingMock({
      processedItems: [doneItem1, doneItem2, failedItem],
    });
    mockUseImportProcessing.mockReturnValue(processingMock);

    const { result } = renderHook(() => useImportFlow(defaultProps));

    await act(async () => {
      await result.current.handleSaveAll();
    });

    expect(mockSaveWorkoutToHistory).toHaveBeenCalledTimes(2);
    expect(mockSaveWorkoutToHistory).toHaveBeenCalledWith('user-1', doneItem1.workout, 'garmin');
    expect(mockSaveWorkoutToHistory).toHaveBeenCalledWith('user-1', doneItem2.workout, 'garmin');
  });

  // ── Test 5 ─────────────────────────────────────────────────────────────────

  it('handleSaveAll calls onDone after saving', async () => {
    const doneItem = makeProcessedItem({ queueId: 'q-1', workout: { title: 'Push Day', blocks: [] } });
    const processingMock = makeProcessingMock({ processedItems: [doneItem] });
    mockUseImportProcessing.mockReturnValue(processingMock);

    const onDone = vi.fn();
    const { result } = renderHook(() => useImportFlow({ ...defaultProps, onDone }));

    await act(async () => {
      await result.current.handleSaveAll();
    });

    expect(onDone).toHaveBeenCalledOnce();
  });

  // ── Test 6 ─────────────────────────────────────────────────────────────────

  it('goToBlockPicker transitions: results → block-picker', async () => {
    // Get to results phase first by running handleImport
    const queueMock = makeQueueMock({
      queue: [makeQueueItem({ id: 'q-1' })],
      toDetectPayload: vi.fn().mockResolvedValue({ urls: ['https://example.com'], base64Items: [] }),
    });
    mockUseImportQueue.mockReturnValue(queueMock);

    const { result } = renderHook(() => useImportFlow(defaultProps));

    await act(async () => {
      await result.current.handleImport();
    });

    expect(result.current.phase).toBe('results');

    act(() => {
      result.current.goToBlockPicker();
    });

    expect(result.current.phase).toBe('block-picker');
  });

  // ── Test 7 ─────────────────────────────────────────────────────────────────

  it('cancelBlockPicker transitions: block-picker → results', async () => {
    // Get to results then to block-picker
    const queueMock = makeQueueMock({
      queue: [makeQueueItem({ id: 'q-1' })],
      toDetectPayload: vi.fn().mockResolvedValue({ urls: ['https://example.com'], base64Items: [] }),
    });
    mockUseImportQueue.mockReturnValue(queueMock);

    const { result } = renderHook(() => useImportFlow(defaultProps));

    await act(async () => {
      await result.current.handleImport();
    });

    act(() => {
      result.current.goToBlockPicker();
    });

    expect(result.current.phase).toBe('block-picker');

    act(() => {
      result.current.cancelBlockPicker();
    });

    expect(result.current.phase).toBe('results');
  });
});
