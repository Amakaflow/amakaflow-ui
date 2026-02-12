/**
 * Pipeline type definitions for standalone streaming workflows.
 * Used by the CreateAIWorkout flow and useStreamingPipeline hook.
 */

// Pipeline stages (subset of WorkoutStage, focused on standalone generation)
export type PipelineStage = 'analyzing' | 'creating' | 'complete';

export interface PipelineStageEvent {
  stage: PipelineStage;
  message: string;
}

export interface PipelineExercise {
  name: string;
  sets?: number;
  reps?: number | string;
  muscle_group?: string;
  notes?: string;
}

export interface PipelinePreview {
  preview_id: string;
  workout: {
    name: string;
    exercises: PipelineExercise[];
    duration_minutes?: number;
    difficulty?: string;
  };
}

export interface PipelineErrorEvent {
  stage?: string;
  message?: string;
  recoverable?: boolean;
}

// Discriminated union for type-safe event handling
export type PipelineSSEEvent =
  | { event: 'stage'; data: PipelineStageEvent }
  | { event: 'content_delta'; data: { text?: string } }
  | { event: 'preview'; data: PipelinePreview }
  | { event: 'error'; data: PipelineErrorEvent }
  | { event: 'complete'; data: Record<string, unknown> };
