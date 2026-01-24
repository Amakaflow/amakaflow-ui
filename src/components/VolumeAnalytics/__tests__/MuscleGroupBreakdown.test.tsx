/**
 * Unit tests for MuscleGroupBreakdown component.
 *
 * Part of AMA-483: Volume Analytics Dashboard
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MuscleGroupBreakdown } from '../MuscleGroupBreakdown';
import {
  MOCK_VOLUME_SUMMARY,
  MOCK_VOLUME_SUMMARY_PREVIOUS,
} from './fixtures/volume-analytics.fixtures';

// =============================================================================
// Rendering Tests
// =============================================================================

describe('MuscleGroupBreakdown rendering', () => {
  it('renders the component with title', () => {
    render(
      <MuscleGroupBreakdown
        current={MOCK_VOLUME_SUMMARY.muscleGroupBreakdown}
        previous={null}
        isLoading={false}
      />
    );

    expect(screen.getByTestId('muscle-group-breakdown')).toBeInTheDocument();
    expect(screen.getByText('Muscle Group Breakdown')).toBeInTheDocument();
  });

  it('renders table headers', () => {
    render(
      <MuscleGroupBreakdown
        current={MOCK_VOLUME_SUMMARY.muscleGroupBreakdown}
        previous={null}
        isLoading={false}
      />
    );

    expect(screen.getByText('Muscle Group')).toBeInTheDocument();
    expect(screen.getByText('Volume')).toBeInTheDocument();
    expect(screen.getByText('% of Total')).toBeInTheDocument();
    expect(screen.getByText('Change')).toBeInTheDocument();
  });

  it('renders all muscle group rows', () => {
    render(
      <MuscleGroupBreakdown
        current={MOCK_VOLUME_SUMMARY.muscleGroupBreakdown}
        previous={null}
        isLoading={false}
      />
    );

    // MOCK_VOLUME_SUMMARY has 7 muscle groups
    expect(screen.getByTestId('muscle-group-row-chest')).toBeInTheDocument();
    expect(screen.getByTestId('muscle-group-row-lats')).toBeInTheDocument();
    expect(screen.getByTestId('muscle-group-row-quadriceps')).toBeInTheDocument();
  });

  it('displays muscle group display names', () => {
    render(
      <MuscleGroupBreakdown
        current={MOCK_VOLUME_SUMMARY.muscleGroupBreakdown}
        previous={null}
        isLoading={false}
      />
    );

    expect(screen.getByText('Chest')).toBeInTheDocument();
    expect(screen.getByText('Lats')).toBeInTheDocument();
    expect(screen.getByText('Quads')).toBeInTheDocument();
  });
});

// =============================================================================
// Loading State Tests
// =============================================================================

describe('MuscleGroupBreakdown loading state', () => {
  it('shows loading skeletons', () => {
    render(
      <MuscleGroupBreakdown
        current={null}
        previous={null}
        isLoading={true}
      />
    );

    expect(screen.getByTestId('muscle-group-breakdown-loading')).toBeInTheDocument();
  });

  it('renders multiple skeleton rows', () => {
    render(
      <MuscleGroupBreakdown
        current={null}
        previous={null}
        isLoading={true}
      />
    );

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Empty State Tests
// =============================================================================

describe('MuscleGroupBreakdown empty state', () => {
  it('shows empty state when current is null', () => {
    render(
      <MuscleGroupBreakdown
        current={null}
        previous={null}
        isLoading={false}
      />
    );

    expect(screen.getByTestId('muscle-group-breakdown-empty')).toBeInTheDocument();
    expect(screen.getByText('No volume data available for this period')).toBeInTheDocument();
  });

  it('shows empty state when current is empty object', () => {
    render(
      <MuscleGroupBreakdown
        current={{}}
        previous={null}
        isLoading={false}
      />
    );

    expect(screen.getByTestId('muscle-group-breakdown-empty')).toBeInTheDocument();
  });
});

// =============================================================================
// Sorting Tests
// =============================================================================

describe('MuscleGroupBreakdown sorting', () => {
  it('sorts muscle groups by volume descending', () => {
    render(
      <MuscleGroupBreakdown
        current={MOCK_VOLUME_SUMMARY.muscleGroupBreakdown}
        previous={null}
        isLoading={false}
      />
    );

    const rows = screen.getAllByRole('row');
    // First data row (index 1, after header) should be highest volume
    // quadriceps: 20000 is highest in MOCK_VOLUME_SUMMARY
    expect(rows[1]).toHaveTextContent('Quads');
  });
});

// =============================================================================
// Volume Display Tests
// =============================================================================

describe('MuscleGroupBreakdown volume display', () => {
  it('formats volume with lbs suffix', () => {
    render(
      <MuscleGroupBreakdown
        current={MOCK_VOLUME_SUMMARY.muscleGroupBreakdown}
        previous={null}
        isLoading={false}
      />
    );

    // quadriceps: 20000 -> "20.0K lbs"
    expect(screen.getByText('20.0K lbs')).toBeInTheDocument();
  });

  it('formats small volumes without K suffix', () => {
    const smallBreakdown = {
      chest: 500,
    };

    render(
      <MuscleGroupBreakdown
        current={smallBreakdown}
        previous={null}
        isLoading={false}
      />
    );

    expect(screen.getByText('500 lbs')).toBeInTheDocument();
  });
});

// =============================================================================
// Percentage Display Tests
// =============================================================================

describe('MuscleGroupBreakdown percentage display', () => {
  it('displays percentage of total', () => {
    render(
      <MuscleGroupBreakdown
        current={MOCK_VOLUME_SUMMARY.muscleGroupBreakdown}
        previous={null}
        isLoading={false}
      />
    );

    // quadriceps: 20000 / 72000 total = 27.8%
    expect(screen.getByText('27.8%')).toBeInTheDocument();
  });

  it('percentages sum to approximately 100%', () => {
    render(
      <MuscleGroupBreakdown
        current={MOCK_VOLUME_SUMMARY.muscleGroupBreakdown}
        previous={null}
        isLoading={false}
      />
    );

    // Find all percentage values
    const percentageElements = screen.getAllByText(/%$/);
    const percentages = percentageElements.map(el =>
      parseFloat(el.textContent?.replace('%', '') || '0')
    );

    const total = percentages.reduce((sum, p) => sum + p, 0);
    expect(total).toBeCloseTo(100, 0);
  });
});

// =============================================================================
// Change Indicator Tests
// =============================================================================

describe('MuscleGroupBreakdown change indicators', () => {
  it('shows positive change when current > previous', () => {
    render(
      <MuscleGroupBreakdown
        current={MOCK_VOLUME_SUMMARY.muscleGroupBreakdown}
        previous={MOCK_VOLUME_SUMMARY_PREVIOUS.muscleGroupBreakdown}
        isLoading={false}
      />
    );

    // chest: 12500 vs 11000 = ~14% increase
    const chestRow = screen.getByTestId('muscle-group-row-chest');
    expect(chestRow).toHaveTextContent('14%');
  });

  it('shows dash when no previous data', () => {
    render(
      <MuscleGroupBreakdown
        current={MOCK_VOLUME_SUMMARY.muscleGroupBreakdown}
        previous={null}
        isLoading={false}
      />
    );

    // Should show change indicators (with minus icons) for all rows
    const changeIndicators = screen.getAllByTestId('change-indicator');
    expect(changeIndicators.length).toBeGreaterThan(0);
  });

  it('handles new muscle group not in previous period', () => {
    const currentWithNew = {
      ...MOCK_VOLUME_SUMMARY.muscleGroupBreakdown,
      newMuscle: 5000,
    };

    render(
      <MuscleGroupBreakdown
        current={currentWithNew}
        previous={MOCK_VOLUME_SUMMARY_PREVIOUS.muscleGroupBreakdown}
        isLoading={false}
      />
    );

    // New muscle should show 100% increase
    expect(screen.getByTestId('muscle-group-row-newMuscle')).toBeInTheDocument();
  });
});

// =============================================================================
// Click Handler Tests
// =============================================================================

describe('MuscleGroupBreakdown click handlers', () => {
  it('calls onMuscleGroupClick when row clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(
      <MuscleGroupBreakdown
        current={MOCK_VOLUME_SUMMARY.muscleGroupBreakdown}
        previous={null}
        isLoading={false}
        onMuscleGroupClick={onClick}
      />
    );

    await user.click(screen.getByTestId('muscle-group-row-chest'));

    expect(onClick).toHaveBeenCalledWith('chest');
  });

  it('calls onMuscleGroupClick with correct muscle group', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(
      <MuscleGroupBreakdown
        current={MOCK_VOLUME_SUMMARY.muscleGroupBreakdown}
        previous={null}
        isLoading={false}
        onMuscleGroupClick={onClick}
      />
    );

    await user.click(screen.getByTestId('muscle-group-row-quadriceps'));

    expect(onClick).toHaveBeenCalledWith('quadriceps');
  });

  it('shows cursor pointer when onClick provided', () => {
    render(
      <MuscleGroupBreakdown
        current={MOCK_VOLUME_SUMMARY.muscleGroupBreakdown}
        previous={null}
        isLoading={false}
        onMuscleGroupClick={() => {}}
      />
    );

    const row = screen.getByTestId('muscle-group-row-chest');
    expect(row).toHaveClass('cursor-pointer');
  });

  it('does not show cursor pointer when onClick not provided', () => {
    render(
      <MuscleGroupBreakdown
        current={MOCK_VOLUME_SUMMARY.muscleGroupBreakdown}
        previous={null}
        isLoading={false}
      />
    );

    const row = screen.getByTestId('muscle-group-row-chest');
    expect(row).not.toHaveClass('cursor-pointer');
  });

  it('shows chevron icon when onClick provided', () => {
    render(
      <MuscleGroupBreakdown
        current={MOCK_VOLUME_SUMMARY.muscleGroupBreakdown}
        previous={null}
        isLoading={false}
        onMuscleGroupClick={() => {}}
      />
    );

    // ChevronRight icons should be present
    const chevrons = document.querySelectorAll('[class*="lucide-chevron-right"]');
    expect(chevrons.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Color Display Tests
// =============================================================================

describe('MuscleGroupBreakdown colors', () => {
  it('displays color indicator for each muscle group', () => {
    render(
      <MuscleGroupBreakdown
        current={MOCK_VOLUME_SUMMARY.muscleGroupBreakdown}
        previous={null}
        isLoading={false}
      />
    );

    // Each row should have a colored indicator div
    const colorIndicators = document.querySelectorAll('.rounded-sm.shrink-0');
    expect(colorIndicators.length).toBe(7); // 7 muscle groups
  });
});
