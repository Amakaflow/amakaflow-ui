import { describe, it, expect } from 'vitest';
import {
  detectWorkoutTypeFromText,
  detectWorkoutTypeFromStructure,
  getDetectionConfirmationMessage,
} from '../detectWorkoutType';
import type { WorkoutStructure } from '../../types/workout';

describe('detectWorkoutTypeFromText', () => {
  it('detects strength workout from keywords', () => {
    const result = detectWorkoutTypeFromText(
      '4x8 Bench Press, 4x8 Barbell Row, 3x12 Lateral Raises, 3x12 Bicep Curls'
    );
    expect(result.detectedType).toBe('strength');
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  it('detects HIIT workout', () => {
    const result = detectWorkoutTypeFromText(
      'Tabata: 20s work / 10s rest. Burpees, Jump Squats, Sprint intervals'
    );
    expect(result.detectedType).toBe('hiit');
  });

  it('detects running workout', () => {
    const result = detectWorkoutTypeFromText(
      '5k tempo run at race pace, 4x800m intervals with jog recovery, cool down easy jog'
    );
    expect(result.detectedType).toBe('running');
  });

  it('detects yoga workout', () => {
    const result = detectWorkoutTypeFromText(
      'Vinyasa flow: Sun Salutation, Warrior I, Warrior II, Downward Dog, Savasana'
    );
    expect(result.detectedType).toBe('yoga');
  });

  it('detects circuit workout', () => {
    const result = detectWorkoutTypeFromText(
      'AMRAP 20 minutes: 15 KB swings, 10 burpees, 5 pull-ups. CrossFit WOD.'
    );
    expect(result.detectedType).toBe('circuit');
  });

  it('returns mixed for ambiguous text', () => {
    const result = detectWorkoutTypeFromText('do some exercise');
    expect(result.detectedType).toBe('mixed');
    expect(result.confidence).toBeLessThanOrEqual(0.5);
  });

  it('returns confidence above 0 for clear workouts', () => {
    const result = detectWorkoutTypeFromText(
      'Bench press 4x8, squat 4x8, deadlift 3x5, overhead press 3x8, barbell row 4x8'
    );
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});

describe('detectWorkoutTypeFromStructure', () => {
  it('uses existing workout_type if available', () => {
    const workout: WorkoutStructure = {
      title: 'Test',
      source: 'test',
      workout_type: 'hiit',
      workout_type_confidence: 0.92,
      blocks: [],
    };
    const result = detectWorkoutTypeFromStructure(workout);
    expect(result.detectedType).toBe('hiit');
    expect(result.confidence).toBe(0.92);
  });

  it('falls back to text analysis for mixed type', () => {
    const workout: WorkoutStructure = {
      title: 'Strength Day',
      source: 'test',
      workout_type: 'mixed',
      blocks: [
        {
          label: 'Main',
          structure: 'sets',
          exercises: [
            { id: '1', name: 'Bench Press', sets: 4, reps: 8, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, type: 'strength' },
            { id: '2', name: 'Barbell Row', sets: 4, reps: 8, reps_range: null, duration_sec: null, rest_sec: null, distance_m: null, distance_range: null, type: 'strength' },
          ],
        },
      ],
    };
    const result = detectWorkoutTypeFromStructure(workout);
    expect(result.detectedType).toBe('strength');
  });
});

describe('getDetectionConfirmationMessage', () => {
  it('returns correct message for strength', () => {
    const msg = getDetectionConfirmationMessage({
      detectedType: 'strength',
      confidence: 0.8,
      reason: 'test',
    });
    expect(msg).toBe('This looks like a Strength workout. Is that right?');
  });

  it('returns correct message for running', () => {
    const msg = getDetectionConfirmationMessage({
      detectedType: 'running',
      confidence: 0.7,
      reason: 'test',
    });
    expect(msg).toBe('This looks like a Running workout. Is that right?');
  });

  it('returns correct message for yoga', () => {
    const msg = getDetectionConfirmationMessage({
      detectedType: 'yoga',
      confidence: 0.6,
      reason: 'test',
    });
    expect(msg).toBe('This looks like a Yoga workout. Is that right?');
  });
});
