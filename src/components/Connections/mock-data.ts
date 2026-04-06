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
  {
    id: 'garmin',
    name: 'Garmin Connect',
    icon: 'Watch',
    color: 'blue-600',
    authMethod: 'oauth2',
    status: 'connected',
    lastSyncedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
    username: 'AlexDemo',
  },
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
// Garmin uses credential-based auth (env vars via garmin-sync-api) — no per-user OAuth yet.
// Stryd uses email/password credentials.
export const PLATFORM_DEFAULTS: PlatformConnection[] = [
  {
    id: 'stryd',
    name: 'Stryd',
    icon: 'Footprints',
    color: 'orange-500',
    authMethod: 'credentials',
    status: 'disconnected',
  },
  {
    id: 'garmin',
    name: 'Garmin Connect',
    icon: 'Watch',
    color: 'blue-600',
    // Garmin sync is credential-based (server-side env vars), not per-user OAuth.
    // Keep as oauth2 in the UI so the connect flow is triggered, but the backend
    // uses shared credentials from garmin-sync-api — no redirect occurs.
    authMethod: 'oauth2',
    status: 'disconnected',
  },
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
