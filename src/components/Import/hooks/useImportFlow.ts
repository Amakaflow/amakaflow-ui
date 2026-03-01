import { useState, useEffect, useRef } from 'react';
import { useImportQueue } from './useImportQueue';
import { useImportProcessing } from './useImportProcessing';
import { bulkImportApi } from '../../../lib/bulk-import-api';
import { saveWorkoutToHistory } from '../../../lib/workout-history';
import type { WorkoutStructure } from '../../../types/workout';
import type { Phase, ImportTab, QueueItem, ProcessedItem, SelectedBlock, ColumnMappingState } from '../../../types/import';
import type { ColumnMapping } from '../../../types/bulk-import';
import type React from 'react';

// ── Public interface ───────────────────────────────────────────────────────────

export interface UseImportFlowProps {
  userId: string;
  onDone: () => void;
  onEditWorkout: (queueId: string, workout: Record<string, unknown>) => void;
  /** Seed processedItems on mount (used when returning from edit). */
  initialProcessedItems?: ProcessedItem[];
  /** Called whenever processedItems changes while phase is 'results'. */
  onUpdateProcessedItems?: (items: ProcessedItem[]) => void;
}

export interface ImportFlowResult {
  // phase
  phase: Phase;
  // tab
  activeTab: ImportTab;
  setActiveTab: (tab: ImportTab) => void;
  // queue (pass-through from useImportQueue)
  queue: QueueItem[];
  addUrls: (raw: string) => void;
  addFiles: (files: File[]) => void;
  removeQueueItem: (id: string) => void;
  // results (pass-through from useImportProcessing)
  processedItems: ProcessedItem[];
  // block picker
  selectedBlocks: SelectedBlock[];
  setSelectedBlocks: React.Dispatch<React.SetStateAction<SelectedBlock[]>>;
  // column mapping state (for MapStep props)
  columnMappingState: ColumnMappingState | null;
  // handlers
  handleImport: () => Promise<void>;
  handleSaveAll: () => Promise<void>;
  handleRetry: (queueId: string) => void;
  handleRemoveResult: (queueId: string) => void;
  /**
   * Called by FileImportTab with the selected files. Internally calls addFiles,
   * then runs detectFile to populate columnMappingState, then transitions to
   * column-mapping phase. Do NOT call addFiles separately before this — files
   * are added inside the handler.
   */
  handleFilesDetected: (files: File[]) => Promise<void>;
  handleColumnMappingComplete: (columns: ColumnMapping[]) => Promise<void>;
  goToBlockPicker: () => void;
  cancelBlockPicker: () => void;
  /** Confirms block picker selection by forwarding the combined workout to onEditWorkout. */
  handleBlockPickerConfirm: (workout: Record<string, unknown>) => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useImportFlow({ userId, onDone, onEditWorkout, initialProcessedItems, onUpdateProcessedItems }: UseImportFlowProps): ImportFlowResult {
  const [phase, setPhase] = useState<Phase>('input');
  const [activeTab, setActiveTab] = useState<ImportTab>('urls-media');
  const [selectedBlocks, setSelectedBlocks] = useState<SelectedBlock[]>([]);
  const [columnMappingState, setColumnMappingState] = useState<ColumnMappingState | null>(null);

  // ── Sub-hooks ────────────────────────────────────────────────────────────────

  const queue = useImportQueue();
  const processing = useImportProcessing();

  // ── Restore state from parent (e.g. returning from StructureWorkout edit) ────

  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current && initialProcessedItems && initialProcessedItems.length > 0) {
      processing.setItems(initialProcessedItems);
      setPhase('results');
    }
    initialized.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync processedItems up to parent while in results phase ──────────────────

  useEffect(() => {
    if (phase === 'results') {
      onUpdateProcessedItems?.(processing.processedItems);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processing.processedItems, phase]);

  // ── handleImport ─────────────────────────────────────────────────────────────
  //
  // Flow: input → processing → results
  // 1. Call toDetectPayload() to get { urls, base64Items }
  // 2. Pair each value with its queueId from the queue
  // 3. Set phase to 'processing', call detect(), set phase to 'results'

  const handleImport = async (): Promise<void> => {
    try {
      const { urls, base64Items } = await queue.toDetectPayload();

      const urlQueueIds = queue.queue
        .filter(i => i.type === 'url')
        .map(i => i.id);

      const base64QueueIds = queue.queue
        .filter(i => i.type === 'image' || i.type === 'pdf')
        .map(i => i.id);

      setPhase('processing');

      await processing.detect(userId, {
        urls,
        base64Items,
        urlQueueIds,
        base64QueueIds,
      });

      setPhase('results');
    } catch {
      setPhase('input'); // reset so user can retry
    }
  };

  // ── handleSaveAll ─────────────────────────────────────────────────────────────
  //
  // Save all done processedItems to workout history, then call onDone().

  const handleSaveAll = async (): Promise<void> => {
    const doneItems = processing.processedItems.filter(
      p => p.status === 'done' && p.workout
    );

    const errors: Array<{ queueId: string; error: unknown }> = [];

    for (const item of doneItems) {
      try {
        // DeviceId does not include a neutral 'import' value, so 'garmin' is used
        // as the source for all imported items. When DeviceId gains an 'import'
        // or 'file' variant this should be updated to reflect the actual source.
        // item.workout is Record<string, unknown> at the type boundary; at runtime
        // it carries a valid WorkoutStructure produced by the detection pipeline.
        await saveWorkoutToHistory(userId, item.workout as WorkoutStructure, 'garmin');
      } catch (err) {
        errors.push({ queueId: item.queueId, error: err });
      }
    }

    if (errors.length > 0) {
      // Some saves failed — don't call onDone, let the caller show an error
      throw new Error(`Failed to save ${errors.length} of ${doneItems.length} workouts`);
    }

    onDone();
  };

  // ── handleRetry ───────────────────────────────────────────────────────────────

  const handleRetry = (queueId: string): void => {
    const queueItem = queue.queue.find(i => i.id === queueId);
    if (queueItem) {
      void processing.retry(queueId, userId, queueItem);
    }
  };

  // ── handleRemoveResult ────────────────────────────────────────────────────────

  const handleRemoveResult = (queueId: string): void => {
    processing.removeResult(queueId);
  };

  // ── handleFilesDetected ───────────────────────────────────────────────────────
  //
  // Called when user selects files in the File tab.
  // 1. Add the files to the queue
  // 2. Call bulkImportApi.detectFile to get job_id + column info
  // 3. Build ColumnMappingState
  // 4. Set phase to 'column-mapping'

  const handleFilesDetected = async (files: File[]): Promise<void> => {
    if (files.length === 0) return;

    queue.addFiles(files);

    try {
      // Use the first file for column detection (multi-file support is future work)
      const response = await bulkImportApi.detectFile(userId, files[0]);

      const firstItem = response.items[0];
      let columns: ColumnMapping[] = [];
      let patterns: ColumnMappingState['patterns'] = [];

      if (firstItem?.raw_data?.column_info) {
        columns = firstItem.raw_data.column_info.map(
          (col: { name: string; index: number; detected_type: string | null; confidence: number; sample_values?: string[] }, idx: number) => ({
            sourceColumn: col.name || `Column ${idx + 1}`,
            sourceColumnIndex: col.index ?? idx,
            targetField: col.detected_type || 'ignore',
            confidence: col.confidence || 0,
            userOverride: false,
            sampleValues: col.sample_values || [],
          })
        );
        patterns = firstItem.patterns || [];
      }

      setColumnMappingState({
        jobId: response.job_id,
        columns,
        patterns,
        loading: false,
      });
    } catch {
      // If detectFile fails, still transition to column-mapping so the UI
      // can show an error state via columnMappingState.loading === false with
      // empty columns.
      setColumnMappingState({
        jobId: '',
        columns: [],
        patterns: [],
        loading: false,
      });
    }

    setPhase('column-mapping');
  };

  // ── handleColumnMappingComplete ───────────────────────────────────────────────
  //
  // Called when MapStep has completed column mapping and passes back ColumnMapping[].
  // 1. Call bulkImportApi.applyMappings with jobId + columns to get processed workouts
  // 2. Map the API response to ProcessedItem[]
  // 3. Inject results into useImportProcessing via setItems
  // 4. Transition to 'results'

  const handleColumnMappingComplete = async (columns: ColumnMapping[]): Promise<void> => {
    const jobId = columnMappingState?.jobId ?? '';
    let processedItems: ProcessedItem[] = [];

    try {
      const response = await bulkImportApi.applyMappings(jobId, userId, columns);

      processedItems = response.workouts.map((w, idx) => ({
        queueId: w.detected_item_id || `file-${idx}`,
        status: 'done' as const,
        workout: w.parsed_workout as Record<string, unknown>,
        workoutTitle: (w.parsed_workout as { title?: string }).title,
        blockCount: (w.parsed_workout as { blocks?: unknown[] }).blocks?.length,
        exerciseCount: undefined,
        sourceIcon: 'file' as const,
      }));
    } catch {
      // If applyMappings fails, still advance to results with an empty list
      // so the user sees the results screen (which can show zero items).
    }

    processing.setItems(processedItems);
    setPhase('results');
  };

  // ── handleBlockPickerConfirm ──────────────────────────────────────────────────
  //
  // Spec: BLOCK_PICKER → onConfirm(combined) → calls onEditWorkout
  // The caller navigates away; this hook stays in block-picker phase.

  const handleBlockPickerConfirm = (workout: Record<string, unknown>): void => {
    onEditWorkout('', workout);
    // stays in block-picker phase — caller can navigate away
  };

  // ── goToBlockPicker / cancelBlockPicker ───────────────────────────────────────

  const goToBlockPicker = (): void => {
    setPhase('block-picker');
  };

  const cancelBlockPicker = (): void => {
    setPhase('results');
  };

  // ── Return ────────────────────────────────────────────────────────────────────

  return {
    // phase
    phase,
    // tab
    activeTab,
    setActiveTab,
    // queue
    queue: queue.queue,
    addUrls: queue.addUrls,
    addFiles: queue.addFiles,
    removeQueueItem: queue.removeItem,
    // results
    processedItems: processing.processedItems,
    // block picker
    selectedBlocks,
    setSelectedBlocks,
    // column mapping
    columnMappingState,
    // handlers
    handleImport,
    handleSaveAll,
    handleRetry,
    handleRemoveResult,
    handleFilesDetected,
    handleColumnMappingComplete,
    goToBlockPicker,
    cancelBlockPicker,
    handleBlockPickerConfirm,
  };
}
