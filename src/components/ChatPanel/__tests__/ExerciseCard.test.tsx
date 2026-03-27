import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExerciseCard } from '../ExerciseCard';

describe('ExerciseCard', () => {
  it('renders exercise name, sets, and reps', () => {
    render(
      <ExerciseCard exercise={{ name: 'Barbell Squat', sets: 4, reps: '8-10', muscle_group: 'quadriceps' }} />
    );
    expect(screen.getByText('Barbell Squat')).toBeInTheDocument();
    expect(screen.getByText('4 sets')).toBeInTheDocument();
    expect(screen.getByText('8-10 reps')).toBeInTheDocument();
    expect(screen.getByText('quadriceps')).toBeInTheDocument();
  });

  it('handles missing optional fields gracefully', () => {
    render(<ExerciseCard exercise={{ name: 'Plank' }} />);
    expect(screen.getByText('Plank')).toBeInTheDocument();
    expect(screen.queryByText('sets')).not.toBeInTheDocument();
  });

  it('renders notes when present', () => {
    render(<ExerciseCard exercise={{ name: 'Squat', notes: 'Keep back straight' }} />);
    expect(screen.getByText('Keep back straight')).toBeInTheDocument();
  });

  it('applies animate-in class when animateIn is true', () => {
    const { container } = render(
      <ExerciseCard exercise={{ name: 'Squat', sets: 3, reps: '10' }} animateIn />
    );
    expect(container.firstChild).toHaveClass('animate-in');
  });
});
