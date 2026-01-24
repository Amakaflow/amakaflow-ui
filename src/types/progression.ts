/**
 * TypeScript types for Progression API.
 *
 * Part of AMA-480: Create Progression API TypeScript Client
 *
 * These types mirror the Pydantic response models from mapper-api's
 * progression router for exercise history and analytics.
 */

// =============================================================================
// Set and Session Types
// =============================================================================

/**
 * A single set with weight, reps, and calculated 1RM.
 */
export interface SetDetail {
  setNumber: number;
  weight: number | null;
  weightUnit: string;
  repsCompleted: number | null;
  repsPlanned: number | null;
  status: string;
  estimated1Rm: number | null;
  isPr: boolean;
}

/**
 * An exercise session containing all sets from a workout.
 */
export interface Session {
  completionId: string;
  workoutDate: string;
  workoutName: string | null;
  exerciseName: string;
  sets: SetDetail[];
  sessionBest1Rm: number | null;
  sessionMaxWeight: number | null;
  sessionTotalVolume: number | null;
}

// =============================================================================
// Exercise History Types
// =============================================================================

/**
 * Response from GET /progression/exercises/{id}/history
 */
export interface ExerciseHistory {
  exerciseId: string;
  exerciseName: string;
  supports1Rm: boolean;
  oneRmFormula: string;
  sessions: Session[];
  totalSessions: number;
  allTimeBest1Rm: number | null;
  allTimeMaxWeight: number | null;
}

/**
 * An exercise that the user has history for.
 */
export interface ExerciseWithHistory {
  exerciseId: string;
  exerciseName: string;
  sessionCount: number;
}

/**
 * Response from GET /progression/exercises
 */
export interface ExercisesWithHistoryResponse {
  exercises: ExerciseWithHistory[];
  total: number;
}

// =============================================================================
// Personal Records Types
// =============================================================================

/**
 * Type of personal record.
 */
export type RecordType = '1rm' | 'max_weight' | 'max_reps';

/**
 * A single personal record.
 */
export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  recordType: RecordType;
  value: number;
  unit: string;
  achievedAt: string | null;
  completionId: string | null;
  details: Record<string, unknown> | null;
}

/**
 * Response from GET /progression/records
 */
export interface PersonalRecordsResponse {
  records: PersonalRecord[];
  exerciseId: string | null;
}

// =============================================================================
// Last Weight Types
// =============================================================================

/**
 * Response from GET /progression/exercises/{id}/last-weight
 */
export interface LastWeight {
  exerciseId: string;
  exerciseName: string;
  weight: number;
  weightUnit: string;
  repsCompleted: number;
  workoutDate: string;
  completionId: string;
}

// =============================================================================
// Volume Analytics Types
// =============================================================================

/**
 * Time granularity for volume analytics.
 */
export type VolumeGranularity = 'daily' | 'weekly' | 'monthly';

/**
 * A single volume data point.
 */
export interface VolumeDataPoint {
  period: string;
  muscleGroup: string;
  totalVolume: number;
  totalSets: number;
  totalReps: number;
}

/**
 * Summary of volume analytics.
 */
export interface VolumeSummary {
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  muscleGroupBreakdown: Record<string, number>;
}

/**
 * Response from GET /progression/volume
 */
export interface VolumeAnalytics {
  data: VolumeDataPoint[];
  summary: VolumeSummary;
  period: {
    startDate: string;
    endDate: string;
  };
  granularity: VolumeGranularity;
}

// =============================================================================
// API Request Parameters
// =============================================================================

/**
 * Parameters for fetching exercise history.
 */
export interface GetExerciseHistoryParams {
  exerciseId: string;
  limit?: number;
  offset?: number;
}

/**
 * Parameters for fetching exercises with history.
 */
export interface GetExercisesParams {
  limit?: number;
}

/**
 * Parameters for fetching personal records.
 */
export interface GetPersonalRecordsParams {
  recordType?: RecordType;
  exerciseId?: string;
  limit?: number;
}

/**
 * Parameters for fetching volume analytics.
 */
export interface GetVolumeAnalyticsParams {
  startDate?: string;
  endDate?: string;
  granularity?: VolumeGranularity;
  muscleGroups?: string[];
}

// =============================================================================
// API Error Types
// =============================================================================

/**
 * Structured error from progression API.
 */
export interface ProgressionApiError {
  statusCode: number;
  message: string;
  detail?: string;
}
