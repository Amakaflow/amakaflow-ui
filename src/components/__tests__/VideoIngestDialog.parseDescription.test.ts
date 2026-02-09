import { describe, it, expect } from 'vitest';
import { parseDescriptionForExercises, type ParsedExerciseSuggestion } from '../../lib/parse-exercises';

describe('parseDescriptionForExercises', () => {
  it('should parse numbered format (existing behavior)', () => {
    const input = '1. Exercise A\n2. Exercise B';
    const result = parseDescriptionForExercises(input);
    
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Exercise A');
    expect(result[1].label).toBe('Exercise B');
  });

  it('should handle superset notation with + delimiter', () => {
    const input = 'Pull-ups 4x8 + Z Press 4x8';
    const result = parseDescriptionForExercises(input);
    
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Pull-ups');
    expect(result[1].label).toBe('Z Press');
  });

  it('should handle mixed formats with sets/reps', () => {
    const input = 'SA cable row 4x12 + SA DB press 4x8';
    const result = parseDescriptionForExercises(input);
    
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('SA cable row');
    expect(result[1].label).toBe('SA DB press');
  });

  it('should remove distance notation like 5 x 10m', () => {
    const input = 'Seated sled pull 5 x 10m';
    const result = parseDescriptionForExercises(input);
    
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Seated sled pull');
  });

  it('should handle complex full workout with multiple lines and supersets', () => {
    const input = `Workout: Pull-ups 4x8 + Z Press 4x8
SA cable row 4x12 + SA DB press 4x8
Seated sled pull 5 x 10m`;
    
    const result = parseDescriptionForExercises(input);
    
    expect(result).toHaveLength(5);
    expect(result[0].label).toBe('Pull-ups');
    expect(result[1].label).toBe('Z Press');
    expect(result[2].label).toBe('SA cable row');
    expect(result[3].label).toBe('SA DB press');
    expect(result[4].label).toBe('Seated sled pull');
  });

  it('should skip empty lines', () => {
    const input = '1. Exercise A\n\n\n2. Exercise B';
    const result = parseDescriptionForExercises(input);
    
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Exercise A');
    expect(result[1].label).toBe('Exercise B');
  });

  it('should parse content after "Workout:" label', () => {
    const input = 'Workout: Pull-ups 4x8\nPush-ups 3x10';
    const result = parseDescriptionForExercises(input);
    
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Pull-ups');
    expect(result[1].label).toBe('Push-ups');
  });

  it('should ignore very short names (< 2 chars)', () => {
    const input = '1. A\n2. BB\n3. Valid Exercise';
    const result = parseDescriptionForExercises(input);
    
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Valid Exercise');
  });

  it('should normalize multiple spaces', () => {
    const input = '1. Exercise    With    Spaces';
    const result = parseDescriptionForExercises(input);
    
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Exercise With Spaces');
  });

  it('should handle bullet format with •', () => {
    const input = '• Exercise A\n• Exercise B';
    const result = parseDescriptionForExercises(input);
    
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Exercise A');
    expect(result[1].label).toBe('Exercise B');
  });

  it('should handle bullet format with -', () => {
    const input = '- Exercise A\n- Exercise B';
    const result = parseDescriptionForExercises(input);
    
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Exercise A');
    expect(result[1].label).toBe('Exercise B');
  });

  it('should handle various set/rep formats', () => {
    const testCases = [
      { input: 'Squats 4x8', expected: 'Squats' },
      { input: 'Squats 4 x 8', expected: 'Squats' },
      { input: 'Squats 4×8', expected: 'Squats' }, // with times symbol
      { input: 'Squats 10x10', expected: 'Squats' },
      { input: 'Sprints 5 x 50m', expected: 'Sprints' },
      { input: 'Deadlift 3x5 + Rows 3x8', expected: ['Deadlift', 'Rows'] },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = parseDescriptionForExercises(input);
      if (Array.isArray(expected)) {
        expect(result).toHaveLength(expected.length);
        expected.forEach((exp, i) => {
          expect(result[i].label).toBe(exp);
        });
      } else {
        expect(result).toHaveLength(1);
        expect(result[0].label).toBe(expected);
      }
    });
  });

  it('should handle empty input', () => {
    expect(parseDescriptionForExercises('')).toEqual([]);
    expect(parseDescriptionForExercises('   ')).toEqual([]);
    expect(parseDescriptionForExercises('\n\n\n')).toEqual([]);
  });

  it('should clean up trailing annotations', () => {
    const input = '1. Exercise A → Supported\n2. Exercise B (Hard)\n3. Exercise C - Easy';
    const result = parseDescriptionForExercises(input);
    
    expect(result).toHaveLength(3);
    expect(result[0].label).toBe('Exercise A');
    expect(result[1].label).toBe('Exercise B');
    expect(result[2].label).toBe('Exercise C');
  });

  it('should handle mixed complex workout', () => {
    const input = `Workout: Full Body Day
1. Squats 4x8 + Lunges 3x10
• Push-ups 3x12
- Pull-ups 4x8 + Rows 3x12

Run 5 x 100m`;
    
    const result = parseDescriptionForExercises(input);
    
    // "Full Body Day" is skipped (no set/rep notation = title, not exercise)
    expect(result).toHaveLength(6);
    expect(result[0].label).toBe('Squats');
    expect(result[1].label).toBe('Lunges');
    expect(result[2].label).toBe('Push-ups');
    expect(result[3].label).toBe('Pull-ups');
    expect(result[4].label).toBe('Rows');
    expect(result[5].label).toBe('Run');
  });

  // New tests for Issue #3: Don't split compound names without set/rep notation
  it('should NOT split compound exercise names without sets/reps', () => {
    const input = 'Chin-up + Negative Hold';
    const result = parseDescriptionForExercises(input);
    
    // Should stay as one exercise since neither side has set/rep notation
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Chin-up + Negative Hold');
  });

  it('should skip hashtags', () => {
    const input = '1. Exercise A\n#fitness #legday\n2. Exercise B';
    const result = parseDescriptionForExercises(input);
    
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Exercise A');
    expect(result[1].label).toBe('Exercise B');
  });

  it('should skip CTAs like "Follow me for more!"', () => {
    const input = '1. Exercise A\nFollow me for more workouts!\n2. Exercise B';
    const result = parseDescriptionForExercises(input);
    
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Exercise A');
    expect(result[1].label).toBe('Exercise B');
  });

  it('should skip section headers', () => {
    const input = 'Upper Body:\n1. Exercise A\nLower Body:\n2. Exercise B';
    const result = parseDescriptionForExercises(input);

    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Exercise A');
    expect(result[1].label).toBe('Exercise B');
  });

  // Tests for round header skip pattern
  it('should skip "5 Rounds" as a round header, not an exercise', () => {
    const input = '- Barbell Back Squats 5x5\n\n5 Rounds\n- Rowing 500m';
    const result = parseDescriptionForExercises(input);

    // "5 Rounds" should be skipped
    const labels = result.map(r => r.label);
    expect(labels).not.toContain('5 Rounds');
    expect(labels).toContain('Barbell Back Squats');
    expect(labels).toContain('Rowing');
  });

  it('should skip various round header formats', () => {
    const roundHeaders = ['5 Rounds', '3 rounds', '10 Rounds of:', '2 Round'];
    for (const header of roundHeaders) {
      const result = parseDescriptionForExercises(header);
      expect(result).toHaveLength(0);
    }
  });

  // Tests for standalone distance extraction
  it('should extract standalone distance from exercise name', () => {
    const input = '- Rowing 500m';
    const result = parseDescriptionForExercises(input);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Rowing');
    expect(result[0].distance).toBe('500m');
    expect(result[0].duration_sec).toBeUndefined();
  });

  it('should extract various distance units', () => {
    const testCases = [
      { input: '- Run 500m', expectedName: 'Run', expectedDistance: '500m' },
      { input: '- Run 1.5km', expectedName: 'Run', expectedDistance: '1.5km' },
      { input: '- Walking Lunges 25m', expectedName: 'Walking Lunges', expectedDistance: '25m' },
      { input: '- Sprint 100yd', expectedName: 'Sprint', expectedDistance: '100yd' },
    ];

    for (const { input, expectedName, expectedDistance } of testCases) {
      const result = parseDescriptionForExercises(input);
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe(expectedName);
      expect(result[0].distance).toBe(expectedDistance);
      expect(result[0].duration_sec).toBeUndefined();
    }
  });

  it('should not set duration_sec for distance exercises', () => {
    const input = '- Rowing 500m\n- Push-ups';
    const result = parseDescriptionForExercises(input);

    expect(result).toHaveLength(2);
    // Distance exercise: no duration_sec
    expect(result[0].label).toBe('Rowing');
    expect(result[0].distance).toBe('500m');
    expect(result[0].duration_sec).toBeUndefined();
    // Non-distance exercise: has duration_sec
    expect(result[1].label).toBe('Push-ups');
    expect(result[1].duration_sec).toBe(30);
  });

  // Full Instagram workout scenario (the original bug)
  it('should handle the full Instagram mixed-format workout', () => {
    const input = `- Barbell Back Squats 5x5
- Barbell Reverse Lunges 4x20

5 Rounds
- Rowing 500m
- Run 500m
- Walking Lunges 25m`;

    const result = parseDescriptionForExercises(input);

    expect(result).toHaveLength(5);
    expect(result[0].label).toBe('Barbell Back Squats');
    expect(result[1].label).toBe('Barbell Reverse Lunges');
    expect(result[2].label).toBe('Rowing');
    expect(result[2].distance).toBe('500m');
    expect(result[3].label).toBe('Run');
    expect(result[3].distance).toBe('500m');
    expect(result[4].label).toBe('Walking Lunges');
    expect(result[4].distance).toBe('25m');
  });
});
