// AMA-213: Workout type defaults configuration
// Default settings applied based on detected workout type

import { WorkoutType, WorkoutStructure, RestType, WarmupActivity } from '../types/workout';

export interface WorkoutTypeDefaults {
  warmup?: {
    enabled: boolean;
    duration: number; // seconds
    activity: WarmupActivity;
  };
  rest?: {
    type: RestType;
    duration?: number; // seconds (null for button type)
  };
}

export const WORKOUT_TYPE_DEFAULTS: Record<WorkoutType, WorkoutTypeDefaults> = {
  strength: {
    warmup: { enabled: true, duration: 300, activity: 'stretching' }, // 5 min warm-up
    rest: { type: 'button' }, // User controls rest between sets
  },
  circuit: {
    warmup: { enabled: true, duration: 180, activity: 'jump_rope' }, // 3 min warm-up
    rest: { type: 'timed', duration: 30 }, // 30s fixed rest between circuits
  },
  hiit: {
    warmup: { enabled: true, duration: 180, activity: 'treadmill' }, // 3 min warm-up
    rest: { type: 'timed', duration: 15 }, // 15s fixed rest between intervals
  },
  cardio: {
    warmup: { enabled: true, duration: 300, activity: 'treadmill' }, // 5 min easy pace warm-up
    rest: { type: 'button' }, // User controls rest
  },
  follow_along: {
    warmup: { enabled: false, duration: 0, activity: 'stretching' }, // Video has built-in warm-up
    rest: { type: 'button' }, // Follow the video timing
  },
  mixed: {
    warmup: { enabled: true, duration: 300, activity: 'stretching' }, // 5 min general warm-up
    rest: { type: 'button' }, // User controls rest
  },
};

// Human-readable labels for workout types
export const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
  strength: 'Strength Training',
  circuit: 'Circuit Training',
  hiit: 'HIIT',
  cardio: 'Cardio',
  follow_along: 'Follow Along',
  mixed: 'Mixed',
};

// Icons for workout types (emoji for now, can be replaced with Lucide icons)
export const WORKOUT_TYPE_ICONS: Record<WorkoutType, string> = {
  strength: 'dumbbell',
  circuit: 'repeat',
  hiit: 'zap',
  cardio: 'heart',
  follow_along: 'play',
  mixed: 'shuffle',
};

/**
 * Apply workout type defaults to a workout structure.
 * Only applies if workout doesn't already have settings configured.
 */
export function applyWorkoutTypeDefaults(
  workout: WorkoutStructure,
  workoutType: WorkoutType
): WorkoutStructure {
  const defaults = WORKOUT_TYPE_DEFAULTS[workoutType];

  // Don't override if settings already exist
  if (workout.settings?.defaultRestType || workout.settings?.workoutWarmup?.enabled) {
    return {
      ...workout,
      workout_type: workoutType,
    };
  }

  return {
    ...workout,
    workout_type: workoutType,
    settings: {
      ...workout.settings,
      defaultRestType: defaults.rest?.type || 'button',
      defaultRestSec: defaults.rest?.duration || null,
      workoutWarmup: defaults.warmup?.enabled
        ? {
            enabled: true,
            activity: defaults.warmup.activity,
            durationSec: defaults.warmup.duration,
          }
        : undefined,
    },
  };
}

/**
 * Get human-readable description of defaults for a workout type.
 */
export function getWorkoutTypeDefaultsDescription(workoutType: WorkoutType): string[] {
  const defaults = WORKOUT_TYPE_DEFAULTS[workoutType];
  const descriptions: string[] = [];

  if (defaults.warmup?.enabled) {
    const mins = Math.floor(defaults.warmup.duration / 60);
    const activity = defaults.warmup.activity.replace('_', ' ');
    descriptions.push(`${mins} min warm-up (${activity})`);
  }

  if (defaults.rest) {
    if (defaults.rest.type === 'button') {
      descriptions.push('Rest: Tap when ready');
    } else if (defaults.rest.duration) {
      descriptions.push(`Rest: ${defaults.rest.duration}s between exercises`);
    }
  }

  return descriptions;
}

/**
 * Get confidence level description
 */
export function getConfidenceDescription(confidence: number): string {
  if (confidence >= 0.9) return 'Very confident';
  if (confidence >= 0.7) return 'Confident';
  if (confidence >= 0.5) return 'Moderate';
  return 'Low confidence';
}
