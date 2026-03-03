'use client';

import { Dumbbell, Flame, Scale, Heart, Activity } from 'lucide-react';
import { useProgramWizard } from '@/context/ProgramWizardContext';
import { ProgramGoal, GOAL_LABELS } from '@/types/program-wizard';
import { cn } from '@/components/ui/utils';

const goalIcons: Record<ProgramGoal, React.ComponentType<{ className?: string }>> = {
  strength: Dumbbell,
  hypertrophy: Flame,
  fat_loss: Scale,
  endurance: Heart,
  general_fitness: Activity,
};

const goals: ProgramGoal[] = ['strength', 'hypertrophy', 'fat_loss', 'endurance', 'general_fitness'];

export function GoalStep() {
  const { state, setGoal } = useProgramWizard();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">
          What&apos;s your primary goal?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This will help us customize your program structure
        </p>
      </div>

      <div className="grid gap-3">
        {goals.map((goal) => {
          const Icon = goalIcons[goal];
          const { label, description } = GOAL_LABELS[goal];
          const isSelected = state.goal === goal;

          return (
            <button
              key={goal}
              type="button"
              onClick={() => setGoal(goal)}
              className={cn(
                'flex items-center gap-4 w-full p-4 rounded-lg border-2 text-left transition-colors',
                isSelected
                  ? 'border-primary bg-secondary'
                  : 'border-border hover:border-primary'
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center w-12 h-12 rounded-lg',
                  isSelected
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'font-medium',
                    isSelected
                      ? 'text-foreground'
                      : 'text-foreground'
                  )}
                >
                  {label}
                </div>
                <div className="text-sm text-muted-foreground">{description}</div>
              </div>
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                  isSelected
                    ? 'border-primary'
                    : 'border-gray-300'
                )}
              >
                {isSelected && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
