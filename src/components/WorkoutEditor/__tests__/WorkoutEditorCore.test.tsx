import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { WorkoutEditorCore } from '../WorkoutEditorCore';

const WORKOUT = {
  title: 'My Workout',
  blocks: [
    {
      label: 'Block A',
      exercises: [
        { name: 'Squat', sets: 3, reps: 10 },
        { name: 'Lunge', sets: 3, reps: 12 },
      ],
    },
  ],
};

describe('WorkoutEditorCore', () => {
  it('renders workout title and exercises', () => {
    render(<WorkoutEditorCore initialWorkout={WORKOUT} onChange={() => {}} />);
    expect(screen.getByText('My Workout')).toBeInTheDocument();
    expect(screen.getByText('Squat')).toBeInTheDocument();
    expect(screen.getByText('Lunge')).toBeInTheDocument();
  });

  it('emits rename_workout op when title is changed', () => {
    const onChange = vi.fn();
    render(<WorkoutEditorCore initialWorkout={WORKOUT} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Rename workout'));
    const input = screen.getByDisplayValue('My Workout');
    fireEvent.change(input, { target: { value: 'New Title' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ op: 'rename_workout', title: 'New Title' })]),
      expect.objectContaining({ title: 'New Title' })
    );
  });

  it('emits rename_exercise op when exercise name is changed', () => {
    const onChange = vi.fn();
    render(<WorkoutEditorCore initialWorkout={WORKOUT} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Rename Squat'));
    const input = screen.getByDisplayValue('Squat');
    fireEvent.change(input, { target: { value: 'Goblet Squat' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ op: 'rename_exercise', block_index: 0, exercise_index: 0, name: 'Goblet Squat' })]),
      expect.anything()
    );
  });

  it('emits delete_exercise op when delete button is clicked', () => {
    const onChange = vi.fn();
    render(<WorkoutEditorCore initialWorkout={WORKOUT} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Delete Squat'));

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ op: 'delete_exercise', block_index: 0, exercise_index: 0 })]),
      expect.anything()
    );
  });

  it('accumulates multiple ops', () => {
    const onChange = vi.fn();
    render(<WorkoutEditorCore initialWorkout={WORKOUT} onChange={onChange} />);

    // Rename workout
    fireEvent.click(screen.getByLabelText('Rename workout'));
    const titleInput = screen.getByDisplayValue('My Workout');
    fireEvent.change(titleInput, { target: { value: 'Updated' } });
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    // Delete exercise
    fireEvent.click(screen.getByLabelText('Delete Lunge'));

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(lastCall[0]).toHaveLength(2);
    expect(lastCall[0][0]).toMatchObject({ op: 'rename_workout' });
    expect(lastCall[0][1]).toMatchObject({ op: 'delete_exercise' });
  });
});
