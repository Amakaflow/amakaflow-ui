/**
 * Unit tests for ProgramCard calendar functionality.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgramCard } from '../ProgramCard';
import type { TrainingProgram } from '../../types/training-program';

const mockProgram: TrainingProgram = {
  id: 'prog-123',
  user_id: 'user-123',
  name: 'Test Program',
  goal: 'strength',
  periodization_model: 'linear',
  experience_level: 'intermediate',
  duration_weeks: 8,
  sessions_per_week: 4,
  time_per_session_minutes: 60,
  status: 'active',
  current_week: 1,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  started_at: undefined,
  completed_at: undefined,
  archived_at: undefined,
  program_weeks: [],
  sessions: [],
  tags: [],
};

describe('ProgramCard', () => {
  it('renders Add to Calendar as primary button', () => {
    const mockOnAddToCalendar = vi.fn();
    const mockOnViewProgram = vi.fn();

    render(
      <ProgramCard
        program={mockProgram}
        onViewProgram={mockOnViewProgram}
        onAddToCalendar={mockOnAddToCalendar}
        onActivate={vi.fn()}
        onPause={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const addToCalendarButton = screen.getByRole('button', { name: /add to calendar/i });
    expect(addToCalendarButton).toBeInTheDocument();
    // Primary button should not have variant="outline"
    expect(addToCalendarButton).not.toHaveClass(/variant.*outline/);
  });

  it('renders View Plan as secondary button', () => {
    const mockOnAddToCalendar = vi.fn();
    const mockOnViewProgram = vi.fn();

    render(
      <ProgramCard
        program={mockProgram}
        onViewProgram={mockOnViewProgram}
        onAddToCalendar={mockOnAddToCalendar}
        onActivate={vi.fn()}
        onPause={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const viewPlanButton = screen.getByRole('button', { name: /view plan/i });
    expect(viewPlanButton).toBeInTheDocument();
    // Secondary button should have variant="outline" which adds border class
    expect(viewPlanButton).toHaveClass(/border/);
  });

  it('clicking Add to Calendar calls onAddToCalendar with the program', () => {
    const mockOnAddToCalendar = vi.fn();
    const mockOnViewProgram = vi.fn();

    render(
      <ProgramCard
        program={mockProgram}
        onViewProgram={mockOnViewProgram}
        onAddToCalendar={mockOnAddToCalendar}
        onActivate={vi.fn()}
        onPause={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const addToCalendarButton = screen.getByRole('button', { name: /add to calendar/i });
    addToCalendarButton.click();

    expect(mockOnAddToCalendar).toHaveBeenCalledWith(mockProgram);
    expect(mockOnViewProgram).not.toHaveBeenCalled();
  });

  it('clicking View Plan calls onViewProgram with the program id', () => {
    const mockOnAddToCalendar = vi.fn();
    const mockOnViewProgram = vi.fn();

    render(
      <ProgramCard
        program={mockProgram}
        onViewProgram={mockOnViewProgram}
        onAddToCalendar={mockOnAddToCalendar}
        onActivate={vi.fn()}
        onPause={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const viewPlanButton = screen.getByRole('button', { name: /view plan/i });
    viewPlanButton.click();

    expect(mockOnViewProgram).toHaveBeenCalledWith(mockProgram.id);
    expect(mockOnAddToCalendar).not.toHaveBeenCalled();
  });
});
