/**
 * AMA-305: Sync Status Badge for workout cards.
 *
 * Shows the current sync state of a workout:
 * - Green check = synced
 * - Yellow spinner = pending/syncing
 * - Red X = failed with retry button
 */

import React from 'react';
import { CheckCircle2, Loader2, XCircle, RefreshCw } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import type { SyncState } from '../types/unified-workout';

export interface SyncStatusBadgeProps {
  /** Current sync state */
  status: SyncState;
  /** Called when user clicks retry on a failed sync */
  onRetry?: () => void;
  /** Optional CSS class */
  className?: string;
}

const STATUS_CONFIG: Record<SyncState, {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  colorClass: string;
}> = {
  not_assigned: {
    label: 'Not synced',
    variant: 'outline',
    colorClass: 'text-muted-foreground',
  },
  pending: {
    label: 'Pending',
    variant: 'secondary',
    colorClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  },
  syncing: {
    label: 'Syncing',
    variant: 'secondary',
    colorClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  },
  synced: {
    label: 'Synced',
    variant: 'secondary',
    colorClass: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  failed: {
    label: 'Failed',
    variant: 'destructive',
    colorClass: '',
  },
  outdated: {
    label: 'Outdated',
    variant: 'secondary',
    colorClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  },
};

function StatusIcon({ status }: { status: SyncState }) {
  switch (status) {
    case 'synced':
      return <CheckCircle2 data-testid="icon-check" className="w-3 h-3" />;
    case 'pending':
    case 'syncing':
      return <Loader2 data-testid="icon-spinner" className="w-3 h-3 animate-spin" />;
    case 'failed':
      return <XCircle data-testid="icon-x" className="w-3 h-3" />;
    default:
      return null;
  }
}

export function SyncStatusBadge({ status, onRetry, className }: SyncStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span data-testid="sync-status-badge" className={cn('inline-flex items-center gap-1', className)}>
      <Badge
        variant={config.variant}
        className={cn('gap-1', config.colorClass)}
      >
        <StatusIcon status={status} />
        {config.label}
      </Badge>
      {status === 'failed' && onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="h-6 w-6 p-0"
          data-testid="sync-retry-button"
          aria-label="Retry sync"
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      )}
    </span>
  );
}
