import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SortableExercise } from '../SortableExercise';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { Exercise } from '../../../types/workout';

const exercise: Exercise = {
  id: 'ex-1',
  name: 'Squat',
  sets: 3,
  reps: 10,
  reps_range: null,
  duration_sec: null,
  rest_sec: null,
  distance_m: null,
  distance_range: null,
  type: 'strength',
};

describe('SortableExercise', () => {
  it('renders exercise name', () => {
    render(
      <DndContext>
        <SortableContext items={['ex-1']}>
          <SortableExercise
            exercise={exercise}
            blockIdx={0}
            exerciseIdx={0}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
          />
        </SortableContext>
      </DndContext>
    );
    expect(screen.getByText('Squat')).toBeInTheDocument();
  });
});
