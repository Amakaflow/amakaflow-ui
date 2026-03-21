/**
 * useSyncDashboard -- aggregates connections, activity feed, and pending decisions (AMA-1127).
 *
 * In demo mode returns mock data. Reuses useConnections for integration status
 * and useActivityFeed for the activity stream.
 */

import { useState, useCallback } from 'react';
import { useConnections } from '../../Connections/hooks/useConnections';
import { useActivityFeed } from '../../ActivityFeed/hooks/useActivityFeed';
import { isDemoMode } from '../../../lib/demo-mode';
import { MOCK_INTEGRATIONS, MOCK_PENDING_DECISIONS } from '../mock-data';
import type { IntegrationStatus, PendingDecision } from '../types';
import type { ConnectionStatus } from '../../Connections/types';

/** Map ConnectionStatus -> IntegrationHealth */
function toHealth(status: ConnectionStatus): IntegrationStatus['health'] {
  switch (status) {
    case 'connected':
      return 'ok';
    case 'syncing':
      return 'syncing';
    case 'error':
      return 'error';
    default:
      return 'ok';
  }
}

// Random but stable session counts for demo
const DEMO_SESSIONS: Record<string, number> = {
  stryd: 5,
  garmin: 12,
  strava: 3,
};

export function useSyncDashboard() {
  const { connections, syncNow, retry } = useConnections();
  const activityFeed = useActivityFeed({ limit: 8 });

  // Pending decisions state (mock for now)
  const [pendingDecisions, setPendingDecisions] = useState<PendingDecision[]>(
    isDemoMode ? MOCK_PENDING_DECISIONS : []
  );

  // Derive integration statuses from connections
  const integrations: IntegrationStatus[] = isDemoMode
    ? MOCK_INTEGRATIONS
    : connections
        .filter((c) => c.status !== 'disconnected')
        .map((c) => ({
          platformId: c.id,
          name: c.name,
          icon: c.icon,
          color: c.color,
          health: toHealth(c.status),
          lastSyncedAt: c.lastSyncedAt ?? null,
          sessionsThisWeek: DEMO_SESSIONS[c.id] ?? 0,
          errorMessage: c.errorMessage,
        }));

  const resolveDecision = useCallback((decisionId: string, _actionValue: string) => {
    setPendingDecisions((prev) => prev.filter((d) => d.id !== decisionId));
  }, []);

  return {
    integrations,
    activityFeed,
    pendingDecisions,
    resolveDecision,
    syncNow,
    retry,
  };
}
