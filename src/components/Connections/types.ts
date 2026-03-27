export type PlatformId = 'stryd' | 'garmin' | 'strava';

export type AuthMethod = 'credentials' | 'oauth2';

export type ConnectionStatus = 'disconnected' | 'connected' | 'syncing' | 'error';

export interface PlatformConnection {
  id: PlatformId;
  name: string;
  icon: string; // lucide icon name reference
  color: string; // tailwind color class
  authMethod: AuthMethod;
  status: ConnectionStatus;
  lastSyncedAt?: Date;
  errorMessage?: string;
  username?: string; // display name or email for connected account
}

export interface CredentialsPayload {
  email: string;
  password: string;
}
