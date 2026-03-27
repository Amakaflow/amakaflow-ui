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
import { isDemoMode } from './demo-mode';
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
// Error Types
// =============================================================================

/**
 * Custom error class for Progression API errors.
 * Includes HTTP status code for proper error handling in consumers.
 */
export class ProgressionApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly detail?: string
  ) {
    super(message);
    this.name = 'ProgressionApiError';
  }

  /**
   * Check if this is a "not found" error (404).
   */
  isNotFound(): boolean {
    return this.statusCode === 404;
  }

  /**
   * Check if this is an authentication error (401).
   */
  isUnauthorized(): boolean {
    return this.statusCode === 401;
  }
}

// =============================================================================
// Runtime Type Helpers
// =============================================================================

/**
 * Safely extract a string value from an unknown field.
 */
function asString(value: unknown, defaultValue: string = ''): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return defaultValue;
  return String(value);
}

/**
 * Safely extract a nullable string value from an unknown field.
 */
function asStringOrNull(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return null;
  return String(value);
}

/**
 * Safely extract a number value from an unknown field.
 */
function asNumber(value: unknown, defaultValue: number = 0): number {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (value === null || value === undefined) return defaultValue;
  const parsed = Number(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Safely extract a nullable number value from an unknown field.
 */
function asNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Safely extract a boolean value from an unknown field.
 */
function asBoolean(value: unknown, defaultValue: boolean = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return defaultValue;
  return Boolean(value);
}

/**
 * Safely extract an array from an unknown field.
 */
function asArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  return [];
}

/**
 * Safely extract an object from an unknown field.
 */
function asObject(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

// =============================================================================
// Response Transformers (snake_case API -> camelCase TypeScript)
// =============================================================================

/**
 * Transform a set from API response to TypeScript type.
 */
function transformSet(apiSet: Record<string, unknown>): SetDetail {
  return {
    setNumber: asNumber(apiSet.set_number, 0),
    weight: asNumberOrNull(apiSet.weight),
    weightUnit: asString(apiSet.weight_unit, 'lbs'),
    repsCompleted: asNumberOrNull(apiSet.reps_completed),
    repsPlanned: asNumberOrNull(apiSet.reps_planned),
    status: asString(apiSet.status, 'completed'),
    estimated1Rm: asNumberOrNull(apiSet.estimated_1rm),
    isPr: asBoolean(apiSet.is_pr, false),
  };
}

/**
 * Transform a session from API response to TypeScript type.
 */
function transformSession(apiSession: Record<string, unknown>): Session {
  return {
    completionId: asString(apiSession.completion_id),
    workoutDate: asString(apiSession.workout_date),
    workoutName: asStringOrNull(apiSession.workout_name),
    exerciseName: asString(apiSession.exercise_name),
    sets: asArray(apiSession.sets).map(transformSet),
    sessionBest1Rm: asNumberOrNull(apiSession.session_best_1rm),
    sessionMaxWeight: asNumberOrNull(apiSession.session_max_weight),
    sessionTotalVolume: asNumberOrNull(apiSession.session_total_volume),
  };
}

/**
 * Transform exercise history from API response to TypeScript type.
 */
function transformExerciseHistory(apiResponse: Record<string, unknown>): ExerciseHistory {
  return {
    exerciseId: asString(apiResponse.exercise_id),
    exerciseName: asString(apiResponse.exercise_name),
    supports1Rm: asBoolean(apiResponse.supports_1rm, false),
    oneRmFormula: asString(apiResponse.one_rm_formula, 'brzycki'),
    sessions: asArray(apiResponse.sessions).map(transformSession),
    totalSessions: asNumber(apiResponse.total_sessions, 0),
    allTimeBest1Rm: asNumberOrNull(apiResponse.all_time_best_1rm),
    allTimeMaxWeight: asNumberOrNull(apiResponse.all_time_max_weight),
  };
}

/**
 * Transform an exercise with history from API response.
 */
function transformExerciseWithHistory(apiExercise: Record<string, unknown>): ExerciseWithHistory {
  return {
    exerciseId: asString(apiExercise.exercise_id),
    exerciseName: asString(apiExercise.exercise_name),
    sessionCount: asNumber(apiExercise.session_count, 0),
  };
}

/**
 * Transform exercises with history response from API.
 */
function transformExercisesWithHistory(apiResponse: Record<string, unknown>): ExercisesWithHistoryResponse {
  return {
    exercises: asArray(apiResponse.exercises).map(transformExerciseWithHistory),
    total: asNumber(apiResponse.total, 0),
  };
}

/**
 * Transform a personal record from API response.
 */
function transformPersonalRecord(apiRecord: Record<string, unknown>): PersonalRecord {
  const recordType = asString(apiRecord.record_type, '1rm');
  return {
    exerciseId: asString(apiRecord.exercise_id),
    exerciseName: asString(apiRecord.exercise_name),
    recordType: recordType as RecordType,
    value: asNumber(apiRecord.value, 0),
    unit: asString(apiRecord.unit, 'lbs'),
    achievedAt: asStringOrNull(apiRecord.achieved_at),
    completionId: asStringOrNull(apiRecord.completion_id),
    details: apiRecord.details !== null && typeof apiRecord.details === 'object'
      ? (apiRecord.details as Record<string, unknown>)
      : null,
  };
}

/**
 * Transform personal records response from API.
 */
function transformPersonalRecords(apiResponse: Record<string, unknown>): PersonalRecordsResponse {
  return {
    records: asArray(apiResponse.records).map(transformPersonalRecord),
    exerciseId: asStringOrNull(apiResponse.exercise_id),
  };
}

/**
 * Transform last weight response from API.
 */
function transformLastWeight(apiResponse: Record<string, unknown>): LastWeight {
  return {
    exerciseId: asString(apiResponse.exercise_id),
    exerciseName: asString(apiResponse.exercise_name),
    weight: asNumber(apiResponse.weight, 0),
    weightUnit: asString(apiResponse.weight_unit, 'lbs'),
    repsCompleted: asNumber(apiResponse.reps_completed, 0),
    workoutDate: asString(apiResponse.workout_date),
    completionId: asString(apiResponse.completion_id),
  };
}

/**
 * Transform a volume data point from API response.
 */
function transformVolumeDataPoint(apiPoint: Record<string, unknown>): VolumeDataPoint {
  return {
    period: asString(apiPoint.period),
    muscleGroup: asString(apiPoint.muscle_group),
    totalVolume: asNumber(apiPoint.total_volume, 0),
    totalSets: asNumber(apiPoint.total_sets, 0),
    totalReps: asNumber(apiPoint.total_reps, 0),
  };
}

/**
 * Transform volume analytics response from API.
 */
function transformVolumeAnalytics(apiResponse: Record<string, unknown>): VolumeAnalytics {
  const period = asObject(apiResponse.period);
  const summary = asObject(apiResponse.summary);
  const breakdown = summary.muscle_group_breakdown;

  return {
    data: asArray(apiResponse.data).map(transformVolumeDataPoint),
    summary: {
      totalVolume: asNumber(summary.total_volume, 0),
      totalSets: asNumber(summary.total_sets, 0),
      totalReps: asNumber(summary.total_reps, 0),
      muscleGroupBreakdown: breakdown !== null && typeof breakdown === 'object' && !Array.isArray(breakdown)
        ? (breakdown as Record<string, number>)
        : {},
    },
    period: {
      startDate: asString(period.start_date),
      endDate: asString(period.end_date),
    },
    granularity: asString(apiResponse.granularity, 'daily') as VolumeAnalytics['granularity'],
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
      const detail = typeof error.detail === 'string' ? error.detail : 'Unknown error';
      throw new ProgressionApiError(
        response.status,
        detail || `API error: ${response.status}`,
        detail
      );
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
    if (isDemoMode) {
      const { DEMO_EXERCISES_WITH_HISTORY } = await import('./mock-data/demo-extended');
      return DEMO_EXERCISES_WITH_HISTORY;
    }
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
    if (isDemoMode) {
      const { getDemoExerciseHistory } = await import('./mock-data/demo-extended');
      return getDemoExerciseHistory(params.exerciseId);
    }
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
    if (isDemoMode) {
      const { DEMO_VOLUME_ANALYTICS } = await import('./mock-data/demo-extended');
      return DEMO_VOLUME_ANALYTICS;
    }
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
