import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkoutFrequencyChart } from '../WorkoutFrequencyChart';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function makeItem(daysAgoN = 0): any {
  return {
    id: Math.random().toString(),
    workout: { title: 'Test', source: 'test', blocks: [], workout_type: 'strength' },
    sources: [], device: 'garmin',
    createdAt: daysAgo(daysAgoN),
    updatedAt: daysAgo(daysAgoN),
  };
}

describe('WorkoutFrequencyChart', () => {
  it('renders without crashing with empty history', () => {
    render(<WorkoutFrequencyChart history={[]} />);
    expect(screen.getByTestId('frequency-chart')).toBeInTheDocument();
  });

  it('shows the workout frequency heading', () => {
    render(<WorkoutFrequencyChart history={[]} />);
    expect(screen.getByText(/workout frequency/i)).toBeInTheDocument();
  });

  it('renders with history data', () => {
    const history = [makeItem(0), makeItem(7), makeItem(14)];
    render(<WorkoutFrequencyChart history={history} />);
    expect(screen.getByTestId('frequency-chart')).toBeInTheDocument();
  });
});
