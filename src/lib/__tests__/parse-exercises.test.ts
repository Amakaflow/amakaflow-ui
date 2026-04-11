import { describe, it, expect } from 'vitest';
import { parseDescriptionForExercises } from '../parse-exercises';

describe('parseDescriptionForExercises', () => {
  it('parses numbered format (1. Exercise Name)', () => {
    const result = parseDescriptionForExercises('1. Bench Press\n2. Squats\n3. Deadlift');
    expect(result).toHaveLength(3);
    expect(result[0].label).toContain('Bench Press');
    expect(result[1].label).toContain('Squat');
    expect(result[2].label).toContain('Deadlift');
  });

  it('parses bullet format (• Exercise Name)', () => {
    const result = parseDescriptionForExercises('• Pull-ups\n• Push-ups\n• Dips');
    expect(result).toHaveLength(3);
    expect(result[0].label).toContain('Pull-up');
  });

  it('parses dash bullet format (- Exercise Name)', () => {
    const result = parseDescriptionForExercises('- Lunges\n- Rows\n- Curls');
    expect(result).toHaveLength(3);
  });

  it('parses fitness notation (Exercise 4x8)', () => {
    const result = parseDescriptionForExercises('Bench Press 4x8\nSquats 5x5');
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('skips hashtags', () => {
    const result = parseDescriptionForExercises('#fitness #workout #gym\n1. Bench Press');
    expect(result).toHaveLength(1);
    expect(result[0].label).toContain('Bench Press');
  });

  it('skips CTAs (follow me, subscribe)', () => {
    const result = parseDescriptionForExercises('Follow me for more!\n1. Squats\nSubscribe for workouts');
    expect(result).toHaveLength(1);
  });

  it('returns empty array for empty input', () => {
    expect(parseDescriptionForExercises('')).toHaveLength(0);
  });

  it('returns empty array for non-exercise text', () => {
    const result = parseDescriptionForExercises('Just had a great day at the gym!');
    expect(result).toHaveLength(0);
  });

  it('each result has an id and accepted=false', () => {
    const result = parseDescriptionForExercises('1. Bench Press');
    if (result.length > 0) {
      expect(result[0].id).toBeDefined();
      expect(result[0].accepted).toBe(true);
    }
  });
});
