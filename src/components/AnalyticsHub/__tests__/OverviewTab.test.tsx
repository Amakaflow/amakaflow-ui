import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OverviewTab } from '../OverviewTab';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => children,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

const mockUser = {
  id: 'u1', name: 'Test', email: 'test@test.com', subscription: 'free',
  workoutsThisWeek: 0, selectedDevices: [], mode: 'individual',
} as any;

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function makeItem(daysAgoN = 0, workout_type = 'strength'): any {
  return {
    id: Math.random().toString(),
    workout: {
      title: 'Test', source: 'test',
      blocks: [{ label: 'Main', exercises: [{ id: 'e1', name: 'Squat', sets: 3 }], supersets: [] }],
      workout_type,
    },
    sources: [], device: 'garmin',
    createdAt: daysAgo(daysAgoN),
    updatedAt: daysAgo(daysAgoN),
  };
}

describe('OverviewTab', () => {
  it('renders the weekly hours stat card', () => {
    render(<OverviewTab user={mockUser} history={[makeItem(0)]} />);
    expect(screen.getByTestId('stat-weekly-hours')).toBeInTheDocument();
  });

  it('renders the sessions count stat card', () => {
    render(<OverviewTab user={mockUser} history={[makeItem(0), makeItem(1)]} />);
    expect(screen.getByTestId('stat-sessions')).toBeInTheDocument();
    expect(screen.getByTestId('stat-sessions')).toHaveTextContent('2');
  });

  it('renders the streak stat card', () => {
    render(<OverviewTab user={mockUser} history={[makeItem(0)]} />);
    expect(screen.getByTestId('stat-streak')).toBeInTheDocument();
  });

  it('renders the week-over-week delta card', () => {
    render(<OverviewTab user={mockUser} history={[makeItem(0)]} />);
    expect(screen.getByTestId('stat-delta')).toBeInTheDocument();
  });

  it('renders the training split section', () => {
    render(<OverviewTab user={mockUser} history={[makeItem(0, 'strength'), makeItem(1, 'running')]} />);
    expect(screen.getByText(/training split/i)).toBeInTheDocument();
    expect(screen.getByText(/Strength/)).toBeInTheDocument();
    expect(screen.getByText(/Cardio/)).toBeInTheDocument();
  });

  it('renders the weekly activity chart section', () => {
    render(<OverviewTab user={mockUser} history={[]} />);
    expect(screen.getByText(/weekly activity/i)).toBeInTheDocument();
  });

  it('toggles chart between sessions and hours views', async () => {
    render(<OverviewTab user={mockUser} history={[makeItem(0)]} />);
    const hoursButton = screen.getByRole('button', { name: /hours/i });
    expect(hoursButton).toBeInTheDocument();
    await userEvent.click(hoursButton);
    expect(screen.getByRole('button', { name: /sessions/i })).toBeInTheDocument();
  });

  it('renders averages row with avg workout and monthly hours', () => {
    render(<OverviewTab user={mockUser} history={[makeItem(0)]} />);
    expect(screen.getByText(/avg workout/i)).toBeInTheDocument();
    expect(screen.getByText(/monthly/i)).toBeInTheDocument();
  });

  it('renders empty state gracefully with no history', () => {
    render(<OverviewTab user={mockUser} history={[]} />);
    expect(screen.getByTestId('stat-weekly-hours')).toHaveTextContent('0m');
    expect(screen.getByTestId('stat-sessions')).toHaveTextContent('0');
  });
});
