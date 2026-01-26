/**
 * WeeklyCalendar Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeeklyCalendar } from '../WeeklyCalendar';
import {
  mockTrainingProgram,
  mockWorkout,
  mockCompletedWorkout,
} from '../../../test/fixtures/program-detail.fixtures';

describe('WeeklyCalendar', () => {
  const mockOnSelectWeek = vi.fn();
  const mockOnSelectWorkout = vi.fn();

  const defaultProps = {
    program: mockTrainingProgram,
    selectedWeekNumber: 1,
    selectedWorkout: null,
    onSelectWeek: mockOnSelectWeek,
    onSelectWorkout: mockOnSelectWorkout,
  };

  beforeEach(() => {
    mockOnSelectWeek.mockClear();
    mockOnSelectWorkout.mockClear();
  });

  describe('Week Tabs', () => {
    it('should render week tabs for all weeks', () => {
      render(<WeeklyCalendar {...defaultProps} />);

      expect(screen.getByText('Week 1')).toBeInTheDocument();
      expect(screen.getByText('Week 2')).toBeInTheDocument();
      expect(screen.getByText('Week 4')).toBeInTheDocument(); // deload week
    });

    it('should highlight selected week', () => {
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={1} />);

      const weekTab = screen.getByText('Week 1').closest('button');
      expect(weekTab).toHaveClass('bg-primary');
    });

    it('should call onSelectWeek when week tab is clicked', () => {
      render(<WeeklyCalendar {...defaultProps} />);

      const week2Tab = screen.getByText('Week 2').closest('button');
      fireEvent.click(week2Tab!);

      expect(mockOnSelectWeek).toHaveBeenCalledWith(2);
    });

    it('should show workout completion count in tabs', () => {
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={1} />);

      // Week 1 has 3 workouts, 1 completed (mockCompletedWorkout)
      expect(screen.getByText('1/3')).toBeInTheDocument();
    });

    it('should show deload indicator on deload weeks', () => {
      render(<WeeklyCalendar {...defaultProps} />);

      // Week 4 is deload - should have a Zap icon
      const week4Tab = screen.getByText('Week 4').closest('button');
      expect(week4Tab?.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Week Navigation', () => {
    it('should have previous week button', () => {
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={2} />);

      const buttons = screen.getAllByRole('button');
      const prevButton = buttons.find((btn) => btn.querySelector('.lucide-chevron-left'));
      expect(prevButton).toBeInTheDocument();
    });

    it('should have next week button', () => {
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={1} />);

      const buttons = screen.getAllByRole('button');
      const nextButton = buttons.find((btn) => btn.querySelector('.lucide-chevron-right'));
      expect(nextButton).toBeInTheDocument();
    });

    it('should disable previous button on first week', () => {
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={1} />);

      const buttons = screen.getAllByRole('button');
      const prevButton = buttons.find((btn) => btn.querySelector('.lucide-chevron-left'));
      expect(prevButton).toBeDisabled();
    });

    it('should disable next button on last week', () => {
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={8} />);

      const buttons = screen.getAllByRole('button');
      const nextButton = buttons.find((btn) => btn.querySelector('.lucide-chevron-right'));
      expect(nextButton).toBeDisabled();
    });

    it('should call onSelectWeek with previous week number', () => {
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={2} />);

      const buttons = screen.getAllByRole('button');
      const prevButton = buttons.find((btn) => btn.querySelector('.lucide-chevron-left'));
      fireEvent.click(prevButton!);

      expect(mockOnSelectWeek).toHaveBeenCalledWith(1);
    });

    it('should call onSelectWeek with next week number', () => {
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={1} />);

      const buttons = screen.getAllByRole('button');
      const nextButton = buttons.find((btn) => btn.querySelector('.lucide-chevron-right'));
      fireEvent.click(nextButton!);

      expect(mockOnSelectWeek).toHaveBeenCalledWith(2);
    });
  });

  describe('Week Info Bar', () => {
    it('should show week focus when present', () => {
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={1} />);
      expect(screen.getByText(/Focus: Hypertrophy/)).toBeInTheDocument();
    });

    it('should show intensity percentage when present', () => {
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={1} />);
      expect(screen.getByText('70% Intensity')).toBeInTheDocument();
    });

    it('should show deload badge for deload weeks', () => {
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={4} />);
      expect(screen.getByText('Deload Week')).toBeInTheDocument();
    });

    it('should show volume modifier when not 100%', () => {
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={4} />);
      expect(screen.getByText(/Volume: 50%/)).toBeInTheDocument();
    });
  });

  describe('Day Grid', () => {
    it('should render day headers', () => {
      render(<WeeklyCalendar {...defaultProps} />);

      expect(screen.getByText('Sun')).toBeInTheDocument();
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Tue')).toBeInTheDocument();
      expect(screen.getByText('Wed')).toBeInTheDocument();
      expect(screen.getByText('Thu')).toBeInTheDocument();
      expect(screen.getByText('Fri')).toBeInTheDocument();
      expect(screen.getByText('Sat')).toBeInTheDocument();
    });

    it('should render workout cards on scheduled days', () => {
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={1} />);

      // Week 1 has workouts on Monday, Wednesday, Friday
      expect(screen.getByText('Lower Body Strength')).toBeInTheDocument();
      expect(screen.getByText('Upper Body Push')).toBeInTheDocument();
      expect(screen.getByText('Upper Body Pull')).toBeInTheDocument();
    });

    it('should render rest day cells for unscheduled days', () => {
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={1} />);

      // Should have rest day cells for Sun, Tue, Thu, Sat (4 days)
      const restDays = screen.getAllByText('Rest Day');
      expect(restDays.length).toBe(4);
    });

    it('should call onSelectWorkout when workout card is clicked', () => {
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={1} />);

      const workoutCard = screen.getByText('Lower Body Strength');
      fireEvent.click(workoutCard);

      expect(mockOnSelectWorkout).toHaveBeenCalled();
    });
  });

  describe('Selected Workout', () => {
    it('should highlight selected workout', () => {
      render(
        <WeeklyCalendar
          {...defaultProps}
          selectedWeekNumber={1}
          selectedWorkout={mockWorkout}
        />
      );

      // The selected card should have ring styling (via WorkoutCard)
      const workoutCard = screen.getByText(mockWorkout.name).closest('.p-3');
      expect(workoutCard).toHaveClass('ring-2');
    });
  });

  describe('ARIA Accessibility', () => {
    it('should have tablist role on week tabs container', () => {
      render(<WeeklyCalendar {...defaultProps} />);
      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();
      expect(tablist).toHaveAttribute('aria-label', 'Program weeks');
    });

    it('should have tab role on each week tab', () => {
      render(<WeeklyCalendar {...defaultProps} />);
      const tabs = screen.getAllByRole('tab');
      // Should have tabs for weeks 1, 2, and 4 (from mockTrainingProgram)
      expect(tabs.length).toBe(3);
    });

    it('should have aria-selected on selected week tab', () => {
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={1} />);
      const tabs = screen.getAllByRole('tab');
      const selectedTab = tabs.find(tab => tab.getAttribute('aria-selected') === 'true');
      expect(selectedTab).toHaveTextContent('Week 1');
    });

    it('should have aria-selected=false on non-selected tabs', () => {
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={1} />);
      const tabs = screen.getAllByRole('tab');
      const nonSelectedTabs = tabs.filter(tab => tab.getAttribute('aria-selected') === 'false');
      expect(nonSelectedTabs.length).toBe(2);
    });

    it('should have tabpanel for week content', () => {
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={1} />);
      const tabpanel = screen.getByRole('tabpanel');
      expect(tabpanel).toBeInTheDocument();
    });

    it('should have aria-controls linking tab to panel', () => {
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={1} />);
      const tabs = screen.getAllByRole('tab');
      const selectedTab = tabs.find(tab => tab.getAttribute('aria-selected') === 'true');
      expect(selectedTab).toHaveAttribute('aria-controls', 'week-panel-1');
    });

    it('should have aria-labels on navigation buttons', () => {
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={2} />);
      expect(screen.getByRole('button', { name: 'Previous week' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next week' })).toBeInTheDocument();
    });
  });

  describe('Week Navigation Boundary', () => {
    it('should disable next button based on actual weeks array length', () => {
      // mockTrainingProgram has duration_weeks=8 but only 3 weeks in array
      // Week 4 is the last week in the array (week_number=4)
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={4} />);

      const buttons = screen.getAllByRole('button');
      const nextButton = buttons.find((btn) => btn.querySelector('.lucide-chevron-right'));
      expect(nextButton).toBeDisabled();
    });

    it('should enable next button when more weeks exist', () => {
      // Week 1 has weeks 2 and 4 after it
      render(<WeeklyCalendar {...defaultProps} selectedWeekNumber={1} />);

      const buttons = screen.getAllByRole('button');
      const nextButton = buttons.find((btn) => btn.querySelector('.lucide-chevron-right'));
      expect(nextButton).not.toBeDisabled();
    });
  });
});
