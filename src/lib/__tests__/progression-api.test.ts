/**
 * Unit tests for Progression API client.
 *
 * Tests cover:
 * - Transform functions (snake_case → camelCase)
 * - ProgressionApiClient methods
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProgressionApiClient } from '../progression-api';
import { API_RESPONSES, EXPECTED_TRANSFORMS, EDGE_CASES, ERROR_RESPONSES } from './fixtures/progression.fixtures';
import { createMockResponse, createMockErrorResponse, createMockMalformedResponse } from './helpers/mockResponse';

// Mock the authenticated-fetch module
vi.mock('../authenticated-fetch', () => ({
  authenticatedFetch: vi.fn(),
}));

import { authenticatedFetch } from '../authenticated-fetch';
const mockAuthFetch = vi.mocked(authenticatedFetch);

describe('progression-api', () => {
  let client: ProgressionApiClient;
  const TEST_BASE_URL = 'http://test-api';

  beforeEach(() => {
    client = new ProgressionApiClient(TEST_BASE_URL);
    vi.clearAllMocks();
  });

  // ===========================================================================
  // getExercisesWithHistory
  // ===========================================================================

  describe('getExercisesWithHistory', () => {
    it('should return transformed exercises on success', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.exercisesWithHistory)
      );

      const result = await client.getExercisesWithHistory();

      expect(result).toEqual(EXPECTED_TRANSFORMS.exercisesWithHistory);
    });

    it('should call correct URL without params', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.exercisesWithHistory)
      );

      await client.getExercisesWithHistory();

      expect(mockAuthFetch).toHaveBeenCalledWith(
        `${TEST_BASE_URL}/progression/exercises`,
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should append limit query param when provided', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.exercisesWithHistory)
      );

      await client.getExercisesWithHistory({ limit: 10 });

      expect(mockAuthFetch).toHaveBeenCalledWith(
        `${TEST_BASE_URL}/progression/exercises?limit=10`,
        expect.any(Object)
      );
    });

    it('should handle empty exercises list', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.exercisesWithHistoryEmpty)
      );

      const result = await client.getExercisesWithHistory();

      expect(result.exercises).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should throw error with detail on 401', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockErrorResponse(401, ERROR_RESPONSES.unauthorized.detail)
      );

      await expect(client.getExercisesWithHistory()).rejects.toThrow('Not authenticated');
    });

    it('should throw error with detail on 500', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockErrorResponse(500, ERROR_RESPONSES.serverError.detail)
      );

      await expect(client.getExercisesWithHistory()).rejects.toThrow('Internal server error');
    });

    it('should handle malformed JSON response', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockMalformedResponse(500)
      );

      await expect(client.getExercisesWithHistory()).rejects.toThrow();
    });
  });

  // ===========================================================================
  // getExerciseHistory
  // ===========================================================================

  describe('getExerciseHistory', () => {
    it('should return transformed exercise history on success', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.exerciseHistory)
      );

      const result = await client.getExerciseHistory({ exerciseId: 'barbell-bench-press' });

      expect(result).toEqual(EXPECTED_TRANSFORMS.exerciseHistory);
    });

    it('should include exerciseId in URL path', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.exerciseHistory)
      );

      await client.getExerciseHistory({ exerciseId: 'barbell-bench-press' });

      expect(mockAuthFetch).toHaveBeenCalledWith(
        `${TEST_BASE_URL}/progression/exercises/barbell-bench-press/history`,
        expect.any(Object)
      );
    });

    it('should encode special characters in exerciseId', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.exerciseHistory)
      );

      await client.getExerciseHistory({ exerciseId: 'exercise/with/slashes' });

      expect(mockAuthFetch).toHaveBeenCalledWith(
        expect.stringContaining('exercise%2Fwith%2Fslashes'),
        expect.any(Object)
      );
    });

    it('should include pagination params when provided', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.exerciseHistory)
      );

      await client.getExerciseHistory({
        exerciseId: 'barbell-bench-press',
        limit: 20,
        offset: 40,
      });

      expect(mockAuthFetch).toHaveBeenCalledWith(
        `${TEST_BASE_URL}/progression/exercises/barbell-bench-press/history?limit=20&offset=40`,
        expect.any(Object)
      );
    });

    it('should handle empty sessions', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.exerciseHistoryEmpty)
      );

      const result = await client.getExerciseHistory({ exerciseId: 'barbell-squat' });

      expect(result.sessions).toEqual([]);
      expect(result.totalSessions).toBe(0);
      expect(result.allTimeBest1Rm).toBeNull();
    });

    it('should throw on 404 not found', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockErrorResponse(404, ERROR_RESPONSES.notFound.detail)
      );

      await expect(
        client.getExerciseHistory({ exerciseId: 'unknown-exercise' })
      ).rejects.toThrow('Exercise not found');
    });

    it('should transform nested sets correctly', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.exerciseHistory)
      );

      const result = await client.getExerciseHistory({ exerciseId: 'barbell-bench-press' });

      // Check first session, second set (has isPr: true)
      const firstSession = result.sessions[0];
      const secondSet = firstSession.sets[1];

      expect(secondSet.setNumber).toBe(2);
      expect(secondSet.weight).toBe(155);
      expect(secondSet.weightUnit).toBe('lbs');
      expect(secondSet.repsCompleted).toBe(8);
      expect(secondSet.estimated1Rm).toBe(191.2);
      expect(secondSet.isPr).toBe(true);
    });

    it('should handle sets with null values', async () => {
      const responseWithNulls = {
        ...API_RESPONSES.exerciseHistory,
        sessions: [
          {
            ...API_RESPONSES.exerciseHistory.sessions[0],
            sets: [EDGE_CASES.setWithNulls],
          },
        ],
      };
      mockAuthFetch.mockResolvedValueOnce(createMockResponse(responseWithNulls));

      const result = await client.getExerciseHistory({ exerciseId: 'test' });

      const set = result.sessions[0].sets[0];
      expect(set.weight).toBeNull();
      expect(set.repsCompleted).toBeNull();
      expect(set.estimated1Rm).toBeNull();
      expect(set.status).toBe('skipped');
    });
  });

  // ===========================================================================
  // getLastWeight
  // ===========================================================================

  describe('getLastWeight', () => {
    it('should return transformed last weight on success', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.lastWeight)
      );

      const result = await client.getLastWeight('barbell-bench-press');

      expect(result).toEqual(EXPECTED_TRANSFORMS.lastWeight);
    });

    it('should call correct URL', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.lastWeight)
      );

      await client.getLastWeight('barbell-bench-press');

      expect(mockAuthFetch).toHaveBeenCalledWith(
        `${TEST_BASE_URL}/progression/exercises/barbell-bench-press/last-weight`,
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should encode exerciseId in URL', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.lastWeight)
      );

      await client.getLastWeight('exercise/name');

      expect(mockAuthFetch).toHaveBeenCalledWith(
        expect.stringContaining('exercise%2Fname'),
        expect.any(Object)
      );
    });

    it('should throw on 404 when no history exists', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockErrorResponse(404, ERROR_RESPONSES.noHistory.detail)
      );

      await expect(
        client.getLastWeight('unknown-exercise')
      ).rejects.toThrow("No weight history found");
    });
  });

  // ===========================================================================
  // getPersonalRecords
  // ===========================================================================

  describe('getPersonalRecords', () => {
    it('should return transformed personal records on success', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.personalRecords)
      );

      const result = await client.getPersonalRecords();

      expect(result).toEqual(EXPECTED_TRANSFORMS.personalRecords);
    });

    it('should call correct URL without params', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.personalRecords)
      );

      await client.getPersonalRecords();

      expect(mockAuthFetch).toHaveBeenCalledWith(
        `${TEST_BASE_URL}/progression/records`,
        expect.any(Object)
      );
    });

    it('should include recordType param', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.personalRecordsFiltered)
      );

      await client.getPersonalRecords({ recordType: '1rm' });

      expect(mockAuthFetch).toHaveBeenCalledWith(
        `${TEST_BASE_URL}/progression/records?record_type=1rm`,
        expect.any(Object)
      );
    });

    it('should include exerciseId param', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.personalRecordsFiltered)
      );

      await client.getPersonalRecords({ exerciseId: 'barbell-bench-press' });

      expect(mockAuthFetch).toHaveBeenCalledWith(
        `${TEST_BASE_URL}/progression/records?exercise_id=barbell-bench-press`,
        expect.any(Object)
      );
    });

    it('should include all params when provided', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.personalRecordsFiltered)
      );

      await client.getPersonalRecords({
        recordType: 'max_weight',
        exerciseId: 'barbell-squat',
        limit: 5,
      });

      const calledUrl = mockAuthFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('record_type=max_weight');
      expect(calledUrl).toContain('exercise_id=barbell-squat');
      expect(calledUrl).toContain('limit=5');
    });

    it('should handle record with null details', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.personalRecords)
      );

      const result = await client.getPersonalRecords();

      // Second record has null details
      expect(result.records[1].details).toBeNull();
    });

    it('should handle record with details object', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.personalRecords)
      );

      const result = await client.getPersonalRecords();

      // First record has details
      expect(result.records[0].details).toEqual({ weight: 205, reps: 5 });
    });
  });

  // ===========================================================================
  // getVolumeAnalytics
  // ===========================================================================

  describe('getVolumeAnalytics', () => {
    it('should return transformed volume analytics on success', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.volumeAnalytics)
      );

      const result = await client.getVolumeAnalytics();

      expect(result).toEqual(EXPECTED_TRANSFORMS.volumeAnalytics);
    });

    it('should call correct URL without params', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.volumeAnalytics)
      );

      await client.getVolumeAnalytics();

      expect(mockAuthFetch).toHaveBeenCalledWith(
        `${TEST_BASE_URL}/progression/volume`,
        expect.any(Object)
      );
    });

    it('should include date range params', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.volumeAnalytics)
      );

      await client.getVolumeAnalytics({
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      });

      const calledUrl = mockAuthFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('start_date=2025-01-01');
      expect(calledUrl).toContain('end_date=2025-01-31');
    });

    it('should include granularity param', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.volumeAnalytics)
      );

      await client.getVolumeAnalytics({ granularity: 'monthly' });

      expect(mockAuthFetch).toHaveBeenCalledWith(
        `${TEST_BASE_URL}/progression/volume?granularity=monthly`,
        expect.any(Object)
      );
    });

    it('should serialize muscleGroups as comma-separated', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.volumeAnalytics)
      );

      await client.getVolumeAnalytics({
        muscleGroups: ['chest', 'back', 'shoulders'],
      });

      expect(mockAuthFetch).toHaveBeenCalledWith(
        expect.stringContaining('muscle_groups=chest%2Cback%2Cshoulders'),
        expect.any(Object)
      );
    });

    it('should not include muscleGroups if empty array', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.volumeAnalytics)
      );

      await client.getVolumeAnalytics({ muscleGroups: [] });

      expect(mockAuthFetch).toHaveBeenCalledWith(
        `${TEST_BASE_URL}/progression/volume`,
        expect.any(Object)
      );
    });

    it('should handle empty data', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.volumeAnalyticsEmpty)
      );

      const result = await client.getVolumeAnalytics();

      expect(result.data).toEqual([]);
      expect(result.summary.totalVolume).toBe(0);
      expect(result.summary.muscleGroupBreakdown).toEqual({});
    });

    it('should transform summary correctly', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.volumeAnalytics)
      );

      const result = await client.getVolumeAnalytics();

      expect(result.summary.totalVolume).toBe(37200);
      expect(result.summary.totalSets).toBe(46);
      expect(result.summary.totalReps).toBe(387);
      expect(result.summary.muscleGroupBreakdown).toEqual({
        chest: 27500,
        triceps: 9700,
      });
    });

    it('should transform period correctly', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.volumeAnalytics)
      );

      const result = await client.getVolumeAnalytics();

      expect(result.period.startDate).toBe('2025-01-01');
      expect(result.period.endDate).toBe('2025-01-15');
    });

    it('should include all params when provided', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockResponse(API_RESPONSES.volumeAnalytics)
      );

      await client.getVolumeAnalytics({
        startDate: '2025-01-01',
        endDate: '2025-01-31',
        granularity: 'weekly',
        muscleGroups: ['chest', 'back'],
      });

      const calledUrl = mockAuthFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('start_date=2025-01-01');
      expect(calledUrl).toContain('end_date=2025-01-31');
      expect(calledUrl).toContain('granularity=weekly');
      expect(calledUrl).toContain('muscle_groups=chest%2Cback');
    });
  });

  // ===========================================================================
  // Error Handling
  // ===========================================================================

  describe('error handling', () => {
    it('should extract detail from error response', async () => {
      mockAuthFetch.mockResolvedValueOnce(
        createMockErrorResponse(400, 'Custom error message')
      );

      await expect(client.getExercisesWithHistory()).rejects.toThrow('Custom error message');
    });

    it('should fall back to status code when no detail', async () => {
      const response = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
        headers: new Headers(),
      } as Response;
      mockAuthFetch.mockResolvedValueOnce(response);

      await expect(client.getExercisesWithHistory()).rejects.toThrow('API error: 500');
    });

    it('should handle malformed JSON in error response', async () => {
      const response = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Invalid JSON')),
        headers: new Headers(),
      } as Response;
      mockAuthFetch.mockResolvedValueOnce(response);

      await expect(client.getExercisesWithHistory()).rejects.toThrow('Unknown error');
    });
  });

  // ===========================================================================
  // Default Values in Transforms
  // ===========================================================================

  describe('transform defaults', () => {
    it('should use default values for missing set fields', async () => {
      const responseWithMinimalSet = {
        ...API_RESPONSES.exerciseHistory,
        sessions: [
          {
            ...API_RESPONSES.exerciseHistory.sessions[0],
            sets: [EDGE_CASES.minimalSet],
          },
        ],
      };
      mockAuthFetch.mockResolvedValueOnce(createMockResponse(responseWithMinimalSet));

      const result = await client.getExerciseHistory({ exerciseId: 'test' });

      const set = result.sessions[0].sets[0];
      expect(set.setNumber).toBe(1);
      expect(set.weightUnit).toBe('lbs');
      expect(set.status).toBe('completed');
      expect(set.isPr).toBe(false);
    });

    it('should use default values for missing session fields', async () => {
      const responseWithMinimalSession = {
        ...API_RESPONSES.exerciseHistory,
        sessions: [EDGE_CASES.minimalSession],
      };
      mockAuthFetch.mockResolvedValueOnce(createMockResponse(responseWithMinimalSession));

      const result = await client.getExerciseHistory({ exerciseId: 'test' });

      const session = result.sessions[0];
      expect(session.completionId).toBe('comp-min');
      expect(session.workoutDate).toBe('');
      expect(session.exerciseName).toBe('');
      expect(session.sets).toEqual([]);
    });

    it('should handle missing exercise history fields', async () => {
      const minimalHistory = {
        exercise_id: 'test',
      };
      mockAuthFetch.mockResolvedValueOnce(createMockResponse(minimalHistory));

      const result = await client.getExerciseHistory({ exerciseId: 'test' });

      expect(result.exerciseId).toBe('test');
      expect(result.exerciseName).toBe('');
      expect(result.supports1Rm).toBe(false);
      expect(result.oneRmFormula).toBe('brzycki');
      expect(result.sessions).toEqual([]);
      expect(result.totalSessions).toBe(0);
    });
  });
});
