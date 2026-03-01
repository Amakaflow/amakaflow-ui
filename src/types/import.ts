import type { ColumnMapping, DetectedPattern } from './bulk-import';

/** Which tab the user has open on the import screen. */
export type ImportTab = 'urls-media' | 'file' | 'clip-queue' | 'integrations';

/** Which phase of the import workflow we're in. */
export type Phase = 'input' | 'processing' | 'results' | 'block-picker' | 'column-mapping';

/** A single item in the pre-import queue (before processing). */
export type QueueItem =
  | { id: string; type: 'url';   label: string; raw: string }
  | { id: string; type: 'image'; label: string; raw: File   }
  | { id: string; type: 'pdf';   label: string; raw: File   }
  | { id: string; type: 'text';  label: string; raw: string }
  | { id: string; type: 'clip';  label: string; raw: string };

/** Per-item processing state. */
export type ItemStatus = 'pending' | 'detecting' | 'extracting' | 'done' | 'failed' | 'error';

export interface ProcessedItem {
  queueId: string;        // links back to QueueItem.id
  status: ItemStatus;
  errorMessage?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workout?: any;          // WorkoutStructure — typed loosely to avoid circular deps
  workoutTitle?: string;
  blockCount?: number;
  exerciseCount?: number;
  sourceIcon?: 'youtube' | 'tiktok' | 'instagram' | 'pinterest' | 'image' | 'pdf' | 'text' | 'file';
}

/** What the user wants to do with results. */
export type ResultsAction = 'save-all' | 'build-one';

/** A block selected in the block picker. */
export interface SelectedBlock {
  workoutIndex: number;   // index into ProcessedItem[]
  blockIndex: number;     // index into workout.blocks[]
  blockId: string;
  blockLabel: string;
}

/** State for the column-mapping phase (file imports only). */
export interface ColumnMappingState {
  jobId: string;
  columns: ColumnMapping[];
  patterns: DetectedPattern[];
  loading: boolean;
}
