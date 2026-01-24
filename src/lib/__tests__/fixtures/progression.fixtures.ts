/**
 * Test fixtures for Progression API tests.
 *
 * Provides both raw API responses (snake_case) and transformed
 * TypeScript objects (camelCase) for comparison testing.
 */

// =============================================================================
// Raw API Responses (snake_case - as returned from mapper-api)
// =============================================================================

export const API_RESPONSES = {
  exerciseHistory: {
    exercise_id: 'barbell-bench-press',
    exercise_name: 'Barbell Bench Press',
    supports_1rm: true,
    one_rm_formula: 'brzycki',
    sessions: [
      {
        completion_id: 'comp-001',
        workout_date: '2025-01-15',
        workout_name: 'Push Day',
        exercise_name: 'Barbell Bench Press',
        sets: [
          {
            set_number: 1,
            weight: 135,
            weight_unit: 'lbs',
            reps_completed: 10,
            reps_planned: 10,
            status: 'completed',
            estimated_1rm: 180,
            is_pr: false,
          },
          {
            set_number: 2,
            weight: 155,
            weight_unit: 'lbs',
            reps_completed: 8,
            reps_planned: 8,
            status: 'completed',
            estimated_1rm: 191.2,
            is_pr: true,
          },
        ],
        session_best_1rm: 191.2,
        session_max_weight: 155,
        session_total_volume: 2590,
      },
      {
        completion_id: 'comp-002',
        workout_date: '2025-01-12',
        workout_name: 'Upper Body',
        exercise_name: 'Barbell Bench Press',
        sets: [
          {
            set_number: 1,
            weight: 135,
            weight_unit: 'lbs',
            reps_completed: 8,
            reps_planned: 10,
            status: 'completed',
            estimated_1rm: 166.5,
            is_pr: false,
          },
        ],
        session_best_1rm: 166.5,
        session_max_weight: 135,
        session_total_volume: 1080,
      },
    ],
    total_sessions: 2,
    all_time_best_1rm: 191.2,
    all_time_max_weight: 155,
  },

  exerciseHistoryEmpty: {
    exercise_id: 'barbell-squat',
    exercise_name: 'Barbell Squat',
    supports_1rm: true,
    one_rm_formula: 'brzycki',
    sessions: [],
    total_sessions: 0,
    all_time_best_1rm: null,
    all_time_max_weight: null,
  },

  exercisesWithHistory: {
    exercises: [
      { exercise_id: 'barbell-bench-press', exercise_name: 'Barbell Bench Press', session_count: 15 },
      { exercise_id: 'barbell-squat', exercise_name: 'Barbell Squat', session_count: 12 },
      { exercise_id: 'deadlift', exercise_name: 'Conventional Deadlift', session_count: 8 },
    ],
    total: 3,
  },

  exercisesWithHistoryEmpty: {
    exercises: [],
    total: 0,
  },

  personalRecords: {
    records: [
      {
        exercise_id: 'barbell-bench-press',
        exercise_name: 'Barbell Bench Press',
        record_type: '1rm',
        value: 225,
        unit: 'lbs',
        achieved_at: '2025-01-10',
        completion_id: 'comp-abc',
        details: { weight: 205, reps: 5 },
      },
      {
        exercise_id: 'barbell-bench-press',
        exercise_name: 'Barbell Bench Press',
        record_type: 'max_weight',
        value: 215,
        unit: 'lbs',
        achieved_at: '2025-01-08',
        completion_id: 'comp-def',
        details: null,
      },
      {
        exercise_id: 'barbell-squat',
        exercise_name: 'Barbell Squat',
        record_type: '1rm',
        value: 315,
        unit: 'lbs',
        achieved_at: '2025-01-05',
        completion_id: 'comp-ghi',
        details: { weight: 275, reps: 6 },
      },
    ],
    exercise_id: null,
  },

  personalRecordsFiltered: {
    records: [
      {
        exercise_id: 'barbell-bench-press',
        exercise_name: 'Barbell Bench Press',
        record_type: '1rm',
        value: 225,
        unit: 'lbs',
        achieved_at: '2025-01-10',
        completion_id: 'comp-abc',
        details: { weight: 205, reps: 5 },
      },
    ],
    exercise_id: 'barbell-bench-press',
  },

  lastWeight: {
    exercise_id: 'barbell-bench-press',
    exercise_name: 'Barbell Bench Press',
    weight: 185,
    weight_unit: 'lbs',
    reps_completed: 8,
    workout_date: '2025-01-15',
    completion_id: 'comp-001',
  },

  volumeAnalytics: {
    data: [
      { period: '2025-01-08', muscle_group: 'chest', total_volume: 12500, total_sets: 12, total_reps: 96 },
      { period: '2025-01-08', muscle_group: 'triceps', total_volume: 4500, total_sets: 9, total_reps: 81 },
      { period: '2025-01-15', muscle_group: 'chest', total_volume: 15000, total_sets: 15, total_reps: 120 },
      { period: '2025-01-15', muscle_group: 'triceps', total_volume: 5200, total_sets: 10, total_reps: 90 },
    ],
    summary: {
      total_volume: 37200,
      total_sets: 46,
      total_reps: 387,
      muscle_group_breakdown: { chest: 27500, triceps: 9700 },
    },
    period: { start_date: '2025-01-01', end_date: '2025-01-15' },
    granularity: 'weekly',
  },

  volumeAnalyticsEmpty: {
    data: [],
    summary: {
      total_volume: 0,
      total_sets: 0,
      total_reps: 0,
      muscle_group_breakdown: {},
    },
    period: { start_date: '2025-01-01', end_date: '2025-01-15' },
    granularity: 'daily',
  },
};

// =============================================================================
// Expected Transformed Outputs (camelCase - TypeScript types)
// =============================================================================

export const EXPECTED_TRANSFORMS = {
  exerciseHistory: {
    exerciseId: 'barbell-bench-press',
    exerciseName: 'Barbell Bench Press',
    supports1Rm: true,
    oneRmFormula: 'brzycki',
    sessions: [
      {
        completionId: 'comp-001',
        workoutDate: '2025-01-15',
        workoutName: 'Push Day',
        exerciseName: 'Barbell Bench Press',
        sets: [
          {
            setNumber: 1,
            weight: 135,
            weightUnit: 'lbs',
            repsCompleted: 10,
            repsPlanned: 10,
            status: 'completed',
            estimated1Rm: 180,
            isPr: false,
          },
          {
            setNumber: 2,
            weight: 155,
            weightUnit: 'lbs',
            repsCompleted: 8,
            repsPlanned: 8,
            status: 'completed',
            estimated1Rm: 191.2,
            isPr: true,
          },
        ],
        sessionBest1Rm: 191.2,
        sessionMaxWeight: 155,
        sessionTotalVolume: 2590,
      },
      {
        completionId: 'comp-002',
        workoutDate: '2025-01-12',
        workoutName: 'Upper Body',
        exerciseName: 'Barbell Bench Press',
        sets: [
          {
            setNumber: 1,
            weight: 135,
            weightUnit: 'lbs',
            repsCompleted: 8,
            repsPlanned: 10,
            status: 'completed',
            estimated1Rm: 166.5,
            isPr: false,
          },
        ],
        sessionBest1Rm: 166.5,
        sessionMaxWeight: 135,
        sessionTotalVolume: 1080,
      },
    ],
    totalSessions: 2,
    allTimeBest1Rm: 191.2,
    allTimeMaxWeight: 155,
  },

  exercisesWithHistory: {
    exercises: [
      { exerciseId: 'barbell-bench-press', exerciseName: 'Barbell Bench Press', sessionCount: 15 },
      { exerciseId: 'barbell-squat', exerciseName: 'Barbell Squat', sessionCount: 12 },
      { exerciseId: 'deadlift', exerciseName: 'Conventional Deadlift', sessionCount: 8 },
    ],
    total: 3,
  },

  personalRecords: {
    records: [
      {
        exerciseId: 'barbell-bench-press',
        exerciseName: 'Barbell Bench Press',
        recordType: '1rm',
        value: 225,
        unit: 'lbs',
        achievedAt: '2025-01-10',
        completionId: 'comp-abc',
        details: { weight: 205, reps: 5 },
      },
      {
        exerciseId: 'barbell-bench-press',
        exerciseName: 'Barbell Bench Press',
        recordType: 'max_weight',
        value: 215,
        unit: 'lbs',
        achievedAt: '2025-01-08',
        completionId: 'comp-def',
        details: null,
      },
      {
        exerciseId: 'barbell-squat',
        exerciseName: 'Barbell Squat',
        recordType: '1rm',
        value: 315,
        unit: 'lbs',
        achievedAt: '2025-01-05',
        completionId: 'comp-ghi',
        details: { weight: 275, reps: 6 },
      },
    ],
    exerciseId: null,
  },

  lastWeight: {
    exerciseId: 'barbell-bench-press',
    exerciseName: 'Barbell Bench Press',
    weight: 185,
    weightUnit: 'lbs',
    repsCompleted: 8,
    workoutDate: '2025-01-15',
    completionId: 'comp-001',
  },

  volumeAnalytics: {
    data: [
      { period: '2025-01-08', muscleGroup: 'chest', totalVolume: 12500, totalSets: 12, totalReps: 96 },
      { period: '2025-01-08', muscleGroup: 'triceps', totalVolume: 4500, totalSets: 9, totalReps: 81 },
      { period: '2025-01-15', muscleGroup: 'chest', totalVolume: 15000, totalSets: 15, totalReps: 120 },
      { period: '2025-01-15', muscleGroup: 'triceps', totalVolume: 5200, totalSets: 10, totalReps: 90 },
    ],
    summary: {
      totalVolume: 37200,
      totalSets: 46,
      totalReps: 387,
      muscleGroupBreakdown: { chest: 27500, triceps: 9700 },
    },
    period: {
      startDate: '2025-01-01',
      endDate: '2025-01-15',
    },
    granularity: 'weekly',
  },
};

// =============================================================================
// Partial/Edge Case Fixtures
// =============================================================================

export const EDGE_CASES = {
  // Set with null values
  setWithNulls: {
    set_number: 1,
    weight: null,
    weight_unit: 'lbs',
    reps_completed: null,
    reps_planned: 10,
    status: 'skipped',
    estimated_1rm: null,
    is_pr: false,
  },

  // Session with empty sets
  sessionWithEmptySets: {
    completion_id: 'comp-empty',
    workout_date: '2025-01-01',
    workout_name: null,
    exercise_name: 'Unknown Exercise',
    sets: [],
    session_best_1rm: null,
    session_max_weight: null,
    session_total_volume: null,
  },

  // Minimal valid set
  minimalSet: {
    set_number: 1,
  },

  // Minimal valid session
  minimalSession: {
    completion_id: 'comp-min',
  },
};

// =============================================================================
// Error Response Fixtures
// =============================================================================

export const ERROR_RESPONSES = {
  unauthorized: { detail: 'Not authenticated' },
  forbidden: { detail: 'Access denied' },
  notFound: { detail: 'Exercise not found' },
  noHistory: { detail: "No weight history found for exercise 'unknown-exercise'" },
  badRequest: { detail: 'Invalid exercise_id format. Use lowercase letters, numbers, and hyphens only.' },
  serverError: { detail: 'Internal server error' },
  validationError: {
    detail: [
      { loc: ['query', 'limit'], msg: 'ensure this value is greater than or equal to 1', type: 'value_error.number.not_ge' },
    ],
  },
};
