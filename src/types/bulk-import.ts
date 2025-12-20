/**
 * Bulk Import Types
 *
 * Type definitions for the 5-step bulk import workflow:
 * Detect -> Map -> Match -> Preview -> Import
 */

import { WorkoutStructure } from './workout';

// ============================================================================
// Input Types
// ============================================================================

export type BulkInputType = 'file' | 'urls' | 'images';

export type BulkImportStep = 'detect' | 'map' | 'match' | 'preview' | 'import';

// ============================================================================
// Step 1: Detection
// ============================================================================

/**
 * Detected item from file/URL/image parsing
 */
export interface DetectedItem {
  id: string;
  sourceIndex: number;
  sourceType: BulkInputType;
  sourceRef: string; // filename, URL, or image identifier
  rawData: Record<string, unknown>;
  parsedTitle?: string;
  parsedExerciseCount?: number;
  parsedBlockCount?: number;
  confidence: number; // 0-100
  errors?: string[];
  warnings?: string[];
}

/**
 * Metadata extracted during detection (e.g., 1RM values, program name)
 */
export interface DetectionMetadata {
  programName?: string;
  programDescription?: string;
  oneRepMaxes?: Record<string, number>; // exercise name -> weight
  detectedFormat?: string; // 'strong_app', 'hevy', 'excel_multi_sheet', etc.
  sheetNames?: string[]; // For multi-sheet Excel files
  totalRows?: number;
  headerRow?: number;
}

// ============================================================================
// Step 2: Column Mapping (for file imports)
// ============================================================================

export type MappingTargetField =
  | 'title'
  | 'exercise'
  | 'sets'
  | 'reps'
  | 'weight'
  | 'duration'
  | 'rest'
  | 'notes'
  | 'block'
  | 'day'
  | 'week'
  | 'ignore';

/**
 * Column mapping for file imports
 */
export interface ColumnMapping {
  sourceColumn: string;
  sourceColumnIndex: number;
  targetField: MappingTargetField;
  confidence: number; // 0-100
  userOverride: boolean;
  sampleValues: string[];
}

/**
 * Detected patterns in the data
 */
export interface DetectedPattern {
  patternType:
    | 'superset_notation'    // "5a, 5b" style
    | 'complex_movement'     // "3+1", "4+4"
    | 'duration_exercise'    // "60s", "30s"
    | 'percentage_weight'    // "70%", "@RPE8"
    | 'warmup_sets'          // Ramp-up patterns
    | 'header_row'
    | 'exercise_grouping';
  regex?: string;
  confidence: number;
  examples: string[];
  count: number;
}

// ============================================================================
// Step 3: Exercise Matching
// ============================================================================

export type ExerciseMatchStatus = 'matched' | 'needs_review' | 'unmapped' | 'new';

/**
 * Exercise matching result
 */
export interface ExerciseMatch {
  id: string;
  originalName: string;
  matchedGarminName: string | null;
  confidence: number; // 0-100
  suggestions: Array<{
    name: string;
    confidence: number;
  }>;
  status: ExerciseMatchStatus;
  userSelection?: string; // User-confirmed mapping
  sourceWorkoutIds: string[]; // Which workouts contain this exercise
  occurrenceCount: number; // How many times it appears across all workouts
}

// ============================================================================
// Step 4: Preview
// ============================================================================

export type ValidationIssueSeverity = 'error' | 'warning' | 'info';

/**
 * Validation issue found during preview
 */
export interface ValidationIssue {
  id: string;
  severity: ValidationIssueSeverity;
  field: string;
  message: string;
  workoutId?: string;
  exerciseName?: string;
  suggestion?: string;
  autoFixable: boolean;
}

/**
 * Flexible workout data structure for preview
 * Can contain either blocks (from URL/image) or direct exercises (from CSV)
 */
export interface PreviewWorkoutData {
  title?: string;
  name?: string;
  description?: string;
  blocks?: Array<{
    label?: string;
    exercises?: Array<{
      name: string;
      sets?: number;
      reps?: string | number;
      reps_range?: string;
      duration_sec?: number;
    }>;
    supersets?: Array<{
      exercises?: Array<{
        name: string;
        sets?: number;
        reps?: string | number;
      }>;
    }>;
  }>;
  exercises?: Array<{
    name?: string;
    raw_name?: string;
    sets?: number;
    reps?: string | number;
    reps_range?: string;
    duration_sec?: number;
  }>;
  workouts?: Array<{
    name?: string;
    exercises?: Array<{
      name?: string;
      raw_name?: string;
    }>;
  }>;
}

/**
 * Preview workout before import
 */
export interface PreviewWorkout {
  id: string;
  detectedItemId: string;
  title: string;
  description?: string;
  exerciseCount: number;
  blockCount: number;
  estimatedDuration?: number; // minutes
  validationIssues: ValidationIssue[];
  workout: PreviewWorkoutData;
  selected: boolean;
  isDuplicate: boolean;
  duplicateOf?: string; // ID of existing workout if duplicate
}

/**
 * Import statistics for preview
 */
export interface ImportStats {
  totalDetected: number;
  totalSelected: number;
  totalSkipped: number;
  exercisesMatched: number;
  exercisesNeedingReview: number;
  exercisesUnmapped: number;
  newExercisesToCreate: number;
  estimatedDuration: number; // Total minutes
  duplicatesFound: number;
  validationErrors: number;
  validationWarnings: number;
}

// ============================================================================
// Step 5: Import Execution
// ============================================================================

export type ImportStatus = 'idle' | 'running' | 'complete' | 'failed' | 'cancelled';

export type ImportResultStatus = 'success' | 'failed' | 'skipped';

/**
 * Import result for a single workout
 */
export interface ImportResult {
  workoutId: string;
  title: string;
  status: ImportResultStatus;
  error?: string;
  savedWorkoutId?: string; // ID in database after successful import
  exportFormats?: string[]; // Which formats were generated
}

/**
 * Import progress tracking
 */
export interface ImportProgress {
  status: ImportStatus;
  progress: number; // 0-100
  currentItem?: string;
  currentItemIndex?: number;
  totalItems: number;
  startedAt?: string;
  estimatedCompletion?: string;
}

// ============================================================================
// Main State Interface
// ============================================================================

/**
 * Complete bulk import state
 */
export interface BulkImportState {
  // Current step and navigation
  step: BulkImportStep;
  activeSteps: BulkImportStep[]; // Dynamic based on inputType

  // Input configuration
  inputType: BulkInputType;
  inputSources: File[] | string[]; // Files or URLs/base64 images

  // Job tracking
  jobId?: string;

  // Step 1: Detection results
  detected: {
    items: DetectedItem[];
    selectedIds: string[];
    metadata: DetectionMetadata;
  };

  // Step 2: Column mappings (for files)
  mappings: {
    columns: ColumnMapping[];
    patterns: DetectedPattern[];
    autoMapped: boolean;
  };

  // Step 3: Exercise matches
  matches: {
    exercises: ExerciseMatch[];
    newExercises: string[];
    allResolved: boolean;
  };

  // Step 4: Preview
  preview: {
    workouts: PreviewWorkout[];
    validationIssues: ValidationIssue[];
    stats: ImportStats;
  };

  // Step 5: Import execution
  import: {
    status: ImportStatus;
    progress: number;
    currentItem?: string;
    jobId?: string;
    results: ImportResult[];
    error?: string;
    startedAt?: string;
    completedAt?: string;
  };

  // UI state
  loading: boolean;
  error: string | null;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface BulkDetectRequest {
  profile_id: string;
  source_type: BulkInputType;
  sources: string[]; // URLs, file paths, or base64 data
}

export interface BulkDetectResponse {
  success: boolean;
  job_id: string;
  items: DetectedItem[];
  metadata: DetectionMetadata;
  total: number;
  success_count: number;
  error_count: number;
}

export interface BulkMapRequest {
  job_id: string;
  profile_id: string;
  column_mappings: ColumnMapping[];
}

export interface BulkMapResponse {
  success: boolean;
  job_id: string;
  mapped_count: number;
  workouts: Array<{
    detected_item_id: string;
    parsed_workout: WorkoutStructure;
  }>;
}

export interface BulkMatchRequest {
  job_id: string;
  profile_id: string;
  user_mappings?: Record<string, string>; // original_name -> selected_garmin_name
}

export interface BulkMatchResponse {
  success: boolean;
  job_id: string;
  exercises: ExerciseMatch[];
  total_exercises: number;
  matched: number;
  needs_review: number;
  unmapped: number;
}

export interface BulkPreviewRequest {
  job_id: string;
  profile_id: string;
  selected_ids: string[];
}

export interface BulkPreviewResponse {
  success: boolean;
  job_id: string;
  workouts: PreviewWorkout[];
  stats: ImportStats;
}

export interface BulkExecuteRequest {
  job_id: string;
  profile_id: string;
  workout_ids: string[];
  device: string;
  async_mode?: boolean;
}

export interface BulkExecuteResponse {
  success: boolean;
  job_id: string;
  status: ImportStatus;
  message: string;
}

export interface BulkStatusResponse {
  success: boolean;
  job_id: string;
  status: ImportStatus;
  progress: number;
  current_item?: string;
  results: ImportResult[];
  error?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Initial State Factory
// ============================================================================

export const createInitialBulkImportState = (): BulkImportState => ({
  step: 'detect',
  activeSteps: ['detect', 'map', 'match', 'preview', 'import'],
  inputType: 'file',
  inputSources: [],
  jobId: undefined,

  detected: {
    items: [],
    selectedIds: [],
    metadata: {},
  },

  mappings: {
    columns: [],
    patterns: [],
    autoMapped: false,
  },

  matches: {
    exercises: [],
    newExercises: [],
    allResolved: false,
  },

  preview: {
    workouts: [],
    validationIssues: [],
    stats: {
      totalDetected: 0,
      totalSelected: 0,
      totalSkipped: 0,
      exercisesMatched: 0,
      exercisesNeedingReview: 0,
      exercisesUnmapped: 0,
      newExercisesToCreate: 0,
      estimatedDuration: 0,
      duplicatesFound: 0,
      validationErrors: 0,
      validationWarnings: 0,
    },
  },

  import: {
    status: 'idle',
    progress: 0,
    results: [],
  },

  loading: false,
  error: null,
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get active steps based on input type
 * URLs and images skip the Map step (no column mapping needed)
 */
export const getActiveSteps = (inputType: BulkInputType): BulkImportStep[] => {
  if (inputType === 'file') {
    return ['detect', 'map', 'match', 'preview', 'import'];
  }
  // URLs and images don't need column mapping
  return ['detect', 'match', 'preview', 'import'];
};

/**
 * Check if a step can proceed to the next
 */
export const canProceedFromStep = (
  step: BulkImportStep,
  state: BulkImportState
): boolean => {
  switch (step) {
    case 'detect':
      return state.detected.selectedIds.length > 0;
    case 'map':
      return state.mappings.columns.some(c => c.targetField === 'exercise');
    case 'match':
      return state.matches.allResolved ||
             state.matches.exercises.every(e => e.status !== 'unmapped');
    case 'preview':
      return state.preview.workouts.some(w => w.selected) &&
             state.preview.stats.validationErrors === 0;
    case 'import':
      return state.import.status === 'complete';
    default:
      return false;
  }
};
