import { describe, it, expect } from 'vitest';
import { SAMPLE_HYROX_WORKOUT } from '../sample-workout';

describe('SAMPLE_HYROX_WORKOUT', () => {
  it('has a title', () => {
    expect(SAMPLE_HYROX_WORKOUT.title).toBeDefined();
    expect(typeof SAMPLE_HYROX_WORKOUT.title).toBe('string');
  });

  it('has blocks', () => {
    expect(Array.isArray(SAMPLE_HYROX_WORKOUT.blocks)).toBe(true);
    expect(SAMPLE_HYROX_WORKOUT.blocks.length).toBeGreaterThan(0);
  });

  it('has source set to sample', () => {
    expect(SAMPLE_HYROX_WORKOUT.source).toBe('sample');
  });

  it('each block has exercises', () => {
    for (const block of SAMPLE_HYROX_WORKOUT.blocks) {
      expect(Array.isArray(block.exercises)).toBe(true);
    }
  });

  it('exercises have names', () => {
    for (const block of SAMPLE_HYROX_WORKOUT.blocks) {
      for (const exercise of block.exercises) {
        expect(exercise.name).toBeDefined();
        expect(typeof exercise.name).toBe('string');
        expect(exercise.name.length).toBeGreaterThan(0);
      }
    }
  });
});
