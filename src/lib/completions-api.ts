/**
 * Workout Completions API (AMA-196)
 *
 * Client functions for fetching workout completion records from Apple Watch/Garmin.
 */

import { authenticatedFetch } from './authenticated-fetch';
import { API_URLS } from './config';

// Use centralized API config
const MAPPER_API_BASE_URL = API_URLS.MAPPER;

// Types for workout completions
export interface WorkoutCompletion {
  id: string;
  workoutName: string;
  startedAt: string;
  durationSeconds: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  minHeartRate?: number;
  activeCalories?: number;
  totalCalories?: number;
  distanceMeters?: number;
  steps?: number;
  source: string;
}

export interface WorkoutCompletionsResponse {
  completions: WorkoutCompletion[];
  total: number;
}

export interface IOSCompanionInterval {
  kind?: 'warmup' | 'cooldown' | 'time' | 'reps' | 'distance' | 'repeat' | 'rest';
  type?: string;  // Android sends 'type' instead of 'kind'
  seconds?: number;
  target?: string;
  reps?: number;
  name?: string;
  load?: string;
  restSec?: number;
  meters?: number;
  intervals?: IOSCompanionInterval[];
}

// =============================================================================
// ExecutionLog v2 Types (AMA-304)
// =============================================================================

export type IntervalStatus = 'completed' | 'skipped' | 'not_reached';
export type SetStatus = IntervalStatus;
export type SkipReason = 'fatigue' | 'injury' | 'time' | 'equipment' | 'other';
export type IntervalKind = 'timed' | 'reps' | 'warmup' | 'rest';
export type WeightSourceMethod = 'manual' | 'suggested' | 'previous';

export interface WeightComponent {
  source: string;
  value?: number;
  unit?: 'lbs' | 'kg';
  modifier?: 'add' | 'assist';
  label?: string;
}

export interface WeightEntry {
  components: WeightComponent[];
  display_label: string;
}

export interface SetLog {
  set_number: number;
  status: SetStatus;
  duration_seconds?: number;
  reps_planned?: number;
  reps_completed?: number;
  weight?: WeightEntry;
  weight_source?: WeightSourceMethod;
  rpe?: number;
  rir?: number;
  to_failure?: boolean;
  modified?: boolean;
  skip_reason?: SkipReason;
}

export interface IntervalLog {
  interval_index: number;
  planned_name: string;
  exercise_id?: string;
  exercise_match_confidence?: number;
  planned_kind: IntervalKind;
  status: IntervalStatus;
  planned_duration_seconds?: number;
  actual_duration_seconds?: number;
  planned_sets?: number;
  planned_reps?: number;
  sets?: SetLog[];
  skip_reason?: SkipReason;
}

export interface ExecutionSummary {
  total_intervals: number;
  completed: number;
  skipped: number;
  not_reached: number;
  completion_percentage: number;
  total_sets: number;
  sets_completed: number;
  sets_skipped: number;
  total_duration_seconds: number;
  active_duration_seconds: number;
  calories?: number;
  avg_heart_rate?: number;
  max_heart_rate?: number;
}

export interface ExecutionLog {
  version: number;
  intervals: IntervalLog[];
  summary: ExecutionSummary;
}

export interface WorkoutCompletionDetail extends WorkoutCompletion {
  endedAt: string;
  durationFormatted: string;
  sourceWorkoutId?: string;
  deviceInfo?: Record<string, unknown>;
  heartRateSamples?: Array<{ t: number; bpm: number }>;
  intervals?: IOSCompanionInterval[];
  executionLog?: ExecutionLog;  // AMA-304: v2 execution log data
  createdAt: string;
}

/**
 * Fetch workout completions for the authenticated user.
 *
 * Returns a paginated list of workout completion records captured from
 * Apple Watch, Garmin, or manual entry.
 *
 * @param limit - Maximum number of completions to return (default 50)
 * @param offset - Number of completions to skip for pagination (default 0)
 */
export async function fetchWorkoutCompletions(
  limit: number = 50,
  offset: number = 0
): Promise<WorkoutCompletionsResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await authenticatedFetch(
    `${MAPPER_API_BASE_URL}/workouts/completions?${params}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to fetch completions: ${response.status}`);
  }

  const data = await response.json();

  // Transform snake_case from backend to camelCase for frontend
  return {
    completions: (data.completions || []).map((c: any) => ({
      id: c.id,
      workoutName: c.workout_name,
      startedAt: c.started_at,
      durationSeconds: c.duration_seconds,
      avgHeartRate: c.avg_heart_rate,
      maxHeartRate: c.max_heart_rate,
      minHeartRate: c.min_heart_rate,
      activeCalories: c.active_calories,
      totalCalories: c.total_calories,
      distanceMeters: c.distance_meters,
      steps: c.steps,
      source: c.source,
    })),
    total: data.total || 0,
  };
}

/**
 * Fetch a single workout completion with full details including intervals.
 *
 * @param completionId - The completion ID to fetch
 */
export async function fetchWorkoutCompletionById(
  completionId: string
): Promise<WorkoutCompletionDetail | null> {
  const response = await authenticatedFetch(
    `${MAPPER_API_BASE_URL}/workouts/completions/${completionId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to fetch completion: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success || !data.completion) {
    return null;
  }

  const c = data.completion;

  // Transform snake_case from backend to camelCase for frontend
  return {
    id: c.id,
    workoutName: c.workout_name,
    startedAt: c.started_at,
    endedAt: c.ended_at,
    durationSeconds: c.duration_seconds,
    durationFormatted: c.duration_formatted,
    avgHeartRate: c.avg_heart_rate,
    maxHeartRate: c.max_heart_rate,
    minHeartRate: c.min_heart_rate,
    activeCalories: c.active_calories,
    totalCalories: c.total_calories,
    distanceMeters: c.distance_meters,
    steps: c.steps,
    source: c.source,
    sourceWorkoutId: c.source_workout_id,
    deviceInfo: c.device_info,
    heartRateSamples: c.heart_rate_samples,
    intervals: c.intervals,
    executionLog: c.execution_log,  // AMA-304: v2 execution log
    createdAt: c.created_at,
  };
}
