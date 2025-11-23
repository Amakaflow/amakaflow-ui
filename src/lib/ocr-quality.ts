import { WorkoutStructure, Exercise } from '../types/workout';

export interface OCRQualityMetrics {
  score: number; // 0-100, higher is better
  issues: string[];
  recommendation: 'good' | 'fair' | 'poor';
}

/**
 * Analyze OCR quality by checking:
 * - Percentage of exercises with missing reps/sets/distance
 * - Exercise names that look garbled (random characters, too short, etc.)
 * - Block labels that look garbled
 * - Overall data completeness
 */
export function analyzeOCRQuality(workout: WorkoutStructure, usedVisionAPI: boolean): OCRQualityMetrics | null {
  // If Vision API was used, don't analyze OCR quality
  if (usedVisionAPI) {
    return null;
  }

  const issues: string[] = [];
  let totalExercises = 0;
  let exercisesWithNoDetails = 0;
  let garbledExerciseNames = 0;
  let garbledBlockLabels = 0;

  // Check all exercises across blocks and supersets
  for (const block of workout.blocks || []) {
    // Check block label
    if (block.label && isGarbledText(block.label)) {
      garbledBlockLabels++;
      issues.push(`Block label "${block.label}" appears garbled`);
    }

    // Check exercises directly in block
    for (const exercise of block.exercises || []) {
      totalExercises++;
      if (isExerciseMissingDetails(exercise)) {
        exercisesWithNoDetails++;
      }
      if (isGarbledText(exercise.name)) {
        garbledExerciseNames++;
        issues.push(`Exercise name "${exercise.name}" appears garbled`);
      }
    }

    // Check exercises in supersets
    for (const superset of block.supersets || []) {
      for (const exercise of superset.exercises || []) {
        totalExercises++;
        if (isExerciseMissingDetails(exercise)) {
          exercisesWithNoDetails++;
        }
        if (isGarbledText(exercise.name)) {
          garbledExerciseNames++;
          issues.push(`Exercise name "${exercise.name}" appears garbled`);
        }
      }
    }
  }

  // Calculate quality score
  let score = 100;

  // Penalize for missing details (40% weight)
  if (totalExercises > 0) {
    const missingDetailsPercent = (exercisesWithNoDetails / totalExercises) * 100;
    score -= missingDetailsPercent * 0.4;
  }

  // Penalize for garbled exercise names (40% weight)
  if (totalExercises > 0) {
    const garbledNamesPercent = (garbledExerciseNames / totalExercises) * 100;
    score -= garbledNamesPercent * 0.4;
  }

  // Penalize for garbled block labels (20% weight)
  const totalBlocks = workout.blocks?.length || 0;
  if (totalBlocks > 0) {
    const garbledBlocksPercent = (garbledBlockLabels / totalBlocks) * 100;
    score -= garbledBlocksPercent * 0.2;
  }

  // Ensure score is between 0 and 100
  score = Math.max(0, Math.min(100, score));

  // Determine recommendation
  let recommendation: 'good' | 'fair' | 'poor';
  if (score >= 70) {
    recommendation = 'good';
  } else if (score >= 40) {
    recommendation = 'fair';
  } else {
    recommendation = 'poor';
  }

  return {
    score: Math.round(score),
    issues: issues.slice(0, 5), // Limit to first 5 issues
    recommendation,
  };
}

/**
 * Check if an exercise is missing key details (reps, sets, distance, duration)
 */
function isExerciseMissingDetails(exercise: Exercise): boolean {
  return !exercise.reps &&
    !exercise.reps_range &&
    !exercise.sets &&
    !exercise.distance_m &&
    !exercise.distance_range &&
    !exercise.duration_sec;
}

/**
 * Check if text appears garbled (OCR errors)
 * Indicators:
 * - Very short (1-2 chars) with no meaningful content
 * - Mostly symbols/special characters
 * - Random character combinations
 * - Pattern matching OCR garbage
 */
function isGarbledText(text: string): boolean {
  if (!text || text.trim().length === 0) {
    return false;
  }

  const trimmed = text.trim();

  // Too short with no letters
  if (trimmed.length <= 2) {
    const letters = sumChars(trimmed, isAlpha);
    if (letters === 0) {
      return true;
    }
  }

  // Count character types
  const letters = sumChars(trimmed, isAlpha);
  const digits = sumChars(trimmed, isDigit);
  const spaces = sumChars(trimmed, isSpace);
  const symbols = trimmed.length - letters - digits - spaces;

  // If mostly symbols, likely garbled
  if (trimmed.length >= 3) {
    const meaningful = letters + digits;
    if (meaningful === 0) {
      return true; // Only symbols
    }
    if (symbols > meaningful * 2) {
      return true; // Too many symbols relative to meaningful chars
    }
  }

  // Check for patterns that suggest OCR garbage
  // All special characters (no letters/digits)
  const onlySpecialChars = /^[®°©™'"()\[\]{}.,;:!?\-_=+|\\/@#$%^&*~`\s]+$/.test(trimmed);
  if (onlySpecialChars && trimmed.length > 2) {
    return true;
  }

  // Check for random character combinations (e.g., "ae", "ry Ae", "be toe")
  // These are often OCR misreads
  if (trimmed.length >= 2 && trimmed.length <= 10) {
    const words = trimmed.split(/\s+/);
    // If multiple short words with no clear pattern
    if (words.length >= 2 && words.every(w => w.length <= 3 && !/^\d+$/.test(w))) {
      // Check if it looks like random characters
      const allShort = words.every(w => w.length <= 3);
      if (allShort && letters < trimmed.length * 0.5) {
        return true;
      }
    }
  }

  // Check for specific garbled patterns commonly seen in OCR errors
  // These are known OCR misreads from workout images
  const garbledPatterns = [
    /^AI BALLS$/i,        // Should be "WALL BALLS"
    /^CE BAL$/i,          // Should be "WALL BALLS"  
    /^rae\.?\s*J$/i,      // Garbled text
    /^ry\s+Ae$/i,         // Garbled text
    /^be\s+toe$/i,        // Garbled text
    /^ti\s+es$/i,         // Garbled text
    /^Ova\.?$/i,          // Incomplete/garbled
    /^Toooncrun$/i,       // Garbled
    /^Hbyarlox/i,         // Garbled "HYROX"
    /^In\s+Rest$/i,       // Should be "1 MIN REST" or similar
    /^Min\.?$/i,          // Incomplete
  ];
  
  for (const pattern of garbledPatterns) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  return false;
}

/**
 * Helper to count characters matching a predicate
 */
function sumChars(text: string, predicate: (c: string) => boolean): number {
  let count = 0;
  for (const char of text) {
    if (predicate(char)) {
      count++;
    }
  }
  return count;
}

/**
 * Helper functions to check character types
 */
function isAlpha(char: string): boolean {
  return /^[a-zA-Z]$/.test(char);
}

function isDigit(char: string): boolean {
  return /^\d$/.test(char);
}

function isSpace(char: string): boolean {
  return /^\s$/.test(char);
}

