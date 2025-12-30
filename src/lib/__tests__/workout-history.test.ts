// ui/src/lib/__tests__/workout-history.test.ts
import { vi } from 'vitest';
import {
  saveWorkoutToHistory,
  getWorkoutHistory,
  deleteWorkoutFromHistory,
  clearWorkoutHistory,
  updateStravaSyncStatus,
  getWorkoutStats,
} from '../workout-history';

const STORAGE_KEY = 'amakaflow_workout_history';

describe('workout-history', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('saveWorkoutToHistory', () => {
    it('should save a workout to history', async () => {
      const result = await saveWorkoutToHistory({
        workout: { title: 'Test Workout', blocks: [] } as any,
        sources: [],
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('workout');
      expect(result).toHaveProperty('sources');

      const raw = localStorage.getItem(STORAGE_KEY);
      expect(raw).not.toBeNull();
    });

    it('should add workout to the beginning of history', async () => {
      await saveWorkoutToHistory({
        workout: { title: 'Workout 1', blocks: [] } as any,
        sources: [],
      });
      await saveWorkoutToHistory({
        workout: { title: 'Workout 2', blocks: [] } as any,
        sources: [],
      });

      const history = await getWorkoutHistory();
      expect(history.length).toBe(2);
      expect(history[0].workout.title).toBe('Workout 2');
      expect(history[1].workout.title).toBe('Workout 1');
    });

    it('should limit history to MAX_HISTORY_ITEMS', async () => {
      for (let i = 0; i < 60; i++) {
        await saveWorkoutToHistory({
          workout: { title: `Workout ${i}`, blocks: [] } as any,
          sources: [],
        });
      }

      const history = await getWorkoutHistory();
      expect(history.length).toBe(50);
    });

    it('should include exports if provided', async () => {
      const exports = {
        yaml: 'test yaml',
        fit: 'test fit',
        plist: 'test plist',
        zwo: 'test zwo',
      };

      const result = await saveWorkoutToHistory({
        workout: { title: 'Test Workout', blocks: [] } as any,
        sources: [],
        exports,
      });

      expect(result.exports).toEqual(exports);
    });
  });

  describe('getWorkoutHistory', () => {
    it('should return empty array when no history exists', async () => {
      const history = await getWorkoutHistory();
      expect(history).toEqual([]);
    });

    it('should return saved workouts', async () => {
      await saveWorkoutToHistory({
        workout: { title: 'Test Workout', blocks: [] } as any,
        sources: [],
      });

      const history = await getWorkoutHistory();
      expect(history.length).toBe(1);
      expect(history[0].workout.title).toBe('Test Workout');
    });

    it('should handle corrupted localStorage data', async () => {
      localStorage.setItem(STORAGE_KEY, 'invalid json');
      const history = await getWorkoutHistory();
      expect(history).toEqual([]);
    });
  });

  describe('deleteWorkoutFromHistory', () => {
    it('should delete a workout from history', async () => {
      const saved = await saveWorkoutToHistory({
        workout: { title: 'Test Workout', blocks: [] } as any,
        sources: [],
      });

      await deleteWorkoutFromHistory(saved.id);
      const history = await getWorkoutHistory();
      expect(history.length).toBe(0);
    });

    it('should not delete other workouts', async () => {
      const saved1 = await saveWorkoutToHistory({
        workout: { title: 'Workout 1', blocks: [] } as any,
        sources: [],
      });
      await saveWorkoutToHistory({
        workout: { title: 'Workout 2', blocks: [] } as any,
        sources: [],
      });

      await deleteWorkoutFromHistory(saved1.id);
      const history = await getWorkoutHistory();
      expect(history.length).toBe(1);
      expect(history[0].workout.title).toBe('Workout 2');
    });
  });

  describe('clearWorkoutHistory', () => {
    it('should clear all workout history', async () => {
      await saveWorkoutToHistory({
        workout: { title: 'Test Workout', blocks: [] } as any,
        sources: [],
      });

      await clearWorkoutHistory();
      const history = await getWorkoutHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('updateStravaSyncStatus', () => {
    it('should update Strava sync status for a workout', async () => {
      const saved = await saveWorkoutToHistory({
        workout: { title: 'Test Workout', blocks: [] } as any,
        sources: [],
      });

      await updateStravaSyncStatus(saved.id, 'activity-123');

      const history = await getWorkoutHistory();
      expect(history[0].syncedToStrava).toBe(true);
      expect(history[0].stravaActivityId).toBe('activity-123');
    });

    it('should not update other workouts', async () => {
      const saved1 = await saveWorkoutToHistory({
        workout: { title: 'Workout 1', blocks: [] } as any,
        sources: [],
      });
      await saveWorkoutToHistory({
        workout: { title: 'Workout 2', blocks: [] } as any,
        sources: [],
      });

      await updateStravaSyncStatus(saved1.id, 'activity-123');

      const history = await getWorkoutHistory();
      expect(history[0].syncedToStrava).toBe(true);
      expect(history[1].syncedToStrava).not.toBe(true);
    });
  });

  describe('getWorkoutStats', () => {
    it('should return stats for empty history', async () => {
      const stats = await getWorkoutStats();
      expect(stats.totalWorkouts).toBe(0);
      expect(stats.thisWeek).toBe(0);
      expect(stats.deviceCounts).toEqual({});
      expect(stats.avgExercisesPerWorkout).toBe(0);
    });
  });

  // AMA-206: Test that workoutId parameter is passed to API for updates
  describe('saveWorkoutToHistory with workoutId (AMA-206)', () => {
    it('should pass workoutId to API for explicit updates', async () => {
      // Mock the workout-api module using Vitest
      const mockSaveWorkoutToAPI = vi.fn().mockResolvedValue({
        id: 'existing-workout-123',
        workout_data: { title: 'Updated Workout', blocks: [] },
        sources: ['text:test'],
        device: 'garmin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Use vi.doMock to mock the module before importing
      vi.doMock('../workout-api', () => ({
        saveWorkoutToAPI: mockSaveWorkoutToAPI,
      }));

      // Clear the module cache to pick up the mock
      vi.resetModules();

      // Re-import the function to use the mocked version
      const { saveWorkoutToHistory: saveWithMock } = await import('../workout-history');

      // Call with workoutId parameter
      await saveWithMock(
        'user-123',
        { title: 'Updated Workout', blocks: [] } as any,
        'garmin',
        undefined, // exports
        ['text:test'], // sources
        undefined, // validation
        'existing-workout-123' // workoutId - this is the key fix for AMA-206
      );

      // Verify saveWorkoutToAPI was called with workout_id
      expect(mockSaveWorkoutToAPI).toHaveBeenCalledWith(
        expect.objectContaining({
          profile_id: 'user-123',
          workout_data: expect.objectContaining({ title: 'Updated Workout' }),
          device: 'garmin',
          workout_id: 'existing-workout-123', // This is the critical assertion
        })
      );

      // Clean up mock
      vi.doUnmock('../workout-api');
      vi.resetModules();
    });

    it('should not pass workoutId when not provided (new workout)', async () => {
      const mockSaveWorkoutToAPI = vi.fn().mockResolvedValue({
        id: 'new-workout-456',
        workout_data: { title: 'New Workout', blocks: [] },
        sources: ['text:test'],
        device: 'garmin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      vi.doMock('../workout-api', () => ({
        saveWorkoutToAPI: mockSaveWorkoutToAPI,
      }));

      vi.resetModules();

      const { saveWorkoutToHistory: saveWithMock } = await import('../workout-history');

      // Call without workoutId parameter
      await saveWithMock(
        'user-123',
        { title: 'New Workout', blocks: [] } as any,
        'garmin',
        undefined,
        ['text:test'],
        undefined
        // No workoutId - this is a new workout
      );

      // Verify saveWorkoutToAPI was called without workout_id (or with undefined)
      expect(mockSaveWorkoutToAPI).toHaveBeenCalledWith(
        expect.objectContaining({
          profile_id: 'user-123',
          workout_data: expect.objectContaining({ title: 'New Workout' }),
          device: 'garmin',
        })
      );

      // The workout_id should be undefined for new workouts
      const callArg = mockSaveWorkoutToAPI.mock.calls[0][0];
      expect(callArg.workout_id).toBeUndefined();

      vi.doUnmock('../workout-api');
      vi.resetModules();
    });
  });
});