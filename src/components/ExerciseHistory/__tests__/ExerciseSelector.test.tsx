/**
 * Tests for ExerciseSelector component.
 *
 * Part of AMA-481: Build Exercise History Page with 1RM Trends
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExerciseSelector } from '../ExerciseSelector';
import { MOCK_EXERCISES, MOCK_EXERCISES_EMPTY } from './fixtures/exercise-history.fixtures';

// =============================================================================
// Rendering State Tests
// =============================================================================

describe('ExerciseSelector rendering states', () => {
  it('shows loading state when isLoading is true', () => {
    render(
      <ExerciseSelector
        exercises={undefined}
        selectedExerciseId={null}
        onSelect={vi.fn()}
        isLoading={true}
      />
    );

    expect(screen.getByText('Loading exercises...')).toBeInTheDocument();
  });

  it('shows placeholder text when no exercise selected', () => {
    render(
      <ExerciseSelector
        exercises={MOCK_EXERCISES}
        selectedExerciseId={null}
        onSelect={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.getByText('Select an exercise...')).toBeInTheDocument();
  });

  it('shows selected exercise name when exercise is selected', () => {
    render(
      <ExerciseSelector
        exercises={MOCK_EXERCISES}
        selectedExerciseId="barbell-bench-press"
        onSelect={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument();
  });

  it('disables button during loading', () => {
    render(
      <ExerciseSelector
        exercises={undefined}
        selectedExerciseId={null}
        onSelect={vi.fn()}
        isLoading={true}
      />
    );

    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('enables button when not loading', () => {
    render(
      <ExerciseSelector
        exercises={MOCK_EXERCISES}
        selectedExerciseId={null}
        onSelect={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.getByRole('combobox')).not.toBeDisabled();
  });
});

// =============================================================================
// Exercise List Tests
// =============================================================================

describe('ExerciseSelector exercise list', () => {
  it('renders all exercises in dropdown', async () => {
    const user = userEvent.setup();
    render(
      <ExerciseSelector
        exercises={MOCK_EXERCISES}
        selectedExerciseId={null}
        onSelect={vi.fn()}
        isLoading={false}
      />
    );

    await user.click(screen.getByRole('combobox'));

    expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Barbell Squat')).toBeInTheDocument();
    expect(screen.getByText('Conventional Deadlift')).toBeInTheDocument();
    expect(screen.getByText('Overhead Press')).toBeInTheDocument();
  });

  it('shows session count badge for each exercise', async () => {
    const user = userEvent.setup();
    render(
      <ExerciseSelector
        exercises={MOCK_EXERCISES}
        selectedExerciseId={null}
        onSelect={vi.fn()}
        isLoading={false}
      />
    );

    await user.click(screen.getByRole('combobox'));

    // MOCK_EXERCISES has: 15, 12, 8, 1 sessions
    expect(screen.getByText('15 sessions')).toBeInTheDocument();
    expect(screen.getByText('12 sessions')).toBeInTheDocument();
    expect(screen.getByText('8 sessions')).toBeInTheDocument();
    expect(screen.getByText('1 session')).toBeInTheDocument();
  });

  it('pluralizes "session(s)" correctly for single session', async () => {
    const user = userEvent.setup();
    render(
      <ExerciseSelector
        exercises={MOCK_EXERCISES}
        selectedExerciseId={null}
        onSelect={vi.fn()}
        isLoading={false}
      />
    );

    await user.click(screen.getByRole('combobox'));

    // Overhead Press has 1 session - should be singular
    expect(screen.getByText('1 session')).toBeInTheDocument();
    // Others should be plural
    expect(screen.queryByText('1 sessions')).not.toBeInTheDocument();
  });

  it('shows "No exercises found" when list is empty', async () => {
    const user = userEvent.setup();
    render(
      <ExerciseSelector
        exercises={MOCK_EXERCISES_EMPTY}
        selectedExerciseId={null}
        onSelect={vi.fn()}
        isLoading={false}
      />
    );

    await user.click(screen.getByRole('combobox'));

    expect(screen.getByText('No exercises found.')).toBeInTheDocument();
  });

  it('shows "No exercises found" when exercises is undefined', async () => {
    const user = userEvent.setup();
    render(
      <ExerciseSelector
        exercises={undefined}
        selectedExerciseId={null}
        onSelect={vi.fn()}
        isLoading={false}
      />
    );

    await user.click(screen.getByRole('combobox'));

    expect(screen.getByText('No exercises found.')).toBeInTheDocument();
  });
});

// =============================================================================
// Search Functionality Tests
// =============================================================================

describe('ExerciseSelector search functionality', () => {
  it('filters exercises by name on search input', async () => {
    const user = userEvent.setup();
    render(
      <ExerciseSelector
        exercises={MOCK_EXERCISES}
        selectedExerciseId={null}
        onSelect={vi.fn()}
        isLoading={false}
      />
    );

    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Search exercises...'), 'bench');

    // Should show Bench Press, hide others
    expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument();
    expect(screen.queryByText('Barbell Squat')).not.toBeInTheDocument();
    expect(screen.queryByText('Conventional Deadlift')).not.toBeInTheDocument();
  });

  it('search is case-insensitive', async () => {
    const user = userEvent.setup();
    render(
      <ExerciseSelector
        exercises={MOCK_EXERCISES}
        selectedExerciseId={null}
        onSelect={vi.fn()}
        isLoading={false}
      />
    );

    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Search exercises...'), 'BENCH');

    expect(screen.getByText('Barbell Bench Press')).toBeInTheDocument();
  });

  it('shows no results message when search has no matches', async () => {
    const user = userEvent.setup();
    render(
      <ExerciseSelector
        exercises={MOCK_EXERCISES}
        selectedExerciseId={null}
        onSelect={vi.fn()}
        isLoading={false}
      />
    );

    await user.click(screen.getByRole('combobox'));
    await user.type(screen.getByPlaceholderText('Search exercises...'), 'xyz123');

    expect(screen.getByText('No exercises found.')).toBeInTheDocument();
  });

  it('clears search results when input cleared', async () => {
    const user = userEvent.setup();
    render(
      <ExerciseSelector
        exercises={MOCK_EXERCISES}
        selectedExerciseId={null}
        onSelect={vi.fn()}
        isLoading={false}
      />
    );

    await user.click(screen.getByRole('combobox'));
    const searchInput = screen.getByPlaceholderText('Search exercises...');

    // Type to filter
    await user.type(searchInput, 'bench');
    expect(screen.queryByText('Barbell Squat')).not.toBeInTheDocument();

    // Clear to show all
    await user.clear(searchInput);
    expect(screen.getByText('Barbell Squat')).toBeInTheDocument();
  });
});

// =============================================================================
// Selection Behavior Tests
// =============================================================================

describe('ExerciseSelector selection behavior', () => {
  it('calls onSelect with exerciseId when exercise clicked', async () => {
    const mockOnSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <ExerciseSelector
        exercises={MOCK_EXERCISES}
        selectedExerciseId={null}
        onSelect={mockOnSelect}
        isLoading={false}
      />
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Barbell Bench Press'));

    expect(mockOnSelect).toHaveBeenCalledTimes(1);
    expect(mockOnSelect).toHaveBeenCalledWith('barbell-bench-press');
  });

  it('calls onSelect with correct id for different exercises', async () => {
    const mockOnSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <ExerciseSelector
        exercises={MOCK_EXERCISES}
        selectedExerciseId={null}
        onSelect={mockOnSelect}
        isLoading={false}
      />
    );

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByText('Conventional Deadlift'));

    expect(mockOnSelect).toHaveBeenCalledWith('deadlift');
  });

  it('closes popover after selection', async () => {
    const user = userEvent.setup();
    render(
      <ExerciseSelector
        exercises={MOCK_EXERCISES}
        selectedExerciseId={null}
        onSelect={vi.fn()}
        isLoading={false}
      />
    );

    await user.click(screen.getByRole('combobox'));

    // Dropdown should be open
    expect(screen.getByPlaceholderText('Search exercises...')).toBeInTheDocument();

    await user.click(screen.getByText('Barbell Bench Press'));

    // Dropdown should be closed (search input no longer visible)
    expect(screen.queryByPlaceholderText('Search exercises...')).not.toBeInTheDocument();
  });
});

// =============================================================================
// Accessibility Tests
// =============================================================================

describe('ExerciseSelector accessibility', () => {
  it('has combobox role on trigger button', () => {
    render(
      <ExerciseSelector
        exercises={MOCK_EXERCISES}
        selectedExerciseId={null}
        onSelect={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('sets aria-expanded correctly when closed', () => {
    render(
      <ExerciseSelector
        exercises={MOCK_EXERCISES}
        selectedExerciseId={null}
        onSelect={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  it('sets aria-expanded correctly when open', async () => {
    const user = userEvent.setup();
    render(
      <ExerciseSelector
        exercises={MOCK_EXERCISES}
        selectedExerciseId={null}
        onSelect={vi.fn()}
        isLoading={false}
      />
    );

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    // After opening, the trigger should have aria-expanded true
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('has search input with placeholder', async () => {
    const user = userEvent.setup();
    render(
      <ExerciseSelector
        exercises={MOCK_EXERCISES}
        selectedExerciseId={null}
        onSelect={vi.fn()}
        isLoading={false}
      />
    );

    await user.click(screen.getByRole('combobox'));

    expect(screen.getByPlaceholderText('Search exercises...')).toBeInTheDocument();
  });
});

// =============================================================================
// Visual Indicator Tests
// =============================================================================

describe('ExerciseSelector visual indicators', () => {
  it('shows dumbbell icon when exercise selected', () => {
    render(
      <ExerciseSelector
        exercises={MOCK_EXERCISES}
        selectedExerciseId="barbell-bench-press"
        onSelect={vi.fn()}
        isLoading={false}
      />
    );

    // Dumbbell icon should be in the trigger
    const trigger = screen.getByRole('combobox');
    const icon = trigger.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('has correct width styling', () => {
    render(
      <ExerciseSelector
        exercises={MOCK_EXERCISES}
        selectedExerciseId={null}
        onSelect={vi.fn()}
        isLoading={false}
      />
    );

    expect(screen.getByRole('combobox')).toHaveClass('w-[300px]');
  });
});
