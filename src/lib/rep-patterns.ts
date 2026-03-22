/**
 * AMA-182: Ladder/Pyramid workout rep pattern utilities.
 *
 * Generates ascending, descending, and pyramid rep sequences
 * based on a base rep count and number of sets.
 */

import type { RepPattern } from '../types/workout';

/** Display labels for rep patterns */
export const REP_PATTERN_LABELS: Record<RepPattern, string> = {
  standard: 'Standard',
  ascending: 'Ascending (Ladder Up)',
  descending: 'Descending (Ladder Down)',
  pyramid: 'Pyramid (Up & Down)',
};

/** Short descriptions for rep patterns */
export const REP_PATTERN_DESCRIPTIONS: Record<RepPattern, string> = {
  standard: 'Same reps each set',
  ascending: 'Reps increase each set (e.g., 8, 10, 12)',
  descending: 'Reps decrease each set (e.g., 12, 10, 8)',
  pyramid: 'Reps go up then back down (e.g., 8, 10, 12, 10, 8)',
};

/**
 * Default rep increment/decrement step between sets.
 */
const DEFAULT_STEP = 2;

/**
 * Generate a rep sequence for a given pattern.
 *
 * @param baseReps - The starting rep count (for ascending) or middle rep count (for pyramid)
 * @param sets - Number of sets
 * @param step - Rep increment between sets (default: 2)
 * @returns Array of rep counts, one per set
 */
export function generateRepSequence(
  baseReps: number,
  sets: number,
  step: number = DEFAULT_STEP,
  pattern: RepPattern = 'standard',
): number[] {
  if (sets <= 0 || baseReps <= 0) return [];

  switch (pattern) {
    case 'standard':
      return Array(sets).fill(baseReps);

    case 'ascending':
      return Array.from({ length: sets }, (_, i) => baseReps + i * step);

    case 'descending': {
      const startReps = baseReps + (sets - 1) * step;
      return Array.from({ length: sets }, (_, i) => startReps - i * step);
    }

    case 'pyramid': {
      // For pyramid, sets determines the total count including the descent
      // E.g., sets=5, baseReps=8, step=2 -> [8, 10, 12, 10, 8]
      // E.g., sets=4, baseReps=8, step=2 -> [8, 10, 10, 8]
      const halfUp = Math.ceil(sets / 2);
      const ascending = Array.from({ length: halfUp }, (_, i) => baseReps + i * step);
      // Mirror: for even sets, include the peak in descent; for odd, exclude it
      const isEven = sets % 2 === 0;
      const descending = isEven
        ? [...ascending].reverse()
        : ascending.slice(0, ascending.length - 1).reverse();
      const full = [...ascending, ...descending];
      return full.slice(0, sets);
    }

    default:
      return Array(sets).fill(baseReps);
  }
}

/**
 * Format a rep sequence as a display string.
 *
 * @param sequence - Array of rep counts
 * @returns Formatted string like "8, 10, 12, 10, 8"
 */
export function formatRepSequence(sequence: number[]): string {
  return sequence.join(', ');
}

/**
 * Get a preview string for a pattern given base reps and sets.
 *
 * @param baseReps - Base rep count
 * @param sets - Number of sets
 * @param pattern - Rep pattern
 * @param step - Rep step (default: 2)
 * @returns Preview string like "8 -> 10 -> 12"
 */
export function getPatternPreview(
  baseReps: number,
  sets: number,
  pattern: RepPattern,
  step: number = DEFAULT_STEP,
): string {
  if (pattern === 'standard') {
    return `${baseReps} reps x ${sets} sets`;
  }
  const sequence = generateRepSequence(baseReps, sets, step, pattern);
  return sequence.join(' -> ');
}
