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
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          What&apos;s your primary goal?
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
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
                  ? 'border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-800'
                  : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-center w-12 h-12 rounded-lg',
                  isSelected
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                )}
              >
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'font-medium',
                    isSelected
                      ? 'text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-700 dark:text-zinc-300'
                  )}
                >
                  {label}
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">{description}</div>
              </div>
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                  isSelected
                    ? 'border-zinc-900 dark:border-zinc-100'
                    : 'border-zinc-300 dark:border-zinc-600'
                )}
              >
                {isSelected && (
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
