/**
 * Tests for DateRangeFilter component and filterByDateRange utility.
 *
 * Part of AMA-481: Build Exercise History Page with 1RM Trends
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangeFilter, filterByDateRange, type DateRange } from '../DateRangeFilter';
import {
  createSessionsForDateRangeTests,
  createSessionAtBoundary,
  MOCK_SESSION_WITH_PR,
  MOCK_SESSION_NO_PR,
} from './fixtures/exercise-history.fixtures';

// =============================================================================
// filterByDateRange Utility Tests
// =============================================================================

describe('filterByDateRange utility', () => {
  describe('edge cases', () => {
    it('returns empty array when sessions is undefined', () => {
      const result = filterByDateRange(undefined, '30d');
      expect(result).toEqual([]);
    });

    it('returns empty array when sessions is empty', () => {
      const result = filterByDateRange([], '30d');
      expect(result).toEqual([]);
    });
  });

  describe('all range', () => {
    it('returns all sessions when range is "all"', () => {
      const sessions = createSessionsForDateRangeTests();
      const result = filterByDateRange(sessions, 'all');
      expect(result).toHaveLength(sessions.length);
      expect(result).toEqual(sessions);
    });

    it('returns empty array for "all" when sessions is empty', () => {
      const result = filterByDateRange([], 'all');
      expect(result).toEqual([]);
    });
  });

  describe('30d range', () => {
    it('filters sessions within last 30 days', () => {
      const sessions = createSessionsForDateRangeTests();
      const result = filterByDateRange(sessions, '30d');

      // Should include: 5d, 25d
      // Should exclude: 35d, 80d, 100d, 200d, 400d
      expect(result).toHaveLength(2);
      expect(result.map((s) => s.completionId)).toEqual(['recent-5d', 'recent-25d']);
    });

    it('excludes session exactly at 30 day boundary', () => {
      const boundarySession = createSessionAtBoundary(30);
      const sessions = [boundarySession];
      const result = filterByDateRange(sessions, '30d');

      // Session at exactly 30 days ago should be excluded (>= cutoff means after cutoff)
      expect(result).toHaveLength(0);
    });

    it('includes session at 29 days', () => {
      const session = createSessionAtBoundary(29);
      const sessions = [session];
      const result = filterByDateRange(sessions, '30d');

      expect(result).toHaveLength(1);
    });
  });

  describe('90d range', () => {
    it('filters sessions within last 90 days', () => {
      const sessions = createSessionsForDateRangeTests();
      const result = filterByDateRange(sessions, '90d');

      // Should include: 5d, 25d, 35d, 80d
      // Should exclude: 100d, 200d, 400d
      expect(result).toHaveLength(4);
      expect(result.map((s) => s.completionId)).toEqual([
        'recent-5d',
        'recent-25d',
        'mid-35d',
        'mid-80d',
      ]);
    });

    it('excludes session exactly at 90 day boundary', () => {
      const boundarySession = createSessionAtBoundary(90);
      const sessions = [boundarySession];
      const result = filterByDateRange(sessions, '90d');

      expect(result).toHaveLength(0);
    });

    it('includes session at 89 days', () => {
      const session = createSessionAtBoundary(89);
      const sessions = [session];
      const result = filterByDateRange(sessions, '90d');

      expect(result).toHaveLength(1);
    });
  });

  describe('1y range', () => {
    it('filters sessions within last year', () => {
      const sessions = createSessionsForDateRangeTests();
      const result = filterByDateRange(sessions, '1y');

      // Should include: 5d, 25d, 35d, 80d, 100d, 200d
      // Should exclude: 400d (more than 365 days)
      expect(result).toHaveLength(6);
      expect(result.map((s) => s.completionId)).toEqual([
        'recent-5d',
        'recent-25d',
        'mid-35d',
        'mid-80d',
        'old-100d',
        'old-200d',
      ]);
    });

    it('excludes session exactly at 365 day boundary', () => {
      const boundarySession = createSessionAtBoundary(365);
      const sessions = [boundarySession];
      const result = filterByDateRange(sessions, '1y');

      expect(result).toHaveLength(0);
    });

    it('includes session at 364 days', () => {
      const session = createSessionAtBoundary(364);
      const sessions = [session];
      const result = filterByDateRange(sessions, '1y');

      expect(result).toHaveLength(1);
    });
  });

  describe('preserves order', () => {
    it('maintains original session order after filtering', () => {
      const sessions = createSessionsForDateRangeTests();
      const result = filterByDateRange(sessions, '90d');

      // Verify order is preserved (most recent first, as returned by API)
      for (let i = 0; i < result.length - 1; i++) {
        const currentDate = new Date(result[i].workoutDate);
        const nextDate = new Date(result[i + 1].workoutDate);
        expect(currentDate.getTime()).toBeGreaterThanOrEqual(nextDate.getTime());
      }
    });
  });

  describe('handles various date formats', () => {
    it('handles ISO date string format (YYYY-MM-DD)', () => {
      const session = { ...MOCK_SESSION_WITH_PR, workoutDate: '2025-01-15' };
      const now = new Date('2025-01-20');
      vi.setSystemTime(now);

      const result = filterByDateRange([session], '30d');
      expect(result).toHaveLength(1);

      vi.useRealTimers();
    });
  });
});

// =============================================================================
// DateRangeFilter Component Tests
// =============================================================================

describe('DateRangeFilter component', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders with current selection displayed', () => {
    render(<DateRangeFilter value="30d" onChange={mockOnChange} />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
  });

  it('renders all date range options when opened', async () => {
    const user = userEvent.setup();
    render(<DateRangeFilter value="all" onChange={mockOnChange} />);

    await user.click(screen.getByRole('combobox'));

    // Use getAllByRole to find all options
    const options = screen.getAllByRole('option');
    const optionTexts = options.map((opt) => opt.textContent);

    expect(optionTexts).toContain('Last 30 days');
    expect(optionTexts).toContain('Last 90 days');
    expect(optionTexts).toContain('Last year');
    expect(optionTexts).toContain('All time');
  });

  it('shows "Last 90 days" when value is 90d', () => {
    render(<DateRangeFilter value="90d" onChange={mockOnChange} />);
    expect(screen.getByText('Last 90 days')).toBeInTheDocument();
  });

  it('shows "Last year" when value is 1y', () => {
    render(<DateRangeFilter value="1y" onChange={mockOnChange} />);
    expect(screen.getByText('Last year')).toBeInTheDocument();
  });

  it('shows "All time" when value is all', () => {
    render(<DateRangeFilter value="all" onChange={mockOnChange} />);
    expect(screen.getByText('All time')).toBeInTheDocument();
  });

  it('calls onChange with new value when selection changes', async () => {
    const user = userEvent.setup();
    render(<DateRangeFilter value="all" onChange={mockOnChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Last 30 days'));

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith('30d');
  });

  it('calls onChange with 90d when "Last 90 days" selected', async () => {
    const user = userEvent.setup();
    render(<DateRangeFilter value="all" onChange={mockOnChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Last 90 days'));

    expect(mockOnChange).toHaveBeenCalledWith('90d');
  });

  it('calls onChange with 1y when "Last year" selected', async () => {
    const user = userEvent.setup();
    render(<DateRangeFilter value="30d" onChange={mockOnChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Last year'));

    expect(mockOnChange).toHaveBeenCalledWith('1y');
  });

  it('calls onChange with all when "All time" selected', async () => {
    const user = userEvent.setup();
    render(<DateRangeFilter value="30d" onChange={mockOnChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('All time'));

    expect(mockOnChange).toHaveBeenCalledWith('all');
  });

  it('has appropriate width styling', () => {
    render(<DateRangeFilter value="all" onChange={mockOnChange} />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveClass('w-[160px]');
  });
});

// =============================================================================
// Type Safety Tests
// =============================================================================

describe('DateRange type', () => {
  it('accepts valid DateRange values', () => {
    const validRanges: DateRange[] = ['30d', '90d', '1y', 'all'];

    validRanges.forEach((range) => {
      const result = filterByDateRange([], range);
      expect(result).toEqual([]);
    });
  });
});
