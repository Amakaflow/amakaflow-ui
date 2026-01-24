/**
 * Progression API client for exercise history and analytics.
 *
 * Part of AMA-480: Create Progression API TypeScript Client
 *
 * Connects to mapper-api's progression endpoints for:
 * - Exercise history with 1RM calculations
 * - Personal records (1RM, max weight, max reps)
 * - Last weight used (for "Use Last Weight" feature)
 * - Volume analytics by muscle group
 */

import { authenticatedFetch } from './authenticated-fetch';
import { API_URLS } from './config';
import type {
  ExerciseHistory,
  ExercisesWithHistoryResponse,
  ExerciseWithHistory,
  GetExerciseHistoryParams,
  GetExercisesParams,
  GetPersonalRecordsParams,
  GetVolumeAnalyticsParams,
  LastWeight,
  PersonalRecord,
  PersonalRecordsResponse,
  RecordType,
  Session,
  SetDetail,
  VolumeAnalytics,
  VolumeDataPoint,
} from '../types/progression';

// Use centralized API config - progression endpoints are on Mapper API
const API_BASE_URL = API_URLS.MAPPER;

// =============================================================================
// Response Transformers (snake_case API -> camelCase TypeScript)
// =============================================================================

/**
 * Transform a set from API response to TypeScript type.
 */
function transformSet(apiSet: Record<string, unknown>): SetDetail {
  return {
    setNumber: (apiSet.set_number as number) ?? 0,
    weight: apiSet.weight as number | null,
    weightUnit: (apiSet.weight_unit as string) ?? 'lbs',
    repsCompleted: apiSet.reps_completed as number | null,
    repsPlanned: apiSet.reps_planned as number | null,
    status: (apiSet.status as string) ?? 'completed',
    estimated1Rm: apiSet.estimated_1rm as number | null,
    isPr: (apiSet.is_pr as boolean) ?? false,
  };
}

/**
 * Transform a session from API response to TypeScript type.
 */
function transformSession(apiSession: Record<string, unknown>): Session {
  const sets = (apiSession.sets as Record<string, unknown>[]) ?? [];
  return {
    completionId: (apiSession.completion_id as string) ?? '',
    workoutDate: (apiSession.workout_date as string) ?? '',
    workoutName: apiSession.workout_name as string | null,
    exerciseName: (apiSession.exercise_name as string) ?? '',
    sets: sets.map(transformSet),
    sessionBest1Rm: apiSession.session_best_1rm as number | null,
    sessionMaxWeight: apiSession.session_max_weight as number | null,
    sessionTotalVolume: apiSession.session_total_volume as number | null,
  };
}

/**
 * Transform exercise history from API response to TypeScript type.
 */
function transformExerciseHistory(apiResponse: Record<string, unknown>): ExerciseHistory {
  const sessions = (apiResponse.sessions as Record<string, unknown>[]) ?? [];
  return {
    exerciseId: (apiResponse.exercise_id as string) ?? '',
    exerciseName: (apiResponse.exercise_name as string) ?? '',
    supports1Rm: (apiResponse.supports_1rm as boolean) ?? false,
    oneRmFormula: (apiResponse.one_rm_formula as string) ?? 'brzycki',
    sessions: sessions.map(transformSession),
    totalSessions: (apiResponse.total_sessions as number) ?? 0,
    allTimeBest1Rm: apiResponse.all_time_best_1rm as number | null,
    allTimeMaxWeight: apiResponse.all_time_max_weight as number | null,
  };
}

/**
 * Transform an exercise with history from API response.
 */
function transformExerciseWithHistory(apiExercise: Record<string, unknown>): ExerciseWithHistory {
  return {
    exerciseId: (apiExercise.exercise_id as string) ?? '',
    exerciseName: (apiExercise.exercise_name as string) ?? '',
    sessionCount: (apiExercise.session_count as number) ?? 0,
  };
}

/**
 * Transform exercises with history response from API.
 */
function transformExercisesWithHistory(apiResponse: Record<string, unknown>): ExercisesWithHistoryResponse {
  const exercises = (apiResponse.exercises as Record<string, unknown>[]) ?? [];
  return {
    exercises: exercises.map(transformExerciseWithHistory),
    total: (apiResponse.total as number) ?? 0,
  };
}

/**
 * Transform a personal record from API response.
 */
function transformPersonalRecord(apiRecord: Record<string, unknown>): PersonalRecord {
  return {
    exerciseId: (apiRecord.exercise_id as string) ?? '',
    exerciseName: (apiRecord.exercise_name as string) ?? '',
    recordType: (apiRecord.record_type as RecordType) ?? '1rm',
    value: (apiRecord.value as number) ?? 0,
    unit: (apiRecord.unit as string) ?? 'lbs',
    achievedAt: apiRecord.achieved_at as string | null,
    completionId: apiRecord.completion_id as string | null,
    details: apiRecord.details as Record<string, unknown> | null,
  };
}

/**
 * Transform personal records response from API.
 */
function transformPersonalRecords(apiResponse: Record<string, unknown>): PersonalRecordsResponse {
  const records = (apiResponse.records as Record<string, unknown>[]) ?? [];
  return {
    records: records.map(transformPersonalRecord),
    exerciseId: apiResponse.exercise_id as string | null,
  };
}

/**
 * Transform last weight response from API.
 */
function transformLastWeight(apiResponse: Record<string, unknown>): LastWeight {
  return {
    exerciseId: (apiResponse.exercise_id as string) ?? '',
    exerciseName: (apiResponse.exercise_name as string) ?? '',
    weight: (apiResponse.weight as number) ?? 0,
    weightUnit: (apiResponse.weight_unit as string) ?? 'lbs',
    repsCompleted: (apiResponse.reps_completed as number) ?? 0,
    workoutDate: (apiResponse.workout_date as string) ?? '',
    completionId: (apiResponse.completion_id as string) ?? '',
  };
}

/**
 * Transform a volume data point from API response.
 */
function transformVolumeDataPoint(apiPoint: Record<string, unknown>): VolumeDataPoint {
  return {
    period: (apiPoint.period as string) ?? '',
    muscleGroup: (apiPoint.muscle_group as string) ?? '',
    totalVolume: (apiPoint.total_volume as number) ?? 0,
    totalSets: (apiPoint.total_sets as number) ?? 0,
    totalReps: (apiPoint.total_reps as number) ?? 0,
  };
}

/**
 * Transform volume analytics response from API.
 */
function transformVolumeAnalytics(apiResponse: Record<string, unknown>): VolumeAnalytics {
  const data = (apiResponse.data as Record<string, unknown>[]) ?? [];
  const period = (apiResponse.period as Record<string, unknown>) ?? {};
  const summary = (apiResponse.summary as Record<string, unknown>) ?? {};

  return {
    data: data.map(transformVolumeDataPoint),
    summary: {
      totalVolume: (summary.total_volume as number) ?? 0,
      totalSets: (summary.total_sets as number) ?? 0,
      totalReps: (summary.total_reps as number) ?? 0,
      muscleGroupBreakdown: (summary.muscle_group_breakdown as Record<string, number>) ?? {},
    },
    period: {
      startDate: (period.start_date as string) ?? '',
      endDate: (period.end_date as string) ?? '',
    },
    granularity: (apiResponse.granularity as VolumeAnalytics['granularity']) ?? 'daily',
  };
}

// =============================================================================
// API Client
// =============================================================================

class ProgressionApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `API error: ${response.status}`);
    }
    return response.json();
  }

  // ==========================================
  // EXERCISES WITH HISTORY
  // ==========================================

  /**
   * Get exercises that the user has performed.
   *
   * Returns a list of exercises where the user has at least one completed
   * session with weight data, sorted by most frequently performed.
   */
  async getExercisesWithHistory(
    params: GetExercisesParams = {}
  ): Promise<ExercisesWithHistoryResponse> {
    const searchParams = new URLSearchParams();
    if (params.limit !== undefined) {
      searchParams.set('limit', params.limit.toString());
    }

    const queryString = searchParams.toString();
    const url = `${this.baseUrl}/progression/exercises${queryString ? `?${queryString}` : ''}`;

    const response = await authenticatedFetch(url, {
      headers: this.getHeaders(),
    });
    const data = await this.handleResponse<Record<string, unknown>>(response);
    return transformExercisesWithHistory(data);
  }

  // ==========================================
  // EXERCISE HISTORY
  // ==========================================

  /**
   * Get the history of a specific exercise.
   *
   * Returns sessions where the exercise was performed, ordered by date descending.
   * Each session includes all sets with weight, reps, and calculated estimated 1RM.
   */
  async getExerciseHistory(params: GetExerciseHistoryParams): Promise<ExerciseHistory> {
    const searchParams = new URLSearchParams();
    if (params.limit !== undefined) {
      searchParams.set('limit', params.limit.toString());
    }
    if (params.offset !== undefined) {
      searchParams.set('offset', params.offset.toString());
    }

    const queryString = searchParams.toString();
    const url = `${this.baseUrl}/progression/exercises/${encodeURIComponent(params.exerciseId)}/history${queryString ? `?${queryString}` : ''}`;

    const response = await authenticatedFetch(url, {
      headers: this.getHeaders(),
    });
    const data = await this.handleResponse<Record<string, unknown>>(response);
    return transformExerciseHistory(data);
  }

  // ==========================================
  // LAST WEIGHT
  // ==========================================

  /**
   * Get the last weight used for an exercise.
   *
   * Returns the most recent completed set with a weight value.
   * Used for the "Use Last Weight" feature in companion apps.
   */
  async getLastWeight(exerciseId: string): Promise<LastWeight> {
    const url = `${this.baseUrl}/progression/exercises/${encodeURIComponent(exerciseId)}/last-weight`;

    const response = await authenticatedFetch(url, {
      headers: this.getHeaders(),
    });
    const data = await this.handleResponse<Record<string, unknown>>(response);
    return transformLastWeight(data);
  }

  // ==========================================
  // PERSONAL RECORDS
  // ==========================================

  /**
   * Get personal records for the user.
   *
   * Calculates records from all exercise history:
   * - 1rm: Best estimated 1RM (calculated from weight/reps)
   * - max_weight: Heaviest weight lifted
   * - max_reps: Most reps at any weight
   */
  async getPersonalRecords(
    params: GetPersonalRecordsParams = {}
  ): Promise<PersonalRecordsResponse> {
    const searchParams = new URLSearchParams();
    if (params.recordType !== undefined) {
      searchParams.set('record_type', params.recordType);
    }
    if (params.exerciseId !== undefined) {
      searchParams.set('exercise_id', params.exerciseId);
    }
    if (params.limit !== undefined) {
      searchParams.set('limit', params.limit.toString());
    }

    const queryString = searchParams.toString();
    const url = `${this.baseUrl}/progression/records${queryString ? `?${queryString}` : ''}`;

    const response = await authenticatedFetch(url, {
      headers: this.getHeaders(),
    });
    const data = await this.handleResponse<Record<string, unknown>>(response);
    return transformPersonalRecords(data);
  }

  // ==========================================
  // VOLUME ANALYTICS
  // ==========================================

  /**
   * Get training volume analytics by muscle group.
   *
   * Returns total volume (weight * reps) for each muscle group
   * over the specified time period, aggregated by the specified granularity.
   */
  async getVolumeAnalytics(
    params: GetVolumeAnalyticsParams = {}
  ): Promise<VolumeAnalytics> {
    const searchParams = new URLSearchParams();
    if (params.startDate !== undefined) {
      searchParams.set('start_date', params.startDate);
    }
    if (params.endDate !== undefined) {
      searchParams.set('end_date', params.endDate);
    }
    if (params.granularity !== undefined) {
      searchParams.set('granularity', params.granularity);
    }
    if (params.muscleGroups !== undefined && params.muscleGroups.length > 0) {
      searchParams.set('muscle_groups', params.muscleGroups.join(','));
    }

    const queryString = searchParams.toString();
    const url = `${this.baseUrl}/progression/volume${queryString ? `?${queryString}` : ''}`;

    const response = await authenticatedFetch(url, {
      headers: this.getHeaders(),
    });
    const data = await this.handleResponse<Record<string, unknown>>(response);
    return transformVolumeAnalytics(data);
  }
}

// Export singleton instance
export const progressionApi = new ProgressionApiClient();

// Export class for testing
export { ProgressionApiClient };

// Re-export types for convenience
export type {
  ExerciseHistory,
  ExercisesWithHistoryResponse,
  ExerciseWithHistory,
  GetExerciseHistoryParams,
  GetExercisesParams,
  GetPersonalRecordsParams,
  GetVolumeAnalyticsParams,
  LastWeight,
  PersonalRecord,
  PersonalRecordsResponse,
  RecordType,
  Session,
  SetDetail,
  VolumeAnalytics,
  VolumeDataPoint,
  VolumeGranularity,
} from '../types/progression';
