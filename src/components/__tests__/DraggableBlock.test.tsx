import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('DraggableBlock type-first header', () => {
  it('shows CIRCUIT type badge', () => {
    renderWorkout(makeWorkout({ structure: 'circuit', rounds: 4 }));
    expect(screen.getByText('CIRCUIT')).toBeInTheDocument();
  });

  it('shows key metric in header for circuit', () => {
    renderWorkout(makeWorkout({ structure: 'circuit', rounds: 4, rest_between_rounds_sec: 30 }));
    expect(screen.getByText('4 rnds · 30s rest')).toBeInTheDocument();
  });

  it('config row is hidden initially', () => {
    renderWorkout(makeWorkout({ structure: 'circuit', rounds: 4 }));
    expect(screen.queryByText('Rounds')).not.toBeInTheDocument();
  });

  it('config row shows when configure button is clicked', () => {
    renderWorkout(makeWorkout({ structure: 'circuit', rounds: 4, rest_between_rounds_sec: 30 }));
    const configBtn = screen.getByRole('button', { name: /configure/i });
    fireEvent.click(configBtn);
    expect(screen.getByText('Rounds')).toBeInTheDocument();
  });

  it('shows EMOM badge and cap metric', () => {
    renderWorkout(makeWorkout({ structure: 'emom', rounds: 12, time_work_sec: 40 }));
    expect(screen.getByText('EMOM')).toBeInTheDocument();
    expect(screen.getByText('12 min · 40s/station')).toBeInTheDocument();
  });
});
