import type { PlatformConnection } from './types';

export const MOCK_CONNECTIONS: PlatformConnection[] = [
  {
    id: 'stryd',
    name: 'Stryd',
    icon: 'Footprints',
    color: 'orange-500',
    authMethod: 'credentials',
    status: 'connected',
    lastSyncedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    username: 'alex@example.com',
  },
  // GARMIN REMOVED — now uses GarminPairing component (Connect IQ + 6-digit code)
  {
    id: 'strava',
    name: 'Strava',
    icon: 'Bike',
    color: 'orange-600',
    authMethod: 'oauth2',
    status: 'disconnected',
  },
];

// PLATFORM_DEFAULTS: used in non-demo (real) mode as the initial state.
// Strava uses real per-user OAuth via POST /strava/oauth/initiate.
// Stryd uses email/password credentials.
// DEPRECATED: Garmin Connect OAuth/credential flow — now uses Connect IQ widget
// with 6-digit pairing code (see GarminPairing.tsx component). The GarminPairing
// component is rendered separately on the ConnectionsPage, not as a PlatformCard.
export const PLATFORM_DEFAULTS: PlatformConnection[] = [
  {
    id: 'stryd',
    name: 'Stryd',
    icon: 'Footprints',
    color: 'orange-500',
    authMethod: 'credentials',
    status: 'disconnected',
  },
  // GARMIN REMOVED from PlatformCard list — replaced by GarminPairing component
  // which uses Connect IQ widget + 6-digit pairing code + native FIT delivery.
  {
    id: 'strava',
    name: 'Strava',
    icon: 'Bike',
    color: 'orange-600',
    // Strava uses real per-user OAuth: POST /strava/oauth/initiate → redirect.
    authMethod: 'oauth2',
    status: 'disconnected',
  },
];
