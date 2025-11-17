import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../storage';
import { WorkoutStructure } from '../../types/workout';

describe('storage', () => {
  beforeEach(() => {
    try {
      localStorage.clear();
    } catch (e) {
      Object.keys(localStorage).forEach(key => localStorage.removeItem(key));
    }
  });

  describe('getUser', () => {
    it('should return null when no user is stored', () => {
      expect(storage.getUser()).toBeNull();
    });

    it('should return stored user', () => {
      const user = { id: '1', name: 'Test User', email: 'test@example.com' };
      storage.setUser(user);
      expect(storage.getUser()).toEqual(user);
    });
  });

  describe('setUser', () => {
    it('should store user in localStorage', () => {
      const user = { id: '1', name: 'Test User', email: 'test@example.com' };
      storage.setUser(user);
      const stored = localStorage.getItem('amakaflow_user');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(user);
    });

    it('should overwrite existing user', () => {
      const user1 = { id: '1', name: 'User 1' };
      const user2 = { id: '2', name: 'User 2' };
      storage.setUser(user1);
      storage.setUser(user2);
      expect(storage.getUser()).toEqual(user2);
    });
  });

  describe('clearUser', () => {
    it('should remove user from localStorage', () => {
      storage.setUser({ id: '1', name: 'Test' });
      storage.clearUser();
      expect(storage.getUser()).toBeNull();
    });
  });

  describe('getWorkouts', () => {
    it('should return empty array when no workouts are stored', () => {
      expect(storage.getWorkouts()).toEqual([]);
    });

    it('should return stored workouts', () => {
      const workout: WorkoutStructure = {
        title: 'Test Workout',
        source: 'test',
        blocks: [],
      };

      const savedWorkout = {
        id: '1',
        workout,
        device: 'garmin',
        createdAt: new Date().toISOString(),
      };

      storage.saveWorkout(savedWorkout);
      const workouts = storage.getWorkouts();
      expect(workouts.length).toBe(1);
      expect(workouts[0].id).toBe('1');
    });
  });

  describe('saveWorkout', () => {
    it('should save a new workout', () => {
      const workout: WorkoutStructure = {
        title: 'Test Workout',
        source: 'test',
        blocks: [],
      };

      const savedWorkout = {
        id: '1',
        workout,
        device: 'garmin',
        createdAt: new Date().toISOString(),
      };

      storage.saveWorkout(savedWorkout);
      const workouts = storage.getWorkouts();
      expect(workouts.length).toBe(1);
      expect(workouts[0]).toEqual(savedWorkout);
    });

    it('should update existing workout', () => {
      const workout: WorkoutStructure = {
        title: 'Test Workout',
        source: 'test',
        blocks: [],
      };

      const savedWorkout = {
        id: '1',
        workout,
        device: 'garmin',
        createdAt: new Date().toISOString(),
      };

      storage.saveWorkout(savedWorkout);
      
      const updatedWorkout = {
        ...savedWorkout,
        workout: { ...workout, title: 'Updated Workout' },
      };

      storage.saveWorkout(updatedWorkout);
      const workouts = storage.getWorkouts();
      expect(workouts.length).toBe(1);
      expect(workouts[0].workout.title).toBe('Updated Workout');
    });

    it('should add multiple workouts', () => {
      const workout1: WorkoutStructure = {
        title: 'Workout 1',
        source: 'test',
        blocks: [],
      };

      const workout2: WorkoutStructure = {
        title: 'Workout 2',
        source: 'test',
        blocks: [],
      };

      storage.saveWorkout({
        id: '1',
        workout: workout1,
        device: 'garmin',
        createdAt: new Date().toISOString(),
      });

      storage.saveWorkout({
        id: '2',
        workout: workout2,
        device: 'apple',
        createdAt: new Date().toISOString(),
      });

      const workouts = storage.getWorkouts();
      expect(workouts.length).toBe(2);
    });
  });

  describe('deleteWorkout', () => {
    it('should delete a workout by id', () => {
      const workout: WorkoutStructure = {
        title: 'Test Workout',
        source: 'test',
        blocks: [],
      };

      storage.saveWorkout({
        id: '1',
        workout,
        device: 'garmin',
        createdAt: new Date().toISOString(),
      });

      storage.deleteWorkout('1');
      const workouts = storage.getWorkouts();
      expect(workouts.length).toBe(0);
    });

    it('should not delete other workouts', () => {
      const workout1: WorkoutStructure = {
        title: 'Workout 1',
        source: 'test',
        blocks: [],
      };

      const workout2: WorkoutStructure = {
        title: 'Workout 2',
        source: 'test',
        blocks: [],
      };

      storage.saveWorkout({
        id: '1',
        workout: workout1,
        device: 'garmin',
        createdAt: new Date().toISOString(),
      });

      storage.saveWorkout({
        id: '2',
        workout: workout2,
        device: 'apple',
        createdAt: new Date().toISOString(),
      });

      storage.deleteWorkout('1');
      const workouts = storage.getWorkouts();
      expect(workouts.length).toBe(1);
      expect(workouts[0].id).toBe('2');
    });
  });

  describe('incrementWorkoutCount', () => {
    it('should increment workout count from 0 to 1', () => {
      storage.incrementWorkoutCount();
      expect(storage.getWorkoutCount()).toBe(1);
    });

    it('should increment workout count multiple times', () => {
      storage.incrementWorkoutCount();
      storage.incrementWorkoutCount();
      storage.incrementWorkoutCount();
      expect(storage.getWorkoutCount()).toBe(3);
    });
  });

  describe('getWorkoutCount', () => {
    it('should return 0 when no count is stored', () => {
      expect(storage.getWorkoutCount()).toBe(0);
    });

    it('should return stored count', () => {
      storage.incrementWorkoutCount();
      storage.incrementWorkoutCount();
      expect(storage.getWorkoutCount()).toBe(2);
    });
  });
});

