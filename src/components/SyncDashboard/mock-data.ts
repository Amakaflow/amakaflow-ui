/**
 * Mock data for SyncDashboard demo mode (AMA-1127).
 */

import type { IntegrationStatus, PendingDecision } from './types';

const now = new Date();

export const MOCK_INTEGRATIONS: IntegrationStatus[] = [
  {
    platformId: 'stryd',
    name: 'Stryd',
    icon: 'Footprints',
    color: 'orange-500',
    health: 'ok',
    lastSyncedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    sessionsThisWeek: 5,
  },
  {
    platformId: 'garmin',
    name: 'Garmin Connect',
    icon: 'Watch',
    color: 'blue-600',
    health: 'syncing',
    lastSyncedAt: new Date(now.getTime() - 30 * 60 * 1000),
    sessionsThisWeek: 12,
  },
  {
    platformId: 'strava',
    name: 'Strava',
    icon: 'Bike',
    color: 'orange-600',
    health: 'error',
    lastSyncedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
    sessionsThisWeek: 3,
    errorMessage: 'OAuth token expired. Re-authorize to resume sync.',
  },
];

export const MOCK_PENDING_DECISIONS: PendingDecision[] = [
  {
    id: 'dec-001',
    type: 'conflict',
    title: 'Schedule conflict: Thursday tempo run',
    description:
      'Your acute:chronic workload ratio is 1.4 (above 1.3 threshold). The Thursday tempo session may increase injury risk.',
    rationale:
      'Moving the tempo run to Saturday gives you an extra recovery day and brings your ratio to 1.2.',
    actions: [
      { id: 'move', label: 'Move to Saturday', variant: 'default', value: 'move_saturday' },
      { id: 'keep', label: 'Keep as is', variant: 'outline', value: 'keep' },
      { id: 'skip', label: 'Skip session', variant: 'ghost', value: 'skip' },
    ],
    createdAt: new Date(now.getTime() - 45 * 60 * 1000).toISOString(),
    agent: 'scheduler',
  },
  {
    id: 'dec-002',
    type: 'suggestion',
    title: 'Duplicate easy run detected',
    description:
      'Wednesday has two easy run sessions from different sources (Garmin + manual entry). One may be a duplicate.',
    rationale:
      'The Garmin session was auto-synced 10 minutes after you manually logged the same run. Removing the duplicate keeps your volume accurate.',
    actions: [
      { id: 'remove-manual', label: 'Remove manual entry', variant: 'default', value: 'remove_manual' },
      { id: 'remove-garmin', label: 'Remove Garmin entry', variant: 'outline', value: 'remove_garmin' },
      { id: 'keep-both', label: 'Keep both', variant: 'ghost', value: 'keep_both' },
    ],
    createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
    agent: 'scheduler',
  },
  {
    id: 'dec-003',
    type: 'confirmation',
    title: 'Push updated plan to Garmin?',
    description:
      'Your training plan for next week has been updated with new interval targets. Push the updated workouts to your Forerunner 265?',
    rationale:
      '4 workouts will be updated on your device. This replaces the previously synced versions.',
    actions: [
      { id: 'push', label: 'Push to Garmin', variant: 'default', value: 'push' },
      { id: 'later', label: 'Later', variant: 'outline', value: 'later' },
    ],
    createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
    agent: 'garmin_pusher',
  },
];
