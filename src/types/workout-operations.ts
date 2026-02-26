/**
 * Types for workout operation endpoints.
 * Mirrors the WorkoutOperationEngine ops on the backend.
 */

export type WorkoutOpName =
  | 'rename_workout'
  | 'rename_exercise'
  | 'edit_exercise'
  | 'delete_exercise'
  | 'swap_exercise'
  | 'reorder_block'
  | 'delete_block';

export interface WorkoutOperation {
  op: WorkoutOpName;
  // rename_workout
  title?: string;
  // rename_exercise, edit_exercise, delete_exercise, swap_exercise
  block_index?: number;
  exercise_index?: number;
  // rename_exercise
  name?: string;
  // edit_exercise
  sets?: number;
  reps?: string | number;
  duration_sec?: number;
  rest_sec?: number;
  // swap_exercise
  target_exercise_index?: number;
  // reorder_block
  from_index?: number;
  to_index?: number;
}

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

export interface MixPreviewWorkout {
  id: string;
  title: string;
  workout: {
    title: string;
    blocks: Array<{
      label?: string;
      exercises: Array<{
        name: string;
        sets?: number;
        reps?: string | number;
        duration_sec?: number;
      }>;
    }>;
    metadata: {
      mixer_sources: Record<string, string[]>;
    };
  };
  exercise_count: number;
  block_count: number;
}

export interface MixWorkoutsResponse {
  preview: MixPreviewWorkout;
}

export interface PreviewOperationResponse {
  preview: {
    id: string;
    title: string;
    workout: Record<string, unknown>;
    exercise_count: number;
    block_count: number;
  };
}
