import { describe, it, expect } from 'vitest';
import { normalizeWorkoutStructure } from '../api';
import type { WorkoutStructure } from '../../types/workout';

describe('normalizeWorkoutStructure', () => {
  it('adds default block when workout has no blocks', () => {
    const workout = { title: 'Test', source: 'manual', blocks: [] } as WorkoutStructure;
    const result = normalizeWorkoutStructure(workout);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].label).toBe('Workout');
  });

  it('preserves title and source when provided', () => {
    const workout = {
      title: 'My Workout',
      source: 'instagram',
      blocks: [{ label: 'Warmup', structure: null, exercises: [] } as any],
    } as WorkoutStructure;
    const result = normalizeWorkoutStructure(workout);
    expect(result.title).toBe('My Workout');
    expect(result.source).toBe('instagram');
  });

  it('defaults title when missing', () => {
    const workout = { blocks: [] } as any;
    const result = normalizeWorkoutStructure(workout);
    expect(result.title).toBe('Imported Workout');
    expect(result.source).toBe('unknown');
  });

  it('normalizes block labels (uses label, structure, or Block N)', () => {
    const workout = {
      title: 'Test',
      source: 'test',
      blocks: [
        { label: '', structure: 'circuit', exercises: [] } as any,
        { label: '', structure: null, exercises: [] } as any,
      ],
    } as WorkoutStructure;
    const result = normalizeWorkoutStructure(workout);
    expect(result.blocks[0].label).toBe('circuit');
    expect(result.blocks[1].label).toBe('Block 2');
  });

  it('infers superset structure when block has supersets', () => {
    const workout = {
      title: 'Test',
      source: 'test',
      blocks: [{
        label: 'Main',
        structure: null,
        exercises: [],
        supersets: [{ exercises: [], rest_between_sec: 30 }],
      } as any],
    } as WorkoutStructure;
    const result = normalizeWorkoutStructure(workout);
    expect(result.blocks[0].structure).toBe('superset');
  });

  it('preserves block numeric fields when present', () => {
    const workout = {
      title: 'Test',
      source: 'test',
      blocks: [{
        label: 'Main',
        structure: 'circuit',
        rounds: 4,
        rest_between_rounds_sec: 30,
        exercises: [],
      } as any],
    } as WorkoutStructure;
    const result = normalizeWorkoutStructure(workout);
    expect(result.blocks[0].rounds).toBe(4);
    expect(result.blocks[0].rest_between_rounds_sec).toBe(30);
  });
});
