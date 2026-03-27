/**
 * Tests for SyncDashboard (AMA-1127).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SyncDashboard } from '../SyncDashboard';

// Mock demo mode
vi.mock('../../../lib/demo-mode', () => ({
  isDemoMode: true,
}));

// Mock authenticated-fetch (used by useActivityFeed)
vi.mock('../../../lib/authenticated-fetch', () => ({
  authenticatedFetch: vi.fn(),
}));

describe('SyncDashboard', () => {
  it('renders the dashboard with all three sections', async () => {
    render(<SyncDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('sync-dashboard')).toBeTruthy();
    });

    // All three sections should be present
    expect(screen.getByTestId('integration-status-section')).toBeTruthy();
    expect(screen.getByTestId('activity-feed-section')).toBeTruthy();
    expect(screen.getByTestId('pending-decisions-section')).toBeTruthy();
  });

  it('renders integration status bars for connected platforms', async () => {
    render(<SyncDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('sync-dashboard')).toBeTruthy();
    });

    // Mock data has 3 integrations
    expect(screen.getByTestId('integration-status-stryd')).toBeTruthy();
    expect(screen.getByTestId('integration-status-garmin')).toBeTruthy();
    expect(screen.getByTestId('integration-status-strava')).toBeTruthy();
  });

  it('renders summary badges with session count', async () => {
    render(<SyncDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-summary')).toBeTruthy();
    });

    // Total sessions: 5 + 12 + 3 = 20
    expect(screen.getByText('20 sessions this week')).toBeTruthy();
  });

  it('renders pending decision cards', async () => {
    render(<SyncDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('sync-dashboard')).toBeTruthy();
    });

    // Mock data has 3 decisions
    expect(screen.getByTestId('decision-card-dec-001')).toBeTruthy();
    expect(screen.getByTestId('decision-card-dec-002')).toBeTruthy();
    expect(screen.getByTestId('decision-card-dec-003')).toBeTruthy();
  });

  it('shows the activity feed section with actions', async () => {
    render(<SyncDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('activity-feed-section')).toBeTruthy();
    });

    // Activity feed reuses the ActivityFeed component which shows mock actions
    await waitFor(() => {
      expect(screen.getByTestId('activity-feed')).toBeTruthy();
    });
  });
});
