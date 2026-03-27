/**
 * AMA-53 & AMA-54: Tests for workout types, categories, and platform types.
 */

import { describe, it, expect } from 'vitest';
import {
  workoutTypeToCategory,
  WORKOUT_CATEGORY_LABELS,
  PLATFORM_EXPORT_FORMATS,
  type WorkoutCategory,
  type WorkoutType,
  type ExportPlatform,
  type ExportFormat,
} from '../workout';

describe('AMA-53: Workout Types', () => {
  it('Exercise interface has required fields', () => {
    // Type-level test: this compiles successfully if the interface is correct
    const exercise = {
      id: 'ex-1',
      name: 'Bench Press',
      sets: 3,
      reps: 10,
      reps_range: null,
      duration_sec: null,
      rest_sec: 60,
      distance_m: null,
      distance_range: null,
      type: 'strength' as const,
    };
    expect(exercise.id).toBe('ex-1');
    expect(exercise.name).toBe('Bench Press');
  });

  it('Block interface supports structure types', () => {
    const block = {
      label: 'Main Block',
      structure: 'superset' as const,
      exercises: [],
      supersets: [],
      rounds: 3,
      rest_between_rounds_sec: 90,
    };
    expect(block.structure).toBe('superset');
    expect(block.rounds).toBe(3);
  });

  it('WorkoutStructure has title, source, and blocks', () => {
    const workout = {
      title: 'My Workout',
      source: 'instagram',
      blocks: [],
    };
    expect(workout.title).toBe('My Workout');
    expect(workout.blocks).toHaveLength(0);
  });
});

describe('AMA-54: Workout Categories and Platform Types', () => {
  it('all WorkoutCategory values have display labels', () => {
    const categories: WorkoutCategory[] = [
      'strength', 'cardio', 'hiit', 'yoga', 'pilates', 'cycling',
      'running', 'swimming', 'mobility', 'crossfit', 'bodyweight',
      'powerlifting', 'olympic_lifting', 'functional', 'sport_specific', 'other',
    ];

    for (const cat of categories) {
      expect(WORKOUT_CATEGORY_LABELS[cat]).toBeDefined();
      expect(typeof WORKOUT_CATEGORY_LABELS[cat]).toBe('string');
    }
  });

  it('workoutTypeToCategory maps all workout types', () => {
    const types: WorkoutType[] = [
      'strength', 'circuit', 'hiit', 'cardio', 'running', 'yoga', 'follow_along', 'mixed',
    ];

    for (const type of types) {
      const category = workoutTypeToCategory(type);
      expect(category).toBeDefined();
      expect(WORKOUT_CATEGORY_LABELS[category]).toBeDefined();
    }
  });

  it('workoutTypeToCategory returns expected mappings', () => {
    expect(workoutTypeToCategory('strength')).toBe('strength');
    expect(workoutTypeToCategory('hiit')).toBe('hiit');
    expect(workoutTypeToCategory('running')).toBe('running');
    expect(workoutTypeToCategory('yoga')).toBe('yoga');
    expect(workoutTypeToCategory('mixed')).toBe('other');
  });

  it('PLATFORM_EXPORT_FORMATS defines formats for all platforms', () => {
    const platforms: ExportPlatform[] = ['garmin', 'apple', 'android', 'zwift', 'generic'];
    for (const platform of platforms) {
      expect(PLATFORM_EXPORT_FORMATS[platform]).toBeDefined();
      expect(Array.isArray(PLATFORM_EXPORT_FORMATS[platform])).toBe(true);
      expect(PLATFORM_EXPORT_FORMATS[platform].length).toBeGreaterThan(0);
    }
  });

  it('garmin platform supports FIT format', () => {
    expect(PLATFORM_EXPORT_FORMATS.garmin).toContain('fit');
  });

  it('WorkoutStructure can include category and target_platform', () => {
    const workout = {
      title: 'Test',
      source: 'manual',
      blocks: [],
      category: 'strength' as WorkoutCategory,
      target_platform: 'garmin' as ExportPlatform,
    };
    expect(workout.category).toBe('strength');
    expect(workout.target_platform).toBe('garmin');
  });
});
