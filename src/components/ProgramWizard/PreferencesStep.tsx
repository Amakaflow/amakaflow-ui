'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useProgramWizard } from '@/context/ProgramWizardContext';
import { FocusArea, FOCUS_AREA_LABELS } from '@/types/program-wizard';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/components/ui/utils';

const focusAreas: FocusArea[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'core',
  'glutes',
  'quads',
  'hamstrings',
  'calves',
];

export function PreferencesStep() {
  const {
    state,
    setInjuries,
    toggleFocusArea,
    addAvoidExercise,
    removeAvoidExercise,
  } = useProgramWizard();

  const [exerciseInput, setExerciseInput] = useState('');

  const handleAddExercise = () => {
    if (exerciseInput.trim()) {
      addAvoidExercise(exerciseInput.trim());
      setExerciseInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddExercise();
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">
          Any preferences? (Optional)
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Help us personalize your program further
        </p>
      </div>

      {/* Injuries/Limitations */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">
          Injuries or limitations
        </label>
        <Textarea
          value={state.injuries}
          onChange={(e) => setInjuries(e.target.value)}
          placeholder="e.g., Lower back issues, shoulder impingement..."
          className="min-h-[80px]"
        />
        <p className="text-xs text-muted-foreground">
          We&apos;ll avoid exercises that might aggravate these conditions
        </p>
      </div>

      {/* Focus Areas */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">
          Focus areas (optional emphasis)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {focusAreas.map((area) => {
            const isSelected = state.focusAreas.includes(area);
            return (
              <button
                key={area}
                type="button"
                onClick={() => toggleFocusArea(area)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border text-muted-foreground hover:border-primary'
                )}
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    'w-4 h-4 rounded flex items-center justify-center border flex-shrink-0',
                    isSelected
                      ? 'border-transparent bg-white'
                      : 'border-gray-300'
                  )}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 text-primary" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span>{FOCUS_AREA_LABELS[area]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Exercises to Avoid */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">
          Exercises to avoid
        </label>
        <div className="flex gap-2">
          <Input
            value={exerciseInput}
            onChange={(e) => setExerciseInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., Deadlift, Overhead press..."
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAddExercise}
            disabled={!exerciseInput.trim()}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {state.avoidExercises.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {state.avoidExercises.map((exercise) => (
              <span
                key={exercise}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-sm text-muted-foreground"
              >
                {exercise}
                <button
                  type="button"
                  onClick={() => removeAvoidExercise(exercise)}
                  className="p-0.5 rounded-full hover:bg-accent"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
