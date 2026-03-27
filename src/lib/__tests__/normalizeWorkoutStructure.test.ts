/**
 * Tests for normalizeWorkoutStructure() in api.ts
 *
 * Critical invariant: when a block has supersets[], exercises[] must stay empty.
 * The old behavior (flattening superset exercises into exercises[]) caused
 * duplicate exercises on mobile. This test suite guards against regression.
 *
 * AMA-564: Instagram Apify auto-extraction superset handling.
 */

import { describe, it, expect } from 'vitest';
import { normalizeWorkoutStructure } from '../api';
import type { WorkoutStructure, Block, Exercise, Superset } from '../../types/workout';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWorkout(blocks: Block[], overrides: Partial<WorkoutStructure> = {}): WorkoutStructure {
  return {
    title: 'Test Workout',
    source: 'test',
    blocks,
    ...overrides,
  } as WorkoutStructure;
}

function makeExercise(name: string, overrides: Partial<Exercise> = {}): Exercise {
  return {
    name,
    sets: 3,
    reps: 10,
    type: 'strength',
    ...overrides,
  } as Exercise;
}

function makeSuperset(exercises: Exercise[]): Superset {
  return { exercises } as Superset;
}

// ---------------------------------------------------------------------------
// 1. Workout with supersets -> exercises stays empty, supersets preserved
// ---------------------------------------------------------------------------

describe('normalizeWorkoutStructure - superset handling', () => {
  it('should keep exercises[] empty when block has non-empty supersets[]', () => {
    const block: Block = {
      label: 'Supersets',
      structure: 'superset',
      exercises: [],
      supersets: [
        makeSuperset([makeExercise('Squats'), makeExercise('Box Jumps')]),
        makeSuperset([makeExercise('Hip Thrusts'), makeExercise('Lunges')]),
      ],
    } as Block;

    const result = normalizeWorkoutStructure(makeWorkout([block]));

    expect(result.blocks[0].exercises).toEqual([]);
    expect(result.blocks[0].supersets).toHaveLength(2);
    expect(result.blocks[0].structure).toBe('superset');
  });

  it('should clear exercises[] even if LLM duplicated them alongside supersets[]', () => {
    const squats = makeExercise('Squats');
    const boxJumps = makeExercise('Box Jumps');

    const block: Block = {
      label: 'Bad LLM Output',
      structure: 'superset',
      exercises: [squats, boxJumps], // LLM mistake: duplicated here
      supersets: [makeSuperset([squats, boxJumps])],
    } as Block;

    const result = normalizeWorkoutStructure(makeWorkout([block]));

    // exercises[] must be empty -- all exercises live in supersets only
    expect(result.blocks[0].exercises).toEqual([]);
    expect(result.blocks[0].supersets).toHaveLength(1);
  });

  it('should preserve superset exercise details (sets, reps, type, notes)', () => {
    const ex1 = makeExercise('Squats', { sets: 5, reps: 5, notes: 'ATG depth' });
    const ex2 = makeExercise('Box Jumps', { sets: 5, reps: 5, type: 'plyometric' });

    const block: Block = {
      label: 'Supersets',
      structure: 'superset',
      exercises: [],
      supersets: [makeSuperset([ex1, ex2])],
    } as Block;

    const result = normalizeWorkoutStructure(makeWorkout([block]));
    const pair = result.blocks[0].supersets![0].exercises;

    expect(pair[0].name).toBe('Squats');
    expect(pair[0].sets).toBe(5);
    expect(pair[0].notes).toBe('ATG depth');
    expect(pair[1].type).toBe('plyometric');
  });
});

// ---------------------------------------------------------------------------
// 2. Workout without supersets -> exercises unchanged
// ---------------------------------------------------------------------------

describe('normalizeWorkoutStructure - regular blocks', () => {
  it('should preserve exercises[] when no supersets exist', () => {
    const block: Block = {
      label: 'Main',
      structure: 'regular',
      exercises: [makeExercise('Bench Press'), makeExercise('Rows')],
    } as Block;

    const result = normalizeWorkoutStructure(makeWorkout([block]));

    expect(result.blocks[0].exercises).toHaveLength(2);
    expect(result.blocks[0].exercises[0].name).toBe('Bench Press');
  });

  it('should preserve exercises[] when supersets is undefined', () => {
    const block: Block = {
      label: 'Warm-up',
      exercises: [makeExercise('Jumping Jacks')],
    } as Block;

    const result = normalizeWorkoutStructure(makeWorkout([block]));

    expect(result.blocks[0].exercises).toHaveLength(1);
  });

  it('should preserve exercises[] when supersets is empty array', () => {
    const block: Block = {
      label: 'Strength',
      structure: 'regular',
      exercises: [makeExercise('Deadlift')],
      supersets: [],
    } as Block;

    const result = normalizeWorkoutStructure(makeWorkout([block]));

    expect(result.blocks[0].exercises).toHaveLength(1);
    expect(result.blocks[0].exercises[0].name).toBe('Deadlift');
  });
});

// ---------------------------------------------------------------------------
// 3. Block with supersets but no structure -> structure set to "superset"
// ---------------------------------------------------------------------------

describe('normalizeWorkoutStructure - structure inference', () => {
  it('should set structure to "superset" when supersets exist but structure is null', () => {
    const block: Block = {
      label: 'Pairs',
      structure: null,
      exercises: [],
      supersets: [makeSuperset([makeExercise('A'), makeExercise('B')])],
    } as Block;

    const result = normalizeWorkoutStructure(makeWorkout([block]));

    expect(result.blocks[0].structure).toBe('superset');
  });

  it('should set structure to "superset" when supersets exist but structure is undefined', () => {
    const block: Block = {
      label: 'Pairs',
      exercises: [],
      supersets: [makeSuperset([makeExercise('A'), makeExercise('B')])],
    } as Block;

    const result = normalizeWorkoutStructure(makeWorkout([block]));

    expect(result.blocks[0].structure).toBe('superset');
  });

  it('should not override explicit non-null structure when no supersets', () => {
    const block: Block = {
      label: 'AMRAP',
      structure: 'amrap',
      exercises: [makeExercise('Burpees')],
    } as Block;

    const result = normalizeWorkoutStructure(makeWorkout([block]));

    expect(result.blocks[0].structure).toBe('amrap');
  });
});

// ---------------------------------------------------------------------------
// 4. Mixed blocks (some with supersets, some without)
// ---------------------------------------------------------------------------

describe('normalizeWorkoutStructure - mixed blocks', () => {
  it('should handle warmup + superset + cooldown blocks correctly', () => {
    const blocks: Block[] = [
      {
        label: 'Warm-up',
        structure: 'regular',
        exercises: [makeExercise('Jumping Jacks')],
      } as Block,
      {
        label: 'Main Work',
        structure: 'superset',
        exercises: [makeExercise('Squats')], // LLM mistake
        supersets: [
          makeSuperset([makeExercise('Squats'), makeExercise('Box Jumps')]),
        ],
      } as Block,
      {
        label: 'Cool-down',
        structure: null,
        exercises: [makeExercise('Stretching')],
      } as Block,
    ];

    const result = normalizeWorkoutStructure(makeWorkout(blocks));

    // Warm-up: exercises preserved
    expect(result.blocks[0].exercises).toHaveLength(1);

    // Superset block: exercises cleared
    expect(result.blocks[1].exercises).toEqual([]);
    expect(result.blocks[1].supersets).toHaveLength(1);

    // Cool-down: exercises preserved
    expect(result.blocks[2].exercises).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// 5. Block-level fields preserved
// ---------------------------------------------------------------------------

describe('normalizeWorkoutStructure - field preservation', () => {
  it('should preserve rest_between_rounds_sec from superset', () => {
    const block: Block = {
      label: 'Pairs',
      structure: 'superset',
      exercises: [],
      supersets: [
        {
          exercises: [makeExercise('A'), makeExercise('B')],
          rest_between_sec: 90,
        } as Superset,
      ],
    } as Block;

    const result = normalizeWorkoutStructure(makeWorkout([block]));

    expect(result.blocks[0].rest_between_rounds_sec).toBe(90);
  });

  it('should preserve workout-level fields (title, source, workout_type)', () => {
    const workout = makeWorkout(
      [{ label: 'Block', exercises: [makeExercise('Push-ups')] } as Block],
      {
        title: 'HIIT Blast',
        source: 'https://instagram.com/reel/abc',
        workout_type: 'hiit',
        workout_type_confidence: 0.95,
      },
    );

    const result = normalizeWorkoutStructure(workout);

    expect(result.title).toBe('HIIT Blast');
    expect(result.source).toBe('https://instagram.com/reel/abc');
    expect(result.workout_type).toBe('hiit');
    expect(result.workout_type_confidence).toBe(0.95);
  });

  it('should default title to "Imported Workout" when missing', () => {
    const workout = makeWorkout(
      [{ label: 'Block', exercises: [makeExercise('Push-ups')] } as Block],
      { title: undefined as unknown as string },
    );

    const result = normalizeWorkoutStructure(workout);

    expect(result.title).toBe('Imported Workout');
  });

  it('should default source to "unknown" when missing', () => {
    const workout = makeWorkout(
      [{ label: 'Block', exercises: [makeExercise('Push-ups')] } as Block],
      { source: undefined as unknown as string },
    );

    const result = normalizeWorkoutStructure(workout);

    expect(result.source).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// 6. Empty/missing blocks
// ---------------------------------------------------------------------------

describe('normalizeWorkoutStructure - empty/missing blocks', () => {
  it('should create default block when blocks is empty array', () => {
    const result = normalizeWorkoutStructure(makeWorkout([]));

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].label).toBe('Workout');
    expect(result.blocks[0].exercises).toEqual([]);
  });

  it('should create default block when blocks is undefined', () => {
    const workout = { title: 'Test' } as WorkoutStructure;

    const result = normalizeWorkoutStructure(workout);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].label).toBe('Workout');
  });
});
