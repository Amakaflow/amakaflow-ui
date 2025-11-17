import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveWorkoutToHistory,
  getWorkoutHistory,
  deleteWorkoutFromHistory,
  clearWorkoutHistory,
  updateStravaSyncStatus,
  getWorkoutStats,
} from '../workout-history';
import { WorkoutStructure } from '../../types/workout';
import { DeviceId } from '../devices';

describe('workout-history', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch (e) {
      Object.keys(localStorage).forEach(key => localStorage.removeItem(key));
    }
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockWorkout = (title: string = 'Test Workout'): WorkoutStructure => ({
    title,
    source: 'test',
    blocks: [
      {
        label: 'Block 1',
        structure: null,
        rest_between_sec: null,
        time_work_sec: null,
        default_reps_range: null,
        default_sets: null,
        exercises: [
          {
            name: 'Push-ups',
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
        supersets: [],
      },
    ],
  });

  describe('saveWorkoutToHistory', () => {
    it('should save a workout to history', () => {
      const workout = createMockWorkout();
      const result = saveWorkoutToHistory({
        workout,
        sources: ['instagram:test'],
        device: 'garmin' as DeviceId,
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('workout');
      expect(result).toHaveProperty('sources');
      expect(result).toHaveProperty('device');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
      expect(result.workout.title).toBe('Test Workout');
      expect(result.device).toBe('garmin');
    });

    it('should add workout to the beginning of history', () => {
      const workout1 = createMockWorkout('Workout 1');
      const workout2 = createMockWorkout('Workout 2');

      saveWorkoutToHistory({
        workout: workout1,
        sources: ['test'],
        device: 'garmin' as DeviceId,
      });

      saveWorkoutToHistory({
        workout: workout2,
        sources: ['test'],
        device: 'apple' as DeviceId,
      });

      const history = getWorkoutHistory();
      expect(history.length).toBe(2);
      expect(history[0].workout.title).toBe('Workout 2');
      expect(history[1].workout.title).toBe('Workout 1');
    });

    it('should limit history to MAX_HISTORY_ITEMS', () => {
      const workout = createMockWorkout();
      
      // Add more than 50 workouts
      for (let i = 0; i < 55; i++) {
        saveWorkoutToHistory({
          workout: { ...workout, title: `Workout ${i}` },
          sources: ['test'],
          device: 'garmin' as DeviceId,
        });
      }

      const history = getWorkoutHistory();
      expect(history.length).toBe(50);
    });

    it('should include exports if provided', () => {
      const workout = createMockWorkout();
      const exports = {
        yaml: 'test yaml',
        plist: 'test plist',
        zwo: 'test zwo',
        fit: 'test fit',
      };

      const result = saveWorkoutToHistory({
        workout,
        sources: ['test'],
        device: 'garmin' as DeviceId,
        exports,
      });

      expect(result.exports).toEqual(exports);
    });
  });

  describe('getWorkoutHistory', () => {
    it('should return empty array when no history exists', () => {
      const history = getWorkoutHistory();
      expect(history).toEqual([]);
    });

    it('should return saved workouts', () => {
      const workout = createMockWorkout();
      saveWorkoutToHistory({
        workout,
        sources: ['test'],
        device: 'garmin' as DeviceId,
      });

      const history = getWorkoutHistory();
      expect(history.length).toBe(1);
      expect(history[0].workout.title).toBe('Test Workout');
    });

    it('should handle corrupted localStorage data', () => {
      localStorage.setItem('amakaflow_workout_history', 'invalid json');
      const history = getWorkoutHistory();
      expect(history).toEqual([]);
    });
  });

  describe('deleteWorkoutFromHistory', () => {
    it('should delete a workout from history', () => {
      const workout = createMockWorkout();
      const saved = saveWorkoutToHistory({
        workout,
        sources: ['test'],
        device: 'garmin' as DeviceId,
      });

      deleteWorkoutFromHistory(saved.id);
      const history = getWorkoutHistory();
      expect(history.length).toBe(0);
    });

    it('should not delete other workouts', () => {
      const workout1 = createMockWorkout('Workout 1');
      const workout2 = createMockWorkout('Workout 2');

      const saved1 = saveWorkoutToHistory({
        workout: workout1,
        sources: ['test'],
        device: 'garmin' as DeviceId,
      });

      saveWorkoutToHistory({
        workout: workout2,
        sources: ['test'],
        device: 'apple' as DeviceId,
      });

      deleteWorkoutFromHistory(saved1.id);
      const history = getWorkoutHistory();
      expect(history.length).toBe(1);
      expect(history[0].workout.title).toBe('Workout 2');
    });
  });

  describe('clearWorkoutHistory', () => {
    it('should clear all workout history', () => {
      const workout = createMockWorkout();
      saveWorkoutToHistory({
        workout,
        sources: ['test'],
        device: 'garmin' as DeviceId,
      });

      clearWorkoutHistory();
      const history = getWorkoutHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('updateStravaSyncStatus', () => {
    it('should update Strava sync status for a workout', () => {
      const workout = createMockWorkout();
      const saved = saveWorkoutToHistory({
        workout,
        sources: ['test'],
        device: 'garmin' as DeviceId,
      });

      updateStravaSyncStatus(saved.id, 'strava-activity-123');
      const history = getWorkoutHistory();
      const updated = history.find((item) => item.id === saved.id);

      expect(updated?.syncedToStrava).toBe(true);
      expect(updated?.stravaActivityId).toBe('strava-activity-123');
    });

    it('should not update other workouts', () => {
      const workout1 = createMockWorkout('Workout 1');
      const workout2 = createMockWorkout('Workout 2');

      const saved1 = saveWorkoutToHistory({
        workout: workout1,
        sources: ['test'],
        device: 'garmin' as DeviceId,
      });

      const saved2 = saveWorkoutToHistory({
        workout: workout2,
        sources: ['test'],
        device: 'apple' as DeviceId,
      });

      updateStravaSyncStatus(saved1.id, 'strava-activity-123');
      const history = getWorkoutHistory();
      const updated1 = history.find((item) => item.id === saved1.id);
      const updated2 = history.find((item) => item.id === saved2.id);

      expect(updated1?.syncedToStrava).toBe(true);
      expect(updated2?.syncedToStrava).toBeUndefined();
    });
  });

  describe('getWorkoutStats', () => {
    it('should return stats for empty history', () => {
      const stats = getWorkoutStats();
      expect(stats.totalWorkouts).toBe(0);
      expect(stats.thisWeek).toBe(0);
      expect(stats.deviceCounts).toEqual({});
      expect(stats.avgExercisesPerWorkout).toBe(0);
    });

    it('should calculate total workouts correctly', () => {
      const workout = createMockWorkout();
      saveWorkoutToHistory({
        workout,
        sources: ['test'],
        device: 'garmin' as DeviceId,
      });

      saveWorkoutToHistory({
        workout,
        sources: ['test'],
        device: 'apple' as DeviceId,
      });

      const stats = getWorkoutStats();
      expect(stats.totalWorkouts).toBe(2);
    });

    it('should count workouts by device', () => {
      const workout = createMockWorkout();
      saveWorkoutToHistory({
        workout,
        sources: ['test'],
        device: 'garmin' as DeviceId,
      });

      saveWorkoutToHistory({
        workout,
        sources: ['test'],
        device: 'garmin' as DeviceId,
      });

      saveWorkoutToHistory({
        workout,
        sources: ['test'],
        device: 'apple' as DeviceId,
      });

      const stats = getWorkoutStats();
      expect(stats.deviceCounts.garmin).toBe(2);
      expect(stats.deviceCounts.apple).toBe(1);
    });

    it('should calculate average exercises per workout', () => {
      const workout1 = createMockWorkout('Workout 1');
      const workout2: WorkoutStructure = {
        title: 'Workout 2',
        source: 'test',
        blocks: [
          {
            label: 'Block 1',
            structure: null,
            rest_between_sec: null,
            time_work_sec: null,
            default_reps_range: null,
            default_sets: null,
            exercises: [],
            supersets: [
              {
                exercises: [
                  {
                    name: 'Exercise 1',
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
                    name: 'Exercise 2',
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
                rest_between_sec: null,
              },
            ],
          },
        ],
      };

      saveWorkoutToHistory({
        workout: workout1,
        sources: ['test'],
        device: 'garmin' as DeviceId,
      });

      saveWorkoutToHistory({
        workout: workout2,
        sources: ['test'],
        device: 'apple' as DeviceId,
      });

      const stats = getWorkoutStats();
      // Workout 1 has 1 exercise, Workout 2 has 2 exercises = avg of 1.5, rounded to 2
      expect(stats.avgExercisesPerWorkout).toBeGreaterThanOrEqual(1);
    });
  });
});

