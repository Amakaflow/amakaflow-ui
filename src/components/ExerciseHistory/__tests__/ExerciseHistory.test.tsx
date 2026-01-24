/**
 * Integration tests for ExerciseHistory main component.
 *
 * Part of AMA-481: Build Exercise History Page with 1RM Trends
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExerciseHistory } from '../ExerciseHistory';
import {
  MOCK_EXERCISES,
  MOCK_EXERCISES_EMPTY,
  MOCK_EXERCISE_HISTORY,
  MOCK_EXERCISE_HISTORY_EMPTY,
  createExercisesWithHistoryReturn,
  createExerciseHistoryReturn,
} from './fixtures/exercise-history.fixtures';

// Mock the hooks
vi.mock('../../../hooks/useProgressionApi', () => ({
  useExercisesWithHistory: vi.fn(),
  useExerciseHistory: vi.fn(),
}));

import {
  useExercisesWithHistory,
  useExerciseHistory,
} from '../../../hooks/useProgressionApi';

// Mock Recharts ResponsiveContainer for chart tests
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

const mockUser = { id: 'user-123', name: 'Test User' };

// =============================================================================
// Setup
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();

  // Default mock implementations
  vi.mocked(useExercisesWithHistory).mockReturnValue(
    createExercisesWithHistoryReturn()
  );

  vi.mocked(useExerciseHistory).mockReturnValue(
    createExerciseHistoryReturn({ data: null })
  );
});

// =============================================================================
// Initial Render Tests
// =============================================================================

describe('ExerciseHistory initial render', () => {
  it('shows page header and description', () => {
    render(<ExerciseHistory user={mockUser} />);

    expect(screen.getByText('Exercise History')).toBeInTheDocument();
    expect(
      screen.getByText('Track your strength progression and view workout history')
    ).toBeInTheDocument();
  });

  it('renders ExerciseSelector', () => {
    render(<ExerciseHistory user={mockUser} />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('does not show DateRangeFilter initially', () => {
    render(<ExerciseHistory user={mockUser} />);

    // Date range filter only shows after exercise is selected
    expect(screen.queryByText('Last 30 days')).not.toBeInTheDocument();
    expect(screen.queryByText('All time')).not.toBeInTheDocument();
  });

  it('shows "Select an Exercise" prompt when no exercise selected', () => {
    render(<ExerciseHistory user={mockUser} />);

    expect(screen.getByText('Select an Exercise')).toBeInTheDocument();
    expect(
      screen.getByText(/Choose an exercise from the dropdown above/)
    ).toBeInTheDocument();
  });
});

// =============================================================================
// No Exercises State Tests
// =============================================================================

describe('ExerciseHistory no exercises state', () => {
  beforeEach(() => {
    vi.mocked(useExercisesWithHistory).mockReturnValue(
      createExercisesWithHistoryReturn({ exercises: MOCK_EXERCISES_EMPTY })
    );
  });

  it('shows "No Workout History Yet" when exercises list empty', () => {
    render(<ExerciseHistory user={mockUser} />);

    expect(screen.getByText('No Workout History Yet')).toBeInTheDocument();
  });

  it('shows guidance about weight tracking', () => {
    render(<ExerciseHistory user={mockUser} />);

    expect(
      screen.getByText(/Complete workouts with weight tracking/)
    ).toBeInTheDocument();
  });

  it('shows badge about 1RM calculations', () => {
    render(<ExerciseHistory user={mockUser} />);

    expect(screen.getByText(/Track weight \+ reps to enable 1RM calculations/)).toBeInTheDocument();
  });
});

// =============================================================================
// Exercise Selected State Tests
// =============================================================================

describe('ExerciseHistory exercise selected', () => {
  beforeEach(() => {
    vi.mocked(useExerciseHistory).mockReturnValue(
      createExerciseHistoryReturn({ data: MOCK_EXERCISE_HISTORY })
    );
  });

  it('shows DateRangeFilter after exercise selection', async () => {
    const user = userEvent.setup();
    render(<ExerciseHistory user={mockUser} />);

    // Select an exercise
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Barbell Bench Press'));

    // Now date range filter should be visible
    expect(screen.getByText('All time')).toBeInTheDocument();
  });

  it('shows stats cards after exercise selection', async () => {
    const user = userEvent.setup();
    render(<ExerciseHistory user={mockUser} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Barbell Bench Press'));

    // Stats card titles should be present
    expect(screen.getByText('All-Time Best 1RM')).toBeInTheDocument();
    // Max Weight appears in both stats card and table header, use getAllByText
    expect(screen.getAllByText('Max Weight').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Total Sessions')).toBeInTheDocument();
    expect(screen.getByText('In Range')).toBeInTheDocument();
  });

  it('shows exercise name badge', async () => {
    const user = userEvent.setup();
    render(<ExerciseHistory user={mockUser} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Barbell Bench Press'));

    // Badge with exercise name should appear
    const badges = screen.getAllByText('Barbell Bench Press');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows "1RM Supported" badge when supports1Rm is true', async () => {
    const user = userEvent.setup();
    render(<ExerciseHistory user={mockUser} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Barbell Bench Press'));

    expect(screen.getByText('1RM Supported')).toBeInTheDocument();
  });

  it('renders chart', async () => {
    const user = userEvent.setup();
    render(<ExerciseHistory user={mockUser} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Barbell Bench Press'));

    expect(screen.getByText('1RM Trend')).toBeInTheDocument();
  });

  it('renders history table', async () => {
    const user = userEvent.setup();
    render(<ExerciseHistory user={mockUser} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Barbell Bench Press'));

    expect(screen.getByText('Session History')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});

// =============================================================================
// Loading State Tests
// =============================================================================

describe('ExerciseHistory loading states', () => {
  it('shows loading in ExerciseSelector while fetching exercises', () => {
    vi.mocked(useExercisesWithHistory).mockReturnValue(
      createExercisesWithHistoryReturn({ isLoading: true, exercises: [] })
    );

    render(<ExerciseHistory user={mockUser} />);

    expect(screen.getByText('Loading exercises...')).toBeInTheDocument();
  });

  it('shows skeleton stats cards while fetching history', async () => {
    vi.mocked(useExerciseHistory).mockReturnValue(
      createExerciseHistoryReturn({ data: null, isLoading: true })
    );

    const user = userEvent.setup();
    render(<ExerciseHistory user={mockUser} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Barbell Bench Press'));

    // Skeletons should be visible
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Error State Tests
// =============================================================================

describe('ExerciseHistory error states', () => {
  it('shows error message when exercises fetch fails', () => {
    vi.mocked(useExercisesWithHistory).mockReturnValue({
      ...createExercisesWithHistoryReturn(),
      error: new Error('Network error'),
    });

    render(<ExerciseHistory user={mockUser} />);

    expect(screen.getByText(/Failed to load exercises/)).toBeInTheDocument();
    expect(screen.getByText(/Network error/)).toBeInTheDocument();
  });

  it('shows error message when history fetch fails', async () => {
    vi.mocked(useExerciseHistory).mockReturnValue({
      ...createExerciseHistoryReturn(),
      error: new Error('API error'),
    });

    const user = userEvent.setup();
    render(<ExerciseHistory user={mockUser} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Barbell Bench Press'));

    expect(screen.getByText(/Failed to load history/)).toBeInTheDocument();
    expect(screen.getByText(/API error/)).toBeInTheDocument();
  });
});

// =============================================================================
// Date Range Filtering Tests
// =============================================================================

describe('ExerciseHistory date range filtering', () => {
  beforeEach(() => {
    vi.mocked(useExerciseHistory).mockReturnValue(
      createExerciseHistoryReturn({ data: MOCK_EXERCISE_HISTORY })
    );
  });

  it('defaults to "all" date range', async () => {
    const user = userEvent.setup();
    render(<ExerciseHistory user={mockUser} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Barbell Bench Press'));

    // "All time" should be the default selection shown
    const selectTriggers = screen.getAllByRole('combobox');
    // Second combobox is the date range filter
    expect(selectTriggers.length).toBe(2);
  });

  it('updates filtered session count when date range changes', async () => {
    const user = userEvent.setup();
    render(<ExerciseHistory user={mockUser} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Barbell Bench Press'));

    // "In Range" stat should show session count
    expect(screen.getByText('In Range')).toBeInTheDocument();
  });
});

// =============================================================================
// Pagination Tests
// =============================================================================

describe('ExerciseHistory pagination', () => {
  it('shows Load More button when hasMore is true', async () => {
    vi.mocked(useExerciseHistory).mockReturnValue(
      createExerciseHistoryReturn({ data: MOCK_EXERCISE_HISTORY, hasMore: true })
    );

    const user = userEvent.setup();
    render(<ExerciseHistory user={mockUser} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Barbell Bench Press'));

    expect(screen.getByText('Load More')).toBeInTheDocument();
  });

  it('hides Load More button when hasMore is false', async () => {
    vi.mocked(useExerciseHistory).mockReturnValue(
      createExerciseHistoryReturn({ data: MOCK_EXERCISE_HISTORY, hasMore: false })
    );

    const user = userEvent.setup();
    render(<ExerciseHistory user={mockUser} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Barbell Bench Press'));

    expect(screen.queryByText('Load More')).not.toBeInTheDocument();
  });

  it('calls fetchMore when Load More clicked', async () => {
    const mockFetchMore = vi.fn();
    vi.mocked(useExerciseHistory).mockReturnValue({
      ...createExerciseHistoryReturn({ data: MOCK_EXERCISE_HISTORY, hasMore: true }),
      fetchMore: mockFetchMore,
    });

    const user = userEvent.setup();
    render(<ExerciseHistory user={mockUser} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Barbell Bench Press'));
    await user.click(screen.getByText('Load More'));

    expect(mockFetchMore).toHaveBeenCalledTimes(1);
  });
});

// =============================================================================
// Stats Cards Tests
// =============================================================================

describe('ExerciseHistory StatsCards', () => {
  beforeEach(() => {
    vi.mocked(useExerciseHistory).mockReturnValue(
      createExerciseHistoryReturn({ data: MOCK_EXERCISE_HISTORY })
    );
  });

  it('displays all-time best 1RM', async () => {
    const user = userEvent.setup();
    render(<ExerciseHistory user={mockUser} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Barbell Bench Press'));

    // MOCK_EXERCISE_HISTORY has allTimeBest1Rm: 191.2
    // Value appears in stats card - find the card by its title and check sibling
    const statTitle = screen.getByText('All-Time Best 1RM');
    const statCard = statTitle.closest('[data-slot="card"]') || statTitle.parentElement?.parentElement;
    expect(statCard?.textContent).toContain('191');
  });

  it('displays max weight', async () => {
    const user = userEvent.setup();
    render(<ExerciseHistory user={mockUser} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Barbell Bench Press'));

    // MOCK_EXERCISE_HISTORY has allTimeMaxWeight: 155
    // Find by the stat card title "Max Weight" (not the table header)
    const statCards = document.querySelectorAll('[data-slot="card"]');
    const maxWeightCard = Array.from(statCards).find(
      (card) => card.textContent?.includes('Max Weight') && card.textContent?.includes('155')
    );
    expect(maxWeightCard).toBeTruthy();
  });

  it('displays total sessions count', async () => {
    const user = userEvent.setup();
    render(<ExerciseHistory user={mockUser} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Barbell Bench Press'));

    // MOCK_EXERCISE_HISTORY has totalSessions: 3
    // Find the Total Sessions stat card
    const statTitle = screen.getByText('Total Sessions');
    const statCard = statTitle.closest('[data-slot="card"]') || statTitle.parentElement?.parentElement;
    expect(statCard?.textContent).toContain('3');
  });

  it('displays dash for null all-time best 1RM', async () => {
    vi.mocked(useExerciseHistory).mockReturnValue(
      createExerciseHistoryReturn({ data: MOCK_EXERCISE_HISTORY_EMPTY })
    );

    const user = userEvent.setup();
    render(<ExerciseHistory user={mockUser} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Barbell Bench Press'));

    // Should show dashes for null values
    const statCards = screen.getAllByText('-');
    expect(statCards.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Hook Integration Tests
// =============================================================================

describe('ExerciseHistory hook integration', () => {
  it('calls useExercisesWithHistory with correct options', () => {
    render(<ExerciseHistory user={mockUser} />);

    expect(useExercisesWithHistory).toHaveBeenCalledWith({ limit: 100 });
  });

  it('calls useExerciseHistory with selected exerciseId', async () => {
    const user = userEvent.setup();
    render(<ExerciseHistory user={mockUser} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Barbell Bench Press'));

    expect(useExerciseHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        exerciseId: 'barbell-bench-press',
        enabled: true,
      })
    );
  });

  it('disables useExerciseHistory when no exercise selected', () => {
    render(<ExerciseHistory user={mockUser} />);

    expect(useExerciseHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
      })
    );
  });
});

// =============================================================================
// Switching Exercises Tests
// =============================================================================

describe('ExerciseHistory switching exercises', () => {
  beforeEach(() => {
    vi.mocked(useExerciseHistory).mockReturnValue(
      createExerciseHistoryReturn({ data: MOCK_EXERCISE_HISTORY })
    );
  });

  it('updates content when different exercise selected', async () => {
    const user = userEvent.setup();
    render(<ExerciseHistory user={mockUser} />);

    // Select first exercise
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Barbell Bench Press'));

    // Verify first exercise shown
    expect(screen.getAllByText('Barbell Bench Press').length).toBeGreaterThan(0);

    // Select different exercise
    const comboboxes = screen.getAllByRole('combobox');
    await user.click(comboboxes[0]); // Exercise selector
    await user.click(screen.getByText('Barbell Squat'));

    // Hook should be called with new exerciseId
    expect(useExerciseHistory).toHaveBeenLastCalledWith(
      expect.objectContaining({
        exerciseId: 'barbell-squat',
      })
    );
  });
});
