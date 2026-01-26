'use client';

import { ArrowLeft, X } from 'lucide-react';
import { ProgramWizardProvider, useProgramWizard } from '@/context/ProgramWizardContext';
import { ProgramWizardStep, WIZARD_STEPS } from '@/types/program-wizard';
import { WizardProgressBar } from './WizardProgressBar';
import { GoalStep } from './GoalStep';
import { ExperienceStep } from './ExperienceStep';
import { ScheduleStep } from './ScheduleStep';
import { EquipmentStep } from './EquipmentStep';
import { PreferencesStep } from './PreferencesStep';
import { ReviewStep } from './ReviewStep';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const stepTitles: Record<ProgramWizardStep, string> = {
  goal: 'Set Your Goal',
  experience: 'Experience Level',
  schedule: 'Training Schedule',
  equipment: 'Equipment',
  preferences: 'Preferences',
  review: 'Review & Generate',
};

interface ProgramWizardProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (programId: string) => void;
}

export function ProgramWizard({ userId, isOpen, onClose, onComplete }: ProgramWizardProps) {
  const handleComplete = (programId: string) => {
    onComplete?.(programId);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <ProgramWizardProvider>
          <ProgramWizardContent
            userId={userId}
            onClose={onClose}
            onComplete={handleComplete}
          />
        </ProgramWizardProvider>
      </DialogContent>
    </Dialog>
  );
}

interface ProgramWizardContentProps {
  userId: string;
  onClose: () => void;
  onComplete: (programId: string) => void;
}

function ProgramWizardContent({ userId, onClose, onComplete }: ProgramWizardContentProps) {
  const { state, goNext, goBack, canGoNext, canGoBack } = useProgramWizard();

  const isFirstStep = state.step === WIZARD_STEPS[0];
  const isLastStep = state.step === WIZARD_STEPS[WIZARD_STEPS.length - 1];
  const isGenerating = state.isGenerating;
  const isComplete = state.generatedProgramId !== null;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <DialogHeader className="px-6 pt-6 pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {canGoBack() && !isGenerating && !isComplete && (
              <button
                type="button"
                onClick={goBack}
                className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <ArrowLeft className="w-5 h-5 text-zinc-500" />
              </button>
            )}
            <DialogTitle className="text-lg font-semibold">
              {stepTitles[state.step]}
            </DialogTitle>
          </div>
          {!isGenerating && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          )}
        </div>
      </DialogHeader>

      {/* Progress Bar */}
      {!isComplete && (
        <div className="px-6">
          <WizardProgressBar />
        </div>
      )}

      {/* Step Content */}
      <div className="px-6 py-6">
        {state.step === 'goal' && <GoalStep />}
        {state.step === 'experience' && <ExperienceStep />}
        {state.step === 'schedule' && <ScheduleStep />}
        {state.step === 'equipment' && <EquipmentStep />}
        {state.step === 'preferences' && <PreferencesStep />}
        {state.step === 'review' && <ReviewStep userId={userId} onComplete={onComplete} />}
      </div>

      {/* Footer Navigation */}
      {!isLastStep && !isGenerating && !isComplete && (
        <div className="flex justify-between items-center px-6 pb-6 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={!canGoBack()}
            className={!canGoBack() ? 'invisible' : ''}
          >
            Back
          </Button>
          <Button
            onClick={goNext}
            disabled={!canGoNext()}
          >
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}
