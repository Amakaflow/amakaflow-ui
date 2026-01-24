/**
 * Integration tests for Progression API React hooks.
 *
 * Tests cover:
 * - Loading, success, and error states
 * - Enabled/disabled behavior
 * - Refetch functionality
 * - Pagination (useExerciseHistory)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useExercisesWithHistory,
  useExerciseHistory,
  useLastWeight,
  usePersonalRecords,
  useVolumeAnalytics,
} from '../useProgressionApi';

// Mock the progression API module
vi.mock('../../lib/progression-api', () => ({
  progressionApi: {
    getExercisesWithHistory: vi.fn(),
    getExerciseHistory: vi.fn(),
    getLastWeight: vi.fn(),
    getPersonalRecords: vi.fn(),
    getVolumeAnalytics: vi.fn(),
  },
}));

import { progressionApi } from '../../lib/progression-api';

// Type the mocked functions
const mockGetExercisesWithHistory = vi.mocked(progressionApi.getExercisesWithHistory);
const mockGetExerciseHistory = vi.mocked(progressionApi.getExerciseHistory);
const mockGetLastWeight = vi.mocked(progressionApi.getLastWeight);
const mockGetPersonalRecords = vi.mocked(progressionApi.getPersonalRecords);
const mockGetVolumeAnalytics = vi.mocked(progressionApi.getVolumeAnalytics);

// Test data
const mockExercisesResponse = {
  exercises: [
    { exerciseId: 'bench-press', exerciseName: 'Bench Press', sessionCount: 10 },
    { exerciseId: 'squat', exerciseName: 'Squat', sessionCount: 8 },
  ],
  total: 2,
};

const mockExerciseHistoryResponse = {
  exerciseId: 'bench-press',
  exerciseName: 'Bench Press',
  supports1Rm: true,
  oneRmFormula: 'brzycki',
  sessions: [
    {
      completionId: 'comp-1',
      workoutDate: '2025-01-15',
      workoutName: 'Push Day',
      exerciseName: 'Bench Press',
      sets: [
        {
          setNumber: 1,
          weight: 135,
          weightUnit: 'lbs',
          repsCompleted: 10,
          repsPlanned: 10,
          status: 'completed',
          estimated1Rm: 180,
          isPr: false,
        },
      ],
      sessionBest1Rm: 180,
      sessionMaxWeight: 135,
      sessionTotalVolume: 1350,
    },
  ],
  totalSessions: 1,
  allTimeBest1Rm: 180,
  allTimeMaxWeight: 135,
};

const mockLastWeightResponse = {
  exerciseId: 'bench-press',
  exerciseName: 'Bench Press',
  weight: 185,
  weightUnit: 'lbs',
  repsCompleted: 8,
  workoutDate: '2025-01-15',
  completionId: 'comp-1',
};

const mockPersonalRecordsResponse = {
  records: [
    {
      exerciseId: 'bench-press',
      exerciseName: 'Bench Press',
      recordType: '1rm' as const,
      value: 225,
      unit: 'lbs',
      achievedAt: '2025-01-10',
      completionId: 'comp-abc',
      details: { weight: 205, reps: 5 },
    },
  ],
  exerciseId: null,
};

const mockVolumeAnalyticsResponse = {
  data: [
    { period: '2025-01-15', muscleGroup: 'chest', totalVolume: 12500, totalSets: 12, totalReps: 96 },
  ],
  summary: {
    totalVolume: 12500,
    totalSets: 12,
    totalReps: 96,
    muscleGroupBreakdown: { chest: 12500 },
  },
  period: { startDate: '2025-01-01', endDate: '2025-01-15' },
  granularity: 'weekly' as const,
};

describe('useProgressionApi hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // useExercisesWithHistory
  // ===========================================================================

  describe('useExercisesWithHistory', () => {
    it('should start with loading state', () => {
      mockGetExercisesWithHistory.mockReturnValue(new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useExercisesWithHistory());

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should return data on success', async () => {
      mockGetExercisesWithHistory.mockResolvedValueOnce(mockExercisesResponse);

      const { result } = renderHook(() => useExercisesWithHistory());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockExercisesResponse);
      expect(result.current.error).toBeNull();
    });

    it('should set error on failure', async () => {
      mockGetExercisesWithHistory.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useExercisesWithHistory());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Network error');
    });

    it('should not fetch when enabled is false', async () => {
      const { result } = renderHook(() => useExercisesWithHistory({ enabled: false }));

      // Wait a tick to ensure effect would have run
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockGetExercisesWithHistory).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });

    it('should pass limit param to API', async () => {
      mockGetExercisesWithHistory.mockResolvedValueOnce(mockExercisesResponse);

      renderHook(() => useExercisesWithHistory({ limit: 25 }));

      await waitFor(() => {
        expect(mockGetExercisesWithHistory).toHaveBeenCalledWith({ limit: 25 });
      });
    });

    it('should refetch when refetch is called', async () => {
      mockGetExercisesWithHistory.mockResolvedValue(mockExercisesResponse);

      const { result } = renderHook(() => useExercisesWithHistory());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGetExercisesWithHistory).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.refetch();
      });

      expect(mockGetExercisesWithHistory).toHaveBeenCalledTimes(2);
    });
  });

  // ===========================================================================
  // useExerciseHistory
  // ===========================================================================

  describe('useExerciseHistory', () => {
    it('should fetch on mount with exerciseId', async () => {
      mockGetExerciseHistory.mockResolvedValueOnce(mockExerciseHistoryResponse);

      const { result } = renderHook(() =>
        useExerciseHistory({ exerciseId: 'bench-press' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGetExerciseHistory).toHaveBeenCalledWith({
        exerciseId: 'bench-press',
        limit: 20,
        offset: 0,
      });
      expect(result.current.data).toEqual(mockExerciseHistoryResponse);
    });

    it('should not fetch when exerciseId is empty', async () => {
      const { result } = renderHook(() =>
        useExerciseHistory({ exerciseId: '' })
      );

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockGetExerciseHistory).not.toHaveBeenCalled();
      expect(result.current.data).toBeNull();
    });

    it('should calculate hasMore correctly when full page returned', async () => {
      const fullPageResponse = {
        ...mockExerciseHistoryResponse,
        sessions: Array(20).fill(mockExerciseHistoryResponse.sessions[0]),
      };
      mockGetExerciseHistory.mockResolvedValueOnce(fullPageResponse);

      const { result } = renderHook(() =>
        useExerciseHistory({ exerciseId: 'bench-press', limit: 20 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.hasMore).toBe(true);
    });

    it('should calculate hasMore correctly when partial page returned', async () => {
      mockGetExerciseHistory.mockResolvedValueOnce(mockExerciseHistoryResponse);

      const { result } = renderHook(() =>
        useExerciseHistory({ exerciseId: 'bench-press', limit: 20 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Only 1 session returned, limit was 20
      expect(result.current.hasMore).toBe(false);
    });

    it('should append sessions when fetchMore is called', async () => {
      const firstPage = {
        ...mockExerciseHistoryResponse,
        sessions: Array(20).fill({
          ...mockExerciseHistoryResponse.sessions[0],
          completionId: 'page-1',
        }),
      };
      const secondPage = {
        ...mockExerciseHistoryResponse,
        sessions: Array(10).fill({
          ...mockExerciseHistoryResponse.sessions[0],
          completionId: 'page-2',
        }),
      };

      mockGetExerciseHistory
        .mockResolvedValueOnce(firstPage)
        .mockResolvedValueOnce(secondPage);

      const { result } = renderHook(() =>
        useExerciseHistory({ exerciseId: 'bench-press', limit: 20 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.sessions.length).toBe(20);

      await act(async () => {
        await result.current.fetchMore();
      });

      expect(result.current.data?.sessions.length).toBe(30);
      expect(mockGetExerciseHistory).toHaveBeenLastCalledWith({
        exerciseId: 'bench-press',
        limit: 20,
        offset: 20,
      });
    });

    it('should not fetchMore when hasMore is false', async () => {
      mockGetExerciseHistory.mockResolvedValueOnce(mockExerciseHistoryResponse);

      const { result } = renderHook(() =>
        useExerciseHistory({ exerciseId: 'bench-press' })
      );

      await waitFor(() => {
        expect(result.current.hasMore).toBe(false);
      });

      await act(async () => {
        await result.current.fetchMore();
      });

      // Should only have been called once (initial fetch)
      expect(mockGetExerciseHistory).toHaveBeenCalledTimes(1);
    });

    it('should refetch from beginning when refetch called', async () => {
      mockGetExerciseHistory.mockResolvedValue(mockExerciseHistoryResponse);

      const { result } = renderHook(() =>
        useExerciseHistory({ exerciseId: 'bench-press' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.refetch();
      });

      // Both calls should use offset: 0
      expect(mockGetExerciseHistory).toHaveBeenNthCalledWith(1, expect.objectContaining({ offset: 0 }));
      expect(mockGetExerciseHistory).toHaveBeenNthCalledWith(2, expect.objectContaining({ offset: 0 }));
    });

    it('should refetch when exerciseId changes', async () => {
      mockGetExerciseHistory.mockResolvedValue(mockExerciseHistoryResponse);

      const { result, rerender } = renderHook(
        ({ exerciseId }) => useExerciseHistory({ exerciseId }),
        { initialProps: { exerciseId: 'bench-press' } }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      rerender({ exerciseId: 'squat' });

      await waitFor(() => {
        expect(mockGetExerciseHistory).toHaveBeenCalledWith(
          expect.objectContaining({ exerciseId: 'squat' })
        );
      });
    });
  });

  // ===========================================================================
  // useLastWeight
  // ===========================================================================

  describe('useLastWeight', () => {
    it('should return last weight on success', async () => {
      mockGetLastWeight.mockResolvedValueOnce(mockLastWeightResponse);

      const { result } = renderHook(() =>
        useLastWeight({ exerciseId: 'bench-press' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockLastWeightResponse);
      expect(result.current.error).toBeNull();
    });

    it('should set data to null on 404 without error', async () => {
      mockGetLastWeight.mockRejectedValueOnce(new Error('404: No weight history found'));

      const { result } = renderHook(() =>
        useLastWeight({ exerciseId: 'unknown-exercise' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull(); // 404 is not treated as error
    });

    it('should set error on non-404 failure', async () => {
      mockGetLastWeight.mockRejectedValueOnce(new Error('500: Server error'));

      const { result } = renderHook(() =>
        useLastWeight({ exerciseId: 'bench-press' })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeInstanceOf(Error);
    });

    it('should not fetch when exerciseId is empty', async () => {
      const { result } = renderHook(() =>
        useLastWeight({ exerciseId: '' })
      );

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockGetLastWeight).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });

    it('should not fetch when disabled', async () => {
      const { result } = renderHook(() =>
        useLastWeight({ exerciseId: 'bench-press', enabled: false })
      );

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockGetLastWeight).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });
  });

  // ===========================================================================
  // usePersonalRecords
  // ===========================================================================

  describe('usePersonalRecords', () => {
    it('should return records on success', async () => {
      mockGetPersonalRecords.mockResolvedValueOnce(mockPersonalRecordsResponse);

      const { result } = renderHook(() => usePersonalRecords());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockPersonalRecordsResponse);
    });

    it('should pass recordType filter', async () => {
      mockGetPersonalRecords.mockResolvedValueOnce(mockPersonalRecordsResponse);

      renderHook(() => usePersonalRecords({ recordType: '1rm' }));

      await waitFor(() => {
        expect(mockGetPersonalRecords).toHaveBeenCalledWith(
          expect.objectContaining({ recordType: '1rm' })
        );
      });
    });

    it('should pass exerciseId filter', async () => {
      mockGetPersonalRecords.mockResolvedValueOnce(mockPersonalRecordsResponse);

      renderHook(() => usePersonalRecords({ exerciseId: 'bench-press' }));

      await waitFor(() => {
        expect(mockGetPersonalRecords).toHaveBeenCalledWith(
          expect.objectContaining({ exerciseId: 'bench-press' })
        );
      });
    });

    it('should pass all filters when provided', async () => {
      mockGetPersonalRecords.mockResolvedValueOnce(mockPersonalRecordsResponse);

      renderHook(() =>
        usePersonalRecords({
          recordType: 'max_weight',
          exerciseId: 'squat',
          limit: 10,
        })
      );

      await waitFor(() => {
        expect(mockGetPersonalRecords).toHaveBeenCalledWith({
          recordType: 'max_weight',
          exerciseId: 'squat',
          limit: 10,
        });
      });
    });

    it('should set error on failure', async () => {
      mockGetPersonalRecords.mockRejectedValueOnce(new Error('Failed'));

      const { result } = renderHook(() => usePersonalRecords());

      await waitFor(() => {
        expect(result.current.error).toBeInstanceOf(Error);
      });
    });

    it('should not fetch when disabled', async () => {
      renderHook(() => usePersonalRecords({ enabled: false }));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockGetPersonalRecords).not.toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // useVolumeAnalytics
  // ===========================================================================

  describe('useVolumeAnalytics', () => {
    it('should return analytics on success', async () => {
      mockGetVolumeAnalytics.mockResolvedValueOnce(mockVolumeAnalyticsResponse);

      const { result } = renderHook(() => useVolumeAnalytics());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockVolumeAnalyticsResponse);
    });

    it('should pass date range params', async () => {
      mockGetVolumeAnalytics.mockResolvedValueOnce(mockVolumeAnalyticsResponse);

      renderHook(() =>
        useVolumeAnalytics({
          startDate: '2025-01-01',
          endDate: '2025-01-31',
        })
      );

      await waitFor(() => {
        expect(mockGetVolumeAnalytics).toHaveBeenCalledWith(
          expect.objectContaining({
            startDate: '2025-01-01',
            endDate: '2025-01-31',
          })
        );
      });
    });

    it('should pass granularity param', async () => {
      mockGetVolumeAnalytics.mockResolvedValueOnce(mockVolumeAnalyticsResponse);

      renderHook(() => useVolumeAnalytics({ granularity: 'monthly' }));

      await waitFor(() => {
        expect(mockGetVolumeAnalytics).toHaveBeenCalledWith(
          expect.objectContaining({ granularity: 'monthly' })
        );
      });
    });

    it('should pass muscleGroups param', async () => {
      mockGetVolumeAnalytics.mockResolvedValueOnce(mockVolumeAnalyticsResponse);

      renderHook(() =>
        useVolumeAnalytics({ muscleGroups: ['chest', 'back'] })
      );

      await waitFor(() => {
        expect(mockGetVolumeAnalytics).toHaveBeenCalledWith(
          expect.objectContaining({ muscleGroups: ['chest', 'back'] })
        );
      });
    });

    it('should refetch when params change', async () => {
      mockGetVolumeAnalytics.mockResolvedValue(mockVolumeAnalyticsResponse);

      const { rerender } = renderHook(
        ({ granularity }) => useVolumeAnalytics({ granularity }),
        { initialProps: { granularity: 'daily' as const } }
      );

      await waitFor(() => {
        expect(mockGetVolumeAnalytics).toHaveBeenCalledTimes(1);
      });

      rerender({ granularity: 'weekly' as const });

      await waitFor(() => {
        expect(mockGetVolumeAnalytics).toHaveBeenCalledTimes(2);
        expect(mockGetVolumeAnalytics).toHaveBeenLastCalledWith(
          expect.objectContaining({ granularity: 'weekly' })
        );
      });
    });

    it('should not fetch when disabled', async () => {
      renderHook(() => useVolumeAnalytics({ enabled: false }));

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockGetVolumeAnalytics).not.toHaveBeenCalled();
    });

    it('should set error on failure', async () => {
      mockGetVolumeAnalytics.mockRejectedValueOnce(new Error('Analytics failed'));

      const { result } = renderHook(() => useVolumeAnalytics());

      await waitFor(() => {
        expect(result.current.error?.message).toBe('Analytics failed');
      });
    });
  });
});
