/**
 * Workout Completions API (AMA-196)
 *
 * Client functions for fetching workout completion records from Apple Watch/Garmin.
 */

import { authenticatedFetch } from './authenticated-fetch';
import { API_URLS } from './config';
import { isDemoMode } from './demo-mode';

// Use centralized API config
const MAPPER_API_BASE_URL = API_URLS.MAPPER;

// =============================================================================
// Demo mock data
// =============================================================================

const DEMO_COMPLETIONS: WorkoutCompletion[] = [
  {
    id: 'comp-1',
    workoutName: 'Hyrox Session',
    startedAt: '2026-02-20T08:30:00',
    durationSeconds: 4500,
    avgHeartRate: 158,
    maxHeartRate: 182,
    minHeartRate: 120,
    activeCalories: 620,
    totalCalories: 680,
    distanceMeters: 8000,
    source: 'garmin',
  },
  {
    id: 'comp-2',
    workoutName: 'Upper Body Strength',
    startedAt: '2026-02-22T10:00:00',
    durationSeconds: 4200,
    avgHeartRate: 128,
    maxHeartRate: 155,
    minHeartRate: 98,
    activeCalories: 380,
    totalCalories: 420,
    source: 'apple_watch',
  },
  {
    id: 'comp-3',
    workoutName: 'Lower Body Power',
    startedAt: '2026-02-18T07:00:00',
    durationSeconds: 4800,
    avgHeartRate: 135,
    maxHeartRate: 162,
    minHeartRate: 100,
    activeCalories: 450,
    totalCalories: 510,
    source: 'garmin',
  },
  {
    id: 'comp-4',
    workoutName: 'Morning Run',
    startedAt: '2026-02-17T06:15:00',
    durationSeconds: 2700,
    avgHeartRate: 148,
    maxHeartRate: 168,
    minHeartRate: 118,
    activeCalories: 390,
    totalCalories: 430,
    distanceMeters: 5000,
    steps: 5200,
    source: 'garmin',
  },
  {
    id: 'comp-5',
    workoutName: 'Push Day — PPL',
    startedAt: '2026-02-15T09:30:00',
    durationSeconds: 4500,
    avgHeartRate: 122,
    maxHeartRate: 148,
    minHeartRate: 95,
    activeCalories: 360,
    totalCalories: 400,
    source: 'apple_watch',
  },
  {
    id: 'comp-6',
    workoutName: 'Pull Day — PPL',
    startedAt: '2026-02-13T10:00:00',
    durationSeconds: 4200,
    avgHeartRate: 130,
    maxHeartRate: 158,
    minHeartRate: 98,
    activeCalories: 395,
    totalCalories: 435,
    source: 'apple_watch',
  },
  {
    id: 'comp-7',
    workoutName: 'HIIT Cardio Blast',
    startedAt: '2026-02-11T07:30:00',
    durationSeconds: 2700,
    avgHeartRate: 168,
    maxHeartRate: 188,
    minHeartRate: 130,
    activeCalories: 480,
    totalCalories: 520,
    source: 'garmin',
  },
  {
    id: 'comp-8',
    workoutName: 'Leg Day — PPL',
    startedAt: '2026-02-08T09:00:00',
    durationSeconds: 5100,
    avgHeartRate: 138,
    maxHeartRate: 165,
    minHeartRate: 102,
    activeCalories: 490,
    totalCalories: 545,
    source: 'apple_watch',
  },
  {
    id: 'comp-9',
    workoutName: 'Zone 2 Bike Ride',
    startedAt: '2026-02-06T06:00:00',
    durationSeconds: 3900,
    avgHeartRate: 138,
    maxHeartRate: 150,
    minHeartRate: 112,
    activeCalories: 540,
    totalCalories: 590,
    distanceMeters: 25000,
    source: 'garmin',
  },
  {
    id: 'comp-10',
    workoutName: 'Full Body Conditioning',
    startedAt: '2026-02-04T08:30:00',
    durationSeconds: 4500,
    avgHeartRate: 142,
    maxHeartRate: 172,
    minHeartRate: 105,
    activeCalories: 530,
    totalCalories: 580,
    source: 'apple_watch',
  },
];

/**
 * AMA-314: Transform heart rate samples from iOS format to web format.
 * iOS sends: { timestamp: string, value: number }
 * Web expects: { t: number, bpm: number }
 */
function transformHeartRateSamples(
  samples: Array<{ timestamp?: string; value?: number; t?: number; bpm?: number }> | undefined
): Array<{ t: number; bpm: number }> | undefined {
  if (!samples || samples.length === 0) {
    return undefined;
  }

  return samples.map((sample) => {
    // Already in web format
    if (typeof sample.t === 'number' && typeof sample.bpm === 'number') {
      return { t: sample.t, bpm: sample.bpm };
    }
    // Convert from iOS format
    const timestamp = sample.timestamp ? new Date(sample.timestamp).getTime() / 1000 : 0;
    const bpm = sample.value ?? sample.bpm ?? 0;
    return { t: timestamp, bpm };
  });
}

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
  if (isDemoMode) {
    const sliced = DEMO_COMPLETIONS.slice(offset, offset + limit);
    return { completions: sliced, total: DEMO_COMPLETIONS.length };
  }

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

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function makeDemoHRSamples(avgHR: number, durationSeconds: number): Array<{ t: number; bpm: number }> {
  const samples: Array<{ t: number; bpm: number }> = [];
  const count = Math.min(60, Math.floor(durationSeconds / 60));
  for (let i = 0; i < count; i++) {
    const progress = i / count;
    const variance = Math.sin(progress * Math.PI * 3) * 12;
    samples.push({ t: i * 60, bpm: Math.round(avgHR + variance) });
  }
  return samples;
}

/**
 * Fetch a single workout completion with full details including intervals.
 *
 * @param completionId - The completion ID to fetch
 */
export async function fetchWorkoutCompletionById(
  completionId: string
): Promise<WorkoutCompletionDetail | null> {
  if (isDemoMode) {
    const base = DEMO_COMPLETIONS.find((c) => c.id === completionId);
    if (!base) return null;
    const endedAt = new Date(new Date(base.startedAt).getTime() + base.durationSeconds * 1000).toISOString();
    return {
      ...base,
      endedAt,
      durationFormatted: formatDuration(base.durationSeconds),
      heartRateSamples: base.avgHeartRate ? makeDemoHRSamples(base.avgHeartRate, base.durationSeconds) : undefined,
      createdAt: base.startedAt,
    };
  }

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

  // AMA-314: Transform heart rate samples from iOS format {timestamp, value} to web format {t, bpm}
  const transformedHRSamples = transformHeartRateSamples(c.heart_rate_samples);

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
    heartRateSamples: transformedHRSamples,
    intervals: c.intervals,
    executionLog: c.execution_log,  // AMA-304: v2 execution log
    createdAt: c.created_at,
  };
}
