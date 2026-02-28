'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useProgramWizard } from '@/context/ProgramWizardContext';
import { FocusArea, FOCUS_AREA_LABELS } from '@/types/program-wizard';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
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
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Any preferences? (Optional)
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Help us personalize your program further
        </p>
      </div>

      {/* Injuries/Limitations */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Injuries or limitations
        </label>
        <Textarea
          value={state.injuries}
          onChange={(e) => setInjuries(e.target.value)}
          placeholder="e.g., Lower back issues, shoulder impingement..."
          className="min-h-[80px]"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          We&apos;ll avoid exercises that might aggravate these conditions
        </p>
      </div>

      {/* Focus Areas */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
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
                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                    : 'border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600'
                )}
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    'w-4 h-4 rounded flex items-center justify-center border flex-shrink-0',
                    isSelected
                      ? 'border-white bg-white dark:border-zinc-900 dark:bg-zinc-900'
                      : 'border-zinc-400 dark:border-zinc-500'
                  )}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 text-zinc-900 dark:text-white" viewBox="0 0 12 12" fill="none">
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
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Exercises to avoid
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={exerciseInput}
            onChange={(e) => setExerciseInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., Deadlift, Overhead press..."
            className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-zinc-800"
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
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-zinc-100 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                {exercise}
                <button
                  type="button"
                  onClick={() => removeAvoidExercise(exercise)}
                  className="p-0.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700"
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
