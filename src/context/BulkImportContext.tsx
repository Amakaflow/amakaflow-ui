/**
 * BulkImportContext
 *
 * React Context for managing bulk import workflow state.
 * Uses useReducer for complex state management across the 5-step workflow:
 * Detect -> Map -> Match -> Preview -> Import
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import {
  BulkImportState,
  BulkImportStep,
  BulkInputType,
  DetectedItem,
  DetectionMetadata,
  ColumnMapping,
  DetectedPattern,
  ExerciseMatch,
  PreviewWorkout,
  ValidationIssue,
  ImportStats,
  ImportResult,
  ImportStatus,
  createInitialBulkImportState,
  getActiveSteps,
  canProceedFromStep,
} from '../types/bulk-import';

// ============================================================================
// Action Types
// ============================================================================

type BulkImportAction =
  // Navigation
  | { type: 'SET_STEP'; step: BulkImportStep }
  | { type: 'GO_NEXT' }
  | { type: 'GO_BACK' }

  // Input configuration
  | { type: 'SET_INPUT_TYPE'; inputType: BulkInputType }
  | { type: 'SET_INPUT_SOURCES'; sources: File[] | string[] }

  // Job tracking
  | { type: 'SET_JOB_ID'; jobId: string }

  // Detection results
  | { type: 'SET_DETECTED_ITEMS'; items: DetectedItem[]; metadata: DetectionMetadata }
  | { type: 'TOGGLE_DETECTED_SELECTION'; id: string }
  | { type: 'SELECT_ALL_DETECTED' }
  | { type: 'DESELECT_ALL_DETECTED' }

  // Column mappings
  | { type: 'SET_COLUMN_MAPPINGS'; columns: ColumnMapping[]; patterns: DetectedPattern[] }
  | { type: 'UPDATE_COLUMN_MAPPING'; index: number; mapping: Partial<ColumnMapping> }
  | { type: 'SET_AUTO_MAPPED'; autoMapped: boolean }

  // Exercise matches
  | { type: 'SET_EXERCISE_MATCHES'; exercises: ExerciseMatch[] }
  | { type: 'UPDATE_EXERCISE_MATCH'; id: string; updates: Partial<ExerciseMatch> }
  | { type: 'SET_ALL_RESOLVED'; resolved: boolean }
  | { type: 'ADD_NEW_EXERCISE'; exerciseName: string }

  // Preview
  | { type: 'SET_PREVIEW_WORKOUTS'; workouts: PreviewWorkout[]; stats: ImportStats }
  | { type: 'SET_VALIDATION_ISSUES'; issues: ValidationIssue[] }
  | { type: 'TOGGLE_WORKOUT_SELECTION'; id: string }
  | { type: 'SELECT_ALL_WORKOUTS' }
  | { type: 'DESELECT_ALL_WORKOUTS' }
  | { type: 'UPDATE_PREVIEW_WORKOUT'; id: string; workout: unknown }

  // Import execution
  | { type: 'START_IMPORT'; jobId: string }
  | { type: 'UPDATE_IMPORT_PROGRESS'; progress: number; currentItem?: string }
  | { type: 'ADD_IMPORT_RESULT'; result: ImportResult }
  | { type: 'SET_IMPORT_RESULTS'; results: ImportResult[] }
  | { type: 'SET_IMPORT_STATUS'; status: ImportStatus; error?: string }
  | { type: 'COMPLETE_IMPORT' }

  // UI state
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'RESET_STATE' }
  | { type: 'RESTORE_STATE'; state: Partial<BulkImportState> };

// ============================================================================
// Reducer
// ============================================================================

function bulkImportReducer(
  state: BulkImportState,
  action: BulkImportAction
): BulkImportState {
  switch (action.type) {
    // Navigation
    case 'SET_STEP':
      return { ...state, step: action.step };

    case 'GO_NEXT': {
      const currentIndex = state.activeSteps.indexOf(state.step);
      if (currentIndex < state.activeSteps.length - 1) {
        return { ...state, step: state.activeSteps[currentIndex + 1] };
      }
      return state;
    }

    case 'GO_BACK': {
      const currentIndex = state.activeSteps.indexOf(state.step);
      if (currentIndex > 0) {
        return { ...state, step: state.activeSteps[currentIndex - 1] };
      }
      return state;
    }

    // Input configuration
    case 'SET_INPUT_TYPE':
      return {
        ...state,
        inputType: action.inputType,
        activeSteps: getActiveSteps(action.inputType),
      };

    case 'SET_INPUT_SOURCES':
      return { ...state, inputSources: action.sources };

    // Job tracking
    case 'SET_JOB_ID':
      return { ...state, jobId: action.jobId };

    // Detection results
    case 'SET_DETECTED_ITEMS':
      return {
        ...state,
        detected: {
          items: action.items,
          selectedIds: action.items.map(item => item.id),
          metadata: action.metadata,
        },
      };

    case 'TOGGLE_DETECTED_SELECTION': {
      const { selectedIds } = state.detected;
      const newSelectedIds = selectedIds.includes(action.id)
        ? selectedIds.filter(id => id !== action.id)
        : [...selectedIds, action.id];
      return {
        ...state,
        detected: { ...state.detected, selectedIds: newSelectedIds },
      };
    }

    case 'SELECT_ALL_DETECTED':
      return {
        ...state,
        detected: {
          ...state.detected,
          selectedIds: state.detected.items.map(item => item.id),
        },
      };

    case 'DESELECT_ALL_DETECTED':
      return {
        ...state,
        detected: { ...state.detected, selectedIds: [] },
      };

    // Column mappings
    case 'SET_COLUMN_MAPPINGS':
      return {
        ...state,
        mappings: {
          ...state.mappings,
          columns: action.columns,
          patterns: action.patterns,
        },
      };

    case 'UPDATE_COLUMN_MAPPING': {
      const columns = [...state.mappings.columns];
      columns[action.index] = { ...columns[action.index], ...action.mapping, userOverride: true };
      return {
        ...state,
        mappings: { ...state.mappings, columns },
      };
    }

    case 'SET_AUTO_MAPPED':
      return {
        ...state,
        mappings: { ...state.mappings, autoMapped: action.autoMapped },
      };

    // Exercise matches
    case 'SET_EXERCISE_MATCHES': {
      const allResolved = action.exercises.every(
        e => e.status === 'matched' || e.status === 'new'
      );
      return {
        ...state,
        matches: {
          ...state.matches,
          exercises: action.exercises,
          allResolved,
        },
      };
    }

    case 'UPDATE_EXERCISE_MATCH': {
      const exercises = state.matches.exercises.map(e =>
        e.id === action.id ? { ...e, ...action.updates } : e
      );
      const allResolved = exercises.every(
        e => e.status === 'matched' || e.status === 'new'
      );
      return {
        ...state,
        matches: { ...state.matches, exercises, allResolved },
      };
    }

    case 'SET_ALL_RESOLVED':
      return {
        ...state,
        matches: { ...state.matches, allResolved: action.resolved },
      };

    case 'ADD_NEW_EXERCISE':
      return {
        ...state,
        matches: {
          ...state.matches,
          newExercises: [...state.matches.newExercises, action.exerciseName],
        },
      };

    // Preview
    case 'SET_PREVIEW_WORKOUTS':
      return {
        ...state,
        preview: {
          ...state.preview,
          workouts: action.workouts,
          stats: action.stats,
        },
      };

    case 'SET_VALIDATION_ISSUES':
      return {
        ...state,
        preview: { ...state.preview, validationIssues: action.issues },
      };

    case 'TOGGLE_WORKOUT_SELECTION': {
      const workouts = state.preview.workouts.map(w =>
        w.id === action.id ? { ...w, selected: !w.selected } : w
      );
      const stats = recalculateStats(workouts, state.matches.exercises);
      return {
        ...state,
        preview: { ...state.preview, workouts, stats },
      };
    }

    case 'SELECT_ALL_WORKOUTS': {
      const workouts = state.preview.workouts.map(w => ({ ...w, selected: true }));
      const stats = recalculateStats(workouts, state.matches.exercises);
      return {
        ...state,
        preview: { ...state.preview, workouts, stats },
      };
    }

    case 'DESELECT_ALL_WORKOUTS': {
      const workouts = state.preview.workouts.map(w => ({ ...w, selected: false }));
      const stats = recalculateStats(workouts, state.matches.exercises);
      return {
        ...state,
        preview: { ...state.preview, workouts, stats },
      };
    }

    case 'UPDATE_PREVIEW_WORKOUT':
      if (!state.preview) return state;
      return {
        ...state,
        preview: {
          ...state.preview,
          workouts: state.preview.workouts.map(w =>
            w.id === action.id ? { ...w, workout: action.workout } : w
          ),
        },
      };

    // Import execution
    case 'START_IMPORT':
      return {
        ...state,
        step: 'import',  // Advance to import step to show progress
        import: {
          ...state.import,
          status: 'running',
          progress: 0,
          jobId: action.jobId,
          results: [],
          error: undefined,
          startedAt: new Date().toISOString(),
          completedAt: undefined,
        },
      };

    case 'UPDATE_IMPORT_PROGRESS':
      return {
        ...state,
        import: {
          ...state.import,
          progress: action.progress,
          currentItem: action.currentItem,
        },
      };

    case 'ADD_IMPORT_RESULT':
      return {
        ...state,
        import: {
          ...state.import,
          results: [...state.import.results, action.result],
        },
      };

    case 'SET_IMPORT_RESULTS':
      return {
        ...state,
        import: { ...state.import, results: action.results },
      };

    case 'SET_IMPORT_STATUS':
      return {
        ...state,
        import: {
          ...state.import,
          status: action.status,
          error: action.error,
        },
      };

    case 'COMPLETE_IMPORT':
      return {
        ...state,
        import: {
          ...state.import,
          status: 'complete',
          progress: 100,
          completedAt: new Date().toISOString(),
        },
      };

    // UI state
    case 'SET_LOADING':
      return { ...state, loading: action.loading };

    case 'SET_ERROR':
      return { ...state, error: action.error };

    case 'RESET_STATE':
      return createInitialBulkImportState();

    case 'RESTORE_STATE':
      return { ...createInitialBulkImportState(), ...action.state };

    default:
      return state;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function recalculateStats(
  workouts: PreviewWorkout[],
  exercises: ExerciseMatch[]
): ImportStats {
  const selected = workouts.filter(w => w.selected);
  const validationErrors = workouts.reduce(
    (sum, w) => sum + w.validationIssues.filter(i => i.severity === 'error').length,
    0
  );
  const validationWarnings = workouts.reduce(
    (sum, w) => sum + w.validationIssues.filter(i => i.severity === 'warning').length,
    0
  );

  return {
    totalDetected: workouts.length,
    totalSelected: selected.length,
    totalSkipped: workouts.length - selected.length,
    exercisesMatched: exercises.filter(e => e.status === 'matched').length,
    exercisesNeedingReview: exercises.filter(e => e.status === 'needs_review').length,
    exercisesUnmapped: exercises.filter(e => e.status === 'unmapped').length,
    newExercisesToCreate: exercises.filter(e => e.status === 'new').length,
    estimatedDuration: selected.reduce((sum, w) => sum + (w.estimatedDuration || 0), 0),
    duplicatesFound: workouts.filter(w => w.isDuplicate).length,
    validationErrors,
    validationWarnings,
  };
}

// ============================================================================
// Context
// ============================================================================

interface BulkImportContextValue {
  state: BulkImportState;
  dispatch: React.Dispatch<BulkImportAction>;

  // Navigation helpers
  goNext: () => void;
  goBack: () => void;
  goToStep: (step: BulkImportStep) => void;
  canGoNext: () => boolean;
  canGoBack: () => boolean;

  // Convenience setters
  setInputType: (type: BulkInputType) => void;
  setInputSources: (sources: File[] | string[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const BulkImportContext = createContext<BulkImportContextValue | null>(null);

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEY = 'bulk_import_state';
const STORAGE_VERSION = 13; // Increment to clear all old sessions - v13: exercise type inference
const SESSION_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes - auto-clear stale sessions (backend cache can expire)

interface PersistedState {
  state: Partial<BulkImportState>;
  savedAt: number;
  version: number;
}

function saveStateToStorage(state: BulkImportState): void {
  try {
    // Don't save File objects - they can't be serialized
    const stateToPersist = {
      ...state,
      inputSources: state.inputType === 'file' ? [] : state.inputSources,
    };
    const persisted: PersistedState = {
      state: stateToPersist,
      savedAt: Date.now(),
      version: STORAGE_VERSION,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch (error) {
    console.warn('Failed to save bulk import state to localStorage:', error);
  }
}

function loadStateFromStorage(): Partial<BulkImportState> | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);

      // Check version - clear outdated state
      if (!parsed.version || parsed.version < STORAGE_VERSION) {
        console.log('Bulk import state version outdated, clearing');
        clearStateFromStorage();
        return null;
      }

      // Handle new format with timestamp
      if (parsed.savedAt && parsed.state) {
        const age = Date.now() - parsed.savedAt;
        if (age > SESSION_EXPIRY_MS) {
          console.log('Bulk import session expired, clearing state');
          clearStateFromStorage();
          return null;
        }
        return parsed.state;
      }

      // Handle legacy format (no timestamp) - clear it
      console.log('Legacy bulk import state found, clearing');
      clearStateFromStorage();
      return null;
    }
  } catch (error) {
    console.warn('Failed to load bulk import state from localStorage:', error);
  }
  return null;
}

function clearStateFromStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear bulk import state from localStorage:', error);
  }
}

// ============================================================================
// Provider
// ============================================================================

interface BulkImportProviderProps {
  children: React.ReactNode;
  autoRestore?: boolean;
}

export function BulkImportProvider({
  children,
  autoRestore = true,
}: BulkImportProviderProps): JSX.Element {
  const [state, dispatch] = useReducer(bulkImportReducer, createInitialBulkImportState());

  // Restore state from localStorage on mount
  useEffect(() => {
    if (autoRestore) {
      const savedState = loadStateFromStorage();
      if (savedState && savedState.jobId) {
        // Don't restore if we're in a terminal import state (failed, cancelled, complete)
        // or if we're on the import step - these states require a fresh session
        const importStatus = (savedState as BulkImportState).import?.status;
        const savedStep = (savedState as BulkImportState).step;

        if (savedStep === 'import' ||
            importStatus === 'failed' ||
            importStatus === 'cancelled' ||
            importStatus === 'complete') {
          console.log('Clearing stale import session - was in terminal state');
          clearStateFromStorage();
          return;
        }

        // Only restore if there's an active job on an early step
        dispatch({ type: 'RESTORE_STATE', state: savedState });
      }
    }
  }, [autoRestore]);

  // Persist state on step changes
  useEffect(() => {
    if (state.jobId) {
      saveStateToStorage(state);
    }
  }, [state.step, state.jobId]);

  // Navigation helpers
  const goNext = useCallback(() => {
    dispatch({ type: 'GO_NEXT' });
  }, []);

  const goBack = useCallback(() => {
    dispatch({ type: 'GO_BACK' });
  }, []);

  const goToStep = useCallback((step: BulkImportStep) => {
    dispatch({ type: 'SET_STEP', step });
  }, []);

  const canGoNext = useCallback(() => {
    return canProceedFromStep(state.step, state);
  }, [state]);

  const canGoBack = useCallback(() => {
    const currentIndex = state.activeSteps.indexOf(state.step);
    return currentIndex > 0;
  }, [state.activeSteps, state.step]);

  // Convenience setters
  const setInputType = useCallback((inputType: BulkInputType) => {
    dispatch({ type: 'SET_INPUT_TYPE', inputType });
  }, []);

  const setInputSources = useCallback((sources: File[] | string[]) => {
    dispatch({ type: 'SET_INPUT_SOURCES', sources });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', loading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', error });
  }, []);

  const reset = useCallback(() => {
    clearStateFromStorage();
    dispatch({ type: 'RESET_STATE' });
  }, []);

  const value: BulkImportContextValue = {
    state,
    dispatch,
    goNext,
    goBack,
    goToStep,
    canGoNext,
    canGoBack,
    setInputType,
    setInputSources,
    setLoading,
    setError,
    reset,
  };

  return (
    <BulkImportContext.Provider value={value}>
      {children}
    </BulkImportContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useBulkImport(): BulkImportContextValue {
  const context = useContext(BulkImportContext);
  if (!context) {
    throw new Error('useBulkImport must be used within a BulkImportProvider');
  }
  return context;
}

// ============================================================================
// Exports
// ============================================================================

export type { BulkImportAction, BulkImportContextValue };
