/**
 * useBulkImportApi Hook
 *
 * React hook for integrating with the bulk import API.
 * Provides methods for each workflow step with automatic state updates.
 * Includes polling logic for async imports.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useBulkImport } from '../context/BulkImportContext';
import {
  bulkImportApi,
  fileToBase64,
  isSupportedFile,
} from '../lib/bulk-import-api';
import {
  BulkInputType,
  ColumnMapping,
  ExerciseMatch,
} from '../types/bulk-import';

// ============================================================================
// Types
// ============================================================================

interface UseBulkImportApiOptions {
  userId: string;
  pollingInterval?: number; // ms, default 2000
  onError?: (error: Error) => void;
}

interface UseBulkImportApiReturn {
  // Step 1: Detection
  detectFromFiles: (files: File[]) => Promise<void>;
  detectFromUrls: (urls: string[]) => Promise<void>;
  detectFromImages: (images: File[]) => Promise<void>;

  // Step 2: Column mapping
  applyColumnMappings: (mappings: ColumnMapping[]) => Promise<void>;

  // Step 3: Exercise matching
  matchExercises: (userMappings?: Record<string, string>) => Promise<void>;
  updateExerciseMatch: (exerciseId: string, garminName: string) => void;

  // Step 4: Preview
  generatePreview: () => Promise<void>;
  toggleWorkoutSelection: (workoutId: string) => void;

  // Step 5: Import
  executeImport: (device: string, asyncMode?: boolean) => Promise<void>;
  cancelImport: () => Promise<void>;

  // Status
  refreshStatus: () => Promise<void>;
  isPolling: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useBulkImportApi({
  userId,
  pollingInterval = 2000,
  onError,
}: UseBulkImportApiOptions): UseBulkImportApiReturn {
  const { state, dispatch, goNext } = useBulkImport();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  // Set user ID on API client
  useEffect(() => {
    if (userId) {
      bulkImportApi.setUserId(userId);
    }
  }, [userId]);

  // Session validation disabled - was causing issues with fresh imports
  // The execute endpoint now validates the session and returns a clear error
  // if the session is expired, which is handled in executeImport

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Error handler - ensures errors are always displayed as strings
  const handleError = useCallback(
    (error: unknown) => {
      let errorMessage = 'An error occurred';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        // Handle object errors (API responses, etc.)
        const errorObj = error as Record<string, unknown>;
        if (errorObj.detail) {
          errorMessage = String(errorObj.detail);
        } else if (errorObj.message) {
          errorMessage = String(errorObj.message);
        } else if (errorObj.error) {
          errorMessage = String(errorObj.error);
        } else {
          // Last resort - try to stringify but limit length
          try {
            const jsonStr = JSON.stringify(error);
            errorMessage = jsonStr.length > 200 ? jsonStr.slice(0, 200) + '...' : jsonStr;
          } catch {
            errorMessage = 'An unknown error occurred';
          }
        }
      }

      dispatch({ type: 'SET_ERROR', error: errorMessage });
      dispatch({ type: 'SET_LOADING', loading: false });
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    },
    [dispatch, onError]
  );

  // ============================================================================
  // Step 1: Detection
  // ============================================================================

  const detectFromFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      // Validate files
      const unsupported = files.filter(f => !isSupportedFile(f));
      if (unsupported.length > 0) {
        handleError(new Error(`Unsupported file type: ${unsupported[0].name}`));
        return;
      }

      dispatch({ type: 'SET_LOADING', loading: true });
      dispatch({ type: 'SET_INPUT_TYPE', inputType: 'file' });
      dispatch({ type: 'SET_INPUT_SOURCES', sources: files });

      try {
        // For now, use the first file (multi-file support can be added later)
        const response = await bulkImportApi.detectFile(userId, files[0]);

        dispatch({ type: 'SET_JOB_ID', jobId: response.job_id });
        dispatch({
          type: 'SET_DETECTED_ITEMS',
          items: response.items,
          metadata: response.metadata,
        });

        // Extract column mappings from detected items for file imports
        const firstItem = response.items[0];
        if (firstItem?.raw_data?.column_info) {
          // Backend ColumnInfo model: { index, name, detected_type, confidence, sample_values }
          const columnMappings: ColumnMapping[] = firstItem.raw_data.column_info.map(
            (col: { name: string; index: number; detected_type: string | null; confidence: number; sample_values?: string[] }, idx: number) => ({
              sourceColumn: col.name || `Column ${idx + 1}`,
              sourceColumnIndex: col.index ?? idx,
              targetField: col.detected_type || 'ignore',
              confidence: col.confidence || 0,
              userOverride: false,
              sampleValues: col.sample_values || [],
            })
          );
          dispatch({
            type: 'SET_COLUMN_MAPPINGS',
            columns: columnMappings,
            patterns: firstItem.patterns || [],
          });
        }

        dispatch({ type: 'SET_LOADING', loading: false });
        goNext();
      } catch (error) {
        handleError(error);
      }
    },
    [userId, dispatch, goNext, handleError]
  );

  const detectFromUrls = useCallback(
    async (urls: string[]) => {
      if (urls.length === 0) return;

      dispatch({ type: 'SET_LOADING', loading: true });
      dispatch({ type: 'SET_INPUT_TYPE', inputType: 'urls' });
      dispatch({ type: 'SET_INPUT_SOURCES', sources: urls });

      try {
        const response = await bulkImportApi.detect(userId, 'urls', urls);

        dispatch({ type: 'SET_JOB_ID', jobId: response.job_id });
        dispatch({
          type: 'SET_DETECTED_ITEMS',
          items: response.items,
          metadata: response.metadata,
        });
        dispatch({ type: 'SET_LOADING', loading: false });
        goNext();
      } catch (error) {
        handleError(error);
      }
    },
    [userId, dispatch, goNext, handleError]
  );

  const detectFromImages = useCallback(
    async (images: File[]) => {
      if (images.length === 0) return;

      dispatch({ type: 'SET_LOADING', loading: true });
      dispatch({ type: 'SET_INPUT_TYPE', inputType: 'images' });
      dispatch({ type: 'SET_INPUT_SOURCES', sources: images });

      try {
        // Convert images to base64
        const base64Images = await Promise.all(images.map(fileToBase64));

        const response = await bulkImportApi.detect(userId, 'images', base64Images);

        dispatch({ type: 'SET_JOB_ID', jobId: response.job_id });
        dispatch({
          type: 'SET_DETECTED_ITEMS',
          items: response.items,
          metadata: response.metadata,
        });
        dispatch({ type: 'SET_LOADING', loading: false });
        goNext();
      } catch (error) {
        handleError(error);
      }
    },
    [userId, dispatch, goNext, handleError]
  );

  // ============================================================================
  // Step 2: Column Mapping
  // ============================================================================

  const applyColumnMappings = useCallback(
    async (mappings: ColumnMapping[]) => {
      if (!state.jobId) {
        handleError(new Error('No active import job'));
        return;
      }

      dispatch({ type: 'SET_LOADING', loading: true });

      try {
        const response = await bulkImportApi.applyMappings(
          state.jobId,
          userId,
          mappings
        );

        // The response includes parsed workouts - we'll use them in preview
        dispatch({ type: 'SET_LOADING', loading: false });
        goNext();
      } catch (error) {
        handleError(error);
      }
    },
    [state.jobId, userId, dispatch, goNext, handleError]
  );

  // ============================================================================
  // Step 3: Exercise Matching
  // ============================================================================

  const matchExercises = useCallback(
    async (userMappings?: Record<string, string>) => {
      if (!state.jobId) {
        handleError(new Error('No active import job'));
        return;
      }

      dispatch({ type: 'SET_LOADING', loading: true });

      try {
        const response = await bulkImportApi.matchExercises(
          state.jobId,
          userId,
          userMappings
        );

        // Transform snake_case to camelCase for frontend
        const transformedExercises = response.exercises.map((e: Record<string, unknown>) => ({
          id: e.id,
          originalName: e.original_name || e.originalName || '',
          matchedGarminName: e.matched_garmin_name || e.matchedGarminName || null,
          confidence: (e.confidence as number) || 0,
          suggestions: (e.suggestions as Array<{ name: string; confidence: number }>) || [],
          status: e.status || 'unmapped',
          userSelection: e.user_selection || e.userSelection || undefined,
          sourceWorkoutIds: e.source_workout_ids || e.sourceWorkoutIds || [],
          occurrenceCount: e.occurrence_count || e.occurrenceCount || 1,
        }));

        dispatch({
          type: 'SET_EXERCISE_MATCHES',
          exercises: transformedExercises,
        });
        dispatch({ type: 'SET_LOADING', loading: false });

        // Auto-advance if all exercises are matched
        if (response.unmapped === 0 && response.needs_review === 0) {
          goNext();
        }
      } catch (error) {
        handleError(error);
      }
    },
    [state.jobId, userId, dispatch, goNext, handleError]
  );

  const updateExerciseMatch = useCallback(
    (exerciseId: string, garminName: string) => {
      const exercise = state.matches.exercises.find(e => e.id === exerciseId);
      if (!exercise) return;

      const updates: Partial<ExerciseMatch> = {
        matchedGarminName: garminName,
        userSelection: garminName,
        status: garminName ? 'matched' : 'unmapped',
        confidence: garminName ? 100 : 0,
      };

      dispatch({ type: 'UPDATE_EXERCISE_MATCH', id: exerciseId, updates });
    },
    [state.matches.exercises, dispatch]
  );

  // ============================================================================
  // Step 4: Preview
  // ============================================================================

  const generatePreview = useCallback(async () => {
    if (!state.jobId) {
      handleError(new Error('No active import job'));
      return;
    }

    dispatch({ type: 'SET_LOADING', loading: true });

    try {
      const response = await bulkImportApi.preview(
        state.jobId,
        userId,
        state.detected.selectedIds
      );

      // Transform snake_case to camelCase for workouts
      const transformedWorkouts = (response.workouts || []).map((w: Record<string, unknown>) => ({
        id: w.id,
        detectedItemId: w.detected_item_id || w.detectedItemId || '',
        title: w.title || 'Untitled Workout',
        description: w.description,
        exerciseCount: w.exercise_count ?? w.exerciseCount ?? 0,
        blockCount: w.block_count ?? w.blockCount ?? 0,
        estimatedDuration: w.estimated_duration ?? w.estimatedDuration,
        validationIssues: (w.validation_issues || w.validationIssues || []) as Array<{ severity: string; message: string; suggestion?: string }>,
        workout: w.workout || {},
        selected: w.selected !== false,
        isDuplicate: w.is_duplicate || w.isDuplicate || false,
        duplicateOf: w.duplicate_of || w.duplicateOf,
      }));

      // Transform snake_case to camelCase for stats
      const rawStats = (response.stats || {}) as Record<string, unknown>;
      const transformedStats = {
        totalDetected: rawStats.total_detected ?? rawStats.totalDetected ?? 0,
        totalSelected: rawStats.total_selected ?? rawStats.totalSelected ?? 0,
        totalSkipped: rawStats.total_skipped ?? rawStats.totalSkipped ?? 0,
        exercisesMatched: rawStats.exercises_matched ?? rawStats.exercisesMatched ?? 0,
        exercisesNeedingReview: rawStats.exercises_needing_review ?? rawStats.exercisesNeedingReview ?? 0,
        exercisesUnmapped: rawStats.exercises_unmapped ?? rawStats.exercisesUnmapped ?? 0,
        newExercisesToCreate: rawStats.new_exercises_to_create ?? rawStats.newExercisesToCreate ?? 0,
        estimatedDuration: rawStats.estimated_duration ?? rawStats.estimatedDuration ?? 0,
        duplicatesFound: rawStats.duplicates_found ?? rawStats.duplicatesFound ?? 0,
        validationErrors: rawStats.validation_errors ?? rawStats.validationErrors ?? 0,
        validationWarnings: rawStats.validation_warnings ?? rawStats.validationWarnings ?? 0,
      };

      dispatch({
        type: 'SET_PREVIEW_WORKOUTS',
        workouts: transformedWorkouts,
        stats: transformedStats,
      });
      dispatch({ type: 'SET_LOADING', loading: false });
      goNext();
    } catch (error) {
      handleError(error);
    }
  }, [state.jobId, state.detected.selectedIds, userId, dispatch, goNext, handleError]);

  const toggleWorkoutSelection = useCallback(
    (workoutId: string) => {
      dispatch({ type: 'TOGGLE_WORKOUT_SELECTION', id: workoutId });
    },
    [dispatch]
  );

  // ============================================================================
  // Step 5: Import
  // ============================================================================

  const startPolling = useCallback((jobId: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    if (!jobId) {
      console.error('startPolling called without jobId');
      return;
    }

    console.log('Starting polling for job:', jobId);
    isPollingRef.current = true;

    pollingRef.current = setInterval(async () => {
      try {
        console.log('Polling status for job:', jobId);
        const status = await bulkImportApi.getStatus(jobId, userId);

        dispatch({
          type: 'UPDATE_IMPORT_PROGRESS',
          progress: status.progress,
          currentItem: status.current_item,
        });
        dispatch({
          type: 'SET_IMPORT_RESULTS',
          results: status.results,
        });

        if (status.status === 'complete') {
          dispatch({ type: 'COMPLETE_IMPORT' });
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          isPollingRef.current = false;
        } else if (status.status === 'failed' || status.status === 'cancelled' || status.status === 'not_found') {
          dispatch({
            type: 'SET_IMPORT_STATUS',
            status: 'failed',
            error: status.status === 'not_found'
              ? 'Import session expired. Please start a new import.'
              : status.error,
          });
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          isPollingRef.current = false;
        }
      } catch (error) {
        console.error('Polling error:', error);
        // Don't stop polling on transient errors
      }
    }, pollingInterval);
  }, [pollingInterval, userId, dispatch]);

  const executeImport = useCallback(
    async (device: string, asyncMode: boolean = true) => {
      if (!state.jobId) {
        handleError(new Error('No active import job'));
        return;
      }

      // Use detectedItemId, not the preview id - backend looks up by detected item ID
      const selectedWorkoutIds = state.preview.workouts
        .filter(w => w.selected)
        .map(w => w.detectedItemId);

      if (selectedWorkoutIds.length === 0) {
        handleError(new Error('No workouts selected for import'));
        return;
      }

      dispatch({ type: 'SET_LOADING', loading: true });

      try {
        const response = await bulkImportApi.execute(
          state.jobId,
          userId,
          selectedWorkoutIds,
          device,
          asyncMode
        );

        // Check if execute was successful
        if (!response.success || response.status === 'not_found') {
          handleError(new Error(response.message || 'Import session expired. Please start a new import.'));
          return;
        }

        dispatch({ type: 'START_IMPORT', jobId: response.job_id });
        dispatch({ type: 'SET_LOADING', loading: false });

        if (asyncMode) {
          // Pass jobId directly since state won't be updated yet
          startPolling(response.job_id);
        }
      } catch (error) {
        handleError(error);
      }
    },
    [state.jobId, state.preview.workouts, userId, dispatch, startPolling, handleError]
  );

  const cancelImport = useCallback(async () => {
    if (!state.import.jobId) return;

    try {
      await bulkImportApi.cancel(state.import.jobId, userId);
      dispatch({ type: 'SET_IMPORT_STATUS', status: 'cancelled' });

      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      isPollingRef.current = false;
    } catch (error) {
      handleError(error);
    }
  }, [state.import.jobId, dispatch, handleError]);

  const refreshStatus = useCallback(async () => {
    if (!state.import.jobId) return;

    try {
      const status = await bulkImportApi.getStatus(state.import.jobId);

      dispatch({
        type: 'UPDATE_IMPORT_PROGRESS',
        progress: status.progress,
        currentItem: status.current_item,
      });
      dispatch({
        type: 'SET_IMPORT_RESULTS',
        results: status.results,
      });
      dispatch({
        type: 'SET_IMPORT_STATUS',
        status: status.status,
        error: status.error,
      });
    } catch (error) {
      handleError(error);
    }
  }, [state.import.jobId, dispatch, handleError]);

  return {
    // Step 1
    detectFromFiles,
    detectFromUrls,
    detectFromImages,

    // Step 2
    applyColumnMappings,

    // Step 3
    matchExercises,
    updateExerciseMatch,

    // Step 4
    generatePreview,
    toggleWorkoutSelection,

    // Step 5
    executeImport,
    cancelImport,

    // Status
    refreshStatus,
    isPolling: isPollingRef.current,
  };
}

export default useBulkImportApi;
