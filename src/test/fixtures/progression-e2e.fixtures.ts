/**
 * E2E test fixtures for Progression API.
 *
 * These fixtures define the expected test data that should be seeded
 * before running E2E tests. The seeded data must match these values.
 *
 * See: /supabase/seed/progression-e2e-seed.sql
 */

import {
  EXERCISE_IDS,
  UNKNOWN_EXERCISE_ID,
  INVALID_EXERCISE_ID,
  TEST_USER_ID,
  DEFAULT_WEIGHT_UNIT,
} from './progression-constants';

// Re-export constants for convenience
export {
  EXERCISE_IDS,
  UNKNOWN_EXERCISE_ID,
  INVALID_EXERCISE_ID,
  TEST_USER_ID,
};

// =============================================================================
// Test User
// =============================================================================

export const E2E_TEST_USER = {
  /**
   * Clerk user ID for E2E test user.
   * This user must exist in Clerk test environment.
   */
  clerkUserId: 'user_e2e_test_progression',

  /**
   * Email for E2E test user.
   */
  email: 'e2e-progression@test.amakaflow.com',

  /**
   * Profile ID in Supabase profiles table.
   * Used for direct database operations.
   */
  profileId: TEST_USER_ID,

  /**
   * Display name for the test user.
   */
  displayName: 'E2E Progression Test User',
};

// =============================================================================
// Seeded Exercises
// =============================================================================

/**
 * Exercises that are seeded with workout history.
 * These exercises have completed sessions with weight data.
 */
export const SEEDED_EXERCISES = {
  benchPress: {
    exerciseId: EXERCISE_IDS.BENCH_PRESS,
    exerciseName: 'Barbell Bench Press',
    muscleGroup: 'chest',
    /**
     * Number of sessions seeded for this exercise.
     * Used to validate getExercisesWithHistory().
     */
    expectedSessionCount: 2,
    /**
     * Whether this exercise supports 1RM calculation.
     */
    supports1Rm: true,
  },

  squat: {
    exerciseId: EXERCISE_IDS.SQUAT,
    exerciseName: 'Barbell Squat',
    muscleGroup: 'legs',
    expectedSessionCount: 1,
    supports1Rm: true,
  },

  pullUp: {
    exerciseId: EXERCISE_IDS.PULL_UP,
    exerciseName: 'Pull Up',
    muscleGroup: 'back',
    expectedSessionCount: 1,
    /**
     * Bodyweight exercise - no 1RM calculation.
     */
    supports1Rm: false,
  },
} as const;

// =============================================================================
// Seeded Sessions
// =============================================================================

/**
 * Session data that is seeded for testing.
 * Each session has sets with specific weights and reps.
 */
export const SEEDED_SESSIONS = {
  benchSession1: {
    completionId: 'comp-e2e-001',
    workoutDate: '2026-01-15',
    workoutName: 'Push Day',
    exerciseId: EXERCISE_IDS.BENCH_PRESS,
    sets: [
      { setNumber: 1, weight: 135, reps: 10, weightUnit: DEFAULT_WEIGHT_UNIT },
      { setNumber: 2, weight: 155, reps: 8, weightUnit: DEFAULT_WEIGHT_UNIT },
      { setNumber: 3, weight: 175, reps: 6, weightUnit: DEFAULT_WEIGHT_UNIT },
    ],
    /**
     * Expected best 1RM from this session.
     * 175 lbs x 6 reps = ~203 lbs (Brzycki formula)
     */
    expectedBest1Rm: 203,
    expectedMaxWeight: 175,
  },

  benchSession2: {
    completionId: 'comp-e2e-002',
    workoutDate: '2026-01-12',
    workoutName: 'Upper Body',
    exerciseId: EXERCISE_IDS.BENCH_PRESS,
    sets: [
      { setNumber: 1, weight: 135, reps: 8, weightUnit: DEFAULT_WEIGHT_UNIT },
    ],
    expectedBest1Rm: 166,
    expectedMaxWeight: 135,
  },

  squatSession1: {
    completionId: 'comp-e2e-003',
    workoutDate: '2026-01-12',
    workoutName: 'Upper Body',
    exerciseId: EXERCISE_IDS.SQUAT,
    sets: [
      { setNumber: 1, weight: 225, reps: 5, weightUnit: DEFAULT_WEIGHT_UNIT },
    ],
    /**
     * 225 lbs x 5 reps = ~253 lbs (Brzycki)
     */
    expectedBest1Rm: 253,
    expectedMaxWeight: 225,
  },
} as const;

// =============================================================================
// Expected Personal Records
// =============================================================================

/**
 * Expected personal records based on seeded data.
 * Used to validate getPersonalRecords() endpoint.
 */
export const EXPECTED_RECORDS = {
  benchPress1RM: {
    exerciseId: 'barbell-bench-press',
    exerciseName: 'Barbell Bench Press',
    recordType: '1rm' as const,
    /**
     * Best 1RM across all sessions.
     * From benchSession1: 175 x 6 = ~203 lbs
     */
    expectedValue: 203,
    /**
     * Tolerance for floating point comparison.
     */
    tolerance: 5,
    unit: 'lbs',
  },

  benchPressMaxWeight: {
    exerciseId: 'barbell-bench-press',
    exerciseName: 'Barbell Bench Press',
    recordType: 'max_weight' as const,
    expectedValue: 175,
    tolerance: 0,
    unit: 'lbs',
  },

  squat1RM: {
    exerciseId: 'barbell-squat',
    exerciseName: 'Barbell Squat',
    recordType: '1rm' as const,
    expectedValue: 253,
    tolerance: 5,
    unit: 'lbs',
  },
};

// =============================================================================
// Expected Last Weight
// =============================================================================

/**
 * Expected last weight values based on seeded data.
 * Used to validate getLastWeight() endpoint.
 */
export const EXPECTED_LAST_WEIGHT = {
  benchPress: {
    exerciseId: 'barbell-bench-press',
    exerciseName: 'Barbell Bench Press',
    /**
     * Last weight used (most recent session, last set).
     * From benchSession1: 175 lbs
     */
    weight: 175,
    weightUnit: 'lbs',
    repsCompleted: 6,
    workoutDate: '2026-01-15',
    completionId: 'comp-e2e-001',
  },
};

// =============================================================================
// Expected Volume Analytics
// =============================================================================

/**
 * Expected volume data based on seeded data.
 * Used to validate getVolumeAnalytics() endpoint.
 */
export const EXPECTED_VOLUME = {
  /**
   * Total volume for bench press in seeded data.
   * Session 1: (135*10) + (155*8) + (175*6) = 1350 + 1240 + 1050 = 3640
   * Session 2: (135*8) = 1080
   * Total: 4720 lbs
   */
  benchPressTotal: 4720,

  /**
   * Total volume for squat in seeded data.
   * Session 1: (225*5) = 1125
   */
  squatTotal: 1125,

  /**
   * Muscle group breakdown.
   */
  muscleGroupBreakdown: {
    chest: 4720,
    legs: 1125,
  },
};

// =============================================================================
// Test Date Ranges
// =============================================================================

/**
 * Fixed date ranges for testing.
 * Using fixed dates prevents flaky tests from relative date calculations.
 */
export const TEST_DATES = {
  /**
   * Date range that includes all seeded sessions.
   */
  allSessions: {
    startDate: '2026-01-01',
    endDate: '2026-01-31',
  },

  /**
   * Date range that includes only the first bench session.
   */
  session1Only: {
    startDate: '2026-01-14',
    endDate: '2026-01-16',
  },

  /**
   * Date range with no seeded data.
   */
  noData: {
    startDate: '2025-01-01',
    endDate: '2025-01-31',
  },
};

// =============================================================================
// Error Cases
// =============================================================================

/**
 * Test data for error scenarios.
 */
export const ERROR_CASES = {
  /**
   * Exercise ID that does not exist in seeded data.
   */
  unknownExerciseId: 'nonexistent-exercise-xyz',

  /**
   * Invalid exercise ID format (uppercase not allowed).
   */
  invalidExerciseIdFormat: 'INVALID_UPPERCASE',

  /**
   * Exercise with no weight history (bodyweight only).
   */
  noWeightHistory: 'pull-up',
};

// =============================================================================
// Personal Records Component Test Data (AMA-482)
// =============================================================================

/**
 * Record type labels used by PRCard and PRSummary components.
 * Maps API record types to display labels.
 */
export const RECORD_TYPE_LABELS = {
  '1rm': 'Est. 1RM',
  'max_weight': 'Max Weight',
  'max_reps': 'Max Reps',
} as const;

/**
 * Compact record type labels used by PRSummary.
 */
export const COMPACT_RECORD_TYPE_LABELS = {
  '1rm': '1RM',
  'max_weight': 'Max',
  'max_reps': 'Reps',
} as const;

/**
 * Dates for testing "New PR" badge logic.
 * isRecentPR() returns true if achievedAt is within 7 days.
 */
export const RECENT_PR_TEST_DATES = {
  /** Date that should show "New!" badge (within 7 days) */
  recentDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0],

  /** Date that should NOT show "New!" badge (older than 7 days) */
  oldDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0],

  /** Date at exactly 7 day boundary */
  boundaryDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0],
} as const;

/**
 * Expected personal records with all record types for comprehensive testing.
 * Extends EXPECTED_RECORDS with additional metadata for E2E tests.
 */
export const EXPECTED_PERSONAL_RECORDS = {
  benchPress: {
    exerciseId: SEEDED_EXERCISES.benchPress.exerciseId,
    exerciseName: SEEDED_EXERCISES.benchPress.exerciseName,
    records: {
      '1rm': {
        expectedValue: 203, // 175 x 6 = ~203 (Brzycki)
        tolerance: 5,
        unit: 'lbs',
      },
      max_weight: {
        expectedValue: 175,
        tolerance: 0,
        unit: 'lbs',
      },
      max_reps: {
        expectedValue: 10, // From 135 x 10 set
        tolerance: 0,
        unit: 'reps',
      },
    },
  },
  squat: {
    exerciseId: SEEDED_EXERCISES.squat.exerciseId,
    exerciseName: SEEDED_EXERCISES.squat.exerciseName,
    records: {
      '1rm': {
        expectedValue: 253, // 225 x 5 = ~253 (Brzycki)
        tolerance: 5,
        unit: 'lbs',
      },
      max_weight: {
        expectedValue: 225,
        tolerance: 0,
        unit: 'lbs',
      },
    },
  },
} as const;

// =============================================================================
// Type Exports
// =============================================================================

export type SeededExercise = typeof SEEDED_EXERCISES[keyof typeof SEEDED_EXERCISES];
export type SeededSession = typeof SEEDED_SESSIONS[keyof typeof SEEDED_SESSIONS];
export type ExpectedRecord = typeof EXPECTED_RECORDS[keyof typeof EXPECTED_RECORDS];
export type RecordTypeLabel = keyof typeof RECORD_TYPE_LABELS;
