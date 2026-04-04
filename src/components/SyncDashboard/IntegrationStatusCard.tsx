/**
 * IntegrationStatusCard -- compact card for a single integration (AMA-1434).
 *
 * Shown in a 3-up row. Clicking expands to reveal the error message.
 */

import React, { useState } from 'react';
import { Footprints, Watch, Bike, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
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
  syncing: 'Syncing...',
  error: 'Error',
};

const HEALTH_TEXT: Record<IntegrationHealth, string> = {
  ok: 'text-green-600 dark:text-green-400',
  syncing: 'text-yellow-600 dark:text-yellow-400',
  error: 'text-red-600 dark:text-red-400',
};

export interface IntegrationStatusCardProps {
  integration: IntegrationStatus;
}

export function IntegrationStatusCard({ integration }: IntegrationStatusCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { name, icon, health, lastSyncedAt, sessionsThisWeek, errorMessage } = integration;
  const Icon = ICON_MAP[icon] || Footprints;
  const hasDetail = health === 'error' && !!errorMessage;

  return (
    <Card
      data-testid={`integration-card-${integration.platformId}`}
      className={`cursor-pointer transition-shadow hover:shadow-md ${hasDetail ? '' : ''}`}
      onClick={() => hasDetail && setExpanded((v) => !v)}
    >
      <CardContent className="px-4 py-3">
        {/* Top row: icon + name + expand toggle */}
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium truncate flex-1">{name}</span>
          {health === 'syncing' && <Loader2 className="w-3 h-3 animate-spin text-yellow-500 flex-shrink-0" />}
          {hasDetail && (
            expanded
              ? <ChevronUp className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              : <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          )}
        </div>

        {/* Status dot + label */}
        <div className="flex items-center gap-1.5 mt-2">
          <span
            data-testid={`health-dot-${integration.platformId}`}
            className={`w-2 h-2 rounded-full flex-shrink-0 ${HEALTH_DOT[health]}`}
            aria-label={HEALTH_LABEL[health]}
          />
          <span className={`text-xs font-medium ${HEALTH_TEXT[health]}`}>
            {HEALTH_LABEL[health]}
          </span>
        </div>

        {/* Session count */}
        <p
          data-testid={`sessions-${integration.platformId}`}
          className="mt-1.5 text-xs text-muted-foreground"
        >
          {sessionsThisWeek} session{sessionsThisWeek !== 1 ? 's' : ''} this week
        </p>

        {/* Last sync */}
        {lastSyncedAt && (
          <p
            data-testid={`last-sync-${integration.platformId}`}
            className="text-xs text-muted-foreground"
          >
            Last sync: {formatTimeAgo(lastSyncedAt)}
          </p>
        )}

        {/* Expanded error detail */}
        {expanded && errorMessage && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400 leading-snug border-t pt-2">
            {errorMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
