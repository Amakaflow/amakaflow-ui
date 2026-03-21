/**
 * ActionCard -- individual action in the activity feed (AMA-1124).
 *
 * Shows status icon, agent badge, rationale, and action buttons
 * (approve/reject for pending, undo for recently applied).
 */

import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import type { PendingAction } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AGENT_LABELS: Record<string, string> = {
  scheduler: 'Scheduler',
  stryd_sync: 'Stryd',
  strava_enricher: 'Strava',
  garmin_pusher: 'Garmin',
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  push_to_garmin: 'Push to Garmin',
  update_strava: 'Update Strava',
  reschedule_session: 'Reschedule',
  enrich_title: 'Enrich Title',
  add_hr_zone: 'Add HR Zone',
  delete_session: 'Delete Session',
  restructure_week: 'Restructure Week',
  first_push_new_device: 'First Push',
};

function isUndoable(action: PendingAction): boolean {
  if (!action.reversible || action.status !== 'approved' || !action.applied_at) {
    return false;
  }
  const appliedAt = new Date(action.applied_at).getTime();
  const now = Date.now();
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  return now - appliedAt < twentyFourHoursMs;
}

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Status rendering
// ---------------------------------------------------------------------------

interface StatusIndicatorProps {
  status: PendingAction['status'];
}

function StatusIndicator({ status }: StatusIndicatorProps) {
  switch (status) {
    case 'approved':
    case 'applied':
      return (
        <span
          data-testid="status-icon-approved"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          aria-label="Applied"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 7.5L5.5 10L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      );
    case 'pending':
      return (
        <span
          data-testid="status-icon-pending"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
          aria-label="Pending approval"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 3V7.5M7 10V10.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      );
    case 'rejected':
      return (
        <span
          data-testid="status-icon-rejected"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          aria-label="Rejected"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      );
    case 'undone':
      return (
        <span
          data-testid="status-icon-undone"
          className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
          aria-label="Undone"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M3 7H8M3 7L5 5M3 7L5 9M11 4V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ActionCardProps {
  action: PendingAction;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onUndo?: (id: string) => void;
}

export function ActionCard({ action, onApprove, onReject, onUndo }: ActionCardProps) {
  const canUndo = isUndoable(action);

  return (
    <Card data-testid={`action-card-${action.id}`} className="gap-0 py-0">
      <CardContent className="flex gap-3 px-4 py-3">
        {/* Status icon */}
        <div className="mt-0.5 flex-shrink-0">
          <StatusIndicator status={action.status} />
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          {/* Header row: action type + agent badge + time */}
          <div className="flex items-center gap-2 flex-wrap">
            <span data-testid="action-type" className="text-sm font-medium text-foreground">
              {ACTION_TYPE_LABELS[action.action_type] || action.action_type}
            </span>
            <Badge data-testid="agent-badge" variant="secondary" className="text-xs">
              {AGENT_LABELS[action.agent] || action.agent}
            </Badge>
            <span data-testid="action-time" className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
              {formatTimeAgo(action.created_at)}
            </span>
          </div>

          {/* Rationale */}
          <p data-testid="action-rationale" className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {action.rationale}
          </p>

          {/* Action buttons */}
          {action.status === 'pending' && (
            <div data-testid="pending-actions" className="mt-2 flex gap-2">
              <Button
                data-testid="approve-btn"
                size="sm"
                variant="default"
                onClick={() => onApprove?.(action.id)}
              >
                Approve
              </Button>
              <Button
                data-testid="reject-btn"
                size="sm"
                variant="outline"
                onClick={() => onReject?.(action.id)}
              >
                Reject
              </Button>
            </div>
          )}

          {canUndo && (
            <div className="mt-2">
              <Button
                data-testid="undo-btn"
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onUndo?.(action.id)}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mr-1" aria-hidden="true">
                  <path d="M3 7H8M3 7L5 5M3 7L5 9M11 4V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Undo
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
