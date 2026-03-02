/**
 * Auto-generate tags from workout content
 * 
 * Provides automatic tagging for workouts based on:
 * - Workout type
 * - Exercise names (upper body, lower body, core)
 * - Block labels (push, pull)
 * - Duration (quick, long)
 */

import type { WorkoutStructure, Block, Exercise } from '../types/workout';

/**
 * Calculate estimated duration in minutes from workout blocks
 */
function estimateDurationMinutes(blocks: Block[]): number {
  let totalSec = 0;

  for (const block of blocks) {
    // Sum exercise durations
    const exercises = block.exercises || [];
    for (const exercise of exercises) {
      if (exercise.duration_sec) {
        totalSec += exercise.duration_sec;
      } else if (exercise.sets && exercise.reps) {
        // Estimate ~3 seconds per rep
        totalSec += exercise.sets * exercise.reps * 3;
      }
      if (exercise.rest_sec) {
        totalSec += exercise.rest_sec;
      }
    }

    // Sum superset durations
    if (block.supersets) {
      for (const superset of block.supersets) {
        for (const exercise of superset.exercises || []) {
          if (exercise.duration_sec) {
            totalSec += exercise.duration_sec;
          } else if (exercise.sets && exercise.reps) {
            totalSec += exercise.sets * exercise.reps * 3;
          }
        }
        if (superset.rest_between_sec) {
          totalSec += superset.rest_between_sec;
        }
      }
    }

    // Add block-level timing
    if (block.time_cap_sec) {
      totalSec = Math.max(totalSec, block.time_cap_sec);
    }
    if (block.rounds && block.rest_between_rounds_sec) {
      totalSec += (block.rounds - 1) * block.rest_between_rounds_sec;
    }
  }

  return Math.ceil(totalSec / 60);
}

/**
 * Check if exercise name contains any of the given keywords
 */
function exerciseContainsKeyword(exerciseName: string, keywords: string[]): boolean {
  const lowerName = exerciseName.toLowerCase();
  return keywords.some(keyword => lowerName.includes(keyword.toLowerCase()));
}

/**
 * Get all exercise names from blocks (including supersets)
 */
function getAllExerciseNames(blocks: Block[]): string[] {
  const names: string[] = [];
  
  for (const block of blocks) {
    // Direct exercises
    for (const exercise of block.exercises || []) {
      names.push(exercise.name);
    }
    
    // Supersets
    for (const superset of block.supersets || []) {
      for (const exercise of superset.exercises || []) {
        names.push(exercise.name);
      }
    }
  }
  
  return names;
}

/**
 * Generate automatic tags based on workout content
 */
export function generateAutoTags(workout: WorkoutStructure): string[] {
  const tags = new Set<string>();
  
  // 1. Workout type → add as tag
  if (workout.workout_type) {
    tags.add(workout.workout_type);
  }
  
  const exerciseNames = getAllExerciseNames(workout.blocks || []);
  const allExerciseText = exerciseNames.join(' ').toLowerCase();
  
  // 2. Upper body: push/chest/bench/press/pull/row/curl/shoulder/tricep/bicep/lat
  const upperBodyKeywords = ['push', 'chest', 'bench', 'press', 'pull', 'row', 'curl', 'shoulder', 'tricep', 'bicep', 'lat'];
  if (upperBodyKeywords.some(keyword => allExerciseText.includes(keyword))) {
    tags.add('upper-body');
  }
  
  // 3. Block labels containing push → add push; containing pull → add pull
  for (const block of workout.blocks || []) {
    const labelLower = (block.label || '').toLowerCase();
    if (labelLower.includes('push')) {
      tags.add('push');
    }
    if (labelLower.includes('pull')) {
      tags.add('pull');
    }
  }
  
  // 4. Lower body: squat/deadlift/lunge/leg/glute/hamstring/quad/hip/calf
  const lowerBodyKeywords = ['squat', 'deadlift', 'lunge', 'leg', 'glute', 'hamstring', 'quad', 'hip', 'calf'];
  if (lowerBodyKeywords.some(keyword => allExerciseText.includes(keyword))) {
    tags.add('lower-body');
  }
  
  // 5. Core: plank/crunch/ab/core/sit-up
  const coreKeywords = ['plank', 'crunch', 'ab', 'core', 'sit-up', 'situp'];
  if (coreKeywords.some(keyword => allExerciseText.includes(keyword))) {
    tags.add('core');
  }
  
  // 6. Duration-based tags
  const durationMin = estimateDurationMinutes(workout.blocks || []);
  if (durationMin < 30) {
    tags.add('quick');
  }
  if (durationMin > 60) {
    tags.add('long');
  }
  
  return Array.from(tags);
}
