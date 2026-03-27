/**
 * Bulk Import API Client
 *
 * API client for the bulk import workflow endpoints.
 * Connects to workout-ingestor-api /import/* endpoints.
 */

import { authenticatedFetch } from './authenticated-fetch';
import { API_URLS } from './config';
import { isDemoMode } from './demo-mode';
import { getImportScenario } from './demo-scenario';

// ============================================================================
// Demo Mode Mock Data
// ============================================================================

const DEMO_JOB_ID = 'demo-import-job-001';

const DEMO_DETECT_RESPONSE: BulkDetectResponse = {
  success: true,
  job_id: DEMO_JOB_ID,
  total: 3,
  success_count: 3,
  error_count: 0,
  metadata: {
    programName: 'Push Pull Legs Program',
    detectedFormat: 'excel_multi_sheet',
    sheetNames: ['Push Day', 'Pull Day', 'Leg Day'],
  },
  items: [
    {
      id: 'demo-item-1',
      sourceIndex: 0,
      sourceType: 'file',
      sourceRef: 'program.xlsx — Sheet: Push Day',
      rawData: {
        title: 'Push Day',
        blocks: [
          {
            id: 'pd-block-1', label: 'Horizontal Push', structure: null,
            exercises: [
              { id: 'pd-ex-1', name: 'Bench Press', sets: 4, reps: 8, reps_range: null, duration_sec: null, rest_sec: 90, rest_type: 'timed', distance_m: null, distance_range: null },
              { id: 'pd-ex-2', name: 'Incline DB Press', sets: 3, reps: 10, reps_range: null, duration_sec: null, rest_sec: 60, rest_type: 'timed', distance_m: null, distance_range: null },
            ],
          },
          {
            id: 'pd-block-2', label: 'Vertical Push', structure: null,
            exercises: [
              { id: 'pd-ex-3', name: 'Overhead Press', sets: 3, reps: 8, reps_range: null, duration_sec: null, rest_sec: 90, rest_type: 'timed', distance_m: null, distance_range: null },
              { id: 'pd-ex-4', name: 'Lateral Raise', sets: 3, reps: 15, reps_range: null, duration_sec: null, rest_sec: 60, rest_type: 'timed', distance_m: null, distance_range: null },
              { id: 'pd-ex-5', name: 'Tricep Pushdown', sets: 3, reps: 12, reps_range: null, duration_sec: null, rest_sec: 60, rest_type: 'timed', distance_m: null, distance_range: null },
              { id: 'pd-ex-6', name: 'Cable Fly', sets: 3, reps: 15, reps_range: null, duration_sec: null, rest_sec: 60, rest_type: 'timed', distance_m: null, distance_range: null },
            ],
          },
        ],
      },
      parsedTitle: 'Push Day',
      parsedExerciseCount: 6,
      parsedBlockCount: 2,
      confidence: 97,
    },
    {
      id: 'demo-item-2',
      sourceIndex: 1,
      sourceType: 'file',
      sourceRef: 'program.xlsx — Sheet: Pull Day',
      rawData: {
        title: 'Pull Day',
        blocks: [
          {
            id: 'pull-block-1', label: 'Vertical Pull', structure: null,
            exercises: [
              { id: 'pull-ex-1', name: 'Pull-ups', sets: 4, reps: 8, reps_range: null, duration_sec: null, rest_sec: 90, rest_type: 'timed', distance_m: null, distance_range: null },
              { id: 'pull-ex-2', name: 'Lat Pulldown', sets: 3, reps: 10, reps_range: null, duration_sec: null, rest_sec: 60, rest_type: 'timed', distance_m: null, distance_range: null },
            ],
          },
          {
            id: 'pull-block-2', label: 'Horizontal Pull', structure: null,
            exercises: [
              { id: 'pull-ex-3', name: 'Barbell Row', sets: 4, reps: 8, reps_range: null, duration_sec: null, rest_sec: 90, rest_type: 'timed', distance_m: null, distance_range: null },
              { id: 'pull-ex-4', name: 'Face Pull', sets: 3, reps: 15, reps_range: null, duration_sec: null, rest_sec: 60, rest_type: 'timed', distance_m: null, distance_range: null },
              { id: 'pull-ex-5', name: 'Bicep Curl', sets: 3, reps: 12, reps_range: null, duration_sec: null, rest_sec: 60, rest_type: 'timed', distance_m: null, distance_range: null },
            ],
          },
        ],
      },
      parsedTitle: 'Pull Day',
      parsedExerciseCount: 5,
      parsedBlockCount: 2,
      confidence: 95,
    },
    {
      id: 'demo-item-3',
      sourceIndex: 2,
      sourceType: 'file',
      sourceRef: 'program.xlsx — Sheet: Leg Day',
      rawData: {
        title: 'Leg Day',
        blocks: [
          {
            id: 'leg-block-1', label: 'Quads', structure: null,
            exercises: [
              { id: 'leg-ex-1', name: 'Back Squat', sets: 4, reps: 5, reps_range: null, duration_sec: null, rest_sec: 120, rest_type: 'timed', distance_m: null, distance_range: null },
              { id: 'leg-ex-2', name: 'Leg Press', sets: 3, reps: 12, reps_range: null, duration_sec: null, rest_sec: 90, rest_type: 'timed', distance_m: null, distance_range: null },
            ],
          },
          {
            id: 'leg-block-2', label: 'Posterior Chain', structure: null,
            exercises: [
              { id: 'leg-ex-3', name: 'Romanian Deadlift', sets: 3, reps: 10, reps_range: null, duration_sec: null, rest_sec: 90, rest_type: 'timed', distance_m: null, distance_range: null },
              { id: 'leg-ex-4', name: 'Leg Curl', sets: 3, reps: 12, reps_range: null, duration_sec: null, rest_sec: 60, rest_type: 'timed', distance_m: null, distance_range: null },
              { id: 'leg-ex-5', name: 'Calf Raise', sets: 4, reps: 15, reps_range: null, duration_sec: null, rest_sec: 45, rest_type: 'timed', distance_m: null, distance_range: null },
            ],
          },
        ],
      },
      parsedTitle: 'Leg Day',
      parsedExerciseCount: 5,
      parsedBlockCount: 2,
      confidence: 96,
    },
  ],
};

const DEMO_MAP_RESPONSE: BulkMapResponse = {
  success: true,
  job_id: DEMO_JOB_ID,
  mapped_count: 3,
  workouts: [],
};

const DEMO_MATCH_RESPONSE: BulkMatchResponse = {
  success: true,
  job_id: DEMO_JOB_ID,
  total_exercises: 5,
  matched: 4,
  needs_review: 1,
  unmapped: 0,
  exercises: [
    { id: 'ex-1', originalName: 'Bench Press', matchedGarminName: 'Bench Press', confidence: 99, suggestions: [], status: 'matched', sourceWorkoutIds: ['demo-item-1'], occurrenceCount: 1 },
    { id: 'ex-2', originalName: 'Overhead Press', matchedGarminName: 'Shoulder Press', confidence: 91, suggestions: [{ name: 'Military Press', confidence: 85 }], status: 'matched', sourceWorkoutIds: ['demo-item-1'], occurrenceCount: 1 },
    { id: 'ex-3', originalName: 'Pull-ups', matchedGarminName: 'Pull Up', confidence: 98, suggestions: [], status: 'matched', sourceWorkoutIds: ['demo-item-2'], occurrenceCount: 1 },
    { id: 'ex-4', originalName: 'Barbell Row', matchedGarminName: 'Bent Over Row', confidence: 88, suggestions: [{ name: 'Barbell Row', confidence: 82 }], status: 'needs_review', sourceWorkoutIds: ['demo-item-2'], occurrenceCount: 2 },
    { id: 'ex-5', originalName: 'Back Squat', matchedGarminName: 'Squat', confidence: 95, suggestions: [], status: 'matched', sourceWorkoutIds: ['demo-item-3'], occurrenceCount: 1 },
  ],
};

const DEMO_PREVIEW_RESPONSE: BulkPreviewResponse = {
  success: true,
  job_id: DEMO_JOB_ID,
  workouts: [
    {
      id: 'prev-1', detectedItemId: 'demo-item-1', title: 'Push Day', exerciseCount: 6, blockCount: 2,
      estimatedDuration: 65, validationIssues: [], selected: true, isDuplicate: false,
      workout: {
        blocks: [
          { label: 'Horizontal Push', exercises: [{ name: 'Bench Press', sets: 4, reps: 8 }, { name: 'Incline DB Press', sets: 3, reps: 10 }] },
          { label: 'Vertical Push', exercises: [{ name: 'Overhead Press', sets: 3, reps: 8 }, { name: 'Lateral Raise', sets: 3, reps: 15 }] },
        ],
      },
    },
    {
      id: 'prev-2', detectedItemId: 'demo-item-2', title: 'Pull Day', exerciseCount: 5, blockCount: 2,
      estimatedDuration: 55, validationIssues: [], selected: true, isDuplicate: false,
      workout: {
        blocks: [
          { label: 'Vertical Pull', exercises: [{ name: 'Pull-ups', sets: 4, reps: 8 }, { name: 'Lat Pulldown', sets: 3, reps: 10 }] },
          { label: 'Horizontal Pull', exercises: [{ name: 'Barbell Row', sets: 4, reps: 8 }, { name: 'Face Pull', sets: 3, reps: 15 }] },
        ],
      },
    },
    {
      id: 'prev-3', detectedItemId: 'demo-item-3', title: 'Leg Day', exerciseCount: 5, blockCount: 2,
      estimatedDuration: 70, validationIssues: [], selected: true, isDuplicate: false,
      workout: {
        blocks: [
          { label: 'Quads', exercises: [{ name: 'Back Squat', sets: 4, reps: 5 }, { name: 'Leg Press', sets: 3, reps: 12 }] },
          { label: 'Posterior Chain', exercises: [{ name: 'Romanian Deadlift', sets: 3, reps: 10 }, { name: 'Leg Curl', sets: 3, reps: 12 }] },
        ],
      },
    },
  ],
  stats: {
    totalDetected: 3, totalSelected: 3, totalSkipped: 0,
    exercisesMatched: 4, exercisesNeedingReview: 1, exercisesUnmapped: 0,
    newExercisesToCreate: 0, estimatedDuration: 190, duplicatesFound: 0,
    validationErrors: 0, validationWarnings: 0,
  },
};

const DEMO_EXECUTE_RESPONSE: BulkExecuteResponse = {
  success: true,
  job_id: DEMO_JOB_ID,
  status: 'running',
  message: 'Import started successfully',
};

const DEMO_STATUS_COMPLETE: BulkStatusResponse = {
  success: true,
  job_id: DEMO_JOB_ID,
  status: 'complete',
  progress: 100,
  results: [
    { workoutId: 'demo-item-1', title: 'Push Day', status: 'success', savedWorkoutId: 'saved-1' },
    { workoutId: 'demo-item-2', title: 'Pull Day', status: 'success', savedWorkoutId: 'saved-2' },
    { workoutId: 'demo-item-3', title: 'Leg Day', status: 'success', savedWorkoutId: 'saved-3' },
  ],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ── Scenario: Messy CSV ──────────────────────────────────────────────────────

const MESSY_JOB_ID = 'demo-import-job-messy';

const MESSY_DETECT: BulkDetectResponse = {
  success: true,
  job_id: MESSY_JOB_ID,
  total: 4,
  success_count: 3,
  error_count: 1,
  metadata: {
    programName: 'gym_log_2025.csv',
    detectedFormat: 'csv_flat',
    sheetNames: [],
  },
  items: [
    { id: 'messy-1', sourceIndex: 0, sourceType: 'file', sourceRef: 'gym_log_2025.csv — rows 2–18', rawData: {}, parsedTitle: 'Upper Body A', parsedExerciseCount: 7, parsedBlockCount: 1, confidence: 58 },
    { id: 'messy-2', sourceIndex: 1, sourceType: 'file', sourceRef: 'gym_log_2025.csv — rows 19–31', rawData: {}, parsedTitle: 'Lower Body', parsedExerciseCount: 5, parsedBlockCount: 1, confidence: 62 },
    { id: 'messy-3', sourceIndex: 2, sourceType: 'file', sourceRef: 'gym_log_2025.csv — rows 32–44', rawData: {}, parsedTitle: 'Upper Body B', parsedExerciseCount: 6, parsedBlockCount: 1, confidence: 55 },
    { id: 'messy-4', sourceIndex: 3, sourceType: 'file', sourceRef: 'gym_log_2025.csv — rows 45–52', rawData: {}, parsedTitle: 'Upper Body A', parsedExerciseCount: 7, parsedBlockCount: 1, confidence: 57, isDuplicate: true },
  ],
};

const MESSY_MAP: BulkMapResponse = {
  success: true,
  job_id: MESSY_JOB_ID,
  mapped_count: 3,
  workouts: [],
};

const MESSY_MATCH: BulkMatchResponse = {
  success: true,
  job_id: MESSY_JOB_ID,
  total_exercises: 8,
  matched: 3,
  needs_review: 4,
  unmapped: 1,
  exercises: [
    { id: 'mex-1', originalName: 'Bench press', matchedGarminName: 'Bench Press', confidence: 96, suggestions: [], status: 'matched', sourceWorkoutIds: ['messy-1'], occurrenceCount: 3 },
    { id: 'mex-2', originalName: 'db fly', matchedGarminName: 'Dumbbell Fly', confidence: 78, suggestions: [{ name: 'Cable Fly', confidence: 71 }, { name: 'Pec Deck', confidence: 65 }], status: 'needs_review', sourceWorkoutIds: ['messy-1'], occurrenceCount: 2 },
    { id: 'mex-3', originalName: 'tri ext', matchedGarminName: 'Tricep Extension', confidence: 69, suggestions: [{ name: 'Skull Crusher', confidence: 60 }], status: 'needs_review', sourceWorkoutIds: ['messy-1', 'messy-3'], occurrenceCount: 4 },
    { id: 'mex-4', originalName: 'squats', matchedGarminName: 'Squat', confidence: 99, suggestions: [], status: 'matched', sourceWorkoutIds: ['messy-2'], occurrenceCount: 3 },
    { id: 'mex-5', originalName: 'leg press machine', matchedGarminName: 'Leg Press', confidence: 92, suggestions: [], status: 'matched', sourceWorkoutIds: ['messy-2'], occurrenceCount: 2 },
    { id: 'mex-6', originalName: 'Nordic curls', matchedGarminName: 'Nordic Hamstring Curl', confidence: 74, suggestions: [{ name: 'Hamstring Curl', confidence: 68 }], status: 'needs_review', sourceWorkoutIds: ['messy-2'], occurrenceCount: 1 },
    { id: 'mex-7', originalName: 'rear delt x', matchedGarminName: '', confidence: 38, suggestions: [{ name: 'Rear Delt Fly', confidence: 55 }, { name: 'Face Pull', confidence: 48 }], status: 'needs_review', sourceWorkoutIds: ['messy-3'], occurrenceCount: 2 },
    { id: 'mex-8', originalName: 'whatever band thing', matchedGarminName: '', confidence: 12, suggestions: [], status: 'unmapped', sourceWorkoutIds: ['messy-3'], occurrenceCount: 1 },
  ],
};

const MESSY_PREVIEW: BulkPreviewResponse = {
  success: true,
  job_id: MESSY_JOB_ID,
  workouts: [
    {
      id: 'mprev-1', detectedItemId: 'messy-1', title: 'Upper Body A', exerciseCount: 7, blockCount: 1,
      estimatedDuration: 55, validationIssues: ['2 exercises need review before import'], selected: true, isDuplicate: false,
      workout: { blocks: [{ label: 'Upper Body', exercises: [{ name: 'Bench press', sets: 4, reps: 8 }, { name: 'db fly', sets: 3, reps: 12 }, { name: 'tri ext', sets: 3, reps: 15 }] }] },
    },
    {
      id: 'mprev-2', detectedItemId: 'messy-2', title: 'Lower Body', exerciseCount: 5, blockCount: 1,
      estimatedDuration: 50, validationIssues: ['1 exercise needs review before import'], selected: true, isDuplicate: false,
      workout: { blocks: [{ label: 'Lower Body', exercises: [{ name: 'squats', sets: 4, reps: 5 }, { name: 'leg press machine', sets: 3, reps: 12 }, { name: 'Nordic curls', sets: 3, reps: 8 }] }] },
    },
    {
      id: 'mprev-3', detectedItemId: 'messy-3', title: 'Upper Body B', exerciseCount: 6, blockCount: 1,
      estimatedDuration: 50, validationIssues: ['1 exercise unmatched and will be skipped', '1 exercise needs review before import'], selected: true, isDuplicate: false,
      workout: { blocks: [{ label: 'Upper Body', exercises: [{ name: 'rear delt x', sets: 3, reps: 15 }, { name: 'whatever band thing', sets: 2, reps: 20 }] }] },
    },
    {
      id: 'mprev-4', detectedItemId: 'messy-4', title: 'Upper Body A (duplicate)', exerciseCount: 7, blockCount: 1,
      estimatedDuration: 55, validationIssues: ['Duplicate of "Upper Body A" — already in import list'], selected: false, isDuplicate: true,
      workout: { blocks: [] },
    },
  ],
  stats: {
    totalDetected: 4, totalSelected: 3, totalSkipped: 1,
    exercisesMatched: 3, exercisesNeedingReview: 4, exercisesUnmapped: 1,
    newExercisesToCreate: 0, estimatedDuration: 155, duplicatesFound: 1,
    validationErrors: 1, validationWarnings: 3,
  },
};

const MESSY_STATUS_COMPLETE: BulkStatusResponse = {
  success: true,
  job_id: MESSY_JOB_ID,
  status: 'complete',
  progress: 100,
  results: [
    { workoutId: 'messy-1', title: 'Upper Body A', status: 'success', savedWorkoutId: 'saved-m1' },
    { workoutId: 'messy-2', title: 'Lower Body', status: 'success', savedWorkoutId: 'saved-m2' },
    { workoutId: 'messy-3', title: 'Upper Body B', status: 'partial', savedWorkoutId: 'saved-m3' },
  ],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ── Scenario: Large Program (8 workouts) ─────────────────────────────────────

const LARGE_JOB_ID = 'demo-import-job-large';

const LARGE_DETECT: BulkDetectResponse = {
  success: true,
  job_id: LARGE_JOB_ID,
  total: 8,
  success_count: 8,
  error_count: 0,
  metadata: {
    programName: '10-Week Strength Block',
    detectedFormat: 'excel_multi_sheet',
    sheetNames: ['W1 Upper', 'W1 Lower', 'W1 Push', 'W1 Pull', 'W2 Upper', 'W2 Lower', 'W2 Push', 'W2 Pull'],
  },
  items: [
    { id: 'lg-1', sourceIndex: 0, sourceType: 'file', sourceRef: 'strength_block.xlsx — Sheet: W1 Upper', rawData: {}, parsedTitle: 'Week 1 — Upper A', parsedExerciseCount: 6, parsedBlockCount: 3, confidence: 98 },
    { id: 'lg-2', sourceIndex: 1, sourceType: 'file', sourceRef: 'strength_block.xlsx — Sheet: W1 Lower', rawData: {}, parsedTitle: 'Week 1 — Lower A', parsedExerciseCount: 5, parsedBlockCount: 2, confidence: 97 },
    { id: 'lg-3', sourceIndex: 2, sourceType: 'file', sourceRef: 'strength_block.xlsx — Sheet: W1 Push', rawData: {}, parsedTitle: 'Week 1 — Push', parsedExerciseCount: 7, parsedBlockCount: 3, confidence: 96 },
    { id: 'lg-4', sourceIndex: 3, sourceType: 'file', sourceRef: 'strength_block.xlsx — Sheet: W1 Pull', rawData: {}, parsedTitle: 'Week 1 — Pull', parsedExerciseCount: 6, parsedBlockCount: 3, confidence: 95 },
    { id: 'lg-5', sourceIndex: 4, sourceType: 'file', sourceRef: 'strength_block.xlsx — Sheet: W2 Upper', rawData: {}, parsedTitle: 'Week 2 — Upper A', parsedExerciseCount: 6, parsedBlockCount: 3, confidence: 98 },
    { id: 'lg-6', sourceIndex: 5, sourceType: 'file', sourceRef: 'strength_block.xlsx — Sheet: W2 Lower', rawData: {}, parsedTitle: 'Week 2 — Lower A', parsedExerciseCount: 5, parsedBlockCount: 2, confidence: 97 },
    { id: 'lg-7', sourceIndex: 6, sourceType: 'file', sourceRef: 'strength_block.xlsx — Sheet: W2 Push', rawData: {}, parsedTitle: 'Week 2 — Push', parsedExerciseCount: 7, parsedBlockCount: 3, confidence: 96 },
    { id: 'lg-8', sourceIndex: 7, sourceType: 'file', sourceRef: 'strength_block.xlsx — Sheet: W2 Pull', rawData: {}, parsedTitle: 'Week 2 — Pull', parsedExerciseCount: 6, parsedBlockCount: 3, confidence: 94 },
  ],
};

const LARGE_MAP: BulkMapResponse = { success: true, job_id: LARGE_JOB_ID, mapped_count: 8, workouts: [] };

const LARGE_MATCH: BulkMatchResponse = {
  success: true,
  job_id: LARGE_JOB_ID,
  total_exercises: 10,
  matched: 9,
  needs_review: 1,
  unmapped: 0,
  exercises: [
    { id: 'lex-1', originalName: 'Bench Press', matchedGarminName: 'Bench Press', confidence: 99, suggestions: [], status: 'matched', sourceWorkoutIds: ['lg-1', 'lg-3', 'lg-5', 'lg-7'], occurrenceCount: 8 },
    { id: 'lex-2', originalName: 'Squat', matchedGarminName: 'Squat', confidence: 99, suggestions: [], status: 'matched', sourceWorkoutIds: ['lg-2', 'lg-6'], occurrenceCount: 4 },
    { id: 'lex-3', originalName: 'Deadlift', matchedGarminName: 'Deadlift', confidence: 99, suggestions: [], status: 'matched', sourceWorkoutIds: ['lg-2', 'lg-6'], occurrenceCount: 4 },
    { id: 'lex-4', originalName: 'Overhead Press', matchedGarminName: 'Shoulder Press', confidence: 91, suggestions: [{ name: 'Military Press', confidence: 85 }], status: 'matched', sourceWorkoutIds: ['lg-1', 'lg-3', 'lg-5', 'lg-7'], occurrenceCount: 8 },
    { id: 'lex-5', originalName: 'Pull-up', matchedGarminName: 'Pull Up', confidence: 98, suggestions: [], status: 'matched', sourceWorkoutIds: ['lg-4', 'lg-8'], occurrenceCount: 4 },
    { id: 'lex-6', originalName: 'Barbell Row', matchedGarminName: 'Bent Over Row', confidence: 89, suggestions: [], status: 'matched', sourceWorkoutIds: ['lg-4', 'lg-8'], occurrenceCount: 4 },
    { id: 'lex-7', originalName: 'Incline DB Press', matchedGarminName: 'Incline Dumbbell Press', confidence: 94, suggestions: [], status: 'matched', sourceWorkoutIds: ['lg-3', 'lg-7'], occurrenceCount: 4 },
    { id: 'lex-8', originalName: 'Romanian DL', matchedGarminName: 'Romanian Deadlift', confidence: 96, suggestions: [], status: 'matched', sourceWorkoutIds: ['lg-2', 'lg-6'], occurrenceCount: 4 },
    { id: 'lex-9', originalName: 'Face Pull', matchedGarminName: 'Face Pull', confidence: 99, suggestions: [], status: 'matched', sourceWorkoutIds: ['lg-4', 'lg-8'], occurrenceCount: 4 },
    { id: 'lex-10', originalName: 'Lateral Raise', matchedGarminName: 'Lateral Raise', confidence: 99, suggestions: [], status: 'needs_review', sourceWorkoutIds: ['lg-3', 'lg-7'], occurrenceCount: 4 },
  ],
};

const LARGE_PREVIEW: BulkPreviewResponse = {
  success: true,
  job_id: LARGE_JOB_ID,
  workouts: [
    { id: 'lprev-1', detectedItemId: 'lg-1', title: 'Week 1 — Upper A', exerciseCount: 6, blockCount: 3, estimatedDuration: 70, validationIssues: [], selected: true, isDuplicate: false, workout: { blocks: [{ label: 'Horizontal Push', exercises: [{ name: 'Bench Press', sets: 4, reps: 5 }, { name: 'Incline DB Press', sets: 3, reps: 8 }] }, { label: 'Vertical Push', exercises: [{ name: 'Overhead Press', sets: 3, reps: 6 }] }, { label: 'Accessory', exercises: [{ name: 'Lateral Raise', sets: 3, reps: 15 }] }] } },
    { id: 'lprev-2', detectedItemId: 'lg-2', title: 'Week 1 — Lower A', exerciseCount: 5, blockCount: 2, estimatedDuration: 75, validationIssues: [], selected: true, isDuplicate: false, workout: { blocks: [{ label: 'Primary', exercises: [{ name: 'Squat', sets: 5, reps: 3 }, { name: 'Deadlift', sets: 3, reps: 5 }] }, { label: 'Accessory', exercises: [{ name: 'Romanian DL', sets: 3, reps: 10 }] }] } },
    { id: 'lprev-3', detectedItemId: 'lg-3', title: 'Week 1 — Push', exerciseCount: 7, blockCount: 3, estimatedDuration: 65, validationIssues: [], selected: true, isDuplicate: false, workout: { blocks: [{ label: 'Primary', exercises: [{ name: 'Bench Press', sets: 4, reps: 6 }] }, { label: 'Secondary', exercises: [{ name: 'Incline DB Press', sets: 3, reps: 10 }, { name: 'Overhead Press', sets: 3, reps: 8 }] }, { label: 'Accessory', exercises: [{ name: 'Lateral Raise', sets: 4, reps: 15 }] }] } },
    { id: 'lprev-4', detectedItemId: 'lg-4', title: 'Week 1 — Pull', exerciseCount: 6, blockCount: 3, estimatedDuration: 65, validationIssues: [], selected: true, isDuplicate: false, workout: { blocks: [{ label: 'Primary', exercises: [{ name: 'Pull-up', sets: 4, reps: 6 }, { name: 'Barbell Row', sets: 4, reps: 6 }] }, { label: 'Accessory', exercises: [{ name: 'Face Pull', sets: 3, reps: 20 }] }] } },
    { id: 'lprev-5', detectedItemId: 'lg-5', title: 'Week 2 — Upper A', exerciseCount: 6, blockCount: 3, estimatedDuration: 70, validationIssues: [], selected: true, isDuplicate: false, workout: { blocks: [{ label: 'Horizontal Push', exercises: [{ name: 'Bench Press', sets: 4, reps: 4 }, { name: 'Incline DB Press', sets: 3, reps: 8 }] }] } },
    { id: 'lprev-6', detectedItemId: 'lg-6', title: 'Week 2 — Lower A', exerciseCount: 5, blockCount: 2, estimatedDuration: 75, validationIssues: [], selected: true, isDuplicate: false, workout: { blocks: [{ label: 'Primary', exercises: [{ name: 'Squat', sets: 5, reps: 2 }, { name: 'Deadlift', sets: 3, reps: 4 }] }] } },
    { id: 'lprev-7', detectedItemId: 'lg-7', title: 'Week 2 — Push', exerciseCount: 7, blockCount: 3, estimatedDuration: 65, validationIssues: [], selected: true, isDuplicate: false, workout: { blocks: [{ label: 'Primary', exercises: [{ name: 'Bench Press', sets: 4, reps: 5 }] }] } },
    { id: 'lprev-8', detectedItemId: 'lg-8', title: 'Week 2 — Pull', exerciseCount: 6, blockCount: 3, estimatedDuration: 65, validationIssues: [], selected: true, isDuplicate: false, workout: { blocks: [{ label: 'Primary', exercises: [{ name: 'Pull-up', sets: 4, reps: 5 }, { name: 'Barbell Row', sets: 4, reps: 5 }] }] } },
  ],
  stats: {
    totalDetected: 8, totalSelected: 8, totalSkipped: 0,
    exercisesMatched: 9, exercisesNeedingReview: 1, exercisesUnmapped: 0,
    newExercisesToCreate: 0, estimatedDuration: 550, duplicatesFound: 0,
    validationErrors: 0, validationWarnings: 0,
  },
};

const LARGE_STATUS_COMPLETE: BulkStatusResponse = {
  success: true,
  job_id: LARGE_JOB_ID,
  status: 'complete',
  progress: 100,
  results: ['lg-1','lg-2','lg-3','lg-4','lg-5','lg-6','lg-7','lg-8'].map((id, i) => ({
    workoutId: id,
    title: LARGE_DETECT.items[i].parsedTitle,
    status: 'success' as const,
    savedWorkoutId: `saved-${id}`,
  })),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ── Scenario: Single Workout ──────────────────────────────────────────────────

const SINGLE_JOB_ID = 'demo-import-job-single';

const SINGLE_DETECT: BulkDetectResponse = {
  success: true,
  job_id: SINGLE_JOB_ID,
  total: 1,
  success_count: 1,
  error_count: 0,
  metadata: {
    programName: 'monday_session.csv',
    detectedFormat: 'csv_flat',
    sheetNames: [],
  },
  items: [
    {
      id: 'sw-1', sourceIndex: 0, sourceType: 'file', sourceRef: 'monday_session.csv',
      rawData: {
        title: 'Monday Session',
        blocks: [
          {
            id: 'sw-block-1', label: 'Main Lifts', structure: null,
            exercises: [
              { id: 'sw-ex-1', name: 'Bench Press', sets: 3, reps: 5, reps_range: null, duration_sec: null, rest_sec: 120, rest_type: 'timed', distance_m: null, distance_range: null },
              { id: 'sw-ex-2', name: 'Squat', sets: 3, reps: 5, reps_range: null, duration_sec: null, rest_sec: 120, rest_type: 'timed', distance_m: null, distance_range: null },
              { id: 'sw-ex-3', name: 'Deadlift', sets: 1, reps: 5, reps_range: null, duration_sec: null, rest_sec: 180, rest_type: 'timed', distance_m: null, distance_range: null },
              { id: 'sw-ex-4', name: 'Pull-up', sets: 3, reps: 8, reps_range: null, duration_sec: null, rest_sec: 90, rest_type: 'timed', distance_m: null, distance_range: null },
            ],
          },
        ],
      },
      parsedTitle: 'Monday Session', parsedExerciseCount: 4, parsedBlockCount: 1, confidence: 91,
    },
  ],
};

const SINGLE_MAP: BulkMapResponse = { success: true, job_id: SINGLE_JOB_ID, mapped_count: 1, workouts: [] };

const SINGLE_MATCH: BulkMatchResponse = {
  success: true,
  job_id: SINGLE_JOB_ID,
  total_exercises: 4,
  matched: 4,
  needs_review: 0,
  unmapped: 0,
  exercises: [
    { id: 'sex-1', originalName: 'Bench Press', matchedGarminName: 'Bench Press', confidence: 99, suggestions: [], status: 'matched', sourceWorkoutIds: ['sw-1'], occurrenceCount: 1 },
    { id: 'sex-2', originalName: 'Squat', matchedGarminName: 'Squat', confidence: 99, suggestions: [], status: 'matched', sourceWorkoutIds: ['sw-1'], occurrenceCount: 1 },
    { id: 'sex-3', originalName: 'Deadlift', matchedGarminName: 'Deadlift', confidence: 99, suggestions: [], status: 'matched', sourceWorkoutIds: ['sw-1'], occurrenceCount: 1 },
    { id: 'sex-4', originalName: 'Pull-up', matchedGarminName: 'Pull Up', confidence: 98, suggestions: [], status: 'matched', sourceWorkoutIds: ['sw-1'], occurrenceCount: 1 },
  ],
};

const SINGLE_PREVIEW: BulkPreviewResponse = {
  success: true,
  job_id: SINGLE_JOB_ID,
  workouts: [
    {
      id: 'sprev-1', detectedItemId: 'sw-1', title: 'Monday Session', exerciseCount: 4, blockCount: 1,
      estimatedDuration: 50, validationIssues: [], selected: true, isDuplicate: false,
      workout: { blocks: [{ label: 'Main Lifts', exercises: [{ name: 'Bench Press', sets: 3, reps: 5 }, { name: 'Squat', sets: 3, reps: 5 }, { name: 'Deadlift', sets: 1, reps: 5 }, { name: 'Pull-up', sets: 3, reps: 8 }] }] },
    },
  ],
  stats: {
    totalDetected: 1, totalSelected: 1, totalSkipped: 0,
    exercisesMatched: 4, exercisesNeedingReview: 0, exercisesUnmapped: 0,
    newExercisesToCreate: 0, estimatedDuration: 50, duplicatesFound: 0,
    validationErrors: 0, validationWarnings: 0,
  },
};

const SINGLE_STATUS_COMPLETE: BulkStatusResponse = {
  success: true,
  job_id: SINGLE_JOB_ID,
  status: 'complete',
  progress: 100,
  results: [{ workoutId: 'sw-1', title: 'Monday Session', status: 'success', savedWorkoutId: 'saved-sw1' }],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ── Scenario resolver ────────────────────────────────────────────────────────

type ScenarioData = {
  detect: BulkDetectResponse;
  map: BulkMapResponse;
  match: BulkMatchResponse;
  preview: BulkPreviewResponse;
  execute: BulkExecuteResponse;
  status: BulkStatusResponse;
};

function getDemoScenarioData(): ScenarioData {
  const scenario = getImportScenario();
  switch (scenario) {
    case 'messy-csv':
      return { detect: MESSY_DETECT, map: MESSY_MAP, match: MESSY_MATCH, preview: MESSY_PREVIEW, execute: { success: true, job_id: MESSY_JOB_ID, status: 'running', message: 'Import started successfully' }, status: MESSY_STATUS_COMPLETE };
    case 'large-program':
      return { detect: LARGE_DETECT, map: LARGE_MAP, match: LARGE_MATCH, preview: LARGE_PREVIEW, execute: { success: true, job_id: LARGE_JOB_ID, status: 'running', message: 'Import started successfully' }, status: LARGE_STATUS_COMPLETE };
    case 'single-workout':
      return { detect: SINGLE_DETECT, map: SINGLE_MAP, match: SINGLE_MATCH, preview: SINGLE_PREVIEW, execute: { success: true, job_id: SINGLE_JOB_ID, status: 'running', message: 'Import started successfully' }, status: SINGLE_STATUS_COMPLETE };
    default:
      return { detect: DEMO_DETECT_RESPONSE, map: DEMO_MAP_RESPONSE, match: DEMO_MATCH_RESPONSE, preview: DEMO_PREVIEW_RESPONSE, execute: DEMO_EXECUTE_RESPONSE, status: DEMO_STATUS_COMPLETE };
  }
}
import {
  BulkInputType,
  BulkDetectRequest,
  BulkDetectResponse,
  BulkMapRequest,
  BulkMapResponse,
  BulkMatchRequest,
  BulkMatchResponse,
  BulkPreviewRequest,
  BulkPreviewResponse,
  BulkExecuteRequest,
  BulkExecuteResponse,
  BulkStatusResponse,
  ColumnMapping,
} from '../types/bulk-import';
import { WorkoutOperation, PreviewOperationResponse } from '../types/workout-operations';

// Use centralized API config
const INGESTOR_API_BASE_URL = API_URLS.INGESTOR;

// ============================================================================
// API Client Class
// ============================================================================

class BulkImportApiClient {
  /**
   * @deprecated setUserId is no longer needed - user is identified via JWT
   */
  setUserId(_userId: string): void {
    // No-op: user ID is now extracted from JWT on the backend
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${INGESTOR_API_BASE_URL}${endpoint}`;

    const response = await authenticatedFetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      // Handle error.detail being a string, array, or object
      let errorMessage = `API error: ${response.status} ${response.statusText}`;
      if (error.detail) {
        if (typeof error.detail === 'string') {
          errorMessage = error.detail;
        } else if (Array.isArray(error.detail)) {
          // Validation errors from FastAPI often come as an array
          errorMessage = error.detail
            .map((e: { msg?: string; message?: string; loc?: string[] }) =>
              e.msg || e.message || (e.loc ? `${e.loc.join('.')}: validation error` : 'Validation error')
            )
            .join('; ');
        } else if (typeof error.detail === 'object') {
          errorMessage = JSON.stringify(error.detail);
        }
      } else if (error.message) {
        errorMessage = String(error.message);
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Step 1: Detect items from sources
   * Parses files, URLs, or images and returns detected workout items
   */
  async detect(
    profileId: string,
    sourceType: BulkInputType,
    sources: string[]
  ): Promise<BulkDetectResponse> {
    if (isDemoMode) { const s = getDemoScenarioData(); return { ...s.detect, items: s.detect.items.map(i => ({ ...i, sourceType })) }; }
    const request: BulkDetectRequest = {
      profile_id: profileId,
      source_type: sourceType,
      sources,
    };

    return this.request<BulkDetectResponse>('/import/detect', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Step 1b: Upload file for detection
   * Uploads a file and returns detected items
   */
  async detectFile(profileId: string, file: File): Promise<BulkDetectResponse> {
    if (isDemoMode) { const s = getDemoScenarioData(); return { ...s.detect, items: s.detect.items.map(i => ({ ...i, sourceRef: `${file.name} — Sheet: ${i.parsedTitle}` })) }; }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('profile_id', profileId);

    const url = `${INGESTOR_API_BASE_URL}/import/detect/file`;

    const response = await authenticatedFetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `Upload error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Step 2: Apply column mappings (for file imports)
   * Maps detected columns to workout fields
   */
  async applyMappings(
    jobId: string,
    profileId: string,
    columnMappings: ColumnMapping[]
  ): Promise<BulkMapResponse> {
    if (isDemoMode) return getDemoScenarioData().map;
    // Transform camelCase to snake_case for backend
    const snakeCaseMappings = columnMappings.map(m => ({
      source_column: m.sourceColumn,
      source_column_index: m.sourceColumnIndex,
      target_field: m.targetField,
      confidence: m.confidence,
      user_override: m.userOverride,
      sample_values: m.sampleValues,
    }));

    const request = {
      job_id: jobId,
      profile_id: profileId,
      column_mappings: snakeCaseMappings,
    };

    return this.request<BulkMapResponse>('/import/map', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Step 3: Match exercises to Garmin database
   * Returns exercise matching suggestions
   */
  async matchExercises(
    jobId: string,
    profileId: string,
    userMappings?: Record<string, string>
  ): Promise<BulkMatchResponse> {
    if (isDemoMode) return getDemoScenarioData().match;
    const request: BulkMatchRequest = {
      job_id: jobId,
      profile_id: profileId,
      user_mappings: userMappings,
    };

    return this.request<BulkMatchResponse>('/import/match', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Step 4: Generate preview
   * Returns preview workouts with validation
   */
  async preview(
    jobId: string,
    profileId: string,
    selectedIds: string[]
  ): Promise<BulkPreviewResponse> {
    if (isDemoMode) return getDemoScenarioData().preview;
    const request: BulkPreviewRequest = {
      job_id: jobId,
      profile_id: profileId,
      selected_ids: selectedIds,
    };

    return this.request<BulkPreviewResponse>('/import/preview', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Step 5: Execute import
   * Starts the import process (async or sync)
   */
  async execute(
    jobId: string,
    profileId: string,
    workoutIds: string[],
    device: string,
    asyncMode: boolean = true
  ): Promise<BulkExecuteResponse> {
    if (isDemoMode) return getDemoScenarioData().execute;
    const request: BulkExecuteRequest = {
      job_id: jobId,
      profile_id: profileId,
      workout_ids: workoutIds,
      device,
      async_mode: asyncMode,
    };

    return this.request<BulkExecuteResponse>('/import/execute', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Get import job status
   * Used for polling during async import
   */
  async getStatus(jobId: string, profileId: string): Promise<BulkStatusResponse> {
    if (isDemoMode) return getDemoScenarioData().status;
    return this.request<BulkStatusResponse>(`/import/status/${jobId}?profile_id=${encodeURIComponent(profileId)}`, {
      method: 'GET',
    });
  }

  /**
   * Cancel a running import
   */
  async cancel(jobId: string, profileId: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(
      `/import/cancel/${jobId}?profile_id=${encodeURIComponent(profileId)}`,
      {
        method: 'POST',
      }
    );
  }

  /**
   * POST /import/preview/operations
   * Applies operations to a PreviewWorkout in the job cache.
   * No DB write — changes are persisted at execute time.
   *
   * Note: errors thrown here do not carry a `.status` property (inherited from
   * the base `request()` method). Callers should handle generic errors via
   * the `.message` property.
   */
  async applyPreviewOperations(
    jobId: string,
    itemId: string,
    operations: WorkoutOperation[]
  ): Promise<PreviewOperationResponse> {
    return this.request<PreviewOperationResponse>('/import/preview/operations', {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId, item_id: itemId, operations }),
    });
  }

  /**
   * Search Garmin exercise database
   * Used for manual exercise matching
   */
  async searchExercises(query: string, limit: number = 10): Promise<ExerciseSearchResponse> {
    return this.request<ExerciseSearchResponse>(
      `/import/exercises/search?query=${encodeURIComponent(query)}&limit=${limit}`,
      {
        method: 'GET',
      }
    );
  }
}

// Response type for exercise search
export interface ExerciseSearchResult {
  name: string;
  score: number;
}

export interface ExerciseSearchResponse {
  query: string;
  results: ExerciseSearchResult[];
  total: number;
}

// ============================================================================
// Singleton Export
// ============================================================================

export const bulkImportApi = new BulkImportApiClient();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert File to base64 string
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if URL is a supported video/image platform
 */
export function isSupportedVideoUrl(url: string): boolean {
  const supportedDomains = [
    'youtube.com',
    'youtu.be',
    'instagram.com',
    'tiktok.com',
    'pinterest.com',
    'pin.it',
  ];

  try {
    const urlObj = new URL(url);
    return supportedDomains.some(domain => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}

/**
 * Get supported file extensions
 */
export function getSupportedFileExtensions(): string[] {
  return ['.xlsx', '.xls', '.csv', '.json', '.txt'];
}

/**
 * Check if file is supported
 */
export function isSupportedFile(file: File): boolean {
  const extensions = getSupportedFileExtensions();
  const fileName = file.name.toLowerCase();
  return extensions.some(ext => fileName.endsWith(ext));
}
