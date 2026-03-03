'use client';

import { useProgramWizard } from '@/context/ProgramWizardContext';
import { ProgramWizardStep, WIZARD_STEPS } from '@/types/program-wizard';

const stepLabels: Record<ProgramWizardStep, string> = {
  goal: 'Set Your Goal',
  experience: 'Experience Level',
  schedule: 'Training Schedule',
  equipment: 'Equipment',
  preferences: 'Preferences',
  review: 'Review & Generate',
};

export function WizardProgressBar() {
  const { state } = useProgramWizard();
  const currentIndex = WIZARD_STEPS.indexOf(state.step);

  return (
    <div className="py-4 space-y-2">
      {/* Segmented bar */}
      <div className="flex gap-1">
        {WIZARD_STEPS.map((_, i) => (
          <div
            key={i}
            className={`h-2 flex-1 rounded-full transition-colors ${
              i <= currentIndex ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Step label + counter */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          {stepLabels[state.step]}
        </span>
        <span className="text-xs text-muted-foreground">
          {currentIndex + 1} of {WIZARD_STEPS.length}
        </span>
      </div>
    </div>
  );
}
