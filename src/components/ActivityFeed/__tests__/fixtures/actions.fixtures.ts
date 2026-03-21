/**
 * Test fixtures for ActivityFeed component tests (AMA-1124).
 */

import type { PendingAction } from '../../types';

const NOW = '2026-03-21T12:00:00.000Z';
const HOUR_AGO = '2026-03-21T11:00:00.000Z';
const DAY_AGO = '2026-03-20T12:00:00.000Z';

export const MOCK_APPROVED_ACTION: PendingAction = {
  id: 'test-act-001',
  user_id: 'test-user',
  agent: 'strava_enricher',
  action_type: 'enrich_title',
  payload: { new_title: 'Morning Easy Run' },
  status: 'approved',
  approval_path: 'auto',
  rationale: 'Added descriptive title from Strava activity data.',
  reversible: true,
  snapshot: { old_title: 'Activity' },
  created_at: HOUR_AGO,
  applied_at: HOUR_AGO,
  undone_at: null,
};

export const MOCK_PENDING_ACTION: PendingAction = {
  id: 'test-act-002',
  user_id: 'test-user',
  agent: 'scheduler',
  action_type: 'restructure_week',
  payload: { changes: ['Swap sessions'] },
  status: 'pending',
  approval_path: 'user_required',
  rationale: 'Acute:chronic ratio is high. Recommending restructure.',
  reversible: true,
  snapshot: null,
  created_at: NOW,
  applied_at: null,
  undone_at: null,
};

export const MOCK_REJECTED_ACTION: PendingAction = {
  id: 'test-act-003',
  user_id: 'test-user',
  agent: 'scheduler',
  action_type: 'delete_session',
  payload: { session_id: 's-1' },
  status: 'rejected',
  approval_path: 'user_required',
  rationale: 'Duplicate session detected.',
  reversible: false,
  snapshot: null,
  created_at: DAY_AGO,
  applied_at: null,
  undone_at: null,
};

export const MOCK_UNDONE_ACTION: PendingAction = {
  id: 'test-act-004',
  user_id: 'test-user',
  agent: 'scheduler',
  action_type: 'reschedule_session',
  payload: { from: '2026-03-20', to: '2026-03-21' },
  status: 'undone',
  approval_path: 'auto',
  rationale: 'Moved session due to low readiness.',
  reversible: true,
  snapshot: { original_date: '2026-03-20' },
  created_at: DAY_AGO,
  applied_at: DAY_AGO,
  undone_at: DAY_AGO,
};

export const MOCK_IRREVERSIBLE_APPROVED: PendingAction = {
  id: 'test-act-005',
  user_id: 'test-user',
  agent: 'garmin_pusher',
  action_type: 'push_to_garmin',
  payload: { workout_id: 'w-1' },
  status: 'approved',
  approval_path: 'auto',
  rationale: 'Pushed workout to Garmin device.',
  reversible: false,
  snapshot: null,
  created_at: HOUR_AGO,
  applied_at: HOUR_AGO,
  undone_at: null,
};

export const ALL_MOCK_ACTIONS: PendingAction[] = [
  MOCK_APPROVED_ACTION,
  MOCK_PENDING_ACTION,
  MOCK_REJECTED_ACTION,
  MOCK_UNDONE_ACTION,
  MOCK_IRREVERSIBLE_APPROVED,
];
