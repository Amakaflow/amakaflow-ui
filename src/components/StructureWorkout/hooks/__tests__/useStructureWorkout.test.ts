import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useStructureWorkout } from '../useStructureWorkout';
import type { WorkoutStructure } from '../../../../types/workout';

const makeWorkout = (): WorkoutStructure => ({
  title: 'Test Workout',
  source: 'test',
  blocks: [
    {
      id: 'block-1',
      label: 'Block 1',
      structure: 'regular',
      exercises: [
        {
          id: 'ex-1',
          name: 'Squat',
          sets: 3,
          reps: 10,
          reps_range: null,
          duration_sec: null,
          rest_sec: 60,
          distance_m: null,
          distance_range: null,
          type: 'strength',
        },
        {
          id: 'ex-2',
          name: 'Deadlift',
          sets: 3,
          reps: 5,
          reps_range: null,
          duration_sec: null,
          rest_sec: 90,
          distance_m: null,
          distance_range: null,
          type: 'strength',
        },
      ],
    },
  ],
});

describe('useStructureWorkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initialises with all state false/null', () => {
    const workout = makeWorkout();
    const onWorkoutChange = vi.fn();

    const { result } = renderHook(() =>
      useStructureWorkout({
        workout,
        onWorkoutChange,
      })
    );

    expect(result.current.showWorkoutSettings).toBe(false);
    expect(result.current.editingExercise).toBeNull();
    expect(result.current.editingBlockIdx).toBeNull();
    expect(result.current.showExerciseSearch).toBe(false);
    expect(result.current.addingToBlock).toBeNull();
    expect(result.current.addingToSuperset).toBeNull();
    expect(result.current.collapseSignal).toBeUndefined();
    expect(result.current.jsonCopied).toBe(false);
    expect(result.current.showAddBlockPicker).toBe(false);
    expect(result.current.skippedWarmup).toBe(false);
    expect(result.current.skippedCooldown).toBe(false);
    expect(result.current.skippedRest).toBe(false);
    expect(result.current.activeDragItem).toBeNull();
  });

  it('updateExercise calls onWorkoutChange with updated exercise', () => {
    const workout = makeWorkout();
    const onWorkoutChange = vi.fn();

    const { result } = renderHook(() =>
      useStructureWorkout({
        workout,
        onWorkoutChange,
      })
    );

    act(() => {
      result.current.updateExercise(0, 0, { name: 'Updated Squat', reps: 15 });
    });

    expect(onWorkoutChange).toHaveBeenCalledTimes(1);
    const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
    expect(updated.blocks[0].exercises[0].name).toBe('Updated Squat');
    expect(updated.blocks[0].exercises[0].reps).toBe(15);
    // Other exercises should be unchanged
    expect(updated.blocks[0].exercises[1].name).toBe('Deadlift');
  });

  it('updateExercise in superset calls onWorkoutChange with correct update', () => {
    const workout: WorkoutStructure = {
      title: 'Test',
      source: 'test',
      blocks: [
        {
          id: 'block-1',
          label: 'Block 1',
          structure: 'superset',
          exercises: [],
          supersets: [
            {
              id: 'ss-1',
              exercises: [
                {
                  id: 'ex-ss-1',
                  name: 'Pull-up',
                  sets: 3,
                  reps: 8,
                  reps_range: null,
                  duration_sec: null,
                  rest_sec: null,
                  distance_m: null,
                  distance_range: null,
                  type: 'strength',
                },
              ],
            },
          ],
        },
      ],
    };
    const onWorkoutChange = vi.fn();

    const { result } = renderHook(() =>
      useStructureWorkout({
        workout,
        onWorkoutChange,
      })
    );

    act(() => {
      result.current.updateExercise(0, 0, { reps: 12 }, 0);
    });

    expect(onWorkoutChange).toHaveBeenCalledTimes(1);
    const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
    expect(updated.blocks[0].supersets![0].exercises[0].reps).toBe(12);
  });

  it('deleteExercise calls onWorkoutChange with exercise removed', () => {
    const workout = makeWorkout();
    const onWorkoutChange = vi.fn();

    const { result } = renderHook(() =>
      useStructureWorkout({
        workout,
        onWorkoutChange,
      })
    );

    act(() => {
      result.current.deleteExercise(0, 0);
    });

    expect(onWorkoutChange).toHaveBeenCalledTimes(1);
    const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
    expect(updated.blocks[0].exercises).toHaveLength(1);
    expect(updated.blocks[0].exercises[0].name).toBe('Deadlift');
  });

  it('addBlock calls onWorkoutChange with new block appended', () => {
    const workout = makeWorkout();
    const onWorkoutChange = vi.fn();

    const { result } = renderHook(() =>
      useStructureWorkout({
        workout,
        onWorkoutChange,
      })
    );

    act(() => {
      result.current.addBlock('circuit');
    });

    expect(onWorkoutChange).toHaveBeenCalledTimes(1);
    const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
    expect(updated.blocks).toHaveLength(2);
    expect(updated.blocks[1].structure).toBe('circuit');
    expect(updated.blocks[1].exercises).toEqual([]);
    expect(typeof updated.blocks[1].id).toBe('string');
  });

  it('addBlock with no structure creates generic block with sequential label', () => {
    const workout = makeWorkout();
    const onWorkoutChange = vi.fn();

    const { result } = renderHook(() =>
      useStructureWorkout({
        workout,
        onWorkoutChange,
      })
    );

    act(() => {
      result.current.addBlock();
    });

    expect(onWorkoutChange).toHaveBeenCalledTimes(1);
    const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
    expect(updated.blocks).toHaveLength(2);
    expect(updated.blocks[1].label).toBe('Block 2');
    expect(updated.blocks[1].structure).toBeNull();
  });

  it('deleteBlock calls onWorkoutChange with block removed', () => {
    const workout = makeWorkout();
    const onWorkoutChange = vi.fn();

    const { result } = renderHook(() =>
      useStructureWorkout({
        workout,
        onWorkoutChange,
      })
    );

    act(() => {
      result.current.deleteBlock(0);
    });

    expect(onWorkoutChange).toHaveBeenCalledTimes(1);
    const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
    expect(updated.blocks).toHaveLength(0);
  });

  it('collapseAll sets collapseSignal action to collapse', () => {
    const workout = makeWorkout();
    const onWorkoutChange = vi.fn();

    const { result } = renderHook(() =>
      useStructureWorkout({
        workout,
        onWorkoutChange,
      })
    );

    act(() => {
      result.current.setCollapseSignal({ action: 'collapse', timestamp: Date.now() });
    });

    expect(result.current.collapseSignal?.action).toBe('collapse');
    expect(typeof result.current.collapseSignal?.timestamp).toBe('number');
  });

  it('expandAll sets collapseSignal action to expand', () => {
    const workout = makeWorkout();
    const onWorkoutChange = vi.fn();

    const { result } = renderHook(() =>
      useStructureWorkout({
        workout,
        onWorkoutChange,
      })
    );

    act(() => {
      result.current.setCollapseSignal({ action: 'expand', timestamp: Date.now() });
    });

    expect(result.current.collapseSignal?.action).toBe('expand');
    expect(typeof result.current.collapseSignal?.timestamp).toBe('number');
  });

  it('workoutWithIds returns the workout with IDs when all IDs present', () => {
    const workout = makeWorkout();
    const onWorkoutChange = vi.fn();

    const { result } = renderHook(() =>
      useStructureWorkout({
        workout,
        onWorkoutChange,
      })
    );

    // All IDs are already present in makeWorkout(), so it returns the same workout
    expect(result.current.workoutWithIds.title).toBe('Test Workout');
    expect(result.current.workoutWithIds.blocks).toHaveLength(1);
    expect(result.current.workoutWithIds.blocks[0].id).toBe('block-1');
  });

  it('workoutWithIds adds IDs when workout blocks are missing them', () => {
    const workout: WorkoutStructure = {
      title: 'No IDs',
      source: 'test',
      blocks: [
        {
          label: 'Block 1',
          structure: 'regular',
          exercises: [
            {
              name: 'Squat',
              sets: 3,
              reps: 10,
              reps_range: null,
              duration_sec: null,
              rest_sec: 60,
              distance_m: null,
              distance_range: null,
              type: 'strength',
            } as any, // no id
          ],
        } as any, // no id
      ],
    };
    const onWorkoutChange = vi.fn();

    const { result } = renderHook(() =>
      useStructureWorkout({
        workout,
        onWorkoutChange,
      })
    );

    expect(typeof result.current.workoutWithIds.blocks[0].id).toBe('string');
    expect(result.current.workoutWithIds.blocks[0].id).toBeTruthy();
    expect(typeof result.current.workoutWithIds.blocks[0].exercises[0].id).toBe('string');
  });

  it('updateBlock calls onWorkoutChange with updated block fields', () => {
    const workout = makeWorkout();
    const onWorkoutChange = vi.fn();

    const { result } = renderHook(() =>
      useStructureWorkout({
        workout,
        onWorkoutChange,
      })
    );

    act(() => {
      result.current.updateBlock(0, { label: 'Updated Block', rounds: 5 });
    });

    expect(onWorkoutChange).toHaveBeenCalledTimes(1);
    const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
    expect(updated.blocks[0].label).toBe('Updated Block');
    expect(updated.blocks[0].rounds).toBe(5);
  });

  it('handleWorkoutSettingsSave calls onWorkoutChange with updated title and settings', () => {
    const workout = makeWorkout();
    const onWorkoutChange = vi.fn();

    const { result } = renderHook(() =>
      useStructureWorkout({
        workout,
        onWorkoutChange,
      })
    );

    act(() => {
      result.current.handleWorkoutSettingsSave('New Title', {
        defaultRestType: 'timed',
        defaultRestSec: 60,
      });
    });

    expect(onWorkoutChange).toHaveBeenCalledTimes(1);
    const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
    expect(updated.title).toBe('New Title');
    expect(updated.settings?.defaultRestSec).toBe(60);
    expect(updated.settings?.defaultRestType).toBe('timed');
  });

  it('addWarmupBlock prepends warmup block to the workout', () => {
    const workout = makeWorkout();
    const onWorkoutChange = vi.fn();

    const { result } = renderHook(() =>
      useStructureWorkout({
        workout,
        onWorkoutChange,
      })
    );

    act(() => {
      result.current.addWarmupBlock();
    });

    expect(onWorkoutChange).toHaveBeenCalledTimes(1);
    const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
    expect(updated.blocks).toHaveLength(2);
    expect(updated.blocks[0].structure).toBe('warmup');
    expect(updated.blocks[0].label).toBe('Warm-up');
    // original block should now be at index 1
    expect(updated.blocks[1].label).toBe('Block 1');
  });

  it('addSuperset calls onWorkoutChange with new superset added to block', () => {
    const workout = makeWorkout();
    const onWorkoutChange = vi.fn();

    const { result } = renderHook(() =>
      useStructureWorkout({
        workout,
        onWorkoutChange,
      })
    );

    act(() => {
      result.current.addSuperset(0);
    });

    expect(onWorkoutChange).toHaveBeenCalledTimes(1);
    const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
    expect(updated.blocks[0].supersets).toHaveLength(1);
    expect(typeof updated.blocks[0].supersets![0].id).toBe('string');
    expect(updated.blocks[0].supersets![0].exercises).toEqual([]);
  });

  it('deleteSuperset calls onWorkoutChange with superset removed', () => {
    const workout: WorkoutStructure = {
      title: 'Test',
      source: 'test',
      blocks: [
        {
          id: 'block-1',
          label: 'Block 1',
          structure: 'superset',
          exercises: [],
          supersets: [
            { id: 'ss-1', exercises: [] },
            { id: 'ss-2', exercises: [] },
          ],
        },
      ],
    };
    const onWorkoutChange = vi.fn();

    const { result } = renderHook(() =>
      useStructureWorkout({
        workout,
        onWorkoutChange,
      })
    );

    act(() => {
      result.current.deleteSuperset(0, 0);
    });

    expect(onWorkoutChange).toHaveBeenCalledTimes(1);
    const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
    expect(updated.blocks[0].supersets).toHaveLength(1);
    expect(updated.blocks[0].supersets![0].id).toBe('ss-2');
  });

  it('addExercise adds exercise to a block', () => {
    const workout = makeWorkout();
    const onWorkoutChange = vi.fn();

    const { result } = renderHook(() =>
      useStructureWorkout({
        workout,
        onWorkoutChange,
      })
    );

    act(() => {
      result.current.addExercise(0, 'Bench Press');
    });

    expect(onWorkoutChange).toHaveBeenCalledTimes(1);
    const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
    // makeWorkout starts with 2 exercises; addExercise appends a third
    expect(updated.blocks[0].exercises).toHaveLength(3);
    expect(updated.blocks[0].exercises[2].name).toBe('Bench Press');
    expect(typeof updated.blocks[0].exercises[2].id).toBe('string');
  });

  it('addExercise adds exercise to a superset', () => {
    const workout: WorkoutStructure = {
      title: 'Test',
      source: 'test',
      blocks: [
        {
          id: 'block-1',
          label: 'Block 1',
          structure: 'superset',
          exercises: [],
          supersets: [
            {
              id: 'ss-1',
              exercises: [
                {
                  id: 'ex-ss-1',
                  name: 'Pull-up',
                  sets: 3,
                  reps: 8,
                  reps_range: null,
                  duration_sec: null,
                  rest_sec: null,
                  distance_m: null,
                  distance_range: null,
                  type: 'strength',
                },
              ],
              rest_between_sec: 60,
            },
          ],
        },
      ],
    };
    const onWorkoutChange = vi.fn();

    const { result } = renderHook(() =>
      useStructureWorkout({
        workout,
        onWorkoutChange,
      })
    );

    act(() => {
      result.current.addExercise(0, 'Dip', 0);
    });

    expect(onWorkoutChange).toHaveBeenCalledTimes(1);
    const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
    // Superset 0 starts with 1 exercise; addExercise pushes a second
    expect(updated.blocks[0].supersets![0].exercises).toHaveLength(2);
    expect(updated.blocks[0].exercises.length).toBe(0); // no change to block-level exercises
    const added = updated.blocks[0].supersets![0].exercises[1];
    expect(added.name).toBe('Dip');
    expect(typeof added.id).toBe('string');
  });

  it('addExercise handles block with supersets but no direct exercises (sparse-array insert)', () => {
    // When a block has supersets but block.exercises is empty, the implementation
    // inserts the new exercise at index 1 (creating a sparse array) so it renders
    // AFTER the supersets in the UI, leaving index 0 intentionally undefined.
    const workout: WorkoutStructure = {
      title: 'Test',
      source: 'test',
      blocks: [
        {
          id: 'block-1',
          label: 'Block 1',
          structure: 'superset',
          exercises: [],
          supersets: [
            {
              id: 'ss-1',
              exercises: [
                {
                  id: 'ex-ss-1',
                  name: 'Pull-up',
                  sets: 3,
                  reps: 8,
                  reps_range: null,
                  duration_sec: null,
                  rest_sec: null,
                  distance_m: null,
                  distance_range: null,
                  type: 'strength',
                },
              ],
              rest_between_sec: 60,
            },
          ],
        },
      ],
    };
    const onWorkoutChange = vi.fn();

    const { result } = renderHook(() =>
      useStructureWorkout({
        workout,
        onWorkoutChange,
      })
    );

    act(() => {
      result.current.addExercise(0, 'Cool-down Stretch');
    });

    expect(onWorkoutChange).toHaveBeenCalledTimes(1);
    const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
    // Implementation inserts at index 1 when hasSupersets && exercises.length === 0
    expect(updated.blocks[0].exercises[1].name).toBe('Cool-down Stretch');
    expect(typeof updated.blocks[0].exercises[1].id).toBe('string');
    // Index 0 is undefined (sparse array)
    expect(updated.blocks[0].exercises[0]).toBeUndefined();
  });

  // ── Drag and Drop ─────────────────────────────────────────────────────────
  describe('drag and drop', () => {
    it('handleDragStart sets activeDragItem for a block', () => {
      const workout = makeWorkout();
      const onWorkoutChange = vi.fn();

      const { result } = renderHook(() =>
        useStructureWorkout({ workout, onWorkoutChange })
      );

      act(() => {
        result.current.handleDragStart({
          active: {
            id: 'block-1',
            data: { current: { type: 'block', blockIdx: 0 } },
          },
        } as any);
      });

      expect(result.current.activeDragItem).toEqual({
        type: 'block',
        label: 'Block 1',
      });
    });

    it('handleDragStart sets activeDragItem for an exercise', () => {
      const workout = makeWorkout();
      const onWorkoutChange = vi.fn();

      const { result } = renderHook(() =>
        useStructureWorkout({ workout, onWorkoutChange })
      );

      act(() => {
        result.current.handleDragStart({
          active: {
            id: 'ex-1',
            data: { current: { type: 'exercise', blockIdx: 0, exerciseIdx: 0, supersetIdx: null } },
          },
        } as any);
      });

      expect(result.current.activeDragItem).toEqual({
        type: 'exercise',
        label: 'Squat',
      });
    });

    it('handleDragEnd reorders blocks', () => {
      // Workout with two blocks so we can reorder
      const workout: WorkoutStructure = {
        title: 'Two Blocks',
        source: 'test',
        blocks: [
          {
            id: 'block-1',
            label: 'Block 1',
            structure: 'regular',
            exercises: [],
          },
          {
            id: 'block-2',
            label: 'Block 2',
            structure: 'circuit',
            exercises: [],
          },
        ],
      };
      const onWorkoutChange = vi.fn();

      const { result } = renderHook(() =>
        useStructureWorkout({ workout, onWorkoutChange })
      );

      act(() => {
        result.current.handleDragEnd({
          active: {
            id: 'block-1',
            data: { current: { type: 'block', blockIdx: 0 } },
          },
          over: {
            id: 'block-2',
            data: { current: { type: 'block', blockIdx: 1 } },
          },
        } as any);
      });

      expect(onWorkoutChange).toHaveBeenCalledTimes(1);
      const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
      // block-1 moves to index 1, block-2 moves to index 0
      expect(updated.blocks[0].id).toBe('block-2');
      expect(updated.blocks[1].id).toBe('block-1');
    });

    it('handleDragEnd reorders exercises within a block', () => {
      const workout = makeWorkout(); // block-1 has ex-1 (Squat) at 0, ex-2 (Deadlift) at 1
      const onWorkoutChange = vi.fn();

      const { result } = renderHook(() =>
        useStructureWorkout({ workout, onWorkoutChange })
      );

      act(() => {
        result.current.handleDragEnd({
          active: {
            id: 'ex-1',
            data: { current: { type: 'exercise', blockIdx: 0, exerciseIdx: 0, supersetIdx: null } },
          },
          over: {
            id: 'ex-2',
            data: { current: { type: 'exercise', blockIdx: 0, exerciseIdx: 1, supersetIdx: null } },
          },
        } as any);
      });

      expect(onWorkoutChange).toHaveBeenCalledTimes(1);
      const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
      // ex-1 (Squat) moved to index 1, ex-2 (Deadlift) moved to index 0
      expect(updated.blocks[0].exercises[0].name).toBe('Deadlift');
      expect(updated.blocks[0].exercises[1].name).toBe('Squat');
    });

    it('handleDragEnd reorders exercises within a superset', () => {
      const workout: WorkoutStructure = {
        title: 'Superset Workout',
        source: 'test',
        blocks: [
          {
            id: 'block-1',
            label: 'Block 1',
            structure: 'superset',
            exercises: [],
            supersets: [
              {
                id: 'ss-1',
                exercises: [
                  {
                    id: 'ss-ex-1',
                    name: 'Pull-up',
                    sets: 3,
                    reps: 8,
                    reps_range: null,
                    duration_sec: null,
                    rest_sec: null,
                    distance_m: null,
                    distance_range: null,
                    type: 'strength',
                  },
                  {
                    id: 'ss-ex-2',
                    name: 'Dip',
                    sets: 3,
                    reps: 10,
                    reps_range: null,
                    duration_sec: null,
                    rest_sec: null,
                    distance_m: null,
                    distance_range: null,
                    type: 'strength',
                  },
                ],
              },
            ],
          },
        ],
      };
      const onWorkoutChange = vi.fn();

      const { result } = renderHook(() =>
        useStructureWorkout({ workout, onWorkoutChange })
      );

      act(() => {
        result.current.handleDragEnd({
          active: {
            id: 'ss-ex-1',
            data: { current: { type: 'superset-exercise', blockIdx: 0, supersetIdx: 0, exerciseIdx: 0 } },
          },
          over: {
            id: 'ss-ex-2',
            data: { current: { type: 'superset-exercise', blockIdx: 0, supersetIdx: 0, exerciseIdx: 1 } },
          },
        } as any);
      });

      expect(onWorkoutChange).toHaveBeenCalledTimes(1);
      const updated = onWorkoutChange.mock.calls[0][0] as WorkoutStructure;
      // ss-ex-1 (Pull-up) moves to index 1, ss-ex-2 (Dip) moves to index 0
      expect(updated.blocks[0].supersets![0].exercises[0].name).toBe('Dip');
      expect(updated.blocks[0].supersets![0].exercises[1].name).toBe('Pull-up');
    });

    it('handleDragEnd is a no-op when active and over are the same', () => {
      const workout = makeWorkout();
      const onWorkoutChange = vi.fn();

      const { result } = renderHook(() =>
        useStructureWorkout({ workout, onWorkoutChange })
      );

      act(() => {
        result.current.handleDragEnd({
          active: {
            id: 'ex-1',
            data: { current: { type: 'exercise', blockIdx: 0, exerciseIdx: 0, supersetIdx: null } },
          },
          over: {
            id: 'ex-1',
            data: { current: { type: 'exercise', blockIdx: 0, exerciseIdx: 0, supersetIdx: null } },
          },
        } as any);
      });

      expect(onWorkoutChange).not.toHaveBeenCalled();
    });

    it('handleDragEnd is a no-op when over is null', () => {
      const workout = makeWorkout();
      const onWorkoutChange = vi.fn();

      const { result } = renderHook(() =>
        useStructureWorkout({ workout, onWorkoutChange })
      );

      act(() => {
        result.current.handleDragEnd({
          active: {
            id: 'ex-1',
            data: { current: { type: 'exercise', blockIdx: 0, exerciseIdx: 0, supersetIdx: null } },
          },
          over: null,
        } as any);
      });

      expect(onWorkoutChange).not.toHaveBeenCalled();
    });

    it('handleDragEnd clears activeDragItem', () => {
      const workout = makeWorkout();
      const onWorkoutChange = vi.fn();

      const { result } = renderHook(() =>
        useStructureWorkout({ workout, onWorkoutChange })
      );

      // First set an active drag item
      act(() => {
        result.current.handleDragStart({
          active: {
            id: 'block-1',
            data: { current: { type: 'block', blockIdx: 0 } },
          },
        } as any);
      });

      expect(result.current.activeDragItem).not.toBeNull();

      // End the drag (same id so no reorder, but activeDragItem must clear)
      act(() => {
        result.current.handleDragEnd({
          active: {
            id: 'block-1',
            data: { current: { type: 'block', blockIdx: 0 } },
          },
          over: {
            id: 'block-1',
            data: { current: { type: 'block', blockIdx: 0 } },
          },
        } as any);
      });

      expect(result.current.activeDragItem).toBeNull();
    });
  });
});
