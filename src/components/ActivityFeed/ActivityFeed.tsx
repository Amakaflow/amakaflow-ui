/**
 * ActivityFeed -- list of recent agent actions with status and controls (AMA-1124).
 *
 * Renders ActionCards in reverse chronological order. Supports filtering by
 * status and agent, and shows loading/empty states.
 */

import React from 'react';
import { useActivityFeed } from './hooks/useActivityFeed';
import { ActionCard } from './ActionCard';
import type { ActionStatus } from './types';

export interface ActivityFeedProps {
  /** Filter actions by status */
  status?: ActionStatus;
  /** Filter actions by agent name */
  agent?: string;
  /** Maximum number of actions to show */
  limit?: number;
  /** Optional CSS class */
  className?: string;
}

export function ActivityFeed({ status, agent, limit, className }: ActivityFeedProps) {
  const { actions, loading, error, approve, reject, undo } = useActivityFeed({
    status,
    agent,
    limit,
  });

  if (loading) {
    return (
      <div data-testid="activity-feed-loading" className={className}>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="activity-feed-error" className={className}>
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Failed to load activity feed: {error}
        </div>
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div data-testid="activity-feed-empty" className={className}>
        <div className="rounded-xl border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          No agent actions yet. Actions will appear here as your AI agents work.
        </div>
      </div>
    );
  }

  return (
    <div data-testid="activity-feed" className={className}>
      <div className="space-y-2">
        {actions.map((action) => (
          <ActionCard
            key={action.id}
            action={action}
            onApprove={approve}
            onReject={reject}
            onUndo={undo}
          />
        ))}
      </div>
    </div>
  );
}
