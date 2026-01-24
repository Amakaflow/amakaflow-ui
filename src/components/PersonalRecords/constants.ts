/**
 * Shared constants for Personal Records components.
 *
 * Part of AMA-482: Create Personal Records (PRs) Component
 */

import type { RecordType } from '../../types/progression';

/**
 * Full labels for record types used in PRCard.
 */
export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  '1rm': 'Est. 1RM',
  'max_weight': 'Max Weight',
  'max_reps': 'Max Reps',
};

/**
 * Compact labels for record types used in PRSummary.
 */
export const RECORD_TYPE_LABELS_COMPACT: Record<RecordType, string> = {
  '1rm': '1RM',
  'max_weight': 'Max',
  'max_reps': 'Reps',
};
