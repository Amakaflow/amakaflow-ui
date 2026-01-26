/**
 * WorkoutCard Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkoutCard, RestDayCell } from '../WorkoutCard';
import {
  mockWorkout,
  mockCompletedWorkout,
} from '../../../test/fixtures/program-detail.fixtures';

describe('WorkoutCard', () => {
  const mockOnClick = vi.fn();

  const defaultProps = {
    workout: mockWorkout,
    onClick: mockOnClick,
    isSelected: false,
  };

  beforeEach(() => {
    mockOnClick.mockClear();
  });

  describe('Rendering', () => {
    it('should render workout name', () => {
      render(<WorkoutCard {...defaultProps} />);
      expect(screen.getByText(mockWorkout.name)).toBeInTheDocument();
    });

    it('should render workout type badge', () => {
      render(<WorkoutCard {...defaultProps} />);
      expect(screen.getByText('legs')).toBeInTheDocument();
    });

    it('should render exercise count', () => {
      render(<WorkoutCard {...defaultProps} />);
      expect(screen.getByText(/4 exercises/)).toBeInTheDocument();
    });

    it('should render singular exercise text for single exercise', () => {
      const singleExerciseWorkout = {
        ...mockWorkout,
        exercises: [mockWorkout.exercises[0]],
      };
      render(<WorkoutCard {...defaultProps} workout={singleExerciseWorkout} />);
      expect(screen.getByText(/1 exercise$/)).toBeInTheDocument();
    });

    it('should render duration when present', () => {
      render(<WorkoutCard {...defaultProps} />);
      expect(screen.getByText(`${mockWorkout.target_duration_minutes} min`)).toBeInTheDocument();
    });

    it('should not render duration when not present', () => {
      const workoutWithoutDuration = {
        ...mockWorkout,
        target_duration_minutes: undefined,
      };
      render(<WorkoutCard {...defaultProps} workout={workoutWithoutDuration} />);
      expect(screen.queryByText(/min$/)).not.toBeInTheDocument();
    });
  });

  describe('Completion Status', () => {
    it('should show completion checkmark for completed workouts', () => {
      render(<WorkoutCard {...defaultProps} workout={mockCompletedWorkout} />);
      // Check for the green checkmark container
      const checkmark = document.querySelector('.bg-green-500');
      expect(checkmark).toBeInTheDocument();
    });

    it('should not show completion checkmark for incomplete workouts', () => {
      render(<WorkoutCard {...defaultProps} />);
      const checkmark = document.querySelector('.bg-green-500');
      expect(checkmark).not.toBeInTheDocument();
    });

    it('should apply muted styling to completed workouts', () => {
      render(<WorkoutCard {...defaultProps} workout={mockCompletedWorkout} />);
      const card = screen.getByText(mockCompletedWorkout.name).closest('.p-3');
      expect(card).toHaveClass('bg-muted/50');
    });
  });

  describe('Selection State', () => {
    it('should apply ring styling when selected', () => {
      render(<WorkoutCard {...defaultProps} isSelected={true} />);
      const card = screen.getByText(mockWorkout.name).closest('.p-3');
      expect(card).toHaveClass('ring-2');
      expect(card).toHaveClass('ring-primary');
    });

    it('should not apply ring styling when not selected', () => {
      render(<WorkoutCard {...defaultProps} isSelected={false} />);
      const card = screen.getByText(mockWorkout.name).closest('.p-3');
      expect(card).not.toHaveClass('ring-2');
    });
  });

  describe('Interaction', () => {
    it('should call onClick when card is clicked', () => {
      render(<WorkoutCard {...defaultProps} />);

      const card = screen.getByText(mockWorkout.name).closest('.p-3');
      fireEvent.click(card!);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should have cursor-pointer class', () => {
      render(<WorkoutCard {...defaultProps} />);
      const card = screen.getByText(mockWorkout.name).closest('.p-3');
      expect(card).toHaveClass('cursor-pointer');
    });
  });

  describe('Keyboard Accessibility', () => {
    it('should have role="button" for screen readers', () => {
      render(<WorkoutCard {...defaultProps} />);
      const card = screen.getByRole('button', { name: mockWorkout.name });
      expect(card).toBeInTheDocument();
    });

    it('should have tabIndex=0 for keyboard focus', () => {
      render(<WorkoutCard {...defaultProps} />);
      const card = screen.getByRole('button', { name: mockWorkout.name });
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('should call onClick when Enter key is pressed', () => {
      render(<WorkoutCard {...defaultProps} />);
      const card = screen.getByRole('button', { name: mockWorkout.name });
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick when Space key is pressed', () => {
      render(<WorkoutCard {...defaultProps} />);
      const card = screen.getByRole('button', { name: mockWorkout.name });
      fireEvent.keyDown(card, { key: ' ' });
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick for other keys', () => {
      render(<WorkoutCard {...defaultProps} />);
      const card = screen.getByRole('button', { name: mockWorkout.name });
      fireEvent.keyDown(card, { key: 'Tab' });
      expect(mockOnClick).not.toHaveBeenCalled();
    });

    it('should include completion status in aria-label', () => {
      render(<WorkoutCard {...defaultProps} workout={mockCompletedWorkout} />);
      const card = screen.getByRole('button', { name: /completed/ });
      expect(card).toBeInTheDocument();
    });
  });

  describe('Workout Types', () => {
    it('should render push workout type', () => {
      const pushWorkout = { ...mockWorkout, workout_type: 'push' };
      render(<WorkoutCard {...defaultProps} workout={pushWorkout} />);
      expect(screen.getByText('push')).toBeInTheDocument();
    });

    it('should render pull workout type', () => {
      const pullWorkout = { ...mockWorkout, workout_type: 'pull' };
      render(<WorkoutCard {...defaultProps} workout={pullWorkout} />);
      expect(screen.getByText('pull')).toBeInTheDocument();
    });

    it('should render full body workout type with underscore replaced', () => {
      const fullBodyWorkout = { ...mockWorkout, workout_type: 'full_body' };
      render(<WorkoutCard {...defaultProps} workout={fullBodyWorkout} />);
      expect(screen.getByText('full body')).toBeInTheDocument();
    });
  });
});

describe('RestDayCell', () => {
  it('should render rest day text', () => {
    render(<RestDayCell />);
    expect(screen.getByText('Rest Day')).toBeInTheDocument();
  });

  it('should have dashed border styling', () => {
    render(<RestDayCell />);
    const cell = screen.getByText('Rest Day').closest('div');
    expect(cell).toHaveClass('border-dashed');
  });

  it('should have minimum height', () => {
    render(<RestDayCell />);
    const cell = screen.getByText('Rest Day').closest('div');
    expect(cell).toHaveClass('min-h-[100px]');
  });
});
