/**
 * Tests for auto-tags generation
 */
import { describe, expect, it } from 'vitest';
import { generateAutoTags } from '../auto-tags';
import type { WorkoutStructure, Block, Exercise } from '../../types/workout';

describe('generateAutoTags', () => {
  const createExercise = (name: string): Exercise => ({
    id: '1',
    name,
    sets: 3,
    reps: 10,
    reps_range: null,
    duration_sec: null,
    rest_sec: 60,
    distance_m: null,
    distance_range: null,
    type: 'strength',
  });

  const createBlock = (label: string, exercises: Exercise[]): Block => ({
    label,
    structure: 'sets',
    exercises,
  });

  const createWorkout = (overrides: Partial<WorkoutStructure> = {}): WorkoutStructure => ({
    title: 'Test Workout',
    source: 'test',
    blocks: [],
    workout_type: undefined,
    ...overrides,
  });

  it('returns strength tag for strength workout', () => {
    const workout = createWorkout({ workout_type: 'strength' });
    const tags = generateAutoTags(workout);
    expect(tags).toContain('strength');
  });

  it('returns cardio tag for cardio workout', () => {
    const workout = createWorkout({ workout_type: 'cardio' });
    const tags = generateAutoTags(workout);
    expect(tags).toContain('cardio');
  });

  it('returns upper-body tag when blocks contain push/bench/shoulder exercises', () => {
    const workout = createWorkout({
      blocks: [
        createBlock('Push Exercises', [
          createExercise('Bench Press'),
          createExercise('Shoulder Press'),
        ]),
      ],
    });
    const tags = generateAutoTags(workout);
    expect(tags).toContain('upper-body');
  });

  it('returns lower-body tag when blocks contain squat/leg exercises', () => {
    const workout = createWorkout({
      blocks: [
        createBlock('Leg Day', [
          createExercise('Squats'),
          createExercise('Leg Press'),
        ]),
      ],
    });
    const tags = generateAutoTags(workout);
    expect(tags).toContain('lower-body');
  });

  it('returns quick tag for workouts under 30 minutes', () => {
    const workout = createWorkout({
      blocks: [
        createBlock('Quick Workout', [
          { ...createExercise('Burpees'), duration_sec: 600 }, // 10 min workout
        ]),
      ],
    });
    const tags = generateAutoTags(workout);
    expect(tags).toContain('quick');
  });

  it('returns long tag for workouts over 60 minutes', () => {
    const workout = createWorkout({
      blocks: [
        createBlock('Long Workout', [
          { ...createExercise('Burpees'), duration_sec: 4000 }, // ~67 min workout
        ]),
      ],
    });
    const tags = generateAutoTags(workout);
    expect(tags).toContain('long');
  });

  it('returns no duplicate tags', () => {
    const workout = createWorkout({
      workout_type: 'strength',
      blocks: [
        createBlock('Upper Body', [
          createExercise('Bench Press'),
          createExercise('Shoulder Press'),
          createExercise('Bicep Curl'),
        ]),
      ],
    });
    const tags = generateAutoTags(workout);
    const uniqueTags = new Set(tags);
    expect(tags.length).toBe(uniqueTags.size);
  });

  it('returns push tag when block label contains push', () => {
    const workout = createWorkout({
      blocks: [
        createBlock('Push Day', [
          createExercise('Bench Press'),
        ]),
      ],
    });
    const tags = generateAutoTags(workout);
    expect(tags).toContain('push');
  });

  it('returns pull tag when block label contains pull', () => {
    const workout = createWorkout({
      blocks: [
        createBlock('Pull Day', [
          createExercise('Pull-ups'),
        ]),
      ],
    });
    const tags = generateAutoTags(workout);
    expect(tags).toContain('pull');
  });

  it('returns core tag for core exercises', () => {
    const workout = createWorkout({
      blocks: [
        createBlock('Core', [
          createExercise('Plank'),
          createExercise('Crunches'),
        ]),
      ],
    });
    const tags = generateAutoTags(workout);
    expect(tags).toContain('core');
  });
});
