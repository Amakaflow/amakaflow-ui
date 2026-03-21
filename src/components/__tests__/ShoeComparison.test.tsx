import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Mock recharts to avoid SVG rendering issues in jsdom
vi.mock('recharts', () => {
  const React = require('react');
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'responsive-container' }, children),
    BarChart: ({ children }: { children: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'bar-chart' }, children),
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  };
});

import { ShoeComparisonPage } from '../Analytics/ShoeComparison/ShoeComparisonPage';
import { ShoeCard } from '../Analytics/ShoeComparison/ShoeCard';
import type { ShoeStats } from '../Analytics/ShoeComparison/hooks/useShoeComparison';

const mockShoe: ShoeStats = {
  shoe_name: 'Test Shoe',
  total_runs: 10,
  total_km: 80.5,
  avg_pace_per_km: 300,
  avg_power: 240,
  avg_form_power: 60,
  avg_leg_spring_stiffness: 10.0,
  avg_vertical_oscillation: 7.5,
  avg_hr: 150,
  best_for: ['intervals', 'tempo'],
};

describe('ShoeCard', () => {
  it('renders shoe name', () => {
    render(<ShoeCard shoe={mockShoe} />);
    expect(screen.getByText('Test Shoe')).toBeInTheDocument();
  });

  it('renders best-for badges', () => {
    render(<ShoeCard shoe={mockShoe} />);
    expect(screen.getByText('Best for: intervals')).toBeInTheDocument();
    expect(screen.getByText('Best for: tempo')).toBeInTheDocument();
  });

  it('renders key metrics', () => {
    render(<ShoeCard shoe={mockShoe} />);
    expect(screen.getByText('240W')).toBeInTheDocument();
    expect(screen.getByText('5:00/km')).toBeInTheDocument();
    expect(screen.getByText('150 bpm')).toBeInTheDocument();
  });

  it('displays total runs and km', () => {
    render(<ShoeCard shoe={mockShoe} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('80.5')).toBeInTheDocument();
  });
});

describe('ShoeComparisonPage', () => {
  it('shows loading state initially', () => {
    render(<ShoeComparisonPage />);
    expect(screen.getByTestId('shoe-comparison-loading')).toBeInTheDocument();
  });

  it('renders all 3 shoe cards after loading', async () => {
    render(<ShoeComparisonPage />);
    await waitFor(
      () => {
        expect(screen.getByTestId('shoe-comparison-page')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    expect(screen.getByText('Nike Vaporfly 3')).toBeInTheDocument();
    expect(screen.getByText('Asics Novablast 4')).toBeInTheDocument();
    expect(screen.getByText('Hoka Mach 6')).toBeInTheDocument();
  });

  it('renders recommendation section', async () => {
    render(<ShoeComparisonPage />);
    await waitFor(
      () => {
        expect(screen.getByTestId('shoe-recommendation')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    expect(screen.getByText('Recommendation')).toBeInTheDocument();
  });

  it('renders comparison chart', async () => {
    render(<ShoeComparisonPage />);
    await waitFor(
      () => {
        expect(screen.getByTestId('comparison-chart')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it('shows total runs analyzed', async () => {
    render(<ShoeComparisonPage />);
    await waitFor(
      () => {
        expect(screen.getByText(/144 runs analyzed/)).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });
});
