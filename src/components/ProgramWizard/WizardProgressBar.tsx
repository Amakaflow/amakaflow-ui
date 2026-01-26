'use client';

import { Check, ChevronRight } from 'lucide-react';
import { useProgramWizard } from '@/context/ProgramWizardContext';
import { ProgramWizardStep, WIZARD_STEPS } from '@/types/program-wizard';
import { cn } from '@/components/ui/utils';

const stepConfig: Record<ProgramWizardStep, string> = {
  goal: 'Goal',
  experience: 'Experience',
  schedule: 'Schedule',
  equipment: 'Equipment',
  preferences: 'Preferences',
  review: 'Review',
};

export function WizardProgressBar() {
  const { state, goToStep } = useProgramWizard();
  const currentIndex = WIZARD_STEPS.indexOf(state.step);

  const handleStepClick = (step: ProgramWizardStep, index: number) => {
    // Only allow clicking on completed steps (to go back)
    if (index < currentIndex) {
      goToStep(step);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-y-2 w-full py-4">
      {WIZARD_STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isActive = index === currentIndex;
        const isPending = index > currentIndex;
        const isClickable = isCompleted;

        return (
          <div key={step} className="flex items-center">
            <button
              type="button"
              onClick={() => handleStepClick(step, index)}
              disabled={!isClickable}
              className={cn(
                'flex items-center gap-2 px-2 py-1 rounded transition-opacity',
                isClickable && 'cursor-pointer hover:opacity-80',
                !isClickable && 'cursor-default'
              )}
            >
              {/* Step circle */}
              <div
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium transition-colors',
                  isCompleted && 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900',
                  isActive && 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900',
                  isPending && 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              {/* Step label */}
              <span
                className={cn(
                  'text-sm font-medium whitespace-nowrap',
                  (isCompleted || isActive) && 'text-zinc-900 dark:text-zinc-100',
                  isPending && 'text-zinc-400 dark:text-zinc-500'
                )}
              >
                {stepConfig[step]}
              </span>
            </button>

            {/* Chevron separator (except for last step) */}
            {index < WIZARD_STEPS.length - 1 && (
              <ChevronRight className="w-4 h-4 mx-1 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
