/**
 * StepProgressBar Component
 *
 * Visual progress indicator for the bulk import workflow.
 * Matches the Create Workout stepper style exactly.
 */

import { Check, ChevronRight } from 'lucide-react';
import { useBulkImport } from '../../context/BulkImportContext';
import { BulkImportStep } from '../../types/bulk-import';
import { cn } from '../ui/utils';

interface StepProgressBarProps {
  className?: string;
}

const stepConfig: Record<BulkImportStep, { label: string }> = {
  detect: { label: 'Add Sources' },
  map: { label: 'Map Columns' },
  match: { label: 'Match Exercises' },
  preview: { label: 'Preview' },
  import: { label: 'Import' },
};

export function StepProgressBar({ className }: StepProgressBarProps) {
  const { state, goToStep } = useBulkImport();
  const currentIndex = state.activeSteps.indexOf(state.step);

  const handleStepClick = (step: BulkImportStep, index: number) => {
    if (index < currentIndex) {
      goToStep(step);
    }
  };

  return (
    <div className={cn('w-full flex items-center justify-center flex-wrap gap-y-2', className)}>
      {state.activeSteps.map((step, index) => {
        const isActive = step === state.step;
        const isCompleted = index < currentIndex;
        const isPending = index > currentIndex;
        const isClickable = index < currentIndex;
        const config = stepConfig[step];

        return (
          <div key={step} className="flex items-center">
            {/* Step button with circle and label */}
            <button
              onClick={() => handleStepClick(step, index)}
              disabled={!isClickable}
              className={cn(
                'flex items-center gap-2 transition-all',
                isClickable && 'cursor-pointer hover:opacity-80',
                !isClickable && 'cursor-default'
              )}
            >
              {/* Circle with number - using inline styles for guaranteed visibility */}
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: isActive ? '#27272a' : isCompleted ? '#10b981' : '#e4e4e7',
                  color: isActive ? '#ffffff' : isCompleted ? '#ffffff' : '#71717a',
                }}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                ) : (
                  index + 1
                )}
              </span>

              {/* Label */}
              <span
                className="text-sm font-medium"
                style={{
                  color: isActive ? '#18181b' : isCompleted ? '#059669' : '#a1a1aa',
                }}
              >
                {config.label}
              </span>
            </button>

            {/* Chevron */}
            {index < state.activeSteps.length - 1 && (
              <ChevronRight
                className="w-4 h-4 mx-3 flex-shrink-0"
                style={{
                  color: index < currentIndex ? '#10b981' : '#d4d4d8',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default StepProgressBar;
