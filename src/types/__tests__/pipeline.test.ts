/**
 * Tests for pipeline type definitions and type guards.
 * Verifies isProgramPreview correctly distinguishes program vs. workout previews.
 */

import { describe, it, expect } from 'vitest';
import { isProgramPreview } from '../pipeline';
import type { PipelinePreview, PipelineProgramPreview } from '../pipeline';

describe('isProgramPreview', () => {
  it('returns true for program preview', () => {
    const programPreview: PipelineProgramPreview = {
      preview_id: 'prog-1',
      program: {
        name: 'Strength Builder',
        goal: 'Build strength over 4 weeks',
        duration_weeks: 4,
        sessions_per_week: 3,
        periodization_model: 'linear',
        weeks: [
          {
            week_number: 1,
            focus: 'Hypertrophy',
            intensity_percentage: 70,
            volume_modifier: 1.0,
            is_deload: false,
            workouts: [
              {
                day_of_week: 1,
                name: 'Upper Body A',
                workout_type: 'strength',
                target_duration_minutes: 60,
                exercises: [{ name: 'Bench Press', sets: 4, reps: 8 }],
              },
            ],
          },
        ],
      },
    };

    expect(isProgramPreview(programPreview)).toBe(true);
  });

  it('returns false for workout preview', () => {
    const workoutPreview: PipelinePreview = {
      preview_id: 'w-1',
      workout: {
        name: 'Quick HIIT Session',
        exercises: [
          { name: 'Burpees', sets: 3, reps: 10 },
          { name: 'Mountain Climbers', sets: 3, reps: 20 },
        ],
        duration_minutes: 25,
        difficulty: 'intermediate',
      },
      source_url: 'https://youtube.com/watch?v=abc',
      platform: 'youtube',
    };

    expect(isProgramPreview(workoutPreview)).toBe(false);
  });
});
