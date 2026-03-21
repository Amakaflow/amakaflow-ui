/**
 * SyncDashboard -- unified dashboard combining integration health,
 * activity feed, and pending decisions (AMA-1127).
 *
 * This is the second main screen of AmakaFlow, accessible from the
 * nav bar as "Dashboard".
 */

import { Activity, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { ActivityFeed } from '../ActivityFeed';
import { IntegrationStatusBar } from './IntegrationStatusBar';
import { PendingDecisionCard } from './PendingDecisionCard';
import { useSyncDashboard } from './hooks/useSyncDashboard';

export interface SyncDashboardProps {
  className?: string;
}

export function SyncDashboard({ className }: SyncDashboardProps) {
  const {
    integrations,
    pendingDecisions,
    resolveDecision,
  } = useSyncDashboard();

  const errorCount = integrations.filter((i) => i.health === 'error').length;
  const syncingCount = integrations.filter((i) => i.health === 'syncing').length;
  const totalSessions = integrations.reduce((sum, i) => sum + i.sessionsThisWeek, 0);

  return (
    <div data-testid="sync-dashboard" className={className}>
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Sync Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor your integrations, recent activity, and resolve pending decisions.
        </p>
      </div>

      {/* Summary badges */}
      <div data-testid="dashboard-summary" className="flex flex-wrap gap-2 mb-6">
        <Badge variant="secondary" className="gap-1">
          <Activity className="w-3 h-3" />
          {totalSessions} sessions this week
        </Badge>
        {syncingCount > 0 && (
          <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300">
            <RefreshCw className="w-3 h-3 animate-spin" />
            {syncingCount} syncing
          </Badge>
        )}
        {errorCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="w-3 h-3" />
            {errorCount} error{errorCount > 1 ? 's' : ''}
          </Badge>
        )}
        {pendingDecisions.length > 0 && (
          <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            {pendingDecisions.length} pending decision{pendingDecisions.length > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Section 1: Integration Status */}
      <section data-testid="integration-status-section" className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Integration Status</h2>
        {integrations.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No integrations connected. Go to Settings to connect your platforms.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {integrations.map((integration) => (
              <IntegrationStatusBar key={integration.platformId} integration={integration} />
            ))}
          </div>
        )}
      </section>

      {/* Section 2: Activity Feed */}
      <section data-testid="activity-feed-section" className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
        <ActivityFeed limit={8} />
      </section>

      {/* Section 3: Pending Decisions */}
      <section data-testid="pending-decisions-section">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-lg font-semibold">Pending Decisions</h2>
          {pendingDecisions.length > 0 && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
              {pendingDecisions.length}
            </Badge>
          )}
        </div>
        {pendingDecisions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No pending decisions. Your AI agents are handling everything automatically.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingDecisions.map((decision) => (
              <PendingDecisionCard
                key={decision.id}
                decision={decision}
                onResolve={resolveDecision}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
