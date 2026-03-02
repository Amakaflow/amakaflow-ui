import { render, screen, fireEvent } from '@testing-library/react';
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

function renderExercise(props: Partial<Parameters<typeof SortableExercise>[0]> = {}) {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  render(
    <DndContext>
      <SortableContext items={['ex-1']}>
        <SortableExercise
          exercise={exercise}
          blockIdx={0}
          exerciseIdx={0}
          onEdit={onEdit}
          onDelete={onDelete}
          {...props}
        />
      </SortableContext>
    </DndContext>
  );
  return { onEdit, onDelete };
}

describe('SortableExercise', () => {
  it('renders exercise name', () => {
    renderExercise();
    expect(screen.getByText('Squat')).toBeInTheDocument();
  });

  it('renders exercise sets and reps', () => {
    renderExercise();
    // getDisplayText() joins parts with " • "
    // sets → "3 sets", reps → "10 reps"
    const displayText = screen.getByText(/3 sets/);
    expect(displayText).toBeInTheDocument();
    expect(displayText.textContent).toContain('10 reps');
  });

  it('calls onEdit when the edit button is clicked', () => {
    const { onEdit } = renderExercise();
    // The edit button contains an Edit2 icon; find button by its position
    const buttons = screen.getAllByRole('button');
    // Edit button is the first action button (before delete)
    const editButton = buttons.find(btn => btn.querySelector('svg') && !btn.closest('[title]'));
    // Use the first button that has an svg child (drag handle is a div, not a button)
    // Buttons: collapse (if expanded), edit, delete — here just edit + delete
    fireEvent.click(buttons[buttons.length - 2]);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when the delete button is clicked', () => {
    const { onDelete } = renderExercise();
    const buttons = screen.getAllByRole('button');
    // Delete button is the last button
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('renders duration instead of reps when duration_sec is set', () => {
    const durationExercise: Exercise = {
      ...exercise,
      sets: 3,
      reps: null,
      duration_sec: 90,
    };
    render(
      <DndContext>
        <SortableContext items={['ex-1']}>
          <SortableExercise
            exercise={durationExercise}
            blockIdx={0}
            exerciseIdx={0}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
          />
        </SortableContext>
      </DndContext>
    );
    // 90s = 1m 30s
    expect(screen.getByText(/1m 30s/)).toBeInTheDocument();
  });

  it('renders reps_range when provided instead of fixed reps', () => {
    const rangeExercise: Exercise = {
      ...exercise,
      reps: null,
      reps_range: '8-12',
    };
    render(
      <DndContext>
        <SortableContext items={['ex-1']}>
          <SortableExercise
            exercise={rangeExercise}
            blockIdx={0}
            exerciseIdx={0}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
          />
        </SortableContext>
      </DndContext>
    );
    expect(screen.getByText(/8-12 reps/)).toBeInTheDocument();
  });

  it('renders distance when distance_m is set', () => {
    const distanceExercise: Exercise = {
      ...exercise,
      reps: null,
      distance_m: 400,
    };
    render(
      <DndContext>
        <SortableContext items={['ex-1']}>
          <SortableExercise
            exercise={distanceExercise}
            blockIdx={0}
            exerciseIdx={0}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
          />
        </SortableContext>
      </DndContext>
    );
    expect(screen.getByText(/400m/)).toBeInTheDocument();
  });

  it('does not render display text row when no sets/reps/duration/distance', () => {
    const bareExercise: Exercise = {
      ...exercise,
      sets: null,
      reps: null,
    };
    render(
      <DndContext>
        <SortableContext items={['ex-1']}>
          <SortableExercise
            exercise={bareExercise}
            blockIdx={0}
            exerciseIdx={0}
            onEdit={vi.fn()}
            onDelete={vi.fn()}
          />
        </SortableContext>
      </DndContext>
    );
    // Name is still rendered
    expect(screen.getByText('Squat')).toBeInTheDocument();
    // No secondary text
    expect(screen.queryByText(/sets/)).not.toBeInTheDocument();
    expect(screen.queryByText(/reps/)).not.toBeInTheDocument();
  });
});
