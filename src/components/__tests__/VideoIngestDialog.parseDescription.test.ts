import { describe, it, expect, vi } from 'vitest';
import { useCallback } from 'react';
import { renderHook } from '@testing-library/react';

// Mock React's useCallback to execute immediately for testing
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useCallback: (fn: Function) => fn,
  };
});

// Import the actual parseDescriptionForExercises function logic
// Since it's inside the component, we'll extract and test the logic directly

type AiSuggestion = {
  id: string;
  label: string;
  duration_sec?: number;
  target_reps?: number;
  notes?: string;
  accepted: boolean;
};

// Reproduce the parser function for testing
function parseDescriptionForExercises(text: string): AiSuggestion[] {
  if (!text.trim()) return [];

  const exercises: AiSuggestion[] = [];
  const lines = text.split('\n');

  const numberedPattern = /^\s*(\d+)\s*[.):]\s*(.+)/;
  const bulletPattern = /^\s*[•\-→>]\s*(.+)/;
  const emojiNumberPattern = /^\s*[\u{1F1E0}-\u{1F9FF}]?\s*(\d+)\s*[.):]\s*(.+)/u;
  const setsRepsPattern = /\s*\d+\s*[x×]\s*\d+\s*m?\s*$/i;
  const supersetDelimiter = /\s*\+\s*/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Skip standalone "Workout:" lines (with no content after colon)
    if (/^workout[:\s]*$/i.test(trimmed)) continue;

    let exerciseName: string | null = null;
    let remainingText: string | null = null;

    const numberedMatch = trimmed.match(numberedPattern);
    if (numberedMatch) {
      exerciseName = numberedMatch[2].trim();
      remainingText = exerciseName;
    } else {
      const bulletMatch = trimmed.match(bulletPattern);
      if (bulletMatch) {
        exerciseName = bulletMatch[1].trim();
        remainingText = exerciseName;
      } else {
        const emojiMatch = trimmed.match(emojiNumberPattern);
        if (emojiMatch) {
          exerciseName = emojiMatch[2].trim();
          remainingText = exerciseName;
        } else {
          if (trimmed.toLowerCase().startsWith('workout:')) {
            remainingText = trimmed.substring(8).trim();
          } else {
            remainingText = trimmed;
          }
        }
      }
    }

    if (remainingText) {
      const supersetParts = remainingText.split(supersetDelimiter);
      
      for (const part of supersetParts) {
        let cleanedName = part.trim();
        
        if (cleanedName.length <= 2) continue;

        cleanedName = cleanedName
          .replace(setsRepsPattern, '')
          .replace(/\s*\d+\s*[x×]\s*\d+\s*m?\s*$/i, '')
          .trim();

        cleanedName = cleanedName
          .replace(/→.*$/, '')
          .replace(/\s*\([^)]*\)\s*$/, '')
          .replace(/\s*-\s*(Easy|Hard|Moderate|Dynamic|Static|Supported|Loaded)\s*$/i, '')
          .trim();
        
        cleanedName = cleanedName.replace(/\s+/g, ' ').trim();

        if (cleanedName.length > 2) {
          exercises.push({
            id: `parsed_${Date.now()}_${exercises.length}`,
            label: cleanedName,
            duration_sec: 30,
            accepted: true,
          });
        }
      }
    }
  }

  return exercises;
}

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
    
    // "Full Body Day" after "Workout:" is also parsed as it's valid text
    expect(result).toHaveLength(7);
    expect(result[0].label).toBe('Full Body Day');
    expect(result[1].label).toBe('Squats');
    expect(result[2].label).toBe('Lunges');
    expect(result[3].label).toBe('Push-ups');
    expect(result[4].label).toBe('Pull-ups');
    expect(result[5].label).toBe('Rows');
    expect(result[6].label).toBe('Run');
  });
});
