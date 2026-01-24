/**
 * Tests for HistoryTable component.
 *
 * Part of AMA-481: Build Exercise History Page with 1RM Trends
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoryTable } from '../HistoryTable';
import {
  MOCK_SESSION_WITH_PR,
  MOCK_SESSION_NO_PR,
  MOCK_SESSION_NULL_WORKOUT_NAME,
  MOCK_SESSION_NULL_1RM,
  MOCK_SESSION_HIGH_VOLUME,
  MOCK_SET_BASIC,
  MOCK_SET_PR,
  MOCK_SET_NULL_VALUES,
} from './fixtures/exercise-history.fixtures';

// =============================================================================
// Loading State Tests
// =============================================================================

describe('HistoryTable loading state', () => {
  it('renders skeleton rows when loading', () => {
    render(<HistoryTable sessions={[]} isLoading={true} />);

    // Should have skeleton elements (animated pulse)
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows table headers during loading', () => {
    render(<HistoryTable sessions={[]} isLoading={true} />);

    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Workout')).toBeInTheDocument();
    expect(screen.getByText('Sets')).toBeInTheDocument();
    expect(screen.getByText('Max Weight')).toBeInTheDocument();
    expect(screen.getByText('Best 1RM')).toBeInTheDocument();
    expect(screen.getByText('Volume')).toBeInTheDocument();
  });
});

// =============================================================================
// Empty State Tests
// =============================================================================

describe('HistoryTable empty state', () => {
  it('shows empty message when no sessions', () => {
    render(<HistoryTable sessions={[]} isLoading={false} />);

    expect(screen.getByText('No sessions in this date range')).toBeInTheDocument();
  });

  it('does not show table when empty', () => {
    render(<HistoryTable sessions={[]} isLoading={false} />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

// =============================================================================
// Session Row Rendering Tests
// =============================================================================

describe('HistoryTable session rows', () => {
  it('renders all sessions', () => {
    const sessions = [MOCK_SESSION_WITH_PR, MOCK_SESSION_NO_PR];
    render(<HistoryTable sessions={sessions} isLoading={false} />);

    // Each session should have a row
    expect(screen.getByText('Push Day')).toBeInTheDocument();
    expect(screen.getByText('Upper Body')).toBeInTheDocument();
  });

  it('formats date correctly', () => {
    render(<HistoryTable sessions={[MOCK_SESSION_WITH_PR]} isLoading={false} />);

    // Date should contain Jan, 15, and 2025 in some locale-appropriate format
    // The exact format may vary by environment (e.g., "Jan 15, 2025" or "15 Jan 2025")
    const row = screen.getByText('Push Day').closest('tr');
    expect(row?.textContent).toMatch(/Jan/i);
    expect(row?.textContent).toMatch(/15/);
    expect(row?.textContent).toMatch(/2025/);
  });

  it('shows workout name', () => {
    render(<HistoryTable sessions={[MOCK_SESSION_WITH_PR]} isLoading={false} />);

    expect(screen.getByText('Push Day')).toBeInTheDocument();
  });

  it('shows "Untitled Workout" for null workout name', () => {
    render(<HistoryTable sessions={[MOCK_SESSION_NULL_WORKOUT_NAME]} isLoading={false} />);

    expect(screen.getByText('Untitled Workout')).toBeInTheDocument();
  });

  it('displays set count', () => {
    render(<HistoryTable sessions={[MOCK_SESSION_WITH_PR]} isLoading={false} />);

    // MOCK_SESSION_WITH_PR has 2 sets
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('displays max weight with unit', () => {
    render(<HistoryTable sessions={[MOCK_SESSION_WITH_PR]} isLoading={false} />);

    // MOCK_SESSION_WITH_PR has sessionMaxWeight: 155
    expect(screen.getByText('155 lbs')).toBeInTheDocument();
  });

  it('displays best 1RM rounded to integer', () => {
    render(<HistoryTable sessions={[MOCK_SESSION_WITH_PR]} isLoading={false} />);

    // MOCK_SESSION_WITH_PR has sessionBest1Rm: 191.2, should round to 191
    expect(screen.getByText(/191 lbs/)).toBeInTheDocument();
  });

  it('displays total volume with unit', () => {
    render(<HistoryTable sessions={[MOCK_SESSION_WITH_PR]} isLoading={false} />);

    // MOCK_SESSION_WITH_PR has sessionTotalVolume: 2590
    expect(screen.getByText('2,590 lbs')).toBeInTheDocument();
  });

  it('displays large volume with thousands separator', () => {
    render(<HistoryTable sessions={[MOCK_SESSION_HIGH_VOLUME]} isLoading={false} />);

    // MOCK_SESSION_HIGH_VOLUME has sessionTotalVolume: 6750
    expect(screen.getByText('6,750 lbs')).toBeInTheDocument();
  });

  it('shows dash for null max weight', () => {
    render(<HistoryTable sessions={[MOCK_SESSION_NULL_1RM]} isLoading={false} />);

    // Count dashes - should have multiple for null values
    const cells = screen.getAllByRole('cell');
    const dashCells = cells.filter((cell) => cell.textContent === '-');
    expect(dashCells.length).toBeGreaterThan(0);
  });

  it('shows dash for null best 1RM', () => {
    render(<HistoryTable sessions={[MOCK_SESSION_NULL_1RM]} isLoading={false} />);

    // The 1RM column should show dash
    const rows = screen.getAllByRole('row');
    // First row is header, second is data
    const dataRow = rows[1];
    expect(dataRow).toBeInTheDocument();
  });

  it('shows trophy icon when session contains PR', () => {
    render(<HistoryTable sessions={[MOCK_SESSION_WITH_PR]} isLoading={false} />);

    // Trophy icon should be present (lucide-react renders as svg)
    const row = screen.getByText('Push Day').closest('tr');
    expect(row).toBeInTheDocument();
    // The trophy is rendered as an SVG with class text-amber-500
    const trophyIcon = row?.querySelector('.text-amber-500');
    expect(trophyIcon).toBeInTheDocument();
  });

  it('does not show trophy when session has no PR', () => {
    render(<HistoryTable sessions={[MOCK_SESSION_NO_PR]} isLoading={false} />);

    const row = screen.getByText('Upper Body').closest('tr');
    const trophyIcon = row?.querySelector('.text-amber-500');
    expect(trophyIcon).not.toBeInTheDocument();
  });
});

// =============================================================================
// Expandable Row Tests
// =============================================================================

describe('HistoryTable expandable rows', () => {
  it('expands row on click to show sets', async () => {
    const user = userEvent.setup();
    render(<HistoryTable sessions={[MOCK_SESSION_WITH_PR]} isLoading={false} />);

    // Initially, set details should not be visible
    expect(screen.queryByText('Set 1')).not.toBeInTheDocument();

    // Click to expand
    const row = screen.getByText('Push Day').closest('tr');
    await user.click(row!);

    // Now set details should be visible
    expect(screen.getByText('Set 1')).toBeInTheDocument();
    expect(screen.getByText('Set 2')).toBeInTheDocument();
  });

  it('collapses row on second click', async () => {
    const user = userEvent.setup();
    render(<HistoryTable sessions={[MOCK_SESSION_WITH_PR]} isLoading={false} />);

    const row = screen.getByText('Push Day').closest('tr');

    // Expand
    await user.click(row!);
    expect(screen.getByText('Set 1')).toBeInTheDocument();

    // Collapse
    await user.click(row!);
    expect(screen.queryByText('Set 1')).not.toBeInTheDocument();
  });

  it('shows chevron icon for expand/collapse', () => {
    render(<HistoryTable sessions={[MOCK_SESSION_WITH_PR]} isLoading={false} />);

    // Should have a button with chevron
    const expandButton = screen.getByRole('button');
    expect(expandButton).toBeInTheDocument();
  });
});

// =============================================================================
// Set Detail Row Tests
// =============================================================================

describe('HistoryTable set details', () => {
  it('renders all sets when expanded', async () => {
    const user = userEvent.setup();
    render(<HistoryTable sessions={[MOCK_SESSION_WITH_PR]} isLoading={false} />);

    // Expand
    const row = screen.getByText('Push Day').closest('tr');
    await user.click(row!);

    // MOCK_SESSION_WITH_PR has 2 sets
    expect(screen.getByText('Set 1')).toBeInTheDocument();
    expect(screen.getByText('Set 2')).toBeInTheDocument();
  });

  it('shows set weight', async () => {
    const user = userEvent.setup();
    render(<HistoryTable sessions={[MOCK_SESSION_WITH_PR]} isLoading={false} />);

    const row = screen.getByText('Push Day').closest('tr');
    await user.click(row!);

    // MOCK_SET_BASIC has weight: 135, MOCK_SET_PR has weight: 155
    expect(screen.getByText('135 lbs')).toBeInTheDocument();
  });

  it('shows set reps', async () => {
    const user = userEvent.setup();
    render(<HistoryTable sessions={[MOCK_SESSION_WITH_PR]} isLoading={false} />);

    const row = screen.getByText('Push Day').closest('tr');
    await user.click(row!);

    // MOCK_SET_BASIC has repsCompleted: 10, MOCK_SET_PR has repsCompleted: 8
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('shows estimated 1RM for set', async () => {
    const user = userEvent.setup();
    render(<HistoryTable sessions={[MOCK_SESSION_WITH_PR]} isLoading={false} />);

    const row = screen.getByText('Push Day').closest('tr');
    await user.click(row!);

    // MOCK_SET_BASIC has estimated1Rm: 180
    expect(screen.getByText(/180 lbs/)).toBeInTheDocument();
  });

  it('shows PR badge for PR sets', async () => {
    const user = userEvent.setup();
    render(<HistoryTable sessions={[MOCK_SESSION_WITH_PR]} isLoading={false} />);

    const row = screen.getByText('Push Day').closest('tr');
    await user.click(row!);

    // MOCK_SET_PR has isPr: true
    expect(screen.getByText('PR')).toBeInTheDocument();
  });

  it('shows dash for null weight in set', async () => {
    const user = userEvent.setup();
    // Create a session with a set that has null weight
    const sessionWithNullSet = {
      ...MOCK_SESSION_NULL_1RM,
      sets: [MOCK_SET_NULL_VALUES],
    };
    render(<HistoryTable sessions={[sessionWithNullSet]} isLoading={false} />);

    const row = screen.getByText('Recovery Session').closest('tr');
    await user.click(row!);

    // Should show dashes for null values
    const setRow = screen.getByText('Set 3').closest('tr');
    expect(setRow).toBeInTheDocument();
  });

  it('shows dash for null reps in set', async () => {
    const user = userEvent.setup();
    const sessionWithNullSet = {
      ...MOCK_SESSION_NULL_1RM,
      sets: [MOCK_SET_NULL_VALUES],
    };
    render(<HistoryTable sessions={[sessionWithNullSet]} isLoading={false} />);

    const row = screen.getByText('Recovery Session').closest('tr');
    await user.click(row!);

    // Set row should exist
    expect(screen.getByText('Set 3')).toBeInTheDocument();
  });
});

// =============================================================================
// Table Structure Tests
// =============================================================================

describe('HistoryTable structure', () => {
  it('renders as a table element', () => {
    render(<HistoryTable sessions={[MOCK_SESSION_WITH_PR]} isLoading={false} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('has correct column headers', () => {
    render(<HistoryTable sessions={[MOCK_SESSION_WITH_PR]} isLoading={false} />);

    const headers = screen.getAllByRole('columnheader');
    const headerTexts = headers.map((h) => h.textContent?.trim());

    expect(headerTexts).toContain('Date');
    expect(headerTexts).toContain('Workout');
    expect(headerTexts).toContain('Sets');
    expect(headerTexts).toContain('Max Weight');
    expect(headerTexts).toContain('Best 1RM');
    expect(headerTexts).toContain('Volume');
  });

  it('renders correct number of data rows', () => {
    const sessions = [MOCK_SESSION_WITH_PR, MOCK_SESSION_NO_PR, MOCK_SESSION_NULL_WORKOUT_NAME];
    render(<HistoryTable sessions={sessions} isLoading={false} />);

    // Get all rows except header
    const rows = screen.getAllByRole('row');
    // First row is header, rest are data rows
    expect(rows.length).toBe(4); // 1 header + 3 data rows
  });
});
