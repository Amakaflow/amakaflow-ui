import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExerciseCardSkeleton } from '../ExerciseCardSkeleton';

describe('ExerciseCardSkeleton', () => {
  it('renders the specified number of skeleton cards', () => {
    render(<ExerciseCardSkeleton count={3} />);
    expect(screen.getAllByTestId('exercise-card-skeleton')).toHaveLength(3);
  });

  it('defaults to 3 skeletons', () => {
    render(<ExerciseCardSkeleton />);
    expect(screen.getAllByTestId('exercise-card-skeleton')).toHaveLength(3);
  });

  it('renders specified count', () => {
    render(<ExerciseCardSkeleton count={5} />);
    expect(screen.getAllByTestId('exercise-card-skeleton')).toHaveLength(5);
  });
});
