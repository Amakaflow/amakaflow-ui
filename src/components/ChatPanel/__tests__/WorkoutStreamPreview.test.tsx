import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkoutStreamPreview } from '../WorkoutStreamPreview';
import type { GeneratedWorkout, WorkoutSearchResults } from '../../../types/chat';

describe('WorkoutStreamPreview', () => {
  it('shows skeleton loaders when isGenerating is true and no data', () => {
    render(<WorkoutStreamPreview isGenerating />);
    expect(screen.getAllByTestId('exercise-card-skeleton').length).toBeGreaterThan(0);
    expect(screen.getByTestId('workout-stream-preview')).toBeInTheDocument();
  });

  it('renders exercise cards when workout data is provided', () => {
    const workout: GeneratedWorkout = {
      type: 'workout_generated',
      workout: {
        name: 'Leg Day',
        exercises: [
          { name: 'Squat', sets: 4, reps: '8-10' },
          { name: 'Lunge', sets: 3, reps: '12' },
        ],
      },
    };
    render(<WorkoutStreamPreview workoutData={workout} />);
    expect(screen.getByText('Leg Day')).toBeInTheDocument();
    expect(screen.getAllByTestId('exercise-card')).toHaveLength(2);
    expect(screen.getByText('Squat')).toBeInTheDocument();
    expect(screen.getByText('Lunge')).toBeInTheDocument();
  });

  it('renders workout metadata (duration and difficulty)', () => {
    const workout: GeneratedWorkout = {
      type: 'workout_generated',
      workout: {
        name: 'HIIT',
        exercises: [{ name: 'Burpees' }],
        duration_minutes: 30,
        difficulty: 'advanced',
      },
    };
    render(<WorkoutStreamPreview workoutData={workout} />);
    expect(screen.getByText('30 min')).toBeInTheDocument();
    expect(screen.getByText(/advanced/i)).toBeInTheDocument();
  });

  it('renders search result cards', () => {
    const results: WorkoutSearchResults = {
      type: 'search_results',
      workouts: [
        { workout_id: 'w1', title: 'Push Day', exercise_count: 6, duration_minutes: 45 },
      ],
    };
    render(<WorkoutStreamPreview searchResults={results} />);
    expect(screen.getByText('Push Day')).toBeInTheDocument();
    expect(screen.getByText('6 exercises')).toBeInTheDocument();
    expect(screen.getByText('45 min')).toBeInTheDocument();
  });

  it('shows nothing when not generating and no data', () => {
    const { container } = render(<WorkoutStreamPreview />);
    expect(container.firstChild).toBeNull();
  });
});
