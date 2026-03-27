/**
 * Types for the Live Progress View (AMA-1154).
 */

export type StepStatus = 'pending' | 'active' | 'completed' | 'error';

export interface ProgressStep {
  id: string;
  label: string;
  status: StepStatus;
  /** Elapsed time in milliseconds once completed */
  elapsedMs?: number;
  /** Optional error message when status is 'error' */
  error?: string;
}

export interface ProgressOperation {
  /** Unique operation identifier */
  operationId: string;
  /** Human-readable title */
  title: string;
  /** Ordered list of steps */
  steps: ProgressStep[];
  /** Whether the operation has been cancelled */
  cancelled: boolean;
  /** Timestamp when operation started */
  startedAt: number;
  /** Timestamp when operation finished (all steps done or cancelled) */
  finishedAt?: number;
}

export interface ProgressStreamEvent {
  operationId: string;
  stepId: string;
  status: StepStatus;
  elapsedMs?: number;
  error?: string;
}
