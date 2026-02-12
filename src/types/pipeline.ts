/**
 * Pipeline type definitions for standalone streaming workflows.
 * Used by the CreateAIWorkout, ImportWorkout flows, and useStreamingPipeline hook.
 */

// Pipeline stages for workout generation
export type GenerationStage = 'analyzing' | 'creating' | 'complete';

// Pipeline stages for URL import
export type ImportStage = 'fetching' | 'extracting' | 'parsing' | 'mapping' | 'complete';

// Pipeline stages for save & push
export type SaveStage = 'validating' | 'saving' | 'pushing' | 'scheduling' | 'complete';

// Union of all pipeline stages
export type PipelineStage = GenerationStage | ImportStage | SaveStage;

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
    exercise_count?: number;
    block_count?: number;
  };
  // Import-specific fields
  source_url?: string;
  platform?: string;
  unmatched?: Array<{ name: string; suggestions?: string[] }>;
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
