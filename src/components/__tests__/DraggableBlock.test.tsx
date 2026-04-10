import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { StructureWorkout } from '../StructureWorkout';
import type { WorkoutStructure } from '../../types/workout';

// Minimal workout for rendering StructureWorkout
function makeWorkout(blockOverrides: object = {}): WorkoutStructure {
  return {
    title: 'Test Workout',
    source: 'test',
    blocks: [{
      id: 'b1',
      label: 'Main Block',
      structure: 'circuit',
      rounds: 4,
      rest_between_rounds_sec: 30,
      exercises: [{ id: 'e1', name: 'Burpees', sets: null, reps: 10, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, type: 'cardio' }],
      ...blockOverrides,
    }],
  };
}

const defaultProps = {
  onWorkoutChange: vi.fn(),
  onAutoMap: vi.fn(),
  onValidate: vi.fn(),
  loading: false,
  selectedDevice: 'ios_companion' as const,
  onDeviceChange: vi.fn(),
  userSelectedDevices: ['ios_companion'],
};

function renderWorkout(workout: WorkoutStructure) {
  return render(
    <DndProvider backend={HTML5Backend}>
      <StructureWorkout workout={workout} {...defaultProps} />
    </DndProvider>
  );
}

describe('DraggableBlock', () => {
  it('renders workout title', () => {
    renderWorkout(makeWorkout());
    expect(screen.getByText('Test Workout')).toBeInTheDocument();
  });

  it('config row is hidden initially', () => {
    renderWorkout(makeWorkout({ structure: 'circuit', rounds: 4 }));
    expect(screen.queryByText('Rounds')).not.toBeInTheDocument();
  });
});
