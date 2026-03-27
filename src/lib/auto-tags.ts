/**
 * Auto-tags Generation
 *
 * Automatically generates tags for workouts based on their content.
 * Tags are used for filtering in the Library tab.
 */

import type { WorkoutStructure, Block, Exercise } from '../types/workout';

// Keywords for detecting muscle groups in exercise names
const UPPER_BODY_KEYWORDS = [
  'push', 'chest', 'bench', 'press', 'pull', 'row', 'curl',
  'shoulder', 'tricep', 'bicep', 'lat', 'push-up', 'pushup'
];

const LOWER_BODY_KEYWORDS = [
  'squat', 'deadlift', 'lunge', 'leg', 'glute', 'hamstring',
  'quad', 'hip', 'calf', 'calves'
];

const CORE_KEYWORDS = [
  'plank', 'crunch', 'ab', 'core', 'sit-up', 'situp', 'crunch'
];

// Keywords for detecting push/pull from block labels
const PUSH_BLOCK_KEYWORD = 'push';
const PULL_BLOCK_KEYWORD = 'pull';

/**
 * Extract all exercise names from a workout's blocks (including supersets)
 */
function extractExerciseNames(workout: WorkoutStructure): string[] {
  const names: string[] = [];

  for (const block of workout.blocks) {
    // Direct exercises in block
    for (const exercise of block.exercises || []) {
      names.push(exercise.name.toLowerCase());
    }

    // Exercises in supersets
    for (const superset of block.supersets || []) {
      for (const exercise of superset.exercises || []) {
        names.push(exercise.name.toLowerCase());
      }
    }
  }

  return names;
}

/**
 * Extract all block labels from a workout
 */
function extractBlockLabels(workout: WorkoutStructure): string[] {
  return workout.blocks.map((block) => block.label.toLowerCase());
}

/**
 * Estimate workout duration in minutes from blocks
 * This is a simplified estimation based on typical exercise durations
 */
function estimateDurationMinutes(workout: WorkoutStructure): number {
  let totalSec = 0;

  for (const block of workout.blocks) {
    // Sum exercise durations
    for (const exercise of block.exercises || []) {
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
    for (const superset of block.supersets || []) {
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

    // Add block-level timing
    if (block.time_cap_sec) {
      totalSec = Math.max(totalSec, block.time_cap_sec);
    }
    if (block.rounds && block.rest_between_rounds_sec) {
      totalSec += (block.rounds - 1) * block.rest_between_rounds_sec;
    }
  }

  // Convert to minutes
  return Math.ceil(totalSec / 60);
}

/**
 * Check if any exercise name contains any of the keywords
 * Uses word boundary matching to avoid false positives (e.g., "pressure" vs "press")
 * Also handles pluralization (e.g., "squats" matches "squat")
 */
function containsKeyword(exerciseNames: string[], keywords: string[]): boolean {
  return exerciseNames.some((name) => {
    // Split on common delimiters to get individual words
    const words = name.split(/[-\s_]+/);
    return keywords.some((keyword) => {
      // Check if any word starts with the keyword (handles pluralization like "squats" -> "squat")
      // or exact match (case-insensitive)
      return words.some((word) => {
        const lowerWord = word.toLowerCase();
        const lowerKeyword = keyword.toLowerCase();
        return lowerWord === lowerKeyword || lowerWord.startsWith(lowerKeyword);
      });
    });
  });
}

/**
 * Check if any block label contains the keyword
 * Uses word boundary matching to avoid false positives
 * Also handles pluralization
 */
function containsBlockLabelKeyword(blockLabels: string[], keyword: string): boolean {
  return blockLabels.some((label) => {
    // Split on common delimiters to get individual words
    const words = label.split(/[-\s_]+/);
    const lowerKeyword = keyword.toLowerCase();
    return words.some((word) => {
      const lowerWord = word.toLowerCase();
      return lowerWord === lowerKeyword || lowerWord.startsWith(lowerKeyword);
    });
  });
}

/**
 * Generate automatic tags for a workout based on its content
 *
 * Rules:
 * - workout.workout_type → add as tag (e.g. strength, cardio, hiit, run)
 * - Exercise names containing push/chest/bench/press/pull/row/curl/shoulder/tricep/bicep/lat → add upper-body
 * - Block labels containing push → add push; containing pull → add pull
 * - Exercise names containing squat/deadlift/lunge/leg/glute/hamstring/quad/hip/calf → add lower-body
 * - Exercise names containing plank/crunch/ab/core/sit-up → add core
 * - estimated_duration_min < 30 → add quick
 * - estimated_duration_min > 60 → add long
 * - Never return duplicate tags
 */
export function generateAutoTags(workout: WorkoutStructure): string[] {
  const tags = new Set<string>();

  // Add workout_type as tag if present
  if (workout.workout_type) {
    tags.add(workout.workout_type);
  }

  // Extract exercise names and block labels
  const exerciseNames = extractExerciseNames(workout);
  const blockLabels = extractBlockLabels(workout);

  // Check for upper body exercises
  if (containsKeyword(exerciseNames, UPPER_BODY_KEYWORDS)) {
    tags.add('upper-body');
  }

  // Check for lower body exercises
  if (containsKeyword(exerciseNames, LOWER_BODY_KEYWORDS)) {
    tags.add('lower-body');
  }

  // Check for core exercises
  if (containsKeyword(exerciseNames, CORE_KEYWORDS)) {
    tags.add('core');
  }

  // Check block labels for push/pull
  if (containsBlockLabelKeyword(blockLabels, PUSH_BLOCK_KEYWORD)) {
    tags.add('push');
  }
  if (containsBlockLabelKeyword(blockLabels, PULL_BLOCK_KEYWORD)) {
    tags.add('pull');
  }

  // Check duration
  const durationMin = estimateDurationMinutes(workout);
  if (durationMin < 30) {
    tags.add('quick');
  }
  if (durationMin > 60) {
    tags.add('long');
  }

  return Array.from(tags);
}
