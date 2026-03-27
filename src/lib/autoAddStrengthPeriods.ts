/**
 * AMA-205: Auto-add warm-up and rest periods for strength workouts.
 *
 * When a strength workout is created, automatically inject:
 *  - 5-min general warm-up block at the start
 *  - 60-90s rest periods between exercises
 *  - 5-min cooldown block at the end
 *
 * The feature can be toggled on/off via WorkoutSettings.autoAddPeriods.
 */

import type { WorkoutStructure, Block, WarmupActivity } from '../types/workout';
import { generateId, getStructureDefaults } from './workout-utils';

export interface AutoAddPeriodsOptions {
  warmupDurationSec?: number;     // Default: 300 (5 min)
  warmupActivity?: WarmupActivity; // Default: 'stretching'
  restBetweenExercisesSec?: number; // Default: 75 (midpoint of 60-90s)
  cooldownDurationSec?: number;   // Default: 300 (5 min)
  cooldownActivity?: WarmupActivity; // Default: 'stretching'
}

const DEFAULT_OPTIONS: Required<AutoAddPeriodsOptions> = {
  warmupDurationSec: 300,
  warmupActivity: 'stretching',
  restBetweenExercisesSec: 75,
  cooldownDurationSec: 300,
  cooldownActivity: 'stretching',
};

/**
 * Determine if a workout is a strength workout based on its type or content.
 */
export function isStrengthWorkout(workout: WorkoutStructure): boolean {
  // Explicit type takes priority
  if (workout.workout_type) {
    return workout.workout_type === 'strength';
  }

  // Heuristic: if most exercises are typed 'strength', treat it as strength
  const allExercises = (workout.blocks || []).flatMap((b) => [
    ...(b.exercises || []),
    ...(b.supersets || []).flatMap((s) => s.exercises || []),
  ]);
  if (allExercises.length === 0) return false;

  const strengthCount = allExercises.filter(
    (e) => e.type === 'strength' || (!e.duration_sec && !e.distance_m && e.sets)
  ).length;
  return strengthCount / allExercises.length >= 0.6;
}

/**
 * Auto-add warm-up, rest periods, and cooldown to a strength workout.
 * Returns a new WorkoutStructure (immutable).
 */
export function autoAddStrengthPeriods(
  workout: WorkoutStructure,
  options?: AutoAddPeriodsOptions,
): WorkoutStructure {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const blocks = [...(workout.blocks || [])];

  // Check if warm-up already exists
  const hasWarmup = blocks.some((b) => b.structure === 'warmup');
  // Check if cooldown already exists
  const hasCooldown = blocks.some((b) => b.structure === 'cooldown');

  // Insert warm-up at the start if not present
  if (!hasWarmup) {
    const warmupBlock: Block = {
      id: generateId(),
      label: 'Warm-up',
      structure: 'warmup',
      exercises: [],
      ...getStructureDefaults('warmup'),
      warmup_enabled: true,
      warmup_activity: opts.warmupActivity,
      warmup_duration_sec: opts.warmupDurationSec,
    };
    blocks.unshift(warmupBlock);
  }

  // Add cooldown at the end if not present
  if (!hasCooldown) {
    const cooldownBlock: Block = {
      id: generateId(),
      label: 'Cool-down',
      structure: 'cooldown',
      exercises: [],
      ...getStructureDefaults('cooldown'),
      warmup_enabled: true,
      warmup_activity: opts.cooldownActivity,
      warmup_duration_sec: opts.cooldownDurationSec,
    };
    blocks.push(cooldownBlock);
  }

  // Apply rest periods to exercise blocks that don't already have rest configured
  const updatedBlocks = blocks.map((block) => {
    if (block.structure === 'warmup' || block.structure === 'cooldown') return block;
    // Don't override blocks that already have rest settings
    if (block.rest_between_sets_sec || block.rest_between_rounds_sec) return block;

    // For 'sets' / 'regular' structures, set rest between sets
    if (block.structure === 'sets' || block.structure === 'regular' || block.structure === null) {
      return {
        ...block,
        rest_between_sets_sec: opts.restBetweenExercisesSec,
      };
    }

    return block;
  });

  return {
    ...workout,
    blocks: updatedBlocks,
    settings: {
      ...workout.settings,
      defaultRestType: workout.settings?.defaultRestType || 'timed',
      defaultRestSec: workout.settings?.defaultRestSec || opts.restBetweenExercisesSec,
    },
  };
}
