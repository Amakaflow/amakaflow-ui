/**
 * Shared test fixtures for Exercise History components.
 *
 * Part of AMA-481: Build Exercise History Page with 1RM Trends
 */

import type {
  ExerciseWithHistory,
  Session,
  SetDetail,
  ExerciseHistory,
} from '../../../../types/progression';

// =============================================================================
// Exercise List Fixtures
// =============================================================================

export const MOCK_EXERCISES: ExerciseWithHistory[] = [
  { exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', sessionCount: 15 },
  { exerciseId: 'barbell-squat', exerciseName: 'Barbell Squat', sessionCount: 12 },
  { exerciseId: 'deadlift', exerciseName: 'Conventional Deadlift', sessionCount: 8 },
  { exerciseId: 'overhead-press', exerciseName: 'Overhead Press', sessionCount: 1 },
];

export const MOCK_EXERCISES_EMPTY: ExerciseWithHistory[] = [];

// =============================================================================
// Set Fixtures
// =============================================================================

export const MOCK_SET_BASIC: SetDetail = {
  setNumber: 1,
  weight: 135,
  weightUnit: 'lbs',
  repsCompleted: 10,
  repsPlanned: 10,
  status: 'completed',
  estimated1Rm: 180,
  isPr: false,
};

export const MOCK_SET_PR: SetDetail = {
  setNumber: 2,
  weight: 155,
  weightUnit: 'lbs',
  repsCompleted: 8,
  repsPlanned: 8,
  status: 'completed',
  estimated1Rm: 191.2,
  isPr: true,
};

export const MOCK_SET_NULL_VALUES: SetDetail = {
  setNumber: 3,
  weight: null,
  weightUnit: 'lbs',
  repsCompleted: null,
  repsPlanned: 10,
  status: 'skipped',
  estimated1Rm: null,
  isPr: false,
};

export const MOCK_SET_HEAVY: SetDetail = {
  setNumber: 1,
  weight: 225,
  weightUnit: 'lbs',
  repsCompleted: 3,
  repsPlanned: 3,
  status: 'completed',
  estimated1Rm: 239,
  isPr: false,
};

// =============================================================================
// Session Fixtures
// =============================================================================

export const MOCK_SESSION_WITH_PR: Session = {
  completionId: 'comp-001',
  workoutDate: '2025-01-15',
  workoutName: 'Push Day',
  exerciseName: 'Barbell Bench Press',
  sets: [MOCK_SET_BASIC, MOCK_SET_PR],
  sessionBest1Rm: 191.2,
  sessionMaxWeight: 155,
  sessionTotalVolume: 2590,
};

export const MOCK_SESSION_NO_PR: Session = {
  completionId: 'comp-002',
  workoutDate: '2025-01-12',
  workoutName: 'Upper Body',
  exerciseName: 'Barbell Bench Press',
  sets: [MOCK_SET_BASIC],
  sessionBest1Rm: 180,
  sessionMaxWeight: 135,
  sessionTotalVolume: 1350,
};

export const MOCK_SESSION_NULL_WORKOUT_NAME: Session = {
  completionId: 'comp-003',
  workoutDate: '2025-01-08',
  workoutName: null,
  exerciseName: 'Barbell Bench Press',
  sets: [MOCK_SET_BASIC],
  sessionBest1Rm: 175,
  sessionMaxWeight: 130,
  sessionTotalVolume: 1300,
};

export const MOCK_SESSION_NULL_1RM: Session = {
  completionId: 'comp-004',
  workoutDate: '2025-01-05',
  workoutName: 'Recovery Session',
  exerciseName: 'Barbell Bench Press',
  sets: [MOCK_SET_NULL_VALUES],
  sessionBest1Rm: null,
  sessionMaxWeight: null,
  sessionTotalVolume: null,
};

export const MOCK_SESSION_HIGH_VOLUME: Session = {
  completionId: 'comp-005',
  workoutDate: '2025-01-20',
  workoutName: 'Volume Day',
  exerciseName: 'Barbell Bench Press',
  sets: [MOCK_SET_BASIC, MOCK_SET_BASIC, MOCK_SET_BASIC, MOCK_SET_BASIC, MOCK_SET_BASIC],
  sessionBest1Rm: 180,
  sessionMaxWeight: 135,
  sessionTotalVolume: 6750,
};

// =============================================================================
// Full History Fixtures
// =============================================================================

export const MOCK_EXERCISE_HISTORY: ExerciseHistory = {
  exerciseId: 'barbell-bench-press',
  exerciseName: 'Barbell Bench Press',
  supports1Rm: true,
  oneRmFormula: 'brzycki',
  sessions: [MOCK_SESSION_WITH_PR, MOCK_SESSION_NO_PR, MOCK_SESSION_NULL_WORKOUT_NAME],
  totalSessions: 3,
  allTimeBest1Rm: 191.2,
  allTimeMaxWeight: 155,
};

export const MOCK_EXERCISE_HISTORY_EMPTY: ExerciseHistory = {
  exerciseId: 'barbell-squat',
  exerciseName: 'Barbell Squat',
  supports1Rm: true,
  oneRmFormula: 'brzycki',
  sessions: [],
  totalSessions: 0,
  allTimeBest1Rm: null,
  allTimeMaxWeight: null,
};

export const MOCK_EXERCISE_HISTORY_NO_1RM_SUPPORT: ExerciseHistory = {
  exerciseId: 'plank',
  exerciseName: 'Plank',
  supports1Rm: false,
  oneRmFormula: 'none',
  sessions: [],
  totalSessions: 5,
  allTimeBest1Rm: null,
  allTimeMaxWeight: null,
};

export const MOCK_EXERCISE_HISTORY_ALL_NULL_1RM: ExerciseHistory = {
  exerciseId: 'bodyweight-exercise',
  exerciseName: 'Bodyweight Exercise',
  supports1Rm: false,
  oneRmFormula: 'none',
  sessions: [MOCK_SESSION_NULL_1RM],
  totalSessions: 1,
  allTimeBest1Rm: null,
  allTimeMaxWeight: null,
};

// =============================================================================
// Date Range Testing Fixtures
// =============================================================================

/**
 * Creates sessions at specific intervals for testing date range filtering.
 * Returns sessions from most recent to oldest (API order).
 */
export function createSessionsForDateRangeTests(): Session[] {
  const now = new Date();

  const createSession = (daysAgo: number, id: string): Session => {
    const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    return {
      completionId: id,
      workoutDate: date.toISOString().split('T')[0],
      workoutName: `Workout ${id}`,
      exerciseName: 'Test Exercise',
      sets: [MOCK_SET_BASIC],
      sessionBest1Rm: 180 + daysAgo, // Vary 1RM for easy identification
      sessionMaxWeight: 135,
      sessionTotalVolume: 1350,
    };
  };

  return [
    createSession(5, 'recent-5d'),      // Within 30d
    createSession(25, 'recent-25d'),    // Within 30d
    createSession(35, 'mid-35d'),       // Within 90d, outside 30d
    createSession(80, 'mid-80d'),       // Within 90d, outside 30d
    createSession(100, 'old-100d'),     // Within 1y, outside 90d
    createSession(200, 'old-200d'),     // Within 1y, outside 90d
    createSession(400, 'ancient-400d'), // Outside 1y
  ];
}

/**
 * Creates a session exactly at the boundary of a date range.
 * Useful for testing edge cases.
 */
export function createSessionAtBoundary(daysAgo: number): Session {
  const now = new Date();
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

  return {
    completionId: `boundary-${daysAgo}d`,
    workoutDate: date.toISOString().split('T')[0],
    workoutName: `Boundary Test ${daysAgo}d`,
    exerciseName: 'Test Exercise',
    sets: [MOCK_SET_BASIC],
    sessionBest1Rm: 180,
    sessionMaxWeight: 135,
    sessionTotalVolume: 1350,
  };
}

// =============================================================================
// Hook Return Value Factories
// =============================================================================

export function createExercisesWithHistoryReturn(
  overrides: Partial<{
    exercises: ExerciseWithHistory[];
    isLoading: boolean;
    error: Error | null;
  }> = {}
) {
  return {
    data: {
      exercises: overrides.exercises ?? MOCK_EXERCISES,
      total: (overrides.exercises ?? MOCK_EXERCISES).length,
    },
    isLoading: overrides.isLoading ?? false,
    error: overrides.error ?? null,
    refetch: vi.fn(),
  };
}

export function createExerciseHistoryReturn(
  overrides: Partial<{
    data: ExerciseHistory | null;
    isLoading: boolean;
    error: Error | null;
    hasMore: boolean;
  }> = {}
) {
  return {
    data: overrides.data ?? MOCK_EXERCISE_HISTORY,
    isLoading: overrides.isLoading ?? false,
    error: overrides.error ?? null,
    refetch: vi.fn(),
    fetchMore: vi.fn(),
    hasMore: overrides.hasMore ?? false,
  };
}
