import { describe, it, expect } from 'vitest';
import { searchExercises, calculateConfidence, exerciseLibrary } from '../exercise-library';

describe('exercise-library', () => {
  describe('searchExercises', () => {
    it('should return empty array for queries shorter than 2 characters', () => {
      expect(searchExercises('')).toEqual([]);
      expect(searchExercises('a')).toEqual([]);
    });

    it('should find exercises by name', () => {
      const results = searchExercises('push');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((ex) => ex.name.toLowerCase().includes('push'))).toBe(true);
    });

    it('should find exercises by alias', () => {
      const results = searchExercises('pushup');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((ex) => ex.aliases.includes('pushup'))).toBe(true);
    });

    it('should find exercises by category', () => {
      const results = searchExercises('upper');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((ex) => ex.category.toLowerCase().includes('upper'))).toBe(true);
    });

    it('should respect the limit parameter', () => {
      const results = searchExercises('squat', 3);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should be case insensitive', () => {
      const lowerResults = searchExercises('push');
      const upperResults = searchExercises('PUSH');
      expect(lowerResults.length).toBe(upperResults.length);
    });

    it('should return results sorted by relevance (implicit)', () => {
      const results = searchExercises('squat');
      // Should include exact matches first
      expect(results[0].name.toLowerCase()).toContain('squat');
    });
  });

  describe('calculateConfidence', () => {
    it('should return 0.95 for exact name match', () => {
      const item = exerciseLibrary[0]; // Push-ups
      const confidence = calculateConfidence(item.name, item);
      expect(confidence).toBe(0.95);
    });

    it('should return 0.90 for exact alias match', () => {
      const item = exerciseLibrary[0]; // Push-ups with alias 'pushup'
      const confidence = calculateConfidence('pushup', item);
      expect(confidence).toBe(0.90);
    });

    it('should return 0.75 for contains match', () => {
      const item = exerciseLibrary[0]; // Push-ups
      const confidence = calculateConfidence('Push', item);
      expect(confidence).toBe(0.75);
    });

    it('should return appropriate confidence for word match', () => {
      const item = exerciseLibrary[10]; // Squats
      const confidence = calculateConfidence('Back Squat', item);
      expect(confidence).toBeGreaterThan(0);
      // Word match can return up to 0.70, but may be higher if contains match applies
      expect(confidence).toBeLessThanOrEqual(0.90);
    });

    it('should return 0.0 for no match', () => {
      const item = exerciseLibrary[0]; // Push-ups
      const confidence = calculateConfidence('completely different exercise', item);
      expect(confidence).toBe(0.0);
    });

    it('should handle case insensitive matching', () => {
      const item = exerciseLibrary[0]; // Push-ups
      const confidence = calculateConfidence('PUSH-UPS', item);
      expect(confidence).toBe(0.95);
    });

    it('should calculate word match confidence based on matching words', () => {
      const item = exerciseLibrary[11]; // Deadlift
      const confidence = calculateConfidence('Conventional Deadlift', item);
      expect(confidence).toBeGreaterThan(0);
    });
  });

  describe('exerciseLibrary', () => {
    it('should contain exercise items', () => {
      expect(exerciseLibrary.length).toBeGreaterThan(0);
    });

    it('should have all required fields for each exercise', () => {
      exerciseLibrary.forEach((exercise) => {
        expect(exercise).toHaveProperty('id');
        expect(exercise).toHaveProperty('name');
        expect(exercise).toHaveProperty('category');
        expect(exercise).toHaveProperty('deviceId');
        expect(exercise).toHaveProperty('aliases');
        expect(Array.isArray(exercise.aliases)).toBe(true);
      });
    });

    it('should have unique IDs', () => {
      const ids = exerciseLibrary.map((ex) => ex.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have exercises from different categories', () => {
      const categories = new Set(exerciseLibrary.map((ex) => ex.category));
      expect(categories.size).toBeGreaterThan(1);
    });
  });
});

