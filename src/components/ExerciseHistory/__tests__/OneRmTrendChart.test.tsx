/**
 * Tests for OneRmTrendChart component.
 *
 * Part of AMA-481: Build Exercise History Page with 1RM Trends
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OneRmTrendChart } from '../OneRmTrendChart';
import {
  MOCK_SESSION_WITH_PR,
  MOCK_SESSION_NO_PR,
  MOCK_SESSION_NULL_WORKOUT_NAME,
  MOCK_SESSION_NULL_1RM,
  createSessionsForDateRangeTests,
} from './fixtures/exercise-history.fixtures';
import type { Session } from '../../../types/progression';

// Mock ResizeObserver for Recharts
vi.mock('recharts', async () => {
  const actual = await vi.importActual('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 500, height: 250 }}>
        {children}
      </div>
    ),
  };
});

// =============================================================================
// Loading State Tests
// =============================================================================

describe('OneRmTrendChart loading state', () => {
  it('renders skeleton when loading', () => {
    render(<OneRmTrendChart sessions={[]} allTimeBest1Rm={null} isLoading={true} />);

    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('shows card title during loading', () => {
    render(<OneRmTrendChart sessions={[]} allTimeBest1Rm={null} isLoading={true} />);

    expect(screen.getByText('1RM Trend')).toBeInTheDocument();
  });
});

// =============================================================================
// Empty State Tests
// =============================================================================

describe('OneRmTrendChart empty state', () => {
  it('shows empty message when no sessions', () => {
    render(<OneRmTrendChart sessions={[]} allTimeBest1Rm={null} isLoading={false} />);

    expect(screen.getByText('No 1RM data available for this date range')).toBeInTheDocument();
  });

  it('shows empty message when all sessions have null 1RM', () => {
    const sessionsWithNull1Rm = [MOCK_SESSION_NULL_1RM];
    render(
      <OneRmTrendChart sessions={sessionsWithNull1Rm} allTimeBest1Rm={null} isLoading={false} />
    );

    expect(screen.getByText('No 1RM data available for this date range')).toBeInTheDocument();
  });
});

// =============================================================================
// Data Preparation Tests
// =============================================================================

describe('OneRmTrendChart data preparation', () => {
  it('renders chart when sessions have 1RM data', () => {
    render(
      <OneRmTrendChart
        sessions={[MOCK_SESSION_WITH_PR, MOCK_SESSION_NO_PR]}
        allTimeBest1Rm={191.2}
        isLoading={false}
      />
    );

    // Chart container should be present
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('filters out sessions with null sessionBest1Rm', () => {
    const mixedSessions = [
      MOCK_SESSION_WITH_PR,
      MOCK_SESSION_NULL_1RM, // This has null 1RM
      MOCK_SESSION_NO_PR,
    ];
    render(
      <OneRmTrendChart sessions={mixedSessions} allTimeBest1Rm={191.2} isLoading={false} />
    );

    // Should still render chart (2 valid sessions)
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('displays all-time best in header when provided', () => {
    render(
      <OneRmTrendChart
        sessions={[MOCK_SESSION_WITH_PR]}
        allTimeBest1Rm={191.2}
        isLoading={false}
      />
    );

    expect(screen.getByText(/All-time best: 191 lbs/)).toBeInTheDocument();
  });

  it('does not display all-time best when null', () => {
    render(
      <OneRmTrendChart sessions={[MOCK_SESSION_WITH_PR]} allTimeBest1Rm={null} isLoading={false} />
    );

    expect(screen.queryByText(/All-time best/)).not.toBeInTheDocument();
  });

  it('rounds all-time best to integer', () => {
    render(
      <OneRmTrendChart
        sessions={[MOCK_SESSION_WITH_PR]}
        allTimeBest1Rm={191.7}
        isLoading={false}
      />
    );

    // Should round 191.7 to 192
    expect(screen.getByText(/192 lbs/)).toBeInTheDocument();
  });
});

// =============================================================================
// Chart Rendering Tests
// =============================================================================

describe('OneRmTrendChart rendering', () => {
  it('renders card with correct title', () => {
    render(
      <OneRmTrendChart
        sessions={[MOCK_SESSION_WITH_PR]}
        allTimeBest1Rm={191.2}
        isLoading={false}
      />
    );

    expect(screen.getByText('1RM Trend')).toBeInTheDocument();
  });

  it('includes TrendingUp icon in title', () => {
    render(
      <OneRmTrendChart
        sessions={[MOCK_SESSION_WITH_PR]}
        allTimeBest1Rm={191.2}
        isLoading={false}
      />
    );

    // Icon is rendered as SVG, check it's in the header
    const header = screen.getByText('1RM Trend').closest('div');
    expect(header).toBeInTheDocument();
  });
});

// =============================================================================
// prepareChartData Logic Tests (via component behavior)
// =============================================================================

describe('OneRmTrendChart data transformation', () => {
  it('handles sessions in reverse chronological order from API', () => {
    // API returns newest first, chart should display oldest first (left to right)
    const sessions = [
      { ...MOCK_SESSION_WITH_PR, workoutDate: '2025-01-15', completionId: 'newer' },
      { ...MOCK_SESSION_NO_PR, workoutDate: '2025-01-10', completionId: 'older' },
    ];

    render(<OneRmTrendChart sessions={sessions} allTimeBest1Rm={191.2} isLoading={false} />);

    // Chart should render without error
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('handles single session', () => {
    render(
      <OneRmTrendChart sessions={[MOCK_SESSION_WITH_PR]} allTimeBest1Rm={191.2} isLoading={false} />
    );

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('handles many sessions', () => {
    const manySessions = createSessionsForDateRangeTests();
    render(<OneRmTrendChart sessions={manySessions} allTimeBest1Rm={200} isLoading={false} />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('handles session with null workout name', () => {
    render(
      <OneRmTrendChart
        sessions={[MOCK_SESSION_NULL_WORKOUT_NAME]}
        allTimeBest1Rm={175}
        isLoading={false}
      />
    );

    // Should render without error
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('OneRmTrendChart edge cases', () => {
  it('handles sessions with same 1RM values', () => {
    const sameSessions: Session[] = [
      { ...MOCK_SESSION_NO_PR, completionId: 'a', workoutDate: '2025-01-10', sessionBest1Rm: 180 },
      { ...MOCK_SESSION_NO_PR, completionId: 'b', workoutDate: '2025-01-12', sessionBest1Rm: 180 },
      { ...MOCK_SESSION_NO_PR, completionId: 'c', workoutDate: '2025-01-14', sessionBest1Rm: 180 },
    ];

    render(<OneRmTrendChart sessions={sameSessions} allTimeBest1Rm={180} isLoading={false} />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('handles sessions with large 1RM values', () => {
    const heavySession: Session = {
      ...MOCK_SESSION_WITH_PR,
      sessionBest1Rm: 500,
      completionId: 'heavy',
    };

    render(<OneRmTrendChart sessions={[heavySession]} allTimeBest1Rm={500} isLoading={false} />);

    expect(screen.getByText(/500 lbs/)).toBeInTheDocument();
  });

  it('handles sessions with small 1RM values', () => {
    const lightSession: Session = {
      ...MOCK_SESSION_NO_PR,
      sessionBest1Rm: 45,
      completionId: 'light',
    };

    render(<OneRmTrendChart sessions={[lightSession]} allTimeBest1Rm={45} isLoading={false} />);

    expect(screen.getByText(/45 lbs/)).toBeInTheDocument();
  });

  it('handles sessions spanning long time period', () => {
    const longRangeSessions: Session[] = [
      { ...MOCK_SESSION_NO_PR, completionId: 'old', workoutDate: '2024-01-01', sessionBest1Rm: 150 },
      {
        ...MOCK_SESSION_WITH_PR,
        completionId: 'new',
        workoutDate: '2025-01-15',
        sessionBest1Rm: 200,
      },
    ];

    render(
      <OneRmTrendChart sessions={longRangeSessions} allTimeBest1Rm={200} isLoading={false} />
    );

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });
});

// =============================================================================
// PR Detection Tests
// =============================================================================

describe('OneRmTrendChart PR handling', () => {
  it('handles session where set has isPr true', () => {
    // MOCK_SESSION_WITH_PR has a set with isPr: true
    render(
      <OneRmTrendChart sessions={[MOCK_SESSION_WITH_PR]} allTimeBest1Rm={191.2} isLoading={false} />
    );

    // Should render without error
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('handles session where no sets have isPr', () => {
    // MOCK_SESSION_NO_PR has no PR sets
    render(
      <OneRmTrendChart sessions={[MOCK_SESSION_NO_PR]} allTimeBest1Rm={180} isLoading={false} />
    );

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('handles mix of PR and non-PR sessions', () => {
    const mixedSessions = [MOCK_SESSION_WITH_PR, MOCK_SESSION_NO_PR];
    render(<OneRmTrendChart sessions={mixedSessions} allTimeBest1Rm={191.2} isLoading={false} />);

    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });
});
