/**
 * Tests for auto-tags generation
 */
import { describe, expect, it } from 'vitest';
import { generateAutoTags } from '../auto-tags';
import type { WorkoutStructure } from '../../types/workout';

describe('generateAutoTags', () => {
  const createWorkout = (overrides: Partial<WorkoutStructure> = {}): WorkoutStructure => ({
    title: 'Test Workout',
    source: 'manual',
    blocks: [],
    ...overrides,
  });

  const createBlock = (label: string, exerciseNames: string[]) => ({
    label,
    structure: null as const,
    exercises: exerciseNames.map((name) => ({
      id: '1',
      name,
      sets: null,
      reps: null,
      reps_range: null,
      duration_sec: null,
      rest_sec: null,
      distance_m: null,
      distance_range: null,
      type: 'strength' as const,
    })),
    supersets: [],
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
        createBlock('Push Day', ['Bench Press', 'Overhead Press', 'Push-ups']),
      ],
    });
    const tags = generateAutoTags(workout);
    expect(tags).toContain('upper-body');
  });

  it('returns upper-body tag when blocks contain pull/row exercises', () => {
    const workout = createWorkout({
      blocks: [
        createBlock('Pull Day', ['Pull-ups', 'Barbell Row', 'Bicep Curl']),
      ],
    });
    const tags = generateAutoTags(workout);
    expect(tags).toContain('upper-body');
  });

  it('returns lower-body tag when blocks contain squat/leg exercises', () => {
    const workout = createWorkout({
      blocks: [
        createBlock('Leg Day', ['Squats', 'Lunges', 'Leg Press']),
      ],
    });
    const tags = generateAutoTags(workout);
    expect(tags).toContain('lower-body');
  });

  it('returns lower-body tag when blocks contain deadlift/glute exercises', () => {
    const workout = createWorkout({
      blocks: [
        createBlock('Lower', ['Deadlift', 'Glute Bridge', 'Hip Thrust']),
      ],
    });
    const tags = generateAutoTags(workout);
    expect(tags).toContain('lower-body');
  });

  it('returns core tag when blocks contain plank/crunch exercises', () => {
    const workout = createWorkout({
      blocks: [
        createBlock('Core', ['Plank', 'Crunches', 'Russian Twists']),
      ],
    });
    const tags = generateAutoTags(workout);
    expect(tags).toContain('core');
  });

  it('returns push tag when block label contains push', () => {
    const workout = createWorkout({
      blocks: [
        createBlock('Push Circuit', ['Burpees', 'Mountain Climbers']),
      ],
    });
    const tags = generateAutoTags(workout);
    expect(tags).toContain('push');
  });

  it('returns pull tag when block label contains pull', () => {
    const workout = createWorkout({
      blocks: [
        createBlock('Pull Circuit', ['Pull-ups', 'Rows']),
      ],
    });
    const tags = generateAutoTags(workout);
    expect(tags).toContain('pull');
  });

  it('returns quick tag for workouts under 30 minutes', () => {
    const workout = createWorkout({
      blocks: [
        createBlock('Quick', ['Push-ups', 'Squats']),
      ],
    });
    // Add exercises with short duration to ensure quick workout
    workout.blocks[0].exercises[0].duration_sec = 60;
    workout.blocks[0].exercises[1].sets = 2;
    workout.blocks[0].exercises[1].reps = 10;

    const tags = generateAutoTags(workout);
    expect(tags).toContain('quick');
  });

  it('returns long tag for workouts over 60 minutes', () => {
    const workout = createWorkout({
      blocks: [
        createBlock('Long', ['Run']),
      ],
    });
    // Add long duration exercise - slightly over 60 minutes to trigger "long" tag
    workout.blocks[0].exercises[0].duration_sec = 3601; // Just over 60 minutes

    const tags = generateAutoTags(workout);
    expect(tags).toContain('long');
  });

  it('returns no duplicate tags', () => {
    const workout = createWorkout({
      workout_type: 'strength',
      blocks: [
        createBlock('Push', ['Bench Press', 'Push-ups', 'Overhead Press']),
        createBlock('Pull', ['Pull-ups', 'Rows']),
      ],
    });
    const tags = generateAutoTags(workout);
    const uniqueTags = new Set(tags);
    expect(tags.length).toBe(uniqueTags.size);
  });

  it('returns multiple tags for complex workout', () => {
    const workout = createWorkout({
      workout_type: 'hiit',
      blocks: [
        createBlock('Push', ['Bench Press', 'Push-ups']),
        createBlock('Legs', ['Squats', 'Lunges']),
        createBlock('Core', ['Plank', 'Crunches']),
      ],
    });
    const tags = generateAutoTags(workout);
    expect(tags).toContain('hiit');
    expect(tags).toContain('upper-body');
    expect(tags).toContain('lower-body');
    expect(tags).toContain('core');
    expect(tags).toContain('push');
  });

  it('handles workout with supersets', () => {
    const workout = createWorkout({
      blocks: [
        {
          label: 'Superset',
          structure: 'superset',
          exercises: [],
          supersets: [
            {
              id: '1',
              exercises: [
                {
                  id: '1',
                  name: 'Push-ups',
                  sets: null,
                  reps: null,
                  reps_range: null,
                  duration_sec: null,
                  rest_sec: null,
                  distance_m: null,
                  distance_range: null,
                  type: 'strength',
                },
                {
                  id: '2',
                  name: 'Squats',
                  sets: null,
                  reps: null,
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
    });
    const tags = generateAutoTags(workout);
    expect(tags).toContain('upper-body');
    expect(tags).toContain('lower-body');
  });
});
