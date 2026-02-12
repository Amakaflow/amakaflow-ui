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

// Pipeline stages for program design (Phase 1a)
export type ProgramDesignStage = 'designing' | 'complete';

// Pipeline stages for program workout generation (Phase 1b)
export type ProgramGenerateStage = 'generating' | 'mapping' | 'complete';

// Union of all pipeline stages
export type PipelineStage =
  | GenerationStage
  | ImportStage
  | SaveStage
  | ProgramDesignStage
  | ProgramGenerateStage;

// Sub-progress for batched operations (e.g., "Week 2 of 4")
export interface PipelineSubProgress {
  current: number;
  total: number;
}

export interface PipelineStageEvent {
  stage: PipelineStage;
  message: string;
  sub_progress?: PipelineSubProgress;
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

// Program-specific preview (returned by generate_program and generate_program_workouts)
export interface PipelineProgramPreview {
  preview_id: string;
  program: {
    name: string;
    goal?: string;
    duration_weeks?: number;
    sessions_per_week?: number;
    periodization_model?: string;
    weeks: Array<{
      week_number: number;
      focus?: string;
      intensity_percentage?: number;
      volume_modifier?: number;
      is_deload: boolean;
      notes?: string;
      workouts: Array<{
        day_of_week: number;
        name: string;
        workout_type: string;
        target_duration_minutes?: number;
        exercises?: PipelineExercise[];
      }>;
    }>;
  };
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
  | { event: 'preview'; data: PipelinePreview | PipelineProgramPreview }
  | { event: 'error'; data: PipelineErrorEvent }
  | { event: 'complete'; data: Record<string, unknown> };

// Type guard to distinguish program previews from workout previews
export function isProgramPreview(
  preview: PipelinePreview | PipelineProgramPreview,
): preview is PipelineProgramPreview {
  return 'program' in preview;
}
