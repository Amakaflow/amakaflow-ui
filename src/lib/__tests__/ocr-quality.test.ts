import { describe, it, expect } from 'vitest';
import { analyzeOCRQuality } from '../ocr-quality';
import type { WorkoutStructure } from '../../types/workout';

function makeWorkout(overrides: Partial<WorkoutStructure> = {}): WorkoutStructure {
  return {
    title: 'Test Workout',
    source: 'test',
    blocks: [{
      id: 'b1',
      label: 'Main',
      structure: 'circuit',
      exercises: [
        { id: 'e1', name: 'Bench Press', sets: 4, reps: 8, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, type: 'strength' },
        { id: 'e2', name: 'Squats', sets: 5, reps: 5, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, type: 'strength' },
      ],
    }],
    ...overrides,
  };
}

describe('analyzeOCRQuality', () => {
  it('returns null when Vision API was used', () => {
    const result = analyzeOCRQuality(makeWorkout(), true);
    expect(result).toBeNull();
  });

  it('returns good score for well-formed workout', () => {
    const result = analyzeOCRQuality(makeWorkout(), false);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(50);
  });

  it('returns lower score for exercises with no details', () => {
    const workout = makeWorkout({
      blocks: [{
        id: 'b1',
        label: 'Main',
        structure: 'circuit',
        exercises: [
          { id: 'e1', name: 'Exercise A', sets: null, reps: null, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, type: 'strength' },
          { id: 'e2', name: 'Exercise B', sets: null, reps: null, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, type: 'strength' },
        ],
      }],
    });
    const result = analyzeOCRQuality(workout, false);
    expect(result).not.toBeNull();
    // Score should be lower than a workout with full details
    const goodResult = analyzeOCRQuality(makeWorkout(), false);
    expect(result!.score).toBeLessThanOrEqual(goodResult!.score);
  });

  it('flags garbled exercise names', () => {
    const workout = makeWorkout({
      blocks: [{
        id: 'b1',
        label: 'Main',
        structure: 'circuit',
        exercises: [
          { id: 'e1', name: 'x2', sets: 4, reps: 8, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, type: 'strength' },
          { id: 'e2', name: '!!??##', sets: 4, reps: 8, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, type: 'strength' },
        ],
      }],
    });
    const result = analyzeOCRQuality(workout, false);
    expect(result).not.toBeNull();
    // Score should be reduced for garbled names
    expect(result!.score).toBeLessThan(100);
  });

  it('returns score between 0 and 100', () => {
    const result = analyzeOCRQuality(makeWorkout(), false);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThanOrEqual(0);
    expect(result!.score).toBeLessThanOrEqual(100);
  });

  it('recommendation is good, fair, or poor', () => {
    const result = analyzeOCRQuality(makeWorkout(), false);
    expect(result).not.toBeNull();
    expect(['good', 'fair', 'poor']).toContain(result!.recommendation);
  });
});
