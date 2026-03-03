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
              <div className="relative flex items-center justify-center w-7 h-7">
                {/* Step number */}
                <div
                  className={cn(
                    'absolute flex items-center justify-center w-7 h-7 rounded-full text-sm font-medium transition-colors',
                    isCompleted && 'bg-primary text-primary-foreground',
                    isActive && 'bg-primary text-primary-foreground',
                    isPending && 'bg-muted text-muted-foreground'
                  )}
                >
                  {index + 1}
                </div>
                {/* Checkmark overlay for completed steps */}
                {isCompleted && (
                  <Check className="w-3.5 h-3.5 text-primary-foreground absolute" />
                )}
              </div>

              {/* Step label */}
              <span
                className={cn(
                  'text-sm font-medium whitespace-nowrap',
                  (isCompleted || isActive) && 'text-foreground',
                  isPending && 'text-muted-foreground'
                )}
              >
                {stepConfig[step]}
              </span>
            </button>

            {/* Chevron separator (except for last step) */}
            {index < WIZARD_STEPS.length - 1 && (
              <ChevronRight className="w-4 h-4 mx-1 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
