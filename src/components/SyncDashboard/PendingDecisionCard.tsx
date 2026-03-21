/**
 * PendingDecisionCard -- conflict/action needing user input (AMA-1127).
 *
 * Shows warning icon, description, rationale, and one-tap resolve buttons.
 */

import { AlertTriangle, GitMerge, HelpCircle } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import type { PendingDecision } from './types';

const TYPE_ICON: Record<PendingDecision['type'], React.ComponentType<{ className?: string }>> = {
  conflict: AlertTriangle,
  suggestion: GitMerge,
  confirmation: HelpCircle,
};

const TYPE_COLOR: Record<PendingDecision['type'], string> = {
  conflict: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400',
  suggestion: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
  confirmation: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400',
};

const AGENT_LABELS: Record<string, string> = {
  scheduler: 'Scheduler',
  stryd_sync: 'Stryd',
  strava_enricher: 'Strava',
  garmin_pusher: 'Garmin',
};

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

export interface PendingDecisionCardProps {
  decision: PendingDecision;
  onResolve: (decisionId: string, actionValue: string) => void;
}

export function PendingDecisionCard({ decision, onResolve }: PendingDecisionCardProps) {
  const Icon = TYPE_ICON[decision.type];
  const iconColorClass = TYPE_COLOR[decision.type];

  return (
    <Card data-testid={`decision-card-${decision.id}`} className="gap-0 py-0">
      <CardContent className="flex gap-3 px-4 py-4">
        {/* Type icon */}
        <div className="mt-0.5 flex-shrink-0">
          <span
            data-testid={`decision-icon-${decision.type}`}
            className={`flex h-8 w-8 items-center justify-center rounded-full ${iconColorClass}`}
          >
            <Icon className="w-4 h-4" />
          </span>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <span data-testid="decision-title" className="text-sm font-medium text-foreground">
              {decision.title}
            </span>
            <Badge data-testid="decision-agent" variant="secondary" className="text-xs">
              {AGENT_LABELS[decision.agent] || decision.agent}
            </Badge>
            <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
              {formatTimeAgo(decision.createdAt)}
            </span>
          </div>

          {/* Description */}
          <p data-testid="decision-description" className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {decision.description}
          </p>

          {/* Rationale */}
          <div data-testid="decision-rationale" className="mt-2 rounded-md bg-muted/50 px-3 py-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium">Rationale:</span> {decision.rationale}
            </p>
          </div>

          {/* Action buttons */}
          <div data-testid="decision-actions" className="mt-3 flex flex-wrap gap-2">
            {decision.actions.map((action) => (
              <Button
                key={action.id}
                data-testid={`decision-action-${action.id}`}
                size="sm"
                variant={action.variant}
                onClick={() => onResolve(decision.id, action.value)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
