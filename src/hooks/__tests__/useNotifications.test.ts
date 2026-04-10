import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mocks/server';
import { useNotifications } from '../useNotifications';

const CALENDAR_API = 'http://localhost:8003';

describe('useNotifications', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('detects browser support', () => {
    const { result } = renderHook(() => useNotifications());
    // jsdom has Notification but not serviceWorker
    expect(typeof result.current.isSupported).toBe('boolean');
  });

  it('fetches preferences on mount', async () => {
    const mockPrefs = {
      user_id: 'user-1',
      workout_reminders: true,
      sync_alerts: true,
      conflict_warnings: false,
      readiness_alerts: false,
      weekly_summary: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00',
    };

    server.use(
      http.get(`${CALENDAR_API}/notifications/preferences`, () =>
        HttpResponse.json(mockPrefs),
      ),
    );

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.preferences).toEqual(mockPrefs);
  });

  it('handles preferences fetch failure gracefully', async () => {
    server.use(
      http.get(`${CALENDAR_API}/notifications/preferences`, () =>
        HttpResponse.error(),
      ),
    );

    const { result } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should not crash — preferences remain null
    expect(result.current.preferences).toBeNull();
  });

  it('returns unsupported permission when Notification API missing', () => {
    const origNotification = globalThis.Notification;
    // @ts-ignore
    delete globalThis.Notification;

    const { result } = renderHook(() => useNotifications());
    expect(result.current.isSupported).toBe(false);

    // Restore
    globalThis.Notification = origNotification;
  });
});
