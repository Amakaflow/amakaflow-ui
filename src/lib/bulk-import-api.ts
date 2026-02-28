/**
 * Bulk Import API Client
 *
 * API client for the bulk import workflow endpoints.
 * Connects to workout-ingestor-api /import/* endpoints.
 */

import { authenticatedFetch } from './authenticated-fetch';
import { API_URLS } from './config';
import { isDemoMode } from './demo-mode';

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
      rawData: { sheet: 'Push Day' },
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
      rawData: { sheet: 'Pull Day' },
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
      rawData: { sheet: 'Leg Day' },
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
    if (isDemoMode) return { ...DEMO_DETECT_RESPONSE, items: DEMO_DETECT_RESPONSE.items.map(i => ({ ...i, sourceType })) };
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
    if (isDemoMode) return { ...DEMO_DETECT_RESPONSE, items: DEMO_DETECT_RESPONSE.items.map(i => ({ ...i, sourceRef: `${file.name} — Sheet: ${i.parsedTitle}` })) };
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
    if (isDemoMode) return DEMO_MAP_RESPONSE;
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
    if (isDemoMode) return DEMO_MATCH_RESPONSE;
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
    if (isDemoMode) return DEMO_PREVIEW_RESPONSE;
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
    if (isDemoMode) return DEMO_EXECUTE_RESPONSE;
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
    if (isDemoMode) return DEMO_STATUS_COMPLETE;
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
