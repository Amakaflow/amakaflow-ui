/**
 * Shared test fixtures for Personal Records components.
 *
 * Part of AMA-482: Create Personal Records (PRs) Component
 */

import type { PersonalRecord, RecordType, PersonalRecordsResponse } from '../../../../types/progression';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Creates a date string N days ago from today.
 */
function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

// =============================================================================
// Individual Record Fixtures
// =============================================================================

export const MOCK_RECORD_1RM: PersonalRecord = {
  exerciseId: 'barbell-bench-press',
  exerciseName: 'Barbell Bench Press',
  recordType: '1rm',
  value: 225,
  unit: 'lbs',
  achievedAt: daysAgo(14),
  completionId: 'comp-001',
  details: { formula: 'brzycki', weightUsed: 200, repsCompleted: 5 },
};

export const MOCK_RECORD_MAX_WEIGHT: PersonalRecord = {
  exerciseId: 'barbell-squat',
  exerciseName: 'Barbell Squat',
  recordType: 'max_weight',
  value: 315,
  unit: 'lbs',
  achievedAt: daysAgo(3),
  completionId: 'comp-002',
  details: null,
};

export const MOCK_RECORD_MAX_REPS: PersonalRecord = {
  exerciseId: 'push-up',
  exerciseName: 'Push-Up',
  recordType: 'max_reps',
  value: 50,
  unit: 'reps',
  achievedAt: daysAgo(21),
  completionId: 'comp-003',
  details: null,
};

export const MOCK_RECORD_RECENT: PersonalRecord = {
  exerciseId: 'deadlift',
  exerciseName: 'Conventional Deadlift',
  recordType: '1rm',
  value: 405,
  unit: 'lbs',
  achievedAt: daysAgo(2),
  completionId: 'comp-004',
  details: { formula: 'brzycki', weightUsed: 365, repsCompleted: 3 },
};

export const MOCK_RECORD_OLD: PersonalRecord = {
  exerciseId: 'overhead-press',
  exerciseName: 'Overhead Press',
  recordType: '1rm',
  value: 135,
  unit: 'lbs',
  achievedAt: daysAgo(60),
  completionId: 'comp-005',
  details: null,
};

export const MOCK_RECORD_NULL_DATE: PersonalRecord = {
  exerciseId: 'lat-pulldown',
  exerciseName: 'Lat Pulldown',
  recordType: 'max_weight',
  value: 180,
  unit: 'lbs',
  achievedAt: null,
  completionId: null,
  details: null,
};

export const MOCK_RECORD_KG_UNIT: PersonalRecord = {
  exerciseId: 'dumbbell-curl',
  exerciseName: 'Dumbbell Curl',
  recordType: 'max_weight',
  value: 25,
  unit: 'kg',
  achievedAt: daysAgo(10),
  completionId: 'comp-kg-001',
  details: null,
};

// =============================================================================
// Record Lists
// =============================================================================

export const MOCK_PERSONAL_RECORDS: PersonalRecord[] = [
  MOCK_RECORD_RECENT, // 2 days ago - should show "New PR" badge
  MOCK_RECORD_MAX_WEIGHT, // 3 days ago - should show "New PR" badge
  MOCK_RECORD_1RM, // 14 days ago - no badge
  MOCK_RECORD_MAX_REPS, // 21 days ago - no badge
  MOCK_RECORD_OLD, // 60 days ago - no badge
];

export const MOCK_PERSONAL_RECORDS_EMPTY: PersonalRecord[] = [];

export const MOCK_PERSONAL_RECORDS_SINGLE: PersonalRecord[] = [MOCK_RECORD_1RM];

export const MOCK_PERSONAL_RECORDS_ALL_1RM: PersonalRecord[] = [
  MOCK_RECORD_RECENT,
  MOCK_RECORD_1RM,
  MOCK_RECORD_OLD,
];

export const MOCK_PERSONAL_RECORDS_WITH_NULL_DATES: PersonalRecord[] = [
  MOCK_RECORD_RECENT,
  MOCK_RECORD_NULL_DATE,
  MOCK_RECORD_1RM,
];

// =============================================================================
// API Response Fixtures
// =============================================================================

export const MOCK_PERSONAL_RECORDS_RESPONSE: PersonalRecordsResponse = {
  records: MOCK_PERSONAL_RECORDS,
  exerciseId: null,
};

export const MOCK_PERSONAL_RECORDS_RESPONSE_FILTERED: PersonalRecordsResponse = {
  records: MOCK_PERSONAL_RECORDS_ALL_1RM,
  exerciseId: null,
};

export const MOCK_PERSONAL_RECORDS_RESPONSE_EMPTY: PersonalRecordsResponse = {
  records: [],
  exerciseId: null,
};

export const MOCK_PERSONAL_RECORDS_RESPONSE_SINGLE_EXERCISE: PersonalRecordsResponse = {
  records: [MOCK_RECORD_1RM],
  exerciseId: 'barbell-bench-press',
};

// =============================================================================
// Hook Return Value Factories
// =============================================================================

export function createPersonalRecordsReturn(
  overrides: Partial<{
    records: PersonalRecord[];
    exerciseId: string | null;
    isLoading: boolean;
    error: Error | null;
  }> = {}
) {
  return {
    data: {
      records: overrides.records ?? MOCK_PERSONAL_RECORDS,
      exerciseId: overrides.exerciseId ?? null,
    },
    isLoading: overrides.isLoading ?? false,
    error: overrides.error ?? null,
    refetch: vi.fn(),
  };
}

export function createPersonalRecordsLoadingReturn() {
  return {
    data: null,
    isLoading: true,
    error: null,
    refetch: vi.fn(),
  };
}

export function createPersonalRecordsErrorReturn(message = 'Failed to fetch records') {
  return {
    data: null,
    isLoading: false,
    error: new Error(message),
    refetch: vi.fn(),
  };
}

export function createPersonalRecordsEmptyReturn() {
  return {
    data: {
      records: [],
      exerciseId: null,
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };
}

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Creates a record achieved exactly N days ago for boundary testing.
 */
export function createRecordAtBoundary(
  daysAgo: number,
  recordType: RecordType = '1rm'
): PersonalRecord {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);

  return {
    exerciseId: `test-exercise-${daysAgo}d`,
    exerciseName: `Test Exercise ${daysAgo}d`,
    recordType,
    value: 100 + daysAgo,
    unit: recordType === 'max_reps' ? 'reps' : 'lbs',
    achievedAt: date.toISOString(),
    completionId: `boundary-${daysAgo}d`,
    details: null,
  };
}

/**
 * Creates multiple records with varying dates for testing date filtering.
 */
export function createRecordsForDateTesting(): PersonalRecord[] {
  return [
    createRecordAtBoundary(1, '1rm'),      // 1 day ago - recent
    createRecordAtBoundary(6, 'max_weight'), // 6 days ago - recent (within 7 days)
    createRecordAtBoundary(7, 'max_reps'),   // 7 days ago - boundary
    createRecordAtBoundary(8, '1rm'),      // 8 days ago - not recent
    createRecordAtBoundary(30, 'max_weight'), // 30 days ago - not recent
  ];
}
