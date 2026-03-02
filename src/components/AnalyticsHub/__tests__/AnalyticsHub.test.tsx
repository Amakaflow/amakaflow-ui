import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnalyticsHub } from '../index';
import type { AppUser } from '../../../app/useAppAuth';

vi.mock('../../VolumeAnalytics', () => ({
  VolumeAnalytics: () => <div data-testid="volume-analytics">VolumeAnalytics</div>,
}));
vi.mock('../../ExerciseHistory', () => ({
  ExerciseHistory: () => <div data-testid="exercise-history">ExerciseHistory</div>,
}));
vi.mock('../OverviewTab', () => ({
  OverviewTab: () => <div data-testid="overview-tab">OverviewTab</div>,
}));

const mockUser: AppUser = {
  id: 'u1',
  name: 'Test User',
  email: 'test@test.com',
  subscription: 'free',
  workoutsThisWeek: 0,
  selectedDevices: [],
  mode: 'individual',
};

describe('AnalyticsHub', () => {
  it('renders all three tab triggers', () => {
    render(<AnalyticsHub user={mockUser} history={[]} />);
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Volume' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Exercise' })).toBeInTheDocument();
  });

  it('Overview tab is active by default', () => {
    render(<AnalyticsHub user={mockUser} history={[]} />);
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('data-state', 'active');
    expect(screen.getByTestId('overview-tab')).toBeInTheDocument();
  });

  it('clicking Volume tab renders VolumeAnalytics', async () => {
    render(<AnalyticsHub user={mockUser} history={[]} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Volume' }));
    expect(screen.getByTestId('volume-analytics')).toBeInTheDocument();
  });

  it('clicking Exercise tab renders ExerciseHistory', async () => {
    render(<AnalyticsHub user={mockUser} history={[]} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Exercise' }));
    expect(screen.getByTestId('exercise-history')).toBeInTheDocument();
  });

  it('has data-testid for E2E targeting', () => {
    render(<AnalyticsHub user={mockUser} history={[]} />);
    expect(screen.getByTestId('analytics-hub')).toBeInTheDocument();
  });
});
