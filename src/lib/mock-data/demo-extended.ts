/**
 * Extended demo mode mock data for APIs not yet covered by demo mode.
 * Used by workout-api, training-program-api, progression-api, and mobile-api
 * when VITE_DEMO_MODE=true.
 */

import type { WorkoutProgram, UserTag } from '../workout-api';
import type { TrainingProgram } from '../../types/training-program';
import type {
  ExercisesWithHistoryResponse,
  ExerciseHistory,
  VolumeAnalytics,
} from '../../types/progression';
import type { PairedDevice } from '../mobile-api';

// ─── Workout Programs (manual collections) ───────────────────────────────────

export const DEMO_PROGRAMS: WorkoutProgram[] = [
  {
    id: 'demo-prog-1',
    profile_id: 'demo-user-1',
    name: 'Push Pull Legs',
    description: '6-day PPL split focusing on strength and hypertrophy',
    color: '#6366f1',
    icon: '💪',
    current_day_index: 2,
    is_active: true,
    created_at: '2026-01-10T09:00:00Z',
    updated_at: '2026-02-20T14:30:00Z',
    members: [],
  },
  {
    id: 'demo-prog-2',
    profile_id: 'demo-user-1',
    name: 'Cardio & Core',
    description: 'HIIT and core stability sessions',
    color: '#f59e0b',
    icon: '🏃',
    current_day_index: 0,
    is_active: true,
    created_at: '2026-01-20T09:00:00Z',
    updated_at: '2026-02-15T10:00:00Z',
    members: [],
  },
];

// ─── User Tags ────────────────────────────────────────────────────────────────

export const DEMO_USER_TAGS: UserTag[] = [
  { id: 'tag-1', profile_id: 'demo-user-1', name: 'Strength', color: '#6366f1', created_at: '2026-01-01T00:00:00Z' },
  { id: 'tag-2', profile_id: 'demo-user-1', name: 'Cardio', color: '#f59e0b', created_at: '2026-01-01T00:00:00Z' },
  { id: 'tag-3', profile_id: 'demo-user-1', name: 'Favourite', color: '#ef4444', created_at: '2026-01-01T00:00:00Z' },
];

// ─── AI-Generated Training Program ───────────────────────────────────────────

export const DEMO_TRAINING_PROGRAMS: TrainingProgram[] = [
  {
    id: 'demo-tp-1',
    user_id: 'demo-user-1',
    name: 'Hypertrophy Block — 8 Weeks',
    goal: 'muscle_gain',
    periodization_model: 'block',
    duration_weeks: 8,
    sessions_per_week: 4,
    experience_level: 'intermediate',
    equipment_available: ['barbell', 'dumbbells', 'cable_machine', 'pull_up_bar'],
    time_per_session_minutes: 60,
    status: 'active',
    current_week: 3,
    created_at: '2026-01-15T09:00:00Z',
    updated_at: '2026-02-28T08:00:00Z',
    started_at: '2026-01-20T00:00:00Z',
    weeks: [
      {
        id: 'week-1', program_id: 'demo-tp-1', week_number: 1,
        focus: 'Accumulation', intensity_percentage: 65, volume_modifier: 1.0, is_deload: false,
        workouts: [
          {
            id: 'w1-1', week_id: 'week-1', day_of_week: 1, name: 'Upper A — Push',
            workout_type: 'push', target_duration_minutes: 60, is_completed: true,
            exercises: [
              { name: 'Bench Press', sets: 4, reps: '10-12', rest_seconds: 90 },
              { name: 'Overhead Press', sets: 3, reps: '10-12', rest_seconds: 90 },
              { name: 'Incline DB Press', sets: 3, reps: '12-15', rest_seconds: 60 },
              { name: 'Lateral Raise', sets: 3, reps: '15-20', rest_seconds: 45 },
            ],
          },
          {
            id: 'w1-2', week_id: 'week-1', day_of_week: 3, name: 'Lower A — Squat',
            workout_type: 'legs', target_duration_minutes: 60, is_completed: true,
            exercises: [
              { name: 'Back Squat', sets: 4, reps: '8-10', rest_seconds: 120 },
              { name: 'Romanian Deadlift', sets: 3, reps: '10-12', rest_seconds: 90 },
              { name: 'Leg Press', sets: 3, reps: '12-15', rest_seconds: 60 },
              { name: 'Leg Curl', sets: 3, reps: '12-15', rest_seconds: 60 },
            ],
          },
          {
            id: 'w1-3', week_id: 'week-1', day_of_week: 5, name: 'Upper B — Pull',
            workout_type: 'pull', target_duration_minutes: 60, is_completed: true,
            exercises: [
              { name: 'Pull-ups', sets: 4, reps: '8-10', rest_seconds: 90 },
              { name: 'Barbell Row', sets: 4, reps: '10-12', rest_seconds: 90 },
              { name: 'Face Pull', sets: 3, reps: '15-20', rest_seconds: 45 },
              { name: 'Bicep Curl', sets: 3, reps: '12-15', rest_seconds: 60 },
            ],
          },
          {
            id: 'w1-4', week_id: 'week-1', day_of_week: 6, name: 'Lower B — Hinge',
            workout_type: 'lower', target_duration_minutes: 60, is_completed: false,
            exercises: [
              { name: 'Deadlift', sets: 4, reps: '6-8', rest_seconds: 180 },
              { name: 'Hip Thrust', sets: 3, reps: '10-12', rest_seconds: 90 },
              { name: 'Walking Lunge', sets: 3, reps: '12', rest_seconds: 60 },
              { name: 'Calf Raise', sets: 4, reps: '15-20', rest_seconds: 45 },
            ],
          },
        ],
      },
    ],
  },
];

// ─── Progression — Exercise History ──────────────────────────────────────────

export const DEMO_EXERCISES_WITH_HISTORY: ExercisesWithHistoryResponse = {
  total: 5,
  exercises: [
    { exerciseId: 'ex-bench', exerciseName: 'Bench Press', sessionCount: 18 },
    { exerciseId: 'ex-squat', exerciseName: 'Back Squat', sessionCount: 16 },
    { exerciseId: 'ex-deadlift', exerciseName: 'Deadlift', sessionCount: 14 },
    { exerciseId: 'ex-ohp', exerciseName: 'Overhead Press', sessionCount: 12 },
    { exerciseId: 'ex-row', exerciseName: 'Barbell Row', sessionCount: 11 },
  ],
};

// ─── Progression — Per-Exercise History ──────────────────────────────────────

function makeSession(
  id: string,
  daysAgo: number,
  exerciseId: string,
  exerciseName: string,
  workoutName: string,
  sets: { w: number; r: number }[]
) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const dateStr = date.toISOString().split('T')[0];
  const setDetails = sets.map((s, i) => {
    const est1rm = s.r > 0 ? Math.round(s.w / (1.0278 - 0.0278 * s.r)) : null;
    return {
      setNumber: i + 1,
      weight: s.w,
      weightUnit: 'lbs',
      repsCompleted: s.r,
      repsPlanned: s.r,
      status: 'completed',
      estimated1Rm: est1rm,
      isPr: false,
    };
  });
  const best1rm = Math.max(...setDetails.map(s => s.estimated1Rm ?? 0));
  const maxWeight = Math.max(...sets.map(s => s.w));
  return {
    completionId: `${exerciseId}-${id}`,
    workoutDate: dateStr,
    workoutName,
    exerciseName,
    sets: setDetails,
    sessionBest1Rm: best1rm > 0 ? best1rm : null,
    sessionMaxWeight: maxWeight,
    sessionTotalVolume: sets.reduce((acc, s) => acc + s.w * s.r, 0),
  };
}

const BENCH_SESSIONS = [
  makeSession('s1', 3,  'ex-bench', 'Bench Press', 'Push Day', [{ w: 185, r: 5 }, { w: 185, r: 5 }, { w: 185, r: 4 }]),
  makeSession('s2', 10, 'ex-bench', 'Bench Press', 'Push Day', [{ w: 180, r: 5 }, { w: 180, r: 5 }, { w: 180, r: 5 }]),
  makeSession('s3', 17, 'ex-bench', 'Bench Press', 'Push Day', [{ w: 175, r: 5 }, { w: 175, r: 5 }, { w: 175, r: 4 }]),
  makeSession('s4', 24, 'ex-bench', 'Bench Press', 'Upper A',  [{ w: 170, r: 6 }, { w: 170, r: 6 }, { w: 170, r: 5 }]),
  makeSession('s5', 31, 'ex-bench', 'Bench Press', 'Push Day', [{ w: 165, r: 6 }, { w: 165, r: 6 }, { w: 165, r: 6 }]),
  makeSession('s6', 38, 'ex-bench', 'Bench Press', 'Upper A',  [{ w: 160, r: 8 }, { w: 160, r: 7 }, { w: 155, r: 8 }]),
  makeSession('s7', 45, 'ex-bench', 'Bench Press', 'Push Day', [{ w: 155, r: 8 }, { w: 155, r: 8 }, { w: 155, r: 7 }]),
  makeSession('s8', 52, 'ex-bench', 'Bench Press', 'Upper A',  [{ w: 150, r: 8 }, { w: 150, r: 8 }, { w: 150, r: 8 }]),
];
BENCH_SESSIONS[0].sets[0].isPr = true;

const SQUAT_SESSIONS = [
  makeSession('s1', 4,  'ex-squat', 'Back Squat', 'Leg Day',   [{ w: 225, r: 5 }, { w: 225, r: 5 }, { w: 225, r: 4 }]),
  makeSession('s2', 11, 'ex-squat', 'Back Squat', 'Lower A',   [{ w: 215, r: 5 }, { w: 215, r: 5 }, { w: 215, r: 5 }]),
  makeSession('s3', 18, 'ex-squat', 'Back Squat', 'Leg Day',   [{ w: 205, r: 5 }, { w: 205, r: 5 }, { w: 205, r: 5 }]),
  makeSession('s4', 25, 'ex-squat', 'Back Squat', 'Lower A',   [{ w: 200, r: 5 }, { w: 200, r: 5 }, { w: 195, r: 6 }]),
  makeSession('s5', 32, 'ex-squat', 'Back Squat', 'Leg Day',   [{ w: 190, r: 6 }, { w: 190, r: 6 }, { w: 190, r: 5 }]),
  makeSession('s6', 39, 'ex-squat', 'Back Squat', 'Lower A',   [{ w: 180, r: 8 }, { w: 180, r: 7 }, { w: 175, r: 8 }]),
];
SQUAT_SESSIONS[0].sets[0].isPr = true;

const DEADLIFT_SESSIONS = [
  makeSession('s1', 5,  'ex-deadlift', 'Deadlift', 'Lower B',  [{ w: 275, r: 3 }, { w: 275, r: 3 }, { w: 265, r: 3 }]),
  makeSession('s2', 12, 'ex-deadlift', 'Deadlift', 'Lower B',  [{ w: 265, r: 3 }, { w: 265, r: 3 }, { w: 265, r: 3 }]),
  makeSession('s3', 19, 'ex-deadlift', 'Deadlift', 'Lower B',  [{ w: 255, r: 4 }, { w: 255, r: 4 }, { w: 245, r: 4 }]),
  makeSession('s4', 26, 'ex-deadlift', 'Deadlift', 'Strength', [{ w: 245, r: 5 }, { w: 245, r: 4 }, { w: 235, r: 5 }]),
  makeSession('s5', 33, 'ex-deadlift', 'Deadlift', 'Lower B',  [{ w: 235, r: 5 }, { w: 235, r: 5 }, { w: 225, r: 5 }]),
];
DEADLIFT_SESSIONS[0].sets[0].isPr = true;

const OHP_SESSIONS = [
  makeSession('s1', 3,  'ex-ohp', 'Overhead Press', 'Push Day', [{ w: 115, r: 5 }, { w: 115, r: 5 }, { w: 110, r: 5 }]),
  makeSession('s2', 10, 'ex-ohp', 'Overhead Press', 'Upper A',  [{ w: 110, r: 5 }, { w: 110, r: 5 }, { w: 110, r: 5 }]),
  makeSession('s3', 17, 'ex-ohp', 'Overhead Press', 'Push Day', [{ w: 105, r: 6 }, { w: 105, r: 6 }, { w: 105, r: 5 }]),
  makeSession('s4', 24, 'ex-ohp', 'Overhead Press', 'Upper A',  [{ w: 100, r: 6 }, { w: 100, r: 6 }, { w: 100, r: 6 }]),
  makeSession('s5', 31, 'ex-ohp', 'Overhead Press', 'Push Day', [{ w:  95, r: 8 }, { w:  95, r: 7 }, { w:  95, r: 7 }]),
];
OHP_SESSIONS[0].sets[0].isPr = true;

const ROW_SESSIONS = [
  makeSession('s1', 4,  'ex-row', 'Barbell Row', 'Pull Day', [{ w: 155, r: 6 }, { w: 155, r: 6 }, { w: 155, r: 5 }]),
  makeSession('s2', 11, 'ex-row', 'Barbell Row', 'Upper B',  [{ w: 150, r: 6 }, { w: 150, r: 6 }, { w: 150, r: 6 }]),
  makeSession('s3', 18, 'ex-row', 'Barbell Row', 'Pull Day', [{ w: 145, r: 8 }, { w: 145, r: 7 }, { w: 140, r: 8 }]),
  makeSession('s4', 25, 'ex-row', 'Barbell Row', 'Upper B',  [{ w: 135, r: 8 }, { w: 135, r: 8 }, { w: 135, r: 7 }]),
];
ROW_SESSIONS[0].sets[0].isPr = true;

export const DEMO_EXERCISE_HISTORIES: Record<string, ExerciseHistory> = {
  'ex-bench': {
    exerciseId: 'ex-bench', exerciseName: 'Bench Press',
    supports1Rm: true, oneRmFormula: 'brzycki',
    sessions: BENCH_SESSIONS, totalSessions: 18,
    allTimeBest1Rm: Math.max(...BENCH_SESSIONS.map(s => s.sessionBest1Rm ?? 0)),
    allTimeMaxWeight: 185,
  },
  'ex-squat': {
    exerciseId: 'ex-squat', exerciseName: 'Back Squat',
    supports1Rm: true, oneRmFormula: 'brzycki',
    sessions: SQUAT_SESSIONS, totalSessions: 16,
    allTimeBest1Rm: Math.max(...SQUAT_SESSIONS.map(s => s.sessionBest1Rm ?? 0)),
    allTimeMaxWeight: 225,
  },
  'ex-deadlift': {
    exerciseId: 'ex-deadlift', exerciseName: 'Deadlift',
    supports1Rm: true, oneRmFormula: 'brzycki',
    sessions: DEADLIFT_SESSIONS, totalSessions: 14,
    allTimeBest1Rm: Math.max(...DEADLIFT_SESSIONS.map(s => s.sessionBest1Rm ?? 0)),
    allTimeMaxWeight: 275,
  },
  'ex-ohp': {
    exerciseId: 'ex-ohp', exerciseName: 'Overhead Press',
    supports1Rm: true, oneRmFormula: 'brzycki',
    sessions: OHP_SESSIONS, totalSessions: 12,
    allTimeBest1Rm: Math.max(...OHP_SESSIONS.map(s => s.sessionBest1Rm ?? 0)),
    allTimeMaxWeight: 115,
  },
  'ex-row': {
    exerciseId: 'ex-row', exerciseName: 'Barbell Row',
    supports1Rm: true, oneRmFormula: 'brzycki',
    sessions: ROW_SESSIONS, totalSessions: 11,
    allTimeBest1Rm: Math.max(...ROW_SESSIONS.map(s => s.sessionBest1Rm ?? 0)),
    allTimeMaxWeight: 155,
  },
};

// Fallback for any exerciseId not in the map
export function getDemoExerciseHistory(exerciseId: string): ExerciseHistory {
  return DEMO_EXERCISE_HISTORIES[exerciseId] ?? {
    exerciseId,
    exerciseName: 'Exercise',
    supports1Rm: true,
    oneRmFormula: 'brzycki',
    sessions: [],
    totalSessions: 0,
    allTimeBest1Rm: null,
    allTimeMaxWeight: null,
  };
}

// ─── Progression — Volume Analytics ──────────────────────────────────────────

const today = new Date();
const weeks = Array.from({ length: 8 }, (_, i) => {
  const d = new Date(today);
  d.setDate(d.getDate() - (7 - i) * 7);
  return d.toISOString().split('T')[0];
});

const muscleGroups = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms'];
const baseVolumes: Record<string, number> = { Chest: 12000, Back: 15000, Legs: 18000, Shoulders: 8000, Arms: 6000 };

export const DEMO_VOLUME_ANALYTICS: VolumeAnalytics = {
  granularity: 'weekly',
  period: {
    startDate: weeks[0],
    endDate: weeks[weeks.length - 1],
  },
  summary: {
    totalVolume: 295000,
    totalSets: 184,
    totalReps: 2240,
    muscleGroupBreakdown: { Chest: 12, Back: 16, Legs: 20, Shoulders: 9, Arms: 7 },
  },
  data: weeks.flatMap(period =>
    muscleGroups.map(muscleGroup => ({
      period,
      muscleGroup,
      totalVolume: Math.round(baseVolumes[muscleGroup] * (0.85 + Math.random() * 0.3)),
      totalSets: Math.round(12 + Math.random() * 8),
      totalReps: Math.round(144 + Math.random() * 96),
    }))
  ),
};

// ─── Mobile — Paired Devices ──────────────────────────────────────────────────

export const DEMO_PAIRED_DEVICES: PairedDevice[] = [
  {
    id: 'device-1',
    deviceInfo: { device: 'iPhone 16 Pro', os: 'iOS 18.2', app_version: '2.4.1', device_id: 'demo-iphone' },
    pairedAt: '2026-01-10T14:22:00Z',
    createdAt: '2026-01-10T14:22:00Z',
  },
  {
    id: 'device-2',
    deviceInfo: { device: 'Apple Watch Series 10', os: 'watchOS 11.2', app_version: '2.4.1', device_id: 'demo-watch' },
    pairedAt: '2026-01-10T14:25:00Z',
    createdAt: '2026-01-10T14:25:00Z',
  },
];
