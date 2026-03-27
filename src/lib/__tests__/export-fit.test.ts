/**
 * AMA-116: Tests for client-side FIT file generation.
 */

import { describe, it, expect } from 'vitest';
import { generateFitFile } from '../export-fit';
import type { WorkoutStructure } from '../../types/workout';

function makeWorkout(overrides?: Partial<WorkoutStructure>): WorkoutStructure {
  return {
    title: 'Test Workout',
    source: 'manual',
    blocks: [
      {
        label: 'Main',
        structure: 'regular',
        exercises: [
          {
            id: 'ex-1',
            name: 'Bench Press',
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
            name: 'Squat',
            sets: 4,
            reps: 8,
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
    ...overrides,
  };
}

describe('AMA-116: FIT file generation', () => {
  it('generates a valid FIT file header', () => {
    const workout = makeWorkout();
    const fitData = generateFitFile(workout);

    expect(fitData).toBeInstanceOf(Uint8Array);
    expect(fitData.length).toBeGreaterThan(14); // minimum header size

    // FIT header: size byte should be 14
    expect(fitData[0]).toBe(14);

    // Data type should be '.FIT'
    expect(fitData[8]).toBe(46);  // '.'
    expect(fitData[9]).toBe(70);  // 'F'
    expect(fitData[10]).toBe(73); // 'I'
    expect(fitData[11]).toBe(84); // 'T'
  });

  it('generates non-empty binary data', () => {
    const workout = makeWorkout();
    const fitData = generateFitFile(workout);

    // Should have header + data + CRC
    expect(fitData.length).toBeGreaterThan(50);
  });

  it('includes workout steps for each exercise', () => {
    const workout = makeWorkout();
    const fitData = generateFitFile(workout);

    // The file should be larger for workouts with more exercises
    const smallWorkout = makeWorkout({
      blocks: [{
        label: 'A',
        structure: 'regular',
        exercises: [{
          id: 'ex-1',
          name: 'Push-ups',
          sets: 1,
          reps: 10,
          reps_range: null,
          duration_sec: null,
          rest_sec: null,
          distance_m: null,
          distance_range: null,
          type: 'strength',
        }],
      }],
    });
    const smallFit = generateFitFile(smallWorkout);

    // Workout with more exercises and rest periods should be larger
    expect(fitData.length).toBeGreaterThan(smallFit.length);
  });

  it('handles timed exercises', () => {
    const workout = makeWorkout({
      blocks: [{
        label: 'Warmup',
        structure: 'warmup',
        exercises: [{
          id: 'ex-1',
          name: 'Stretching',
          sets: null,
          reps: null,
          reps_range: null,
          duration_sec: 300,
          rest_sec: null,
          distance_m: null,
          distance_range: null,
          type: 'cardio',
        }],
      }],
    });

    const fitData = generateFitFile(workout);
    expect(fitData).toBeInstanceOf(Uint8Array);
    expect(fitData.length).toBeGreaterThan(14);
  });

  it('handles distance exercises', () => {
    const workout = makeWorkout({
      blocks: [{
        label: 'Run',
        structure: 'regular',
        exercises: [{
          id: 'ex-1',
          name: 'Running',
          sets: null,
          reps: null,
          reps_range: null,
          duration_sec: null,
          rest_sec: null,
          distance_m: 5000,
          distance_range: null,
          type: 'cardio',
        }],
      }],
    });

    const fitData = generateFitFile(workout);
    expect(fitData).toBeInstanceOf(Uint8Array);
    expect(fitData.length).toBeGreaterThan(14);
  });

  it('handles rounds/circuit blocks', () => {
    const workout = makeWorkout({
      blocks: [{
        label: 'Circuit',
        structure: 'circuit',
        rounds: 3,
        rest_between_rounds_sec: 60,
        exercises: [
          { id: 'ex-1', name: 'Burpees', sets: null, reps: 10, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, type: 'cardio' },
          { id: 'ex-2', name: 'Jump Squats', sets: null, reps: 15, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, type: 'cardio' },
        ],
      }],
    });

    const fitData = generateFitFile(workout);
    expect(fitData).toBeInstanceOf(Uint8Array);
    // 3 rounds * 2 exercises + rest steps
    expect(fitData.length).toBeGreaterThan(100);
  });

  it('handles empty workout', () => {
    const workout = makeWorkout({ blocks: [] });
    const fitData = generateFitFile(workout);
    expect(fitData).toBeInstanceOf(Uint8Array);
    // Should still have valid header
    expect(fitData[0]).toBe(14);
  });
});
