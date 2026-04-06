import { useState, useCallback } from 'react';
import type { PlatformConnection, PlatformId, CredentialsPayload } from '../types';
import { MOCK_CONNECTIONS, PLATFORM_DEFAULTS } from '../mock-data';
import { isDemoMode } from '../../../lib/demo-mode';
import { API_URLS } from '../../../lib/config';
import { authenticatedFetch } from '../../../lib/authenticated-fetch';

export function useConnections() {
  const [connections, setConnections] = useState<PlatformConnection[]>(
    isDemoMode ? MOCK_CONNECTIONS : PLATFORM_DEFAULTS
  );

  const getConnection = useCallback(
    (id: PlatformId) => connections.find((c) => c.id === id)!,
    [connections]
  );

  const updateConnection = useCallback(
    (id: PlatformId, updates: Partial<PlatformConnection>) => {
      setConnections((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      );
    },
    []
  );

  const connectWithCredentials = useCallback(
    async (id: PlatformId, _credentials: CredentialsPayload) => {
      // In demo mode, simulate a connection delay
      updateConnection(id, { status: 'syncing' });
      await new Promise((r) => setTimeout(r, 1500));
      updateConnection(id, {
        status: 'connected',
        lastSyncedAt: new Date(),
        username: _credentials.email,
      });
    },
    [updateConnection]
  );

  const connectWithOAuth = useCallback(
    async (id: PlatformId) => {
      updateConnection(id, { status: 'syncing' });

      if (isDemoMode) {
        // Demo mode — simulate OAuth redirect + callback
        await new Promise((r) => setTimeout(r, 2000));
        updateConnection(id, { status: 'connected', lastSyncedAt: new Date(), username: 'DemoUser' });
        return;
      }

      try {
        if (id === 'strava') {
          // Real Strava OAuth — get auth URL from backend then redirect
          const resp = await authenticatedFetch(`${API_URLS.STRAVA}/strava/oauth/initiate`, {
            method: 'POST',
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.auth_url) {
              window.location.href = data.auth_url;
              return;
            }
          }
          throw new Error('Failed to initiate Strava OAuth');
        }

        // Other platforms — keep mock for now
        await new Promise((r) => setTimeout(r, 2000));
        updateConnection(id, { status: 'connected', lastSyncedAt: new Date(), username: 'Connected' });
      } catch (e) {
        updateConnection(id, { status: 'error', errorMessage: (e as Error).message });
      }
    },
    [updateConnection]
  );

  const disconnect = useCallback(
    (id: PlatformId) => {
      updateConnection(id, {
        status: 'disconnected',
        lastSyncedAt: undefined,
        username: undefined,
        errorMessage: undefined,
      });
    },
    [updateConnection]
  );

  const syncNow = useCallback(
    async (id: PlatformId) => {
      updateConnection(id, { status: 'syncing' });
      await new Promise((r) => setTimeout(r, 2000));
      // Simulate occasional errors (10% chance in demo)
      if (isDemoMode && Math.random() < 0.1) {
        updateConnection(id, {
          status: 'error',
          errorMessage: 'Sync failed: connection timed out. Please try again.',
        });
      } else {
        updateConnection(id, {
          status: 'connected',
          lastSyncedAt: new Date(),
          errorMessage: undefined,
        });
      }
    },
    [updateConnection]
  );

  const retry = useCallback(
    async (id: PlatformId) => {
      await syncNow(id);
    },
    [syncNow]
  );

  return {
    connections,
    getConnection,
    connectWithCredentials,
    connectWithOAuth,
    disconnect,
    syncNow,
    retry,
  };
}
