'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useProgramWizard } from '@/context/ProgramWizardContext';
import { programGenerationApi } from '@/lib/program-generation-api';
import { ProgramGenerationRequest, getEquipmentForState } from '@/types/program-wizard';

const POLL_INTERVAL = 2000; // 2 seconds

interface UseProgramGenerationApiOptions {
  userId: string;
  onComplete?: (programId: string) => void;
  onError?: (error: string) => void;
}

export function useProgramGenerationApi({
  userId,
  onComplete,
  onError,
}: UseProgramGenerationApiOptions) {
  const {
    state,
    startGeneration,
    updateGenerationProgress,
    generationComplete,
    generationFailed,
    clearGenerationError,
  } = useProgramWizard();

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      stopPolling();
      abortControllerRef.current?.abort();
    };
  }, [stopPolling]);

  const pollStatus = useCallback(
    async (jobId: string) => {
      try {
        const status = await programGenerationApi.getGenerationStatus(jobId);

        if (status.status === 'completed' && status.program_id) {
          stopPolling();
          generationComplete(status.program_id);
          onComplete?.(status.program_id);
        } else if (status.status === 'failed') {
          stopPolling();
          const errorMessage = status.error || 'Program generation failed';
          generationFailed(errorMessage);
          onError?.(errorMessage);
        } else {
          // Update progress and continue polling
          if (status.progress !== undefined) {
            updateGenerationProgress(status.progress);
          }
          pollingRef.current = setTimeout(() => pollStatus(jobId), POLL_INTERVAL);
        }
      } catch (error) {
        stopPolling();
        const errorMessage = error instanceof Error ? error.message : 'Failed to check generation status';
        generationFailed(errorMessage);
        onError?.(errorMessage);
      }
    },
    [stopPolling, generationComplete, generationFailed, updateGenerationProgress, onComplete, onError]
  );

  const generate = useCallback(async () => {
    // Clear any previous error before starting
    clearGenerationError();

    if (!state.goal || !state.experienceLevel) {
      const error = 'Missing required fields';
      generationFailed(error);
      onError?.(error);
      return;
    }

    const equipment = getEquipmentForState(state);

    const request: ProgramGenerationRequest = {
      user_id: userId,
      goal: state.goal,
      experience_level: state.experienceLevel,
      duration_weeks: state.durationWeeks,
      sessions_per_week: state.sessionsPerWeek,
      preferred_days: state.preferredDays,
      time_per_session: state.timePerSession,
      equipment,
    };

    // Add optional fields
    if (state.injuries.trim()) {
      request.injuries = state.injuries.trim();
    }
    if (state.focusAreas.length > 0) {
      request.focus_areas = state.focusAreas;
    }
    if (state.avoidExercises.length > 0) {
      request.avoid_exercises = state.avoidExercises;
    }

    try {
      const response = await programGenerationApi.generateProgram(request);

      if (response.status === 'failed') {
        const errorMessage = response.error || 'Program generation failed';
        generationFailed(errorMessage);
        onError?.(errorMessage);
        return;
      }

      startGeneration(response.job_id);

      // Start polling for status
      pollingRef.current = setTimeout(() => pollStatus(response.job_id), POLL_INTERVAL);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start program generation';
      generationFailed(errorMessage);
      onError?.(errorMessage);
    }
  }, [
    state,
    userId,
    startGeneration,
    generationFailed,
    clearGenerationError,
    pollStatus,
    onError,
  ]);

  const cancel = useCallback(() => {
    stopPolling();
    abortControllerRef.current?.abort();
  }, [stopPolling]);

  return {
    generate,
    cancel,
    isGenerating: state.isGenerating,
    progress: state.generationProgress,
    error: state.generationError,
    programId: state.generatedProgramId,
  };
}
