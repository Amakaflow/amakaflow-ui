import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { useImportFlow } from '../useImportFlow';
import type { ImportQueueResult } from '../useImportQueue';
import type { ImportProcessingResult } from '../useImportProcessing';
import type { ProcessedItem, QueueItem } from '../../../../types/import';
import type { ColumnMapping } from '../../../../types/bulk-import';

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
    applyMappings: vi.fn().mockResolvedValue({
      success: true,
      job_id: 'job-1',
      mapped_count: 1,
      workouts: [
        {
          detected_item_id: 'q-file-1',
          parsed_workout: { title: 'Leg Day', blocks: [] },
        },
      ],
    }),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

import { useImportQueue } from '../useImportQueue';
import { useImportProcessing } from '../useImportProcessing';
import { saveWorkoutToHistory } from '../../../../lib/workout-history';
import { bulkImportApi } from '../../../../lib/bulk-import-api';

const mockUseImportQueue = useImportQueue as Mock;
const mockUseImportProcessing = useImportProcessing as Mock;
const mockSaveWorkoutToHistory = saveWorkoutToHistory as Mock;
const mockApplyMappings = bulkImportApi.applyMappings as Mock;

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

  it('handleColumnMappingComplete: calls applyMappings API, maps response to ProcessedItem[], transitions → results', async () => {
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

    const columns: ColumnMapping[] = [
      {
        sourceColumn: 'Exercise',
        sourceColumnIndex: 0,
        targetField: 'exercise',
        confidence: 90,
        userOverride: false,
        sampleValues: ['Squat'],
      },
    ];

    await act(async () => {
      await result.current.handleColumnMappingComplete(columns);
    });

    expect(result.current.phase).toBe('results');

    // API should have been called with the jobId from detectFile + columns
    expect(mockApplyMappings).toHaveBeenCalledWith('job-1', 'user-1', columns);

    // setItems should receive the ProcessedItem[] mapped from the API response
    expect(setItemsMock).toHaveBeenCalledOnce();
    const calledWith: ProcessedItem[] = setItemsMock.mock.calls[0][0];
    expect(calledWith).toHaveLength(1);
    expect(calledWith[0].queueId).toBe('q-file-1');
    expect(calledWith[0].status).toBe('done');
    expect(calledWith[0].workoutTitle).toBe('Leg Day');
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

  // ── Test: handleImport error handling ──────────────────────────────────────

  it('handleImport resets phase to input on error', async () => {
    const detectMock = vi.fn().mockRejectedValueOnce(new Error('network error'));
    const processingMock = makeProcessingMock({ detect: detectMock });
    const queueMock = makeQueueMock({
      queue: [makeQueueItem({ id: 'q-1', type: 'url', raw: 'https://example.com' })],
      toDetectPayload: vi.fn().mockResolvedValue({ urls: ['https://example.com'], base64Items: [] }),
    });
    mockUseImportQueue.mockReturnValue(queueMock);
    mockUseImportProcessing.mockReturnValue(processingMock);

    const { result } = renderHook(() => useImportFlow(defaultProps));

    await act(async () => { await result.current.handleImport(); });

    expect(result.current.phase).toBe('input');
  });

  // ── Test: handleSaveAll error handling ─────────────────────────────────────

  it('handleSaveAll does not call onDone if any save fails', async () => {
    const doneItem1 = makeProcessedItem({ queueId: 'q-1', workout: { title: 'Push Day', blocks: [] } });
    const doneItem2 = makeProcessedItem({ queueId: 'q-2', workoutTitle: 'Pull Day', workout: { title: 'Pull Day', blocks: [] } });
    const processingMock = makeProcessingMock({ processedItems: [doneItem1, doneItem2] });
    mockUseImportProcessing.mockReturnValue(processingMock);

    // Make saveWorkoutToHistory throw for the second item
    mockSaveWorkoutToHistory
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('API error'));

    const onDone = vi.fn();
    const { result } = renderHook(() => useImportFlow({ ...defaultProps, onDone }));

    let caughtError: Error | undefined;
    await act(async () => {
      try {
        await result.current.handleSaveAll();
      } catch (err) {
        caughtError = err as Error;
      }
    });

    expect(onDone).not.toHaveBeenCalled();
    expect(caughtError).toBeInstanceOf(Error);
    expect(caughtError?.message).toMatch(/Failed to save 1 of 2/);
  });

  // ── Test (handleBlockPickerConfirm) ────────────────────────────────────────

  it('handleBlockPickerConfirm calls onEditWorkout', () => {
    const mockOnEditWorkout = vi.fn();
    const props = { ...defaultProps, onEditWorkout: mockOnEditWorkout };
    const mockWorkout = { title: 'Test Workout' };
    const { result } = renderHook(() => useImportFlow(props));
    act(() => { result.current.handleBlockPickerConfirm(mockWorkout); });
    expect(mockOnEditWorkout).toHaveBeenCalledWith(mockWorkout);
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
