import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { StructureWorkout } from '../StructureWorkout';
import type { WorkoutStructure } from '../../types/workout';

const defaultProps = {
  onWorkoutChange: vi.fn(),
  onAutoMap: vi.fn(),
  onValidate: vi.fn(),
  loading: false,
  selectedDevice: 'ios_companion' as const,
  onDeviceChange: vi.fn(),
  userSelectedDevices: ['ios_companion'],
};

function renderSW(workout: WorkoutStructure) {
  return render(
    <DndProvider backend={HTML5Backend}>
      <StructureWorkout workout={workout} {...defaultProps} />
    </DndProvider>
  );
}

describe('StructureWorkout integration', () => {
  it('shows warmup suggestion strip when no warmup block', () => {
    renderSW({ title: 'Test', source: 'test', blocks: [
      { id: 'b1', label: 'Main', structure: 'circuit', rounds: 3, exercises: [] }
    ]});
    expect(screen.getByText(/no warm-up found/i)).toBeInTheDocument();
  });

  it('does not show warmup strip when warmup block exists', () => {
    renderSW({ title: 'Test', source: 'test', blocks: [
      { id: 'b0', label: 'Warm-up', structure: 'warmup', warmup_duration_sec: 300, warmup_activity: 'jump_rope', exercises: [] },
      { id: 'b1', label: 'Main', structure: 'circuit', rounds: 3, exercises: [] }
    ]});
    expect(screen.queryByText(/no warm-up found/i)).not.toBeInTheDocument();
  });

  it('hides warmup strip after skip clicked', () => {
    renderSW({ title: 'Test', source: 'test', blocks: [
      { id: 'b1', label: 'Main', structure: 'circuit', rounds: 3, exercises: [] }
    ]});
    fireEvent.click(screen.getAllByRole('button', { name: /skip/i })[0]);
    expect(screen.queryByText(/no warm-up found/i)).not.toBeInTheDocument();
  });

  it('auto-migrates legacy workoutWarmup setting to warmup block', () => {
    const onWorkoutChange = vi.fn();
    render(
      <DndProvider backend={HTML5Backend}>
        <StructureWorkout
          workout={{
            title: 'Test', source: 'test',
            settings: { defaultRestType: 'timed', defaultRestSec: 30, workoutWarmup: { enabled: true, activity: 'jump_rope', durationSec: 300 } },
            blocks: [{ id: 'b1', label: 'Main', structure: 'circuit', rounds: 3, exercises: [] }],
          }}
          {...defaultProps}
          onWorkoutChange={onWorkoutChange}
        />
      </DndProvider>
    );
    // Auto-migration fires onWorkoutChange with warmup block prepended
    expect(onWorkoutChange).toHaveBeenCalledWith(
      expect.objectContaining({
        blocks: expect.arrayContaining([
          expect.objectContaining({ structure: 'warmup', warmup_activity: 'jump_rope' })
        ])
      })
    );
  });

  it('shows AddBlockTypePicker when + Add Block clicked', () => {
    renderSW({ title: 'Test', source: 'test', blocks: [] });
    fireEvent.click(screen.getByRole('button', { name: /add block/i }));
    expect(screen.getByText('Circuit')).toBeInTheDocument();
    expect(screen.getByText('EMOM')).toBeInTheDocument();
  });

  it('shows default rest banner when rest is configured', () => {
    renderSW({
      title: 'Test', source: 'test',
      settings: { defaultRestType: 'timed', defaultRestSec: 60 },
      blocks: [{ id: 'b1', label: 'Main', structure: 'circuit', rounds: 3, exercises: [] }],
    });
    expect(screen.getByText(/default rest/i)).toBeInTheDocument();
    expect(screen.getByText(/60s/)).toBeInTheDocument();
  });
});
