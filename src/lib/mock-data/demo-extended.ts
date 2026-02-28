/**
 * Extended demo mode mock data for APIs not yet covered by demo mode.
 * Used by workout-api, training-program-api, progression-api, and mobile-api
 * when VITE_DEMO_MODE=true.
 */

import type { WorkoutProgram, UserTag } from '../workout-api';
import type { TrainingProgram } from '../../types/training-program';
import type {
  ExercisesWithHistoryResponse,
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
