/**
 * Standalone preview for AMA-205: Auto-add warm-up and rest periods.
 * Served at /auto-add-periods-preview.html during dev.
 */
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import './index.css';
import { autoAddStrengthPeriods, isStrengthWorkout } from './lib/autoAddStrengthPeriods';
import type { WorkoutStructure } from './types/workout';

const SAMPLE_STRENGTH_WORKOUT: WorkoutStructure = {
  title: 'Push Day',
  source: 'manual',
  workout_type: 'strength',
  blocks: [
    {
      label: 'Main Lifts',
      structure: 'sets',
      sets: 4,
      exercises: [
        { id: 'ex1', name: 'Bench Press', sets: 4, reps: 8, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, type: 'strength' },
        { id: 'ex2', name: 'Overhead Press', sets: 4, reps: 8, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, type: 'strength' },
        { id: 'ex3', name: 'Incline DB Press', sets: 3, reps: 12, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, type: 'strength' },
      ],
    },
  ],
};

function AutoAddPreview() {
  const [original] = useState(SAMPLE_STRENGTH_WORKOUT);
  const [enhanced, setEnhanced] = useState<WorkoutStructure | null>(null);

  const handleAutoAdd = () => {
    setEnhanced(autoAddStrengthPeriods(original));
  };

  const renderWorkout = (workout: WorkoutStructure, label: string) => (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <h3 className="font-semibold text-sm">{label}</h3>
      <p className="text-xs text-muted-foreground">
        Type: {workout.workout_type || 'unknown'} | Is strength: {isStrengthWorkout(workout) ? 'Yes' : 'No'}
      </p>
      {workout.settings && (
        <div className="text-xs bg-muted/50 p-2 rounded">
          Rest: {workout.settings.defaultRestType} {workout.settings.defaultRestSec ? `(${workout.settings.defaultRestSec}s)` : ''} |
          Warm-up: {workout.settings.workoutWarmup?.enabled ? `${workout.settings.workoutWarmup.durationSec / 60}min` : 'off'}
        </div>
      )}
      {workout.blocks?.map((block, i) => (
        <div key={i} className="pl-3 border-l-2 border-muted py-1" data-testid={`block-${block.structure || 'default'}`}>
          <p className="text-sm font-medium">{block.label} ({block.structure})</p>
          {block.rest_between_sets_sec && (
            <p className="text-xs text-muted-foreground">Rest between sets: {block.rest_between_sets_sec}s</p>
          )}
          {block.exercises?.map((ex, j) => (
            <p key={j} className="text-xs text-muted-foreground ml-2">
              {ex.name} - {ex.sets}x{ex.reps}
            </p>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div className="dark bg-background text-foreground min-h-screen p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Auto-add Warm-up & Rest (AMA-205)</h1>

        <div className="grid grid-cols-2 gap-4">
          {renderWorkout(original, 'Before (Original)')}
          {enhanced ? (
            renderWorkout(enhanced, 'After (Auto-added)')
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/20 p-4 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Click button to apply</p>
            </div>
          )}
        </div>

        <button
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm"
          onClick={handleAutoAdd}
          data-testid="apply-auto-add"
        >
          Apply Auto-add Periods
        </button>
      </div>
    </div>
  );
}

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(<AutoAddPreview />);
}
