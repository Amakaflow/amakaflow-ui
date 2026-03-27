/**
 * Standalone demo page for ActivityFeed screenshots (AMA-1124).
 * Used by Playwright screenshot script.
 */

import React from 'react';
import { ActivityFeed } from './ActivityFeed';

export function ActivityFeedDemo() {
  return (
    <div className="mx-auto max-w-2xl p-6" data-testid="activity-feed-demo">
      <h1 className="mb-1 text-2xl font-bold text-foreground">Agent Activity</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Actions proposed and taken by your AI agents. Review, approve, or undo.
      </p>
      <ActivityFeed />
    </div>
  );
}
