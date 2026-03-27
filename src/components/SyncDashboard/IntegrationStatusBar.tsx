/**
 * IntegrationStatusBar -- compact status row per connected platform (AMA-1127).
 *
 * Shows icon, name, health dot, session count, and last sync time.
 */

import { Footprints, Watch, Bike, Loader2 } from 'lucide-react';
import type { IntegrationStatus, IntegrationHealth } from './types';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Footprints,
  Watch,
  Bike,
};

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const HEALTH_DOT: Record<IntegrationHealth, string> = {
  ok: 'bg-green-500',
  syncing: 'bg-yellow-500 animate-pulse',
  error: 'bg-red-500',
};

const HEALTH_LABEL: Record<IntegrationHealth, string> = {
  ok: 'Connected',
  syncing: 'Syncing',
  error: 'Error',
};

export interface IntegrationStatusBarProps {
  integration: IntegrationStatus;
}

export function IntegrationStatusBar({ integration }: IntegrationStatusBarProps) {
  const { name, icon, health, lastSyncedAt, sessionsThisWeek, errorMessage } = integration;
  const Icon = ICON_MAP[icon] || Footprints;

  return (
    <div
      data-testid={`integration-status-${integration.platformId}`}
      className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* Name + health dot */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm font-medium truncate">{name}</span>
        <span
          data-testid={`health-dot-${integration.platformId}`}
          className={`w-2 h-2 rounded-full flex-shrink-0 ${HEALTH_DOT[health]}`}
          aria-label={HEALTH_LABEL[health]}
        />
        {health === 'syncing' && (
          <Loader2 className="w-3 h-3 animate-spin text-yellow-600" />
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Session count */}
      <span data-testid={`sessions-${integration.platformId}`} className="text-xs text-muted-foreground whitespace-nowrap">
        {sessionsThisWeek} session{sessionsThisWeek !== 1 ? 's' : ''} this week
      </span>

      {/* Last sync */}
      {lastSyncedAt && (
        <span data-testid={`last-sync-${integration.platformId}`} className="text-xs text-muted-foreground whitespace-nowrap">
          {formatTimeAgo(lastSyncedAt)}
        </span>
      )}

      {/* Error message */}
      {health === 'error' && errorMessage && (
        <span className="text-xs text-red-500 truncate max-w-[200px]" title={errorMessage}>
          {errorMessage}
        </span>
      )}
    </div>
  );
}
