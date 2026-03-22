import { describe, it, expect } from 'vitest';
import { autoAddStrengthPeriods, isStrengthWorkout } from '../autoAddStrengthPeriods';
import type { WorkoutStructure } from '../../types/workout';

const makeStrengthWorkout = (overrides?: Partial<WorkoutStructure>): WorkoutStructure => ({
  title: 'Test Strength Workout',
  source: 'test',
  workout_type: 'strength',
  blocks: [
    {
      label: 'Main',
      structure: 'sets',
      sets: 4,
      exercises: [
        { id: '1', name: 'Bench Press', sets: 4, reps: 8, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, type: 'strength' },
        { id: '2', name: 'Squat', sets: 4, reps: 8, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, type: 'strength' },
      ],
    },
  ],
  ...overrides,
});

describe('isStrengthWorkout', () => {
  it('returns true when workout_type is strength', () => {
    expect(isStrengthWorkout(makeStrengthWorkout())).toBe(true);
  });

  it('returns false for cardio workout type', () => {
    expect(isStrengthWorkout(makeStrengthWorkout({ workout_type: 'cardio' }))).toBe(false);
  });

  it('detects strength by exercise heuristics when type is not set', () => {
    const workout = makeStrengthWorkout({ workout_type: undefined });
    expect(isStrengthWorkout(workout)).toBe(true);
  });

  it('returns false for empty workout', () => {
    expect(isStrengthWorkout({ title: '', source: '', blocks: [] })).toBe(false);
  });
});

describe('autoAddStrengthPeriods', () => {
  it('adds warm-up block at start', () => {
    const result = autoAddStrengthPeriods(makeStrengthWorkout());
    expect(result.blocks[0].structure).toBe('warmup');
    expect(result.blocks[0].label).toBe('Warm-up');
    expect(result.blocks[0].warmup_duration_sec).toBe(300);
  });

  it('adds cooldown block at end', () => {
    const result = autoAddStrengthPeriods(makeStrengthWorkout());
    const lastBlock = result.blocks[result.blocks.length - 1];
    expect(lastBlock.structure).toBe('cooldown');
    expect(lastBlock.label).toBe('Cool-down');
    expect(lastBlock.warmup_duration_sec).toBe(300);
  });

  it('sets rest between sets on exercise blocks', () => {
    const result = autoAddStrengthPeriods(makeStrengthWorkout());
    const mainBlock = result.blocks.find(b => b.label === 'Main');
    expect(mainBlock?.rest_between_sets_sec).toBe(75);
  });

  it('sets default rest in settings', () => {
    const result = autoAddStrengthPeriods(makeStrengthWorkout());
    expect(result.settings?.defaultRestType).toBe('timed');
    expect(result.settings?.defaultRestSec).toBe(75);
  });

  it('does not duplicate warm-up if one already exists', () => {
    const workout = makeStrengthWorkout();
    workout.blocks.unshift({
      label: 'Warm-up', structure: 'warmup', exercises: [],
      warmup_duration_sec: 180, warmup_activity: 'stretching',
    });
    const result = autoAddStrengthPeriods(workout);
    const warmups = result.blocks.filter(b => b.structure === 'warmup');
    expect(warmups).toHaveLength(1);
  });

  it('does not duplicate cooldown if one already exists', () => {
    const workout = makeStrengthWorkout();
    workout.blocks.push({
      label: 'Cool-down', structure: 'cooldown', exercises: [],
      warmup_duration_sec: 180, warmup_activity: 'stretching',
    });
    const result = autoAddStrengthPeriods(workout);
    const cooldowns = result.blocks.filter(b => b.structure === 'cooldown');
    expect(cooldowns).toHaveLength(1);
  });

  it('does not override existing rest settings on blocks', () => {
    const workout = makeStrengthWorkout();
    workout.blocks[0].rest_between_sets_sec = 120;
    const result = autoAddStrengthPeriods(workout);
    const mainBlock = result.blocks.find(b => b.label === 'Main');
    expect(mainBlock?.rest_between_sets_sec).toBe(120);
  });

  it('accepts custom options', () => {
    const result = autoAddStrengthPeriods(makeStrengthWorkout(), {
      warmupDurationSec: 180,
      restBetweenExercisesSec: 90,
      cooldownDurationSec: 240,
    });
    expect(result.blocks[0].warmup_duration_sec).toBe(180);
    expect(result.blocks[result.blocks.length - 1].warmup_duration_sec).toBe(240);
    expect(result.settings?.defaultRestSec).toBe(90);
  });
});
