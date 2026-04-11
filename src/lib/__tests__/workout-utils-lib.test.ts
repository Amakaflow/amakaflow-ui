import { describe, it, expect } from 'vitest';
import {
  generateId,
  addIdsToWorkout,
  createEmptyWorkout,
  cloneBlock,
  formatRestSecs,
  formatMMSS,
  formatWorkoutForStrava,
} from '../workout-utils';
import type { WorkoutStructure, Block } from '../../types/workout';

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns unique IDs on each call', () => {
    const ids = new Set([generateId(), generateId(), generateId(), generateId()]);
    expect(ids.size).toBe(4);
  });
});

describe('addIdsToWorkout', () => {
  it('adds IDs to blocks and exercises', () => {
    const workout = {
      title: 'Test',
      source: 'test',
      blocks: [{
        label: 'Main',
        structure: 'circuit',
        exercises: [{ name: 'Push-ups' }, { name: 'Squats' }],
      }],
    } as any as WorkoutStructure;

    const result = addIdsToWorkout(workout);
    expect(result.blocks[0].id).toBeDefined();
    expect(result.blocks[0].exercises[0].id).toBeDefined();
    expect(result.blocks[0].exercises[1].id).toBeDefined();
  });

  it('preserves existing IDs', () => {
    const workout = {
      title: 'Test', source: 'test',
      blocks: [{
        id: 'existing-block',
        label: 'Main',
        structure: 'circuit',
        exercises: [{ id: 'e1', name: 'Push-ups' }],
      }],
    } as any as WorkoutStructure;

    const result = addIdsToWorkout(workout);
    expect(result.blocks[0].id).toBe('existing-block');
    expect(result.blocks[0].exercises[0].id).toBe('e1');
  });
});

describe('createEmptyWorkout', () => {
  it('returns a valid empty workout', () => {
    const workout = createEmptyWorkout();
    expect(workout.title).toBeDefined();
    expect(Array.isArray(workout.blocks)).toBe(true);
    expect(workout.blocks.length).toBeGreaterThanOrEqual(1);
  });
});

describe('cloneBlock', () => {
  it('creates a deep copy', () => {
    const block = {
      id: 'b1',
      label: 'Main',
      structure: 'circuit',
      exercises: [{ id: 'e1', name: 'Push-ups' }],
    } as any as Block;

    const clone = cloneBlock(block);
    expect(clone.label).toBe('Main');
    expect(clone.exercises).toHaveLength(1);
    expect(clone.exercises[0].name).toBe('Push-ups');
    // Should be a new object, not the same reference
    expect(clone).not.toBe(block);
    expect(clone.exercises).not.toBe(block.exercises);
  });
});

describe('formatRestSecs', () => {
  it('formats seconds under 90', () => {
    expect(formatRestSecs(30)).toBe('30s');
    expect(formatRestSecs(90)).toBe('90s');
  });

  it('formats minutes', () => {
    expect(formatRestSecs(120)).toBe('2m');
    expect(formatRestSecs(150)).toBe('2m 30s');
  });
});

describe('formatMMSS', () => {
  it('formats seconds as MM:SS', () => {
    expect(formatMMSS(600)).toBe('10:00');
    expect(formatMMSS(75)).toBe('1:15');
    expect(formatMMSS(0)).toBe('0:00');
  });
});

describe('formatWorkoutForStrava', () => {
  it('produces a non-empty string', () => {
    const workout = {
      title: 'Test Workout',
      source: 'test',
      blocks: [{
        label: 'Main',
        structure: 'circuit',
        rounds: 3,
        exercises: [
          { name: 'Push-ups', reps: 10, sets: 3 },
          { name: 'Squats', reps: 15, sets: 3 },
        ],
      } as any],
    } as WorkoutStructure;

    const result = formatWorkoutForStrava(workout);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('Push-ups');
  });
});
