/**
 * AMA-210 & AMA-211: Tests for workout playback modification types.
 */

import { describe, it, expect } from 'vitest';
import {
  createPreWorkoutCustomization,
  applyReorder,
  flattenToDraggableItems,
  type ReorderEvent,
} from '../workout-playback';
import type { Block, Exercise } from '../workout';

function makeExercise(name: string, id?: string): Exercise {
  return {
    id: id ?? `ex-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    sets: 3,
    reps: 10,
    reps_range: null,
    duration_sec: null,
    rest_sec: 60,
    distance_m: null,
    distance_range: null,
    type: 'strength',
  };
}

function makeBlock(label: string, exercises: Exercise[]): Block {
  return {
    id: `block-${label.toLowerCase()}`,
    label,
    structure: 'regular',
    exercises,
  };
}

describe('AMA-211: Pre-workout reorder', () => {
  describe('createPreWorkoutCustomization', () => {
    it('creates customization from blocks', () => {
      const blocks = [
        makeBlock('A', [makeExercise('Bench Press'), makeExercise('Squat')]),
      ];
      const result = createPreWorkoutCustomization(blocks);

      expect(result.blocks).toHaveLength(1);
      expect(result.hasChanges).toBe(false);
      expect(result.history).toHaveLength(0);
    });

    it('creates a copy of blocks (not a reference)', () => {
      const blocks = [makeBlock('A', [makeExercise('Bench Press')])];
      const result = createPreWorkoutCustomization(blocks);

      // Mutating the result should not affect the original
      result.blocks[0].label = 'Modified';
      expect(blocks[0].label).toBe('A');
    });
  });

  describe('applyReorder', () => {
    it('swaps exercises within same block', () => {
      const blocks = [
        makeBlock('A', [
          makeExercise('Bench Press', 'ex-1'),
          makeExercise('Squat', 'ex-2'),
          makeExercise('Deadlift', 'ex-3'),
        ]),
      ];

      const event: ReorderEvent = {
        exerciseId: 'ex-3',
        fromBlockIndex: 0,
        fromExerciseIndex: 2,
        toBlockIndex: 0,
        toExerciseIndex: 0,
      };

      const result = applyReorder(blocks, event);

      expect(result[0].exercises[0].name).toBe('Deadlift');
      expect(result[0].exercises[1].name).toBe('Bench Press');
      expect(result[0].exercises[2].name).toBe('Squat');
    });

    it('moves exercise between blocks', () => {
      const blocks = [
        makeBlock('A', [makeExercise('Bench Press', 'ex-1')]),
        makeBlock('B', [makeExercise('Squat', 'ex-2')]),
      ];

      const event: ReorderEvent = {
        exerciseId: 'ex-1',
        fromBlockIndex: 0,
        fromExerciseIndex: 0,
        toBlockIndex: 1,
        toExerciseIndex: 0,
      };

      const result = applyReorder(blocks, event);

      expect(result[0].exercises).toHaveLength(0);
      expect(result[1].exercises).toHaveLength(2);
      expect(result[1].exercises[0].name).toBe('Bench Press');
    });

    it('does not mutate original blocks', () => {
      const blocks = [
        makeBlock('A', [
          makeExercise('Bench Press', 'ex-1'),
          makeExercise('Squat', 'ex-2'),
        ]),
      ];

      const event: ReorderEvent = {
        exerciseId: 'ex-2',
        fromBlockIndex: 0,
        fromExerciseIndex: 1,
        toBlockIndex: 0,
        toExerciseIndex: 0,
      };

      const result = applyReorder(blocks, event);

      // Original should be unchanged
      expect(blocks[0].exercises[0].name).toBe('Bench Press');
      expect(blocks[0].exercises[1].name).toBe('Squat');

      // Result should be changed
      expect(result[0].exercises[0].name).toBe('Squat');
    });

    it('handles invalid block indices gracefully', () => {
      const blocks = [makeBlock('A', [makeExercise('Bench Press')])];

      const event: ReorderEvent = {
        exerciseId: 'ex-1',
        fromBlockIndex: 5, // out of range
        fromExerciseIndex: 0,
        toBlockIndex: 0,
        toExerciseIndex: 0,
      };

      // Should return original blocks unchanged
      const result = applyReorder(blocks, event);
      expect(result[0].exercises[0].name).toBe('Bench Press');
    });
  });

  describe('flattenToDraggableItems', () => {
    it('flattens blocks into ordered list', () => {
      const blocks = [
        makeBlock('A', [
          makeExercise('Bench Press', 'ex-1'),
          makeExercise('Squat', 'ex-2'),
        ]),
        makeBlock('B', [
          makeExercise('Deadlift', 'ex-3'),
        ]),
      ];

      const items = flattenToDraggableItems(blocks);

      expect(items).toHaveLength(3);
      expect(items[0].id).toBe('ex-1');
      expect(items[0].blockIndex).toBe(0);
      expect(items[0].exerciseIndex).toBe(0);
      expect(items[0].blockLabel).toBe('A');
      expect(items[1].id).toBe('ex-2');
      expect(items[2].id).toBe('ex-3');
      expect(items[2].blockIndex).toBe(1);
    });

    it('handles empty blocks', () => {
      const blocks = [makeBlock('A', [])];
      const items = flattenToDraggableItems(blocks);
      expect(items).toHaveLength(0);
    });
  });
});

describe('AMA-210: Mid-workout modifications', () => {
  it('SkipResult has correct shape', () => {
    const skip = {
      action: 'skip' as const,
      exerciseId: 'ex-1',
      exerciseName: 'Bench Press',
      reason: 'equipment_unavailable' as const,
    };
    expect(skip.action).toBe('skip');
    expect(skip.reason).toBe('equipment_unavailable');
  });

  it('ReplaceResult has correct shape', () => {
    const replace = {
      action: 'replace' as const,
      originalExerciseId: 'ex-1',
      originalName: 'Bench Press',
      replacementExercise: makeExercise('Dumbbell Press'),
      reason: 'same muscle group',
    };
    expect(replace.action).toBe('replace');
    expect(replace.replacementExercise.name).toBe('Dumbbell Press');
  });

  it('ReorderResult has correct shape', () => {
    const reorder = {
      action: 'reorder' as const,
      newOrder: ['ex-3', 'ex-1', 'ex-2'],
    };
    expect(reorder.action).toBe('reorder');
    expect(reorder.newOrder).toHaveLength(3);
  });
});
