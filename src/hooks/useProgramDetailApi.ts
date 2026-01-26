/**
 * useProgramDetailApi Hook
 *
 * Handles API interactions for the Program Detail view.
 * Provides methods for loading, updating, and managing training programs.
 */

import { useEffect, useCallback, useRef } from 'react';
import { useProgramDetail } from '../context/ProgramDetailContext';
import {
  getTrainingProgram,
  updateProgramStatus,
  updateProgramProgress,
  deleteTrainingProgram,
  markWorkoutComplete as markWorkoutCompleteApi,
} from '../lib/training-program-api';
import type { ProgramStatus } from '../types/training-program';

interface UseProgramDetailApiOptions {
  programId: string;
  userId: string;
  onDeleted?: () => void;
}

interface UseProgramDetailApiReturn {
  // State from context
  program: ReturnType<typeof useProgramDetail>['program'];
  selectedWeek: ReturnType<typeof useProgramDetail>['selectedWeek'];
  selectedWorkout: ReturnType<typeof useProgramDetail>['selectedWorkout'];
  isLoading: boolean;
  error: string | null;

  // Actions
  selectWeek: (weekNumber: number) => void;
  selectWorkout: ReturnType<typeof useProgramDetail>['selectWorkout'];
  refreshProgram: () => Promise<void>;
  updateStatus: (status: ProgramStatus) => Promise<boolean>;
  advanceWeek: () => Promise<boolean>;
  deleteProgram: () => Promise<boolean>;
  markWorkoutComplete: (workoutId: string, isCompleted?: boolean) => Promise<boolean>;
}

export function useProgramDetailApi({
  programId,
  userId,
  onDeleted,
}: UseProgramDetailApiOptions): UseProgramDetailApiReturn {
  const {
    program,
    selectedWeek,
    selectedWorkout,
    isLoading,
    error,
    setProgram,
    clearProgram,
    selectWeek,
    selectWorkout,
    setLoading,
    setError,
    updateStatus: updateStatusInContext,
    updateCurrentWeek,
    markWorkoutComplete: markWorkoutCompleteInContext,
  } = useProgramDetail();

  // Track mounted state to prevent stale updates
  const isMountedRef = useRef(true);
  const loadIdRef = useRef(0);

  // Load program on mount
  const loadProgram = useCallback(async () => {
    if (!programId || !userId) return;

    // Increment load ID to track which load is current
    const currentLoadId = ++loadIdRef.current;

    setLoading(true);
    setError(null);

    try {
      const programData = await getTrainingProgram(programId, userId);

      // Only update state if this is still the current load and component is mounted
      if (currentLoadId !== loadIdRef.current || !isMountedRef.current) {
        return;
      }

      if (programData) {
        setProgram(programData);
      } else {
        setError('Program not found');
      }
    } catch (err) {
      // Only update state if this is still the current load and component is mounted
      if (currentLoadId !== loadIdRef.current || !isMountedRef.current) {
        return;
      }
      console.error('[useProgramDetailApi] Error loading program:', err);
      setError(err instanceof Error ? err.message : 'Failed to load program');
    } finally {
      // Only update loading state if this is still the current load and component is mounted
      if (currentLoadId === loadIdRef.current && isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [programId, userId, setProgram, setLoading, setError]);

  // Load on mount, cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    loadProgram();

    return () => {
      isMountedRef.current = false;
      clearProgram();
    };
  }, [loadProgram, clearProgram]);

  // Refresh program data
  const refreshProgram = useCallback(async () => {
    await loadProgram();
  }, [loadProgram]);

  // Update program status
  const updateStatus = useCallback(
    async (status: ProgramStatus): Promise<boolean> => {
      if (!programId || !userId) return false;

      setLoading(true);
      try {
        const success = await updateProgramStatus(programId, userId, status);
        if (success) {
          updateStatusInContext(status);
        }
        return success;
      } catch (err) {
        console.error('[useProgramDetailApi] Error updating status:', err);
        setError(err instanceof Error ? err.message : 'Failed to update status');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [programId, userId, updateStatusInContext, setLoading, setError]
  );

  // Advance to next week
  const advanceWeek = useCallback(async (): Promise<boolean> => {
    if (!program || !userId) return false;

    const nextWeek = program.current_week + 1;
    if (nextWeek > program.duration_weeks) {
      // Program complete
      return updateStatus('completed');
    }

    setLoading(true);
    try {
      const success = await updateProgramProgress(programId, userId, nextWeek);
      if (success) {
        updateCurrentWeek(nextWeek);
        selectWeek(nextWeek);
      }
      return success;
    } catch (err) {
      console.error('[useProgramDetailApi] Error advancing week:', err);
      setError(err instanceof Error ? err.message : 'Failed to advance week');
      return false;
    } finally {
      setLoading(false);
    }
  }, [program, programId, userId, updateCurrentWeek, selectWeek, updateStatus, setLoading, setError]);

  // Delete program
  const deleteProgram = useCallback(async (): Promise<boolean> => {
    if (!programId || !userId) return false;

    setLoading(true);
    try {
      const success = await deleteTrainingProgram(programId, userId);
      if (success) {
        clearProgram();
        onDeleted?.();
      }
      return success;
    } catch (err) {
      console.error('[useProgramDetailApi] Error deleting program:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete program');
      return false;
    } finally {
      setLoading(false);
    }
  }, [programId, userId, clearProgram, onDeleted, setLoading, setError]);

  // Mark workout complete
  const markWorkoutComplete = useCallback(
    async (workoutId: string, isCompleted: boolean = true): Promise<boolean> => {
      if (!userId) return false;

      try {
        const success = await markWorkoutCompleteApi(workoutId, userId, isCompleted);
        if (success) {
          markWorkoutCompleteInContext(workoutId, isCompleted);
        }
        return success;
      } catch (err) {
        console.error('[useProgramDetailApi] Error marking workout complete:', err);
        setError(err instanceof Error ? err.message : 'Failed to update workout');
        return false;
      }
    },
    [userId, markWorkoutCompleteInContext, setError]
  );

  return {
    program,
    selectedWeek,
    selectedWorkout,
    isLoading,
    error,
    selectWeek,
    selectWorkout,
    refreshProgram,
    updateStatus,
    advanceWeek,
    deleteProgram,
    markWorkoutComplete,
  };
}
