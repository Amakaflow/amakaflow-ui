/**
 * Types for the unified import flow.
 *
 * This replaces the separate "Single Import" (workflow) and "Bulk Import" paths.
 * All input sources (URLs, images, PDFs, files, integrations) flow through
 * the same queue → process → results pipeline.
 */

/** Which tab the user has open on the import screen. */
export type ImportTab = 'urls-media' | 'file' | 'integrations';

/** A single item in the pre-import queue (before processing). */
export interface QueueItem {
  id: string;              // stable local UUID (use crypto.randomUUID())
  type: 'url' | 'image' | 'pdf' | 'text';
  label: string;           // display label (truncated URL, filename, etc.)
  raw: string | File;      // the actual payload
}

/** Per-item processing state. */
export type ItemStatus = 'pending' | 'detecting' | 'extracting' | 'done' | 'failed';

export interface ProcessedItem {
  queueId: string;         // links back to QueueItem.id
  status: ItemStatus;
  errorMessage?: string;
  /** Populated when status === 'done'. Shape matches PreviewWorkout from bulk-import types. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workout?: any;           // WorkoutStructure — typed loosely to avoid circular deps
  workoutTitle?: string;
  blockCount?: number;
  exerciseCount?: number;
  sourceIcon?: 'youtube' | 'tiktok' | 'instagram' | 'pinterest' | 'image' | 'pdf' | 'text' | 'file';
}

/** What the user wants to do with the results. */
export type ResultsAction = 'save-all' | 'build-one';

/** A block selected in the block picker. */
export interface SelectedBlock {
  workoutIndex: number;    // index into ProcessedItem[]
  blockIndex: number;      // index into workout.blocks[]
  blockId: string;
  blockLabel: string;
}
