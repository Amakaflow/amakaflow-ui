/**
 * Tests for IntegrationStatusBar (AMA-1127).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IntegrationStatusBar } from '../IntegrationStatusBar';
import type { IntegrationStatus } from '../types';

const okIntegration: IntegrationStatus = {
  platformId: 'stryd',
  name: 'Stryd',
  icon: 'Footprints',
  color: 'orange-500',
  health: 'ok',
  lastSyncedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  sessionsThisWeek: 5,
};

const errorIntegration: IntegrationStatus = {
  platformId: 'strava',
  name: 'Strava',
  icon: 'Bike',
  color: 'orange-600',
  health: 'error',
  lastSyncedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
  sessionsThisWeek: 3,
  errorMessage: 'OAuth token expired',
};

const syncingIntegration: IntegrationStatus = {
  platformId: 'garmin',
  name: 'Garmin Connect',
  icon: 'Watch',
  color: 'blue-600',
  health: 'syncing',
  lastSyncedAt: new Date(Date.now() - 30 * 60 * 1000),
  sessionsThisWeek: 12,
};

describe('IntegrationStatusBar', () => {
  it('renders platform name and session count', () => {
    render(<IntegrationStatusBar integration={okIntegration} />);

    expect(screen.getByText('Stryd')).toBeTruthy();
    expect(screen.getByTestId('sessions-stryd')).toHaveTextContent('5 sessions this week');
  });

  it('shows green health dot for ok status', () => {
    render(<IntegrationStatusBar integration={okIntegration} />);

    const dot = screen.getByTestId('health-dot-stryd');
    expect(dot.className).toContain('bg-green-500');
  });

  it('shows yellow pulsing dot for syncing status', () => {
    render(<IntegrationStatusBar integration={syncingIntegration} />);

    const dot = screen.getByTestId('health-dot-garmin');
    expect(dot.className).toContain('bg-yellow-500');
    expect(dot.className).toContain('animate-pulse');
  });

  it('shows red dot and error message for error status', () => {
    render(<IntegrationStatusBar integration={errorIntegration} />);

    const dot = screen.getByTestId('health-dot-strava');
    expect(dot.className).toContain('bg-red-500');
    expect(screen.getByText('OAuth token expired')).toBeTruthy();
  });

  it('shows last sync time', () => {
    render(<IntegrationStatusBar integration={okIntegration} />);

    expect(screen.getByTestId('last-sync-stryd')).toHaveTextContent('2h ago');
  });
});
