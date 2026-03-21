/**
 * Tests for ActivityFeed component (AMA-1124).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ActivityFeed } from '../ActivityFeed';
import { MOCK_ACTIONS } from '../mock-data';

// Mock demo mode to true so we get mock data
vi.mock('../../../lib/demo-mode', () => ({
  isDemoMode: true,
}));

describe('ActivityFeed', () => {
  it('renders loading state initially then shows actions', async () => {
    render(<ActivityFeed />);
    // After loading, should show actions
    await waitFor(() => {
      expect(screen.getByTestId('activity-feed')).toBeTruthy();
    });
  });

  it('renders all mock actions in demo mode', async () => {
    render(<ActivityFeed />);
    await waitFor(() => {
      expect(screen.getByTestId('activity-feed')).toBeTruthy();
    });
    // Should render one card per mock action
    const cards = screen.getAllByTestId(/^action-card-/);
    expect(cards.length).toBe(MOCK_ACTIONS.length);
  });

  it('shows pending actions with approve/reject buttons', async () => {
    render(<ActivityFeed />);
    await waitFor(() => {
      expect(screen.getByTestId('activity-feed')).toBeTruthy();
    });
    // The mock data has one pending action (act-002)
    expect(screen.getByTestId('action-card-act-002')).toBeTruthy();
    expect(screen.getByTestId('approve-btn')).toBeTruthy();
    expect(screen.getByTestId('reject-btn')).toBeTruthy();
  });

  it('shows status icons for different statuses', async () => {
    render(<ActivityFeed />);
    await waitFor(() => {
      expect(screen.getByTestId('activity-feed')).toBeTruthy();
    });
    // Approved actions
    expect(screen.getAllByTestId('status-icon-approved').length).toBeGreaterThan(0);
    // Pending actions
    expect(screen.getAllByTestId('status-icon-pending').length).toBe(1);
    // Rejected actions
    expect(screen.getAllByTestId('status-icon-rejected').length).toBe(1);
    // Undone actions
    expect(screen.getAllByTestId('status-icon-undone').length).toBe(1);
  });
});
