import { DEMO_USER } from '../demo-mode';

export const MOCK_USER = DEMO_USER;

export const MOCK_LINKED_ACCOUNTS = {
  strava: { connected: true, connectedAt: '2025-10-01', lastSyncAt: '2026-02-20' },
  relive: { connected: false },
  trainingPeaks: { connected: false },
  appleHealth: { connected: true, connectedAt: '2025-11-15' },
  garmin: { connected: true, connectedAt: '2025-09-01' },
  amazfit: { connected: false },
};
