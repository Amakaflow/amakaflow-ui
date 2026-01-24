/**
 * React hooks for Progression API.
 *
 * Part of AMA-480: Create Progression API TypeScript Client
 *
 * Provides data fetching, caching, and state management for:
 * - Exercise history with 1RM calculations
 * - Personal records (1RM, max weight, max reps)
 * - Last weight used
 * - Volume analytics by muscle group
 */

import { useState, useEffect, useCallback } from 'react';
import {
  progressionApi,
  ExercisesWithHistoryResponse,
  ExerciseHistory,
  LastWeight,
  PersonalRecordsResponse,
  VolumeAnalytics,
  RecordType,
  VolumeGranularity,
} from '../lib/progression-api';

// =============================================================================
// EXERCISES WITH HISTORY HOOK
// =============================================================================

interface UseExercisesWithHistoryOptions {
  limit?: number;
  enabled?: boolean;
}

interface UseExercisesWithHistoryResult {
  data: ExercisesWithHistoryResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching exercises that the user has performed.
 *
 * Returns a list of exercises where the user has at least one completed
 * session with weight data, sorted by most frequently performed.
 */
export function useExercisesWithHistory(
  options: UseExercisesWithHistoryOptions = {}
): UseExercisesWithHistoryResult {
  const { limit, enabled = true } = options;
  const [data, setData] = useState<ExercisesWithHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await progressionApi.getExercisesWithHistory({ limit });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch exercises'));
      console.error('Failed to fetch exercises with history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [limit, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}

// =============================================================================
// EXERCISE HISTORY HOOK
// =============================================================================

interface UseExerciseHistoryOptions {
  exerciseId: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

interface UseExerciseHistoryResult {
  data: ExerciseHistory | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  fetchMore: () => Promise<void>;
  hasMore: boolean;
}

/**
 * Hook for fetching the history of a specific exercise.
 *
 * Returns sessions where the exercise was performed, ordered by date descending.
 * Each session includes all sets with weight, reps, and calculated estimated 1RM.
 *
 * Supports pagination with fetchMore().
 */
export function useExerciseHistory(
  options: UseExerciseHistoryOptions
): UseExerciseHistoryResult {
  const { exerciseId, limit = 20, offset: initialOffset = 0, enabled = true } = options;
  const [data, setData] = useState<ExerciseHistory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentOffset, setCurrentOffset] = useState(initialOffset);
  const [hasMore, setHasMore] = useState(true);

  const fetchData = useCallback(async () => {
    if (!enabled || !exerciseId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await progressionApi.getExerciseHistory({
        exerciseId,
        limit,
        offset: initialOffset,
      });
      setData(result);
      setCurrentOffset(initialOffset + result.sessions.length);
      setHasMore(result.sessions.length >= limit);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch exercise history'));
      console.error('Failed to fetch exercise history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [exerciseId, limit, initialOffset, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch more sessions (pagination)
  const fetchMore = useCallback(async () => {
    if (!enabled || !exerciseId || isLoading || !hasMore) return;

    setIsLoading(true);

    try {
      const result = await progressionApi.getExerciseHistory({
        exerciseId,
        limit,
        offset: currentOffset,
      });

      if (data) {
        setData({
          ...data,
          sessions: [...data.sessions, ...result.sessions],
        });
      } else {
        setData(result);
      }

      setCurrentOffset(currentOffset + result.sessions.length);
      setHasMore(result.sessions.length >= limit);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch more sessions'));
      console.error('Failed to fetch more exercise history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [exerciseId, limit, currentOffset, enabled, isLoading, hasMore, data]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
    fetchMore,
    hasMore,
  };
}

// =============================================================================
// LAST WEIGHT HOOK
// =============================================================================

interface UseLastWeightOptions {
  exerciseId: string;
  enabled?: boolean;
}

interface UseLastWeightResult {
  data: LastWeight | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching the last weight used for an exercise.
 *
 * Returns the most recent completed set with a weight value.
 * Used for the "Use Last Weight" feature in companion apps.
 */
export function useLastWeight(options: UseLastWeightOptions): UseLastWeightResult {
  const { exerciseId, enabled = true } = options;
  const [data, setData] = useState<LastWeight | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled || !exerciseId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await progressionApi.getLastWeight(exerciseId);
      setData(result);
    } catch (err) {
      // 404 is expected when no history exists
      if (err instanceof Error && err.message.includes('404')) {
        setData(null);
      } else {
        setError(err instanceof Error ? err : new Error('Failed to fetch last weight'));
        console.error('Failed to fetch last weight:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [exerciseId, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}

// =============================================================================
// PERSONAL RECORDS HOOK
// =============================================================================

interface UsePersonalRecordsOptions {
  recordType?: RecordType;
  exerciseId?: string;
  limit?: number;
  enabled?: boolean;
}

interface UsePersonalRecordsResult {
  data: PersonalRecordsResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching personal records.
 *
 * Calculates records from all exercise history:
 * - 1rm: Best estimated 1RM (calculated from weight/reps)
 * - max_weight: Heaviest weight lifted
 * - max_reps: Most reps at any weight
 */
export function usePersonalRecords(
  options: UsePersonalRecordsOptions = {}
): UsePersonalRecordsResult {
  const { recordType, exerciseId, limit, enabled = true } = options;
  const [data, setData] = useState<PersonalRecordsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await progressionApi.getPersonalRecords({
        recordType,
        exerciseId,
        limit,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch personal records'));
      console.error('Failed to fetch personal records:', err);
    } finally {
      setIsLoading(false);
    }
  }, [recordType, exerciseId, limit, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}

// =============================================================================
// VOLUME ANALYTICS HOOK
// =============================================================================

interface UseVolumeAnalyticsOptions {
  startDate?: string;
  endDate?: string;
  granularity?: VolumeGranularity;
  muscleGroups?: string[];
  enabled?: boolean;
}

interface UseVolumeAnalyticsResult {
  data: VolumeAnalytics | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching training volume analytics by muscle group.
 *
 * Returns total volume (weight * reps) for each muscle group
 * over the specified time period, aggregated by the specified granularity.
 */
export function useVolumeAnalytics(
  options: UseVolumeAnalyticsOptions = {}
): UseVolumeAnalyticsResult {
  const { startDate, endDate, granularity, muscleGroups, enabled = true } = options;
  const [data, setData] = useState<VolumeAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await progressionApi.getVolumeAnalytics({
        startDate,
        endDate,
        granularity,
        muscleGroups,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch volume analytics'));
      console.error('Failed to fetch volume analytics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, granularity, muscleGroups, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData,
  };
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

// Re-export types for convenience
export type {
  ExerciseHistory,
  ExercisesWithHistoryResponse,
  ExerciseWithHistory,
  LastWeight,
  PersonalRecord,
  PersonalRecordsResponse,
  RecordType,
  Session,
  SetDetail,
  VolumeAnalytics,
  VolumeDataPoint,
  VolumeGranularity,
} from '../lib/progression-api';
