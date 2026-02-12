/**
 * StageIndicator — Perplexity-style progress showing what the AI is doing.
 *
 * Renders inline in the chat during tool execution. Shows the current
 * stage with an animated indicator and completed stages with checkmarks.
 *
 * Accepts an optional stageConfig prop to render any pipeline's stages.
 */

import { Loader2, CheckCircle2, Search, User, Dumbbell, Sparkles } from 'lucide-react';
import type { WorkoutStage } from '../../types/chat';
import { cn } from '../ui/utils';

export type StageConfig = Record<string, { icon: typeof Search; label: string }>;

export interface GenericStageEvent {
  stage: string;
  message: string;
}

const DEFAULT_STAGE_CONFIG: Record<WorkoutStage, { icon: typeof Search; label: string }> = {
  analyzing: { icon: Sparkles, label: 'Analyzing request' },
  researching: { icon: User, label: 'Researching profile' },
  searching: { icon: Search, label: 'Searching exercises' },
  creating: { icon: Dumbbell, label: 'Creating plan' },
  complete: { icon: CheckCircle2, label: 'Complete' },
};

const DEFAULT_STAGES: WorkoutStage[] = ['analyzing', 'researching', 'searching', 'creating'];

interface StageIndicatorProps {
  currentStage: GenericStageEvent | null;
  completedStages: string[];
  stageConfig?: StageConfig;
  stages?: string[];
}

export function StageIndicator({
  currentStage,
  completedStages,
  stageConfig,
  stages,
}: StageIndicatorProps) {
  if (!currentStage && completedStages.length === 0) return null;

  const config = stageConfig || DEFAULT_STAGE_CONFIG;
  const allStages = stages || DEFAULT_STAGES;

  return (
    <div
      className="flex flex-col gap-1.5 rounded-lg bg-muted/50 px-3 py-2 mb-2 text-xs"
      data-testid="stage-indicator"
    >
      {allStages.map((stage) => {
        const stageConf = config[stage];
        if (!stageConf) return null;
        const Icon = stageConf.icon;
        const isCompleted = completedStages.includes(stage);
        const isCurrent = currentStage?.stage === stage;
        const isInactive = !isCompleted && !isCurrent;

        if (isInactive) return null;

        return (
          <div
            key={stage}
            className={cn(
              'flex items-center gap-2 transition-opacity duration-300',
              isInactive && 'opacity-40',
            )}
            data-testid={`stage-${stage}`}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
            ) : isCurrent ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
            ) : (
              <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            )}
            <span className={cn(
              isCompleted && 'text-muted-foreground line-through',
              isCurrent && 'text-foreground font-medium',
            )}>
              {isCurrent && currentStage?.message ? currentStage.message : stageConf.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
