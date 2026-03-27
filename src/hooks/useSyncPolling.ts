/**
 * AMA-311: Auto-refresh sync status polling hook.
 *
 * Polls for sync status updates every 30 seconds when there are pending syncs.
 * Stops polling when all workouts are synced. Provides a manual refresh button.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SyncState } from '../types/unified-workout';

/** Default polling interval in milliseconds */
const DEFAULT_POLL_INTERVAL_MS = 30_000;

/** Sync states that should trigger continued polling */
const ACTIVE_SYNC_STATES: SyncState[] = ['pending', 'syncing'];

export interface SyncStatusItem {
  id: string;
  status: SyncState;
}

export interface UseSyncPollingOptions {
  /** Function to fetch current sync statuses */
  fetchStatuses: () => Promise<SyncStatusItem[]>;
  /** Polling interval in ms (default: 30000) */
  intervalMs?: number;
  /** Whether polling is enabled (default: true) */
  enabled?: boolean;
}

export interface UseSyncPollingResult {
  /** Current sync statuses */
  statuses: SyncStatusItem[];
  /** Whether a fetch is in progress */
  isPolling: boolean;
  /** Whether auto-polling is currently active (has pending items) */
  isAutoPolling: boolean;
  /** Last successful fetch timestamp */
  lastRefreshedAt: Date | null;
  /** Error from last fetch attempt */
  error: Error | null;
  /** Manually trigger a refresh */
  refresh: () => Promise<void>;
}

/**
 * Hook that polls for sync status updates.
 *
 * - Polls every `intervalMs` when there are pending/syncing items
 * - Stops polling when all items are synced, failed, or not_assigned
 * - Provides manual refresh capability
 */
export function useSyncPolling({
  fetchStatuses,
  intervalMs = DEFAULT_POLL_INTERVAL_MS,
  enabled = true,
}: UseSyncPollingOptions): UseSyncPollingResult {
  const [statuses, setStatuses] = useState<SyncStatusItem[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const fetchRef = useRef(fetchStatuses);
  fetchRef.current = fetchStatuses;

  const hasPendingSyncs = statuses.some((s) =>
    ACTIVE_SYNC_STATES.includes(s.status),
  );

  const doFetch = useCallback(async () => {
    setIsPolling(true);
    setError(null);
    try {
      const result = await fetchRef.current();
      setStatuses(result);
      setLastRefreshedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsPolling(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      doFetch();
    }
  }, [enabled, doFetch]);

  // Auto-poll when there are pending syncs
  useEffect(() => {
    if (!enabled || !hasPendingSyncs) return;

    const timer = setInterval(() => {
      doFetch();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [enabled, hasPendingSyncs, intervalMs, doFetch]);

  const refresh = useCallback(async () => {
    await doFetch();
  }, [doFetch]);

  return {
    statuses,
    isPolling,
    isAutoPolling: hasPendingSyncs && enabled,
    lastRefreshedAt,
    error,
    refresh,
  };
}
