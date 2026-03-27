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
    authMethod: 'oauth2',
    status: 'disconnected',
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
