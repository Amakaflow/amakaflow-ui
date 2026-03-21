/**
 * Web Push subscription management hook.
 *
 * AMA-1132: Handles browser permission requests, push subscription
 * lifecycle, and notification preference API calls.
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_CALENDAR_API_URL || 'http://localhost:8003';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationPreferences {
  user_id: string;
  workout_reminders: boolean;
  sync_alerts: boolean;
  conflict_warnings: boolean;
  readiness_alerts: boolean;
  weekly_summary: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
}

export interface UseNotificationsResult {
  /** Current browser permission state */
  permission: NotificationPermission | 'unsupported';
  /** Whether the browser supports Web Push */
  isSupported: boolean;
  /** Request browser notification permission */
  requestPermission: () => Promise<NotificationPermission>;
  /** Subscribe this browser for push notifications */
  subscribe: () => Promise<void>;
  /** Unsubscribe this browser */
  unsubscribe: () => Promise<void>;
  /** Notification preferences from the API */
  preferences: NotificationPreferences | null;
  /** Whether preferences are loading */
  isLoading: boolean;
  /** Fetch latest preferences */
  fetchPreferences: () => Promise<void>;
  /** Update one or more preferences */
  updatePreferences: (updates: Partial<Omit<NotificationPreferences, 'user_id'>>) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helper: get auth headers
// ---------------------------------------------------------------------------

function getAuthHeaders(): Record<string, string> {
  // In production this would come from Clerk; for now support API key
  const token = localStorage.getItem('auth_token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNotifications(): UseNotificationsResult {
  const isSupported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;

  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    isSupported ? Notification.permission : 'unsupported',
  );
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch preferences on mount
  const fetchPreferences = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await fetch(`${API_BASE}/notifications/preferences`, {
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      });
      if (resp.ok) {
        setPreferences(await resp.json());
      }
    } catch {
      // Silently fail — preferences will show defaults in UI
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!isSupported) return 'denied';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, [isSupported]);

  const subscribe = useCallback(async () => {
    if (!isSupported) return;

    const perm = await requestPermission();
    if (perm !== 'granted') return;

    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
    });

    const subJson = sub.toJSON();
    await fetch(`${API_BASE}/notifications/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: subJson.keys || {},
      }),
    });
  }, [isSupported, requestPermission]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;

    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (!sub) return;

    const subJson = sub.toJSON();
    await sub.unsubscribe();

    await fetch(`${API_BASE}/notifications/subscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ endpoint: subJson.endpoint }),
    });
  }, [isSupported]);

  const updatePreferences = useCallback(
    async (updates: Partial<Omit<NotificationPreferences, 'user_id'>>) => {
      try {
        const resp = await fetch(`${API_BASE}/notifications/preferences`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(updates),
        });
        if (resp.ok) {
          setPreferences(await resp.json());
        }
      } catch {
        // caller can handle error via preferences state
      }
    },
    [],
  );

  return {
    permission,
    isSupported,
    requestPermission,
    subscribe,
    unsubscribe,
    preferences,
    isLoading,
    fetchPreferences,
    updatePreferences,
  };
}
