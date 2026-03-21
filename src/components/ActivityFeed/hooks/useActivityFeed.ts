/**
 * Hook for fetching and managing PendingActions (AMA-1124).
 *
 * In demo mode, returns mock data. In production, calls the
 * calendar-api /actions endpoints.
 */

import { useCallback, useEffect, useState } from 'react';
import { isDemoMode } from '../../../lib/demo-mode';
import { authenticatedFetch } from '../../../lib/authenticated-fetch';
import { API_URLS } from '../../../lib/config';
import { MOCK_ACTIONS } from '../mock-data';
import type { PendingAction, ActionStatus } from '../types';

const CALENDAR_API = API_URLS.CALENDAR;

interface UseActivityFeedOptions {
  status?: ActionStatus;
  agent?: string;
  limit?: number;
}

interface UseActivityFeedResult {
  actions: PendingAction[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  approve: (id: string) => Promise<void>;
  reject: (id: string) => Promise<void>;
  undo: (id: string) => Promise<void>;
}

export function useActivityFeed(options: UseActivityFeedOptions = {}): UseActivityFeedResult {
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActions = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (isDemoMode) {
      // Filter mock data based on options
      let filtered = [...MOCK_ACTIONS];
      if (options.status) {
        filtered = filtered.filter((a) => a.status === options.status);
      }
      if (options.agent) {
        filtered = filtered.filter((a) => a.agent === options.agent);
      }
      if (options.limit) {
        filtered = filtered.slice(0, options.limit);
      }
      setActions(filtered);
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams();
      if (options.status) params.set('status', options.status);
      if (options.agent) params.set('agent', options.agent);
      if (options.limit) params.set('limit', String(options.limit));

      const qs = params.toString();
      const url = `${CALENDAR_API}/actions${qs ? `?${qs}` : ''}`;
      const resp = await authenticatedFetch(url);

      if (!resp.ok) {
        throw new Error(`Failed to fetch actions: ${resp.status}`);
      }

      const data: PendingAction[] = await resp.json();
      setActions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [options.status, options.agent, options.limit]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const mutateAction = useCallback(
    async (id: string, verb: 'approve' | 'reject' | 'undo') => {
      if (isDemoMode) {
        // Optimistic update for demo
        setActions((prev) =>
          prev.map((a) => {
            if (a.id !== id) return a;
            const now = new Date().toISOString();
            switch (verb) {
              case 'approve':
                return { ...a, status: 'approved' as const, applied_at: now };
              case 'reject':
                return { ...a, status: 'rejected' as const };
              case 'undo':
                return { ...a, status: 'undone' as const, undone_at: now };
              default:
                return a;
            }
          }),
        );
        return;
      }

      const resp = await authenticatedFetch(`${CALENDAR_API}/actions/${id}/${verb}`, {
        method: 'POST',
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || `Failed to ${verb} action`);
      }

      // Refresh after mutation
      await fetchActions();
    },
    [fetchActions],
  );

  return {
    actions,
    loading,
    error,
    refresh: fetchActions,
    approve: (id: string) => mutateAction(id, 'approve'),
    reject: (id: string) => mutateAction(id, 'reject'),
    undo: (id: string) => mutateAction(id, 'undo'),
  };
}
