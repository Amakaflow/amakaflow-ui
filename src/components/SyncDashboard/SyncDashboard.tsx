/**
 * SyncDashboard -- unified dashboard combining integration health,
 * activity feed, and pending decisions (AMA-1127).
 *
 * Redesigned in AMA-1434: actions-first layout with compact integration row,
 * tabbed activity feed, and a stats summary header bar.
 */

import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  KeyRound,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { ActivityFeed } from '../ActivityFeed';
import { IntegrationStatusCard } from './IntegrationStatusCard';
import { PendingDecisionCard } from './PendingDecisionCard';
import { useSyncDashboard } from './hooks/useSyncDashboard';
import type { PendingDecision } from './types';

export interface SyncDashboardProps {
  className?: string;
}

// Map decision type to border accent colour
const DECISION_BORDER: Record<PendingDecision['type'], string> = {
  conflict: 'border-l-amber-500',
  suggestion: 'border-l-blue-500',
  confirmation: 'border-l-purple-500',
};

// OAuth error pattern: decisions that look like re-auth notices
function isReauthDecision(d: PendingDecision): boolean {
  return (
    d.description.toLowerCase().includes('token') ||
    d.description.toLowerCase().includes('oauth') ||
    d.description.toLowerCase().includes('re-auth') ||
    d.description.toLowerCase().includes('expire')
  );
}

/** Tabs for the activity feed section */
type FeedTab = 'all' | 'garmin' | 'strava' | 'scheduler';

const FEED_TABS: { id: FeedTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'garmin', label: 'Garmin' },
  { id: 'strava', label: 'Strava' },
  { id: 'scheduler', label: 'Scheduler' },
];

export function SyncDashboard({ className }: SyncDashboardProps) {
  const {
    integrations,
    pendingDecisions,
    resolveDecision,
  } = useSyncDashboard();

  const [activeTab, setActiveTab] = useState<FeedTab>('all');

  const errorCount = integrations.filter((i) => i.health === 'error').length;
  const syncingCount = integrations.filter((i) => i.health === 'syncing').length;
  const totalSessions = integrations.reduce((sum, i) => sum + i.sessionsThisWeek, 0);

  // Find the most recent lastSyncedAt across all integrations
  const lastSyncedAt = integrations
    .map((i) => i.lastSyncedAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  function formatLastSync(date: Date | null): string {
    if (!date) return 'Never';
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  // Derive agent filter from tab
  const agentFilter: string | undefined =
    activeTab === 'garmin'
      ? 'garmin_pusher'
      : activeTab === 'strava'
      ? 'strava_enricher'
      : activeTab === 'scheduler'
      ? 'scheduler'
      : undefined;

  return (
    <div data-testid="sync-dashboard" className={className}>
      {/* ------------------------------------------------------------------ */}
      {/* Stats header bar                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div
        data-testid="dashboard-stats-bar"
        className="flex flex-wrap items-center gap-3 mb-6 px-4 py-2.5 rounded-xl bg-muted/40 border text-sm text-muted-foreground"
      >
        <span className="font-medium text-foreground">Sync Dashboard</span>
        <span className="hidden sm:block text-muted-foreground/40">|</span>
        <span className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5" />
          {totalSessions} sessions this week
        </span>
        {errorCount > 0 && (
          <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
            <AlertCircle className="w-3.5 h-3.5" />
            {errorCount} error{errorCount > 1 ? 's' : ''}
          </span>
        )}
        {syncingCount > 0 && (
          <span className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            {syncingCount} syncing
          </span>
        )}
        <span className="ml-auto text-xs">
          Last sync: {formatLastSync(lastSyncedAt)}
        </span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Section 1: Action Required (TOP — prominent)                        */}
      {/* ------------------------------------------------------------------ */}
      <section data-testid="pending-decisions-section" className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-base font-semibold">Action Required</h2>
          {pendingDecisions.length > 0 && (
            <Badge
              variant="secondary"
              className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-xs"
            >
              {pendingDecisions.length}
            </Badge>
          )}
        </div>

        {pendingDecisions.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-4 px-4">
              <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  All clear — no actions needed
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your AI agents are handling everything automatically.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pendingDecisions.map((decision) => {
              const isReauth = isReauthDecision(decision);
              const accentBorder = DECISION_BORDER[decision.type];
              return (
                <div
                  key={decision.id}
                  className={`border-l-4 rounded-xl overflow-hidden ${accentBorder}`}
                >
                  {/* Re-auth notice banner (if applicable) */}
                  {isReauth && (
                    <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2">
                      <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        Re-authorization required
                      </span>
                    </div>
                  )}
                  {/* Error-type notice banner */}
                  {!isReauth && decision.type === 'conflict' && (
                    <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        Conflict detected
                      </span>
                    </div>
                  )}
                  <PendingDecisionCard
                    decision={decision}
                    onResolve={resolveDecision}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 2: Integration Status (compact 3-up row)                   */}
      {/* ------------------------------------------------------------------ */}
      <section data-testid="integration-status-section" className="mb-8">
        <h2 className="text-base font-semibold mb-3">Integration Status</h2>
        {integrations.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No integrations connected. Go to Settings to connect your platforms.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {integrations.map((integration) => (
              <IntegrationStatusCard key={integration.platformId} integration={integration} />
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Section 3: Recent Activity (grouped with tabs)                      */}
      {/* ------------------------------------------------------------------ */}
      <section data-testid="activity-feed-section">
        <h2 className="text-base font-semibold mb-3">Recent Activity</h2>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as FeedTab)}
        >
          <div className="overflow-x-auto -mx-1 px-1 mb-4">
            <TabsList className="w-max min-w-full">
              {FEED_TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="text-xs sm:text-sm min-h-[44px] sm:min-h-0">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {FEED_TABS.map((tab) => (
            <TabsContent key={tab.id} value={tab.id}>
              <ActivityFeed
                agent={tab.id === 'all' ? undefined : agentFilter}
                limit={10}
              />
            </TabsContent>
          ))}
        </Tabs>
      </section>
    </div>
  );
}
