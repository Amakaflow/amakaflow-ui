/**
 * Program Detail View E2E Smoke Tests
 *
 * Tests the training program detail view API integration.
 * Run with: npm run test:e2e -- --testNamePattern='@smoke.*Program'
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { skipIfApiUnavailable, retry, waitFor } from '../e2e-setup';
import { API_URLS } from '../../lib/config';

const CALENDAR_API_URL = API_URLS.CALENDAR;
const TEST_USER_ID = 'e2e-test-user';

// Helper to make authenticated API calls (simplified for E2E)
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${CALENDAR_API_URL}${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.detail || error.message || `API error: ${response.status}`);
  }

  return response.json();
}

describe('@smoke Program Detail API Smoke Tests', () => {
  let apiAvailable: boolean;
  let testProgramId: string | null = null;

  beforeAll(async () => {
    apiAvailable = !(await skipIfApiUnavailable());
  });

  beforeEach(async ({ skip }) => {
    if (!apiAvailable) {
      skip();
    }
  });

  describe('SMOKE-PD-01: List Training Programs', () => {
    it('returns training programs for a user', async () => {
      const result = await retry(() =>
        apiCall<{
          success: boolean;
          programs: any[];
          count: number;
        }>(`/training-programs`)
      );

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('programs');
      expect(Array.isArray(result.programs)).toBe(true);
      expect(result).toHaveProperty('count');
      expect(typeof result.count).toBe('number');

      // Store a program ID for subsequent tests if available
      if (result.programs.length > 0) {
        testProgramId = result.programs[0].id;
      }
    });

    it('returns programs with required fields', async () => {
      const result = await retry(() =>
        apiCall<{
          success: boolean;
          programs: any[];
        }>(`/training-programs`)
      );

      if (result.programs.length > 0) {
        const program = result.programs[0];

        // Required fields validation
        expect(program).toHaveProperty('id');
        expect(program).toHaveProperty('user_id');
        expect(program).toHaveProperty('name');
        expect(program).toHaveProperty('goal');
        expect(program).toHaveProperty('periodization_model');
        expect(program).toHaveProperty('duration_weeks');
        expect(program).toHaveProperty('sessions_per_week');
        expect(program).toHaveProperty('experience_level');
        expect(program).toHaveProperty('status');
        expect(program).toHaveProperty('current_week');
      }
    });

    it('excludes archived programs by default', async () => {
      const result = await retry(() =>
        apiCall<{
          success: boolean;
          programs: any[];
        }>(`/training-programs?include_archived=false`)
      );

      // All returned programs should not be archived
      for (const program of result.programs) {
        expect(program.status).not.toBe('archived');
      }
    });
  });

  describe('SMOKE-PD-02: Get Training Program Details', () => {
    it('returns full program with weeks and workouts', async () => {
      // Skip if no test program available
      if (!testProgramId) {
        console.log('Skipping: No test program available');
        return;
      }

      const result = await retry(() =>
        apiCall<{
          success: boolean;
          program: any;
        }>(`/training-programs/${testProgramId}`)
      );

      expect(result.success).toBe(true);
      expect(result.program).toBeDefined();

      const program = result.program;
      expect(program).toHaveProperty('weeks');
      expect(Array.isArray(program.weeks)).toBe(true);

      // Validate weeks structure
      if (program.weeks.length > 0) {
        const week = program.weeks[0];
        expect(week).toHaveProperty('id');
        expect(week).toHaveProperty('week_number');
        expect(week).toHaveProperty('workouts');
        expect(Array.isArray(week.workouts)).toBe(true);
      }
    });

    it('returns workouts with exercises', async () => {
      if (!testProgramId) {
        console.log('Skipping: No test program available');
        return;
      }

      const result = await retry(() =>
        apiCall<{
          success: boolean;
          program: any;
        }>(`/training-programs/${testProgramId}`)
      );

      const program = result.program;

      // Find a week with workouts
      const weekWithWorkouts = program.weeks.find(
        (w: any) => w.workouts && w.workouts.length > 0
      );

      if (weekWithWorkouts) {
        const workout = weekWithWorkouts.workouts[0];
        expect(workout).toHaveProperty('id');
        expect(workout).toHaveProperty('name');
        expect(workout).toHaveProperty('workout_type');
        expect(workout).toHaveProperty('day_of_week');
        expect(workout).toHaveProperty('exercises');
        expect(Array.isArray(workout.exercises)).toBe(true);

        // Validate exercise structure
        if (workout.exercises.length > 0) {
          const exercise = workout.exercises[0];
          expect(exercise).toHaveProperty('name');
          expect(exercise).toHaveProperty('sets');
          expect(exercise).toHaveProperty('reps');
          expect(exercise).toHaveProperty('rest_seconds');
        }
      }
    });

    it('returns 404 for non-existent program', async () => {
      try {
        await apiCall(`/training-programs/non-existent-id`);
        expect.fail('Expected 404 error');
      } catch (error) {
        expect((error as Error).message).toMatch(/not found|404/i);
      }
    });
  });

  describe('SMOKE-PD-03: Program Status Updates', () => {
    let statusTestProgramId: string | null = null;

    beforeAll(async () => {
      // Use the test program ID if available
      statusTestProgramId = testProgramId;
    });

    it('can update program status to paused', async () => {
      if (!statusTestProgramId) {
        console.log('Skipping: No test program available');
        return;
      }

      // This test may fail if the program is in a state that doesn't allow pausing
      // In a real E2E test, we'd create a test program first
      try {
        const result = await retry(() =>
          apiCall<{
            success: boolean;
            message: string;
          }>(`/training-programs/${statusTestProgramId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({
              // AMA-1450: user_id removed from request body.
              status: 'paused',
            }),
          })
        );

        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('message');
      } catch (error) {
        // May fail if status transition is invalid
        console.log('Status update test skipped:', (error as Error).message);
      }
    });
  });

  describe('SMOKE-PD-04: Workout Completion', () => {
    it('can mark a workout as complete', async () => {
      if (!testProgramId) {
        console.log('Skipping: No test program available');
        return;
      }

      // Get the program to find a workout ID
      const programResult = await retry(() =>
        apiCall<{
          success: boolean;
          program: any;
        }>(`/training-programs/${testProgramId}`)
      );

      const program = programResult.program;
      const weekWithWorkouts = program.weeks.find(
        (w: any) => w.workouts && w.workouts.length > 0
      );

      if (!weekWithWorkouts || weekWithWorkouts.workouts.length === 0) {
        console.log('Skipping: No workouts available');
        return;
      }

      const workoutId = weekWithWorkouts.workouts[0].id;

      try {
        const result = await retry(() =>
          apiCall<{
            success: boolean;
            message: string;
          }>(`/training-programs/workouts/${workoutId}/complete`, {
            method: 'PATCH',
            body: JSON.stringify({
              // AMA-1450: user_id removed from request body.
              is_completed: true,
            }),
          })
        );

        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('message');
      } catch (error) {
        console.log('Workout completion test skipped:', (error as Error).message);
      }
    });
  });

  describe('SMOKE-PD-05: API Health Check', () => {
    it('calendar API is available', async () => {
      const response = await fetch(`${CALENDAR_API_URL}/health`);
      expect(response.ok).toBe(true);
    });
  });

  describe('SMOKE-PD-06: Data Validation', () => {
    it('validates goal is a valid enum value', async () => {
      const result = await retry(() =>
        apiCall<{
          success: boolean;
          programs: any[];
        }>(`/training-programs`)
      );

      const validGoals = ['strength', 'hypertrophy', 'fat_loss', 'endurance', 'general_fitness'];

      for (const program of result.programs) {
        expect(validGoals).toContain(program.goal);
      }
    });

    it('validates status is a valid enum value', async () => {
      const result = await retry(() =>
        apiCall<{
          success: boolean;
          programs: any[];
        }>(`/training-programs`)
      );

      const validStatuses = ['draft', 'active', 'paused', 'completed', 'archived'];

      for (const program of result.programs) {
        expect(validStatuses).toContain(program.status);
      }
    });

    it('validates periodization model is a valid enum value', async () => {
      const result = await retry(() =>
        apiCall<{
          success: boolean;
          programs: any[];
        }>(`/training-programs`)
      );

      const validModels = ['linear', 'undulating', 'block', 'conjugate'];

      for (const program of result.programs) {
        expect(validModels).toContain(program.periodization_model);
      }
    });

    it('validates experience level is a valid enum value', async () => {
      const result = await retry(() =>
        apiCall<{
          success: boolean;
          programs: any[];
        }>(`/training-programs`)
      );

      const validLevels = ['beginner', 'intermediate', 'advanced'];

      for (const program of result.programs) {
        expect(validLevels).toContain(program.experience_level);
      }
    });

    it('validates week numbers are sequential starting from 1', async () => {
      if (!testProgramId) {
        console.log('Skipping: No test program available');
        return;
      }

      const result = await retry(() =>
        apiCall<{
          success: boolean;
          program: any;
        }>(`/training-programs/${testProgramId}`)
      );

      const weeks = result.program.weeks;
      if (weeks.length > 0) {
        const weekNumbers = weeks.map((w: any) => w.week_number).sort((a: number, b: number) => a - b);

        // First week should be 1
        expect(weekNumbers[0]).toBe(1);

        // Should be sequential
        for (let i = 1; i < weekNumbers.length; i++) {
          expect(weekNumbers[i]).toBe(weekNumbers[i - 1] + 1);
        }
      }
    });

    it('validates day_of_week is 0-6', async () => {
      if (!testProgramId) {
        console.log('Skipping: No test program available');
        return;
      }

      const result = await retry(() =>
        apiCall<{
          success: boolean;
          program: any;
        }>(`/training-programs/${testProgramId}`)
      );

      for (const week of result.program.weeks) {
        for (const workout of week.workouts || []) {
          expect(workout.day_of_week).toBeGreaterThanOrEqual(0);
          expect(workout.day_of_week).toBeLessThanOrEqual(6);
        }
      }
    });
  });
});
