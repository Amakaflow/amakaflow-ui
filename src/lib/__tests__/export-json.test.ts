/**
 * AMA-118: Tests for client-side JSON export.
 */

import { describe, it, expect } from 'vitest';
import {
  generateJsonExport,
  generateBulkJsonExport,
  workoutToJsonString,
  workoutsToJsonString,
} from '../export-json';
import type { WorkoutStructure } from '../../types/workout';

function makeWorkout(title = 'Test Workout'): WorkoutStructure {
  return {
    title,
    source: 'manual',
    blocks: [
      {
        label: 'Main Block',
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
        ],
      },
    ],
  };
}

describe('AMA-118: JSON export', () => {
  describe('generateJsonExport', () => {
    it('wraps workout in metadata envelope', () => {
      const workout = makeWorkout();
      const result = generateJsonExport(workout);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.schemaVersion).toBe('1.0.0');
      expect(result.metadata.source).toBe('AmakaFlow');
      expect(result.metadata.workoutCount).toBe(1);
      expect(result.metadata.exportedAt).toBeDefined();
      expect(result.workout).toBeDefined();
      expect(result.workout.title).toBe('Test Workout');
    });

    it('strips internal fields from workout', () => {
      const workout = {
        ...makeWorkout(),
        _bulkWorkouts: [makeWorkout('Other')],
        _provenance: { mode: 'test' },
      };
      const result = generateJsonExport(workout);

      expect((result.workout as Record<string, unknown>)._bulkWorkouts).toBeUndefined();
      expect((result.workout as Record<string, unknown>)._provenance).toBeUndefined();
    });

    it('preserves all public fields', () => {
      const workout = makeWorkout();
      const result = generateJsonExport(workout);

      expect(result.workout.title).toBe('Test Workout');
      expect(result.workout.source).toBe('manual');
      expect(result.workout.blocks).toHaveLength(1);
      expect(result.workout.blocks[0].exercises).toHaveLength(1);
      expect(result.workout.blocks[0].exercises[0].name).toBe('Bench Press');
    });
  });

  describe('generateBulkJsonExport', () => {
    it('wraps multiple workouts in metadata envelope', () => {
      const workouts = [makeWorkout('Workout A'), makeWorkout('Workout B')];
      const result = generateBulkJsonExport(workouts);

      expect(result.metadata.workoutCount).toBe(2);
      expect(result.workouts).toHaveLength(2);
      expect(result.workouts[0].title).toBe('Workout A');
      expect(result.workouts[1].title).toBe('Workout B');
    });

    it('handles empty array', () => {
      const result = generateBulkJsonExport([]);
      expect(result.metadata.workoutCount).toBe(0);
      expect(result.workouts).toHaveLength(0);
    });
  });

  describe('workoutToJsonString', () => {
    it('produces valid JSON', () => {
      const workout = makeWorkout();
      const jsonStr = workoutToJsonString(workout);

      expect(() => JSON.parse(jsonStr)).not.toThrow();
      const parsed = JSON.parse(jsonStr);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.workout.title).toBe('Test Workout');
    });

    it('pretty-prints by default', () => {
      const workout = makeWorkout();
      const jsonStr = workoutToJsonString(workout);

      // Pretty-printed JSON has newlines
      expect(jsonStr).toContain('\n');
    });

    it('can produce compact JSON', () => {
      const workout = makeWorkout();
      const jsonStr = workoutToJsonString(workout, false);

      // Compact JSON has no newlines (single line)
      expect(jsonStr.split('\n')).toHaveLength(1);
    });
  });

  describe('workoutsToJsonString', () => {
    it('produces valid JSON for bulk export', () => {
      const workouts = [makeWorkout('A'), makeWorkout('B')];
      const jsonStr = workoutsToJsonString(workouts);

      const parsed = JSON.parse(jsonStr);
      expect(parsed.metadata.workoutCount).toBe(2);
      expect(parsed.workouts).toHaveLength(2);
    });
  });
});
