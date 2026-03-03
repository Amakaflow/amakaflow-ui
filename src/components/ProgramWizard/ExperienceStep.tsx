'use client';

import { Sprout, TrendingUp, Award } from 'lucide-react';
import { useProgramWizard } from '@/context/ProgramWizardContext';
import { ExperienceLevel, EXPERIENCE_LABELS } from '@/types/program-wizard';
import { cn } from '@/components/ui/utils';

const experienceIcons: Record<ExperienceLevel, React.ComponentType<{ className?: string }>> = {
  beginner: Sprout,
  intermediate: TrendingUp,
  advanced: Award,
};

const levels: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];

export function ExperienceStep() {
  const { state, setExperienceLevel } = useProgramWizard();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">
          What&apos;s your experience level?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We&apos;ll adjust exercise complexity and volume accordingly
        </p>
      </div>

      <div className="grid gap-3">
        {levels.map((level) => {
          const Icon = experienceIcons[level];
          const { label, description } = EXPERIENCE_LABELS[level];
          const isSelected = state.experienceLevel === level;

          return (
            <button
              key={level}
              type="button"
              onClick={() => setExperienceLevel(level)}
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
                    'font-medium text-foreground'
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
