/**
 * Types for workout operation endpoints.
 * Mirrors the WorkoutOperationEngine ops on the backend.
 */

export type WorkoutOperation =
  | { op: 'rename_workout'; title: string }
  | { op: 'rename_exercise'; block_index: number; exercise_index: number; name: string }
  | { op: 'edit_exercise'; block_index: number; exercise_index: number; sets?: number; reps?: string | number; duration_sec?: number; rest_sec?: number }
  | { op: 'delete_exercise'; block_index: number; exercise_index: number }
  | { op: 'swap_exercise'; block_index: number; exercise_index: number; target_exercise_index: number }
  | { op: 'reorder_block'; from_index: number; to_index: number }
  | { op: 'delete_block'; block_index: number };

/** Derived union of all operation names */
export type WorkoutOpName = WorkoutOperation['op'];

export interface ApplyOperationsRequest {
  operations: WorkoutOperation[];
  expected_updated_at: string;
}

export interface ApplyOperationsResponse {
  workout: {
    id: string;
    title: string;
    workout_data: Record<string, unknown>;
    updated_at: string;
  };
}

export interface MixSource {
  workout_id: string;
  block_indices: number[];
}

export interface MixWorkoutsRequest {
  sources: MixSource[];
  title: string;
}

export interface PreviewWorkoutPayload {
  title?: string;
  blocks?: Array<{
    label?: string;
    exercises?: Array<{
      name: string;
      sets?: number;
      reps?: string | number;
      duration_sec?: number;
    }>;
  }>;
  metadata?: {
    mixer_sources?: Record<string, string[]>;
  };
}

export interface MixPreviewWorkout {
  id: string;
  title: string;
  workout: PreviewWorkoutPayload;
  exercise_count: number;
  block_count: number;
}

export interface MixWorkoutsResponse {
  preview: MixPreviewWorkout;
}

export interface PreviewOperationResponse {
  preview: MixPreviewWorkout;
}
