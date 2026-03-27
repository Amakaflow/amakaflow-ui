'use client';

import { Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { useProgramWizard } from '@/context/ProgramWizardContext';
import { useProgramGenerationApi } from '@/hooks/useProgramGenerationApi';
import {
  GOAL_LABELS,
  EXPERIENCE_LABELS,
  EQUIPMENT_LABELS,
  DAY_LABELS,
  FOCUS_AREA_LABELS,
  EQUIPMENT_LABELS_MAP,
  getEquipmentForState,
} from '@/types/program-wizard';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/components/ui/utils';

interface ReviewStepProps {
  userId: string;
  onComplete?: (programId: string) => void;
}

export function ReviewStep({ userId, onComplete }: ReviewStepProps) {
  const { state, goToStep } = useProgramWizard();
  const { generate, isGenerating, progress, error, programId } = useProgramGenerationApi({
    userId,
    onComplete,
  });

  const equipment = getEquipmentForState(state);

  // Show success state
  if (programId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-6">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            Program Generated!
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your personalized training program is ready
          </p>
        </div>
        <Button onClick={() => onComplete?.(programId)}>
          View Program
        </Button>
      </div>
    );
  }

  // Show generating state
  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-6">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-muted-foreground animate-pulse" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">
            Generating Your Program
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Our AI is creating your personalized training plan
          </p>
        </div>
        <div className="w-full max-w-xs space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-center text-sm text-muted-foreground">
            {progress}% complete
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">
          Review Your Program
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Check your selections before we generate your program
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="space-y-4">
        {/* Goal */}
        <SummaryCard
          label="Goal"
          value={state.goal ? GOAL_LABELS[state.goal].label : '-'}
          onEdit={() => goToStep('goal')}
        />

        {/* Experience */}
        <SummaryCard
          label="Experience"
          value={state.experienceLevel ? EXPERIENCE_LABELS[state.experienceLevel].label : '-'}
          onEdit={() => goToStep('experience')}
        />

        {/* Schedule */}
        <SummaryCard
          label="Schedule"
          value={
            <div className="space-y-1">
              <div>{state.durationWeeks} weeks • {state.sessionsPerWeek} sessions/week</div>
              <div className="text-xs text-muted-foreground">
                {state.preferredDays.map((d) => DAY_LABELS[d].short).join(', ')} • {state.timePerSession} min/session
              </div>
            </div>
          }
          onEdit={() => goToStep('schedule')}
        />

        {/* Equipment */}
        <SummaryCard
          label="Equipment"
          value={
            state.useCustomEquipment
              ? `Custom: ${equipment.map((e) => EQUIPMENT_LABELS_MAP[e] || e).join(', ')}`
              : state.equipmentPreset
              ? EQUIPMENT_LABELS[state.equipmentPreset].label
              : '-'
          }
          onEdit={() => goToStep('equipment')}
        />

        {/* Preferences (only show if any set) */}
        {(state.injuries || state.focusAreas.length > 0 || state.avoidExercises.length > 0) && (
          <SummaryCard
            label="Preferences"
            value={
              <div className="space-y-1">
                {state.injuries && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Injuries: </span>
                    {state.injuries}
                  </div>
                )}
                {state.focusAreas.length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Focus: </span>
                    {state.focusAreas.map((a) => FOCUS_AREA_LABELS[a]).join(', ')}
                  </div>
                )}
                {state.avoidExercises.length > 0 && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Avoid: </span>
                    {state.avoidExercises.join(', ')}
                  </div>
                )}
              </div>
            }
            onEdit={() => goToStep('preferences')}
          />
        )}
      </div>

      {/* Generate Button */}
      <div className="pt-4">
        <Button
          onClick={generate}
          className="w-full"
          size="lg"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Generate Program
        </Button>
      </div>
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: React.ReactNode;
  onEdit: () => void;
}

function SummaryCard({ label, value, onEdit }: SummaryCardProps) {
  return (
    <div className="flex items-start justify-between p-4 rounded-lg border border-border bg-white">
      <div className="space-y-1 flex-1 min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="text-sm text-foreground">{value}</div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="text-xs font-medium text-muted-foreground hover:text-foreground ml-4"
      >
        Edit
      </button>
    </div>
  );
}
