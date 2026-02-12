/**
 * StreamingWorkflow — Reusable component that shows pipeline stages + workout preview.
 *
 * Wraps StageIndicator for stage progress and renders a workout preview card
 * when the pipeline completes. Used by CreateAIWorkout and potentially other flows.
 */

import { Sparkles, Dumbbell, CheckCircle2 } from 'lucide-react';
import { StageIndicator } from './ChatPanel/StageIndicator';
import type { StageConfig } from './ChatPanel/StageIndicator';
import type { PipelineStageEvent, PipelinePreview } from '../types/pipeline';

const DEFAULT_STAGE_CONFIG: StageConfig = {
  analyzing: { icon: Sparkles, label: 'Analyzing request' },
  creating: { icon: Dumbbell, label: 'Generating exercises' },
  complete: { icon: CheckCircle2, label: 'Complete' },
};

const DEFAULT_STAGES = ['analyzing', 'creating'];

interface StreamingWorkflowProps {
  currentStage: PipelineStageEvent | null;
  completedStages: string[];
  preview: PipelinePreview | null;
  isStreaming: boolean;
  error: string | null;
  onSave?: () => void;
  onRetry?: () => void;
  stageConfig?: StageConfig;
  stages?: string[];
}

export function StreamingWorkflow({
  currentStage,
  completedStages,
  preview,
  isStreaming,
  error,
  onSave,
  onRetry,
  stageConfig = DEFAULT_STAGE_CONFIG,
  stages = DEFAULT_STAGES,
}: StreamingWorkflowProps) {
  return (
    <div className="space-y-4">
      {/* Stage progress */}
      {(isStreaming || completedStages.length > 0) && (
        <StageIndicator
          currentStage={currentStage}
          completedStages={completedStages}
          stageConfig={stageConfig}
          stages={stages}
        />
      )}

      {/* Error display */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* Workout preview card */}
      {preview && (
        <div className="rounded-lg border bg-card p-4 space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">{preview.workout.name}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {preview.workout.difficulty && (
                <span className="rounded-full bg-muted px-2 py-0.5">
                  {preview.workout.difficulty}
                </span>
              )}
              {preview.workout.duration_minutes && (
                <span className="rounded-full bg-muted px-2 py-0.5">
                  {preview.workout.duration_minutes} min
                </span>
              )}
            </div>
          </div>

          {/* Exercise list */}
          <div className="space-y-2">
            {preview.workout.exercises.map((exercise, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="font-medium">{exercise.name}</span>
                  {exercise.muscle_group && (
                    <span className="text-xs text-muted-foreground">
                      ({exercise.muscle_group})
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {exercise.sets && exercise.reps
                    ? `${exercise.sets} × ${exercise.reps}`
                    : exercise.sets
                      ? `${exercise.sets} sets`
                      : exercise.reps
                        ? `${exercise.reps} reps`
                        : ''}
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-2">
            {onSave && (
              <button
                onClick={onSave}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Save to Library
              </button>
            )}
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Try Again
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
