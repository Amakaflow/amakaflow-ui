/**
 * StreamingWorkflow — Reusable component that shows pipeline stages + workout preview.
 *
 * Wraps StageIndicator for stage progress and renders a workout preview card
 * when the pipeline completes. Used by CreateAIWorkout and potentially other flows.
 *
 * Supports nested sub-progress for batched operations (e.g., program generation).
 */

import { Sparkles, Dumbbell, CheckCircle2, ShieldCheck, Save, Send, CalendarPlus, Compass, Link, Loader2, Circle } from 'lucide-react';
import { StageIndicator } from './ChatPanel/StageIndicator';
import type { StageConfig } from './ChatPanel/StageIndicator';
import type { PipelineStageEvent, PipelinePreview, PipelineSubProgress } from '../types/pipeline';
import { cn } from './ui/utils';

const DEFAULT_STAGE_CONFIG: StageConfig = {
  analyzing: { icon: Sparkles, label: 'Analyzing request' },
  creating: { icon: Dumbbell, label: 'Generating exercises' },
  complete: { icon: CheckCircle2, label: 'Complete' },
};

const DEFAULT_STAGES = ['analyzing', 'creating'];

export const SAVE_STAGE_CONFIG: StageConfig = {
  validating: { icon: ShieldCheck, label: 'Validating workout' },
  saving: { icon: Save, label: 'Saving to library' },
  pushing: { icon: Send, label: 'Syncing to devices' },
  scheduling: { icon: CalendarPlus, label: 'Adding to calendar' },
  complete: { icon: CheckCircle2, label: 'Complete' },
};

export const SAVE_STAGES = ['validating', 'saving', 'pushing', 'scheduling'];

export const PROGRAM_DESIGN_STAGE_CONFIG: StageConfig = {
  designing: { icon: Compass, label: 'Designing program' },
  complete: { icon: CheckCircle2, label: 'Complete' },
};

export const PROGRAM_DESIGN_STAGES = ['designing'];

export const PROGRAM_GENERATE_STAGE_CONFIG: StageConfig = {
  generating: { icon: Dumbbell, label: 'Generating workouts' },
  mapping: { icon: Link, label: 'Matching exercises' },
  complete: { icon: CheckCircle2, label: 'Complete' },
};

export const PROGRAM_GENERATE_STAGES = ['generating', 'mapping'];

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
  subProgress?: PipelineSubProgress | null;
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
  subProgress,
}: StreamingWorkflowProps) {
  return (
    <div className="space-y-4">
      {/* Stage progress */}
      {(isStreaming || completedStages.length > 0) && (
        <div className="space-y-1.5">
          <StageIndicator
            currentStage={currentStage}
            completedStages={completedStages}
            stageConfig={stageConfig}
            stages={stages}
          />

          {/* Nested sub-progress (e.g., "Week 2 of 4") */}
          {subProgress && currentStage && (
            <SubProgressIndicator
              current={subProgress.current}
              total={subProgress.total}
              label={currentStage.message}
            />
          )}
        </div>
      )}

      {/* Error display */}
      {error && (
        <div data-testid="pipeline-error" className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{error}</p>
          {onRetry && (
            <button
              data-testid="pipeline-error-retry"
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
        <div data-testid="workout-preview-card" className="rounded-lg border bg-card p-4 space-y-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between">
            <h3 data-testid="preview-workout-name" className="font-semibold text-lg">{preview.workout.name}</h3>
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
                data-testid={`preview-exercise-${idx}`}
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
                data-testid="preview-save-btn"
                onClick={onSave}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Save to Library
              </button>
            )}
            {onRetry && (
              <button
                data-testid="preview-retry-btn"
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

/**
 * SubProgressIndicator — Nested progress for batched operations.
 *
 * Shows individual items (e.g., weeks) with completed/active/pending states.
 */
function SubProgressIndicator({
  current,
  total,
  label,
  itemLabel = 'Week',
}: {
  current: number;
  total: number;
  label?: string;
  itemLabel?: string;
}) {
  return (
    <div
      className="ml-5 flex flex-col gap-1 rounded-md bg-muted/30 px-3 py-2 text-xs"
      data-testid="sub-progress"
    >
      {Array.from({ length: total }, (_, i) => {
        const itemNum = i + 1;
        const isCompleted = itemNum < current;
        const isActive = itemNum === current;

        return (
          <div
            key={itemNum}
            className={cn(
              'flex items-center gap-2 transition-opacity duration-200',
              !isCompleted && !isActive && 'opacity-40',
            )}
            data-testid={`sub-progress-item-${itemNum}`}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
            ) : isActive ? (
              <Loader2 className="w-3 h-3 animate-spin text-primary shrink-0" />
            ) : (
              <Circle className="w-3 h-3 text-muted-foreground shrink-0" />
            )}
            <span className={cn(
              isCompleted && 'text-muted-foreground',
              isActive && 'text-foreground font-medium',
            )}>
              {itemLabel} {itemNum}
            </span>
          </div>
        );
      })}
    </div>
  );
}
