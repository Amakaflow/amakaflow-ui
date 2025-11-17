import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateWorkoutStructure,
  autoMapWorkout,
  validateWorkout,
  getExerciseSuggestions,
  processWorkflow,
} from '../mock-api';
import { WorkoutStructure, SourceType } from '../../types/workout';

describe('mock-api', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateWorkoutStructure', () => {
    it('should generate a workout structure from sources', async () => {
      const sources = [
        { type: 'instagram' as SourceType, content: 'test workout' },
      ];

      const promise = generateWorkoutStructure(sources);
      vi.advanceTimersByTime(1500);
      const result = await promise;

      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('blocks');
      expect(result.blocks).toBeInstanceOf(Array);
      expect(result.blocks.length).toBeGreaterThan(0);
      expect(result.source).toContain('instagram:test workout');
    });

    it('should handle multiple sources', async () => {
      const sources = [
        { type: 'youtube' as SourceType, content: 'video 1' },
        { type: 'image' as SourceType, content: 'image 1' },
      ];

      const promise = generateWorkoutStructure(sources);
      vi.advanceTimersByTime(1500);
      const result = await promise;

      expect(result.source).toContain('youtube:video 1');
      expect(result.source).toContain('image:image 1');
    });

    it('should include exercises in the structure', async () => {
      const sources = [{ type: 'ai-text' as SourceType, content: 'workout' }];

      const promise = generateWorkoutStructure(sources);
      vi.advanceTimersByTime(1500);
      const result = await promise;

      const hasExercises = result.blocks.some(
        (block) =>
          (block.exercises && block.exercises.length > 0) ||
          (block.supersets && block.supersets.length > 0)
      );
      expect(hasExercises).toBe(true);
    });
  });

  describe('validateWorkout', () => {
    it('should validate a workout structure', async () => {
      const workout: WorkoutStructure = {
        title: 'Test Workout',
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
      };

      const promise = validateWorkout(workout);
      vi.advanceTimersByTime(1000);
      const result = await promise;

      expect(result).toHaveProperty('total_exercises');
      expect(result).toHaveProperty('validated_exercises');
      expect(result).toHaveProperty('needs_review');
      expect(result).toHaveProperty('unmapped_exercises');
      expect(result).toHaveProperty('can_proceed');
      expect(result.total_exercises).toBeGreaterThan(0);
    });

    it('should categorize exercises correctly', async () => {
      const workout: WorkoutStructure = {
        title: 'Test',
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
              {
                name: 'Exercise 3',
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
            supersets: [],
          },
        ],
      };

      const promise = validateWorkout(workout);
      vi.advanceTimersByTime(1000);
      const result = await promise;

      expect(result.total_exercises).toBe(3);
      expect(result.validated_exercises.length + result.needs_review.length + result.unmapped_exercises.length).toBe(3);
    });

    it('should handle workouts with supersets', async () => {
      const workout: WorkoutStructure = {
        title: 'Test',
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
                    name: 'Superset Exercise 1',
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

      const promise = validateWorkout(workout);
      vi.advanceTimersByTime(1000);
      const result = await promise;

      expect(result.total_exercises).toBe(1);
    });

    it('should set can_proceed to false when there are unmapped exercises', async () => {
      const workout: WorkoutStructure = {
        title: 'Test',
        source: 'test',
        blocks: [
          {
            label: 'Block 1',
            structure: null,
            rest_between_sec: null,
            time_work_sec: null,
            default_reps_range: null,
            default_sets: null,
            exercises: Array(10).fill(null).map((_, i) => ({
              name: `Exercise ${i}`,
              sets: null,
              reps: null,
              reps_range: null,
              duration_sec: null,
              rest_sec: null,
              distance_m: null,
              distance_range: null,
              type: 'strength',
            })),
            supersets: [],
          },
        ],
      };

      const promise = validateWorkout(workout);
      vi.advanceTimersByTime(1000);
      const result = await promise;

      // With 10 exercises, some should be unmapped (15% of total)
      if (result.unmapped_exercises.length > 0) {
        expect(result.can_proceed).toBe(false);
      }
    });
  });

  describe('autoMapWorkout', () => {
    it('should generate export formats from workout structure', async () => {
      const workout: WorkoutStructure = {
        title: 'Test Workout',
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
      };

      const promise = autoMapWorkout(workout);
      vi.advanceTimersByTime(1200);
      const result = await promise;

      expect(result).toHaveProperty('yaml');
      expect(result).toHaveProperty('plist');
      expect(result).toHaveProperty('zwo');
      expect(result).toHaveProperty('fit');
      expect(result.yaml).toContain('Test Workout');
      expect(result.plist).toContain('Test Workout');
      expect(result.zwo).toContain('Test Workout');
    });

    it('should include exercise data in YAML format', async () => {
      const workout: WorkoutStructure = {
        title: 'Test',
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
                name: 'Squats',
                sets: 3,
                reps: 12,
                reps_range: null,
                duration_sec: null,
                rest_sec: 60,
                distance_m: null,
                distance_range: null,
                type: 'strength',
              },
            ],
            supersets: [],
          },
        ],
      };

      const promise = autoMapWorkout(workout);
      vi.advanceTimersByTime(1200);
      const result = await promise;

      expect(result.yaml).toContain('Squats');
      expect(result.yaml).toContain('sets: 3');
      expect(result.yaml).toContain('repetitionValue: 12');
    });
  });

  describe('getExerciseSuggestions', () => {
    it('should return suggestions for known exercises', async () => {
      const promise = getExerciseSuggestions('squat');
      vi.advanceTimersByTime(500);
      const result = await promise;

      expect(result).toHaveProperty('input');
      expect(result).toHaveProperty('best_match');
      expect(result).toHaveProperty('similar_exercises');
      expect(result.input).toBe('squat');
      expect(result.best_match).not.toBeNull();
      expect(result.needs_user_search).toBe(false);
    });

    it('should return empty suggestions for unknown exercises', async () => {
      const promise = getExerciseSuggestions('unknown exercise xyz');
      vi.advanceTimersByTime(500);
      const result = await promise;

      expect(result.best_match).toBeNull();
      expect(result.similar_exercises).toEqual([]);
      expect(result.needs_user_search).toBe(true);
    });

    it('should categorize exercises correctly', async () => {
      const promise = getExerciseSuggestions('bench press');
      vi.advanceTimersByTime(500);
      const result = await promise;

      expect(result.category).toBe('bench');
      expect(result.best_match).not.toBeNull();
    });
  });

  describe('processWorkflow', () => {
    it('should process a workout and return export formats', async () => {
      const workout: WorkoutStructure = {
        title: 'Test',
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
            ],
            supersets: [],
          },
        ],
      };

      const promise = processWorkflow(workout, true);
      // Advance timers for both processWorkflow (1500ms) and autoMapWorkout (1200ms)
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toHaveProperty('yaml');
      expect(result).toHaveProperty('plist');
      expect(result).toHaveProperty('zwo');
      expect(result).toHaveProperty('fit');
    }, 10000); // Increase timeout
  });
});

