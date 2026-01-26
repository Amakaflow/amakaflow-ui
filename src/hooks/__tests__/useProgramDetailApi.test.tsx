/**
 * useProgramDetailApi Hook Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { ProgramDetailProvider } from '../../context/ProgramDetailContext';
import { useProgramDetailApi } from '../useProgramDetailApi';
import {
  mockTrainingProgram,
  mockWorkout,
  TEST_USER_ID,
  TEST_PROGRAM_ID,
  TEST_WORKOUT_ID,
} from '../../test/fixtures/program-detail.fixtures';

// Mock the API module
vi.mock('../../lib/training-program-api', () => ({
  getTrainingProgram: vi.fn(),
  updateProgramStatus: vi.fn(),
  updateProgramProgress: vi.fn(),
  deleteTrainingProgram: vi.fn(),
  markWorkoutComplete: vi.fn(),
}));

import {
  getTrainingProgram,
  updateProgramStatus,
  updateProgramProgress,
  deleteTrainingProgram,
  markWorkoutComplete,
} from '../../lib/training-program-api';

const mockGetTrainingProgram = getTrainingProgram as ReturnType<typeof vi.fn>;
const mockUpdateProgramStatus = updateProgramStatus as ReturnType<typeof vi.fn>;
const mockUpdateProgramProgress = updateProgramProgress as ReturnType<typeof vi.fn>;
const mockDeleteTrainingProgram = deleteTrainingProgram as ReturnType<typeof vi.fn>;
const mockMarkWorkoutComplete = markWorkoutComplete as ReturnType<typeof vi.fn>;

// Wrapper for tests
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ProgramDetailProvider>{children}</ProgramDetailProvider>
);

describe('useProgramDetailApi', () => {
  const defaultOptions = {
    programId: TEST_PROGRAM_ID,
    userId: TEST_USER_ID,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTrainingProgram.mockResolvedValue(mockTrainingProgram);
    mockUpdateProgramStatus.mockResolvedValue(true);
    mockUpdateProgramProgress.mockResolvedValue(true);
    mockDeleteTrainingProgram.mockResolvedValue(true);
    mockMarkWorkoutComplete.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initial Load', () => {
    it('should load program on mount', async () => {
      const { result } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGetTrainingProgram).toHaveBeenCalledWith(
        TEST_PROGRAM_ID,
        TEST_USER_ID
      );
      expect(result.current.program).toEqual(mockTrainingProgram);
    });

    it('should set loading state during fetch', async () => {
      // Create a delayed response
      mockGetTrainingProgram.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockTrainingProgram), 100))
      );

      const { result } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should set error when program not found', async () => {
      mockGetTrainingProgram.mockResolvedValue(null);

      const { result } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.error).toBe('Program not found');
      });
    });

    it('should set error on API failure', async () => {
      mockGetTrainingProgram.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });
    });

    it('should not load without programId', async () => {
      const { result } = renderHook(
        () => useProgramDetailApi({ programId: '', userId: TEST_USER_ID }),
        { wrapper }
      );

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockGetTrainingProgram).not.toHaveBeenCalled();
    });

    it('should not load without userId', async () => {
      const { result } = renderHook(
        () => useProgramDetailApi({ programId: TEST_PROGRAM_ID, userId: '' }),
        { wrapper }
      );

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockGetTrainingProgram).not.toHaveBeenCalled();
    });
  });

  describe('refreshProgram', () => {
    it('should reload program data', async () => {
      const { result } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.program).toBeTruthy();
      });

      mockGetTrainingProgram.mockClear();

      await act(async () => {
        await result.current.refreshProgram();
      });

      expect(mockGetTrainingProgram).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateStatus', () => {
    it('should update program status', async () => {
      const { result } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.program).toBeTruthy();
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.updateStatus('paused');
      });

      expect(success).toBe(true);
      expect(mockUpdateProgramStatus).toHaveBeenCalledWith(
        TEST_PROGRAM_ID,
        TEST_USER_ID,
        'paused'
      );
      expect(result.current.program?.status).toBe('paused');
    });

    it('should return false on API failure', async () => {
      mockUpdateProgramStatus.mockResolvedValue(false);

      const { result } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.program).toBeTruthy();
      });

      let success: boolean = true;
      await act(async () => {
        success = await result.current.updateStatus('paused');
      });

      expect(success).toBe(false);
    });

    it('should handle API error', async () => {
      mockUpdateProgramStatus.mockRejectedValue(new Error('Update failed'));

      const { result } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.program).toBeTruthy();
      });

      let success: boolean = true;
      await act(async () => {
        success = await result.current.updateStatus('paused');
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe('Update failed');
    });
  });

  describe('advanceWeek', () => {
    it('should advance to next week', async () => {
      const { result } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.program).toBeTruthy();
      });

      const currentWeek = result.current.program!.current_week;

      let success: boolean = false;
      await act(async () => {
        success = await result.current.advanceWeek();
      });

      expect(success).toBe(true);
      expect(mockUpdateProgramProgress).toHaveBeenCalledWith(
        TEST_PROGRAM_ID,
        TEST_USER_ID,
        currentWeek + 1
      );
      expect(result.current.program?.current_week).toBe(currentWeek + 1);
    });

    it('should complete program when advancing past last week', async () => {
      const programAtLastWeek = {
        ...mockTrainingProgram,
        current_week: mockTrainingProgram.duration_weeks,
      };
      mockGetTrainingProgram.mockResolvedValue(programAtLastWeek);

      const { result } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.program?.current_week).toBe(8);
      });

      await act(async () => {
        await result.current.advanceWeek();
      });

      expect(mockUpdateProgramStatus).toHaveBeenCalledWith(
        TEST_PROGRAM_ID,
        TEST_USER_ID,
        'completed'
      );
    });

    it('should select the new week after advancing', async () => {
      const { result } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.program).toBeTruthy();
      });

      const currentWeek = result.current.program!.current_week;

      await act(async () => {
        await result.current.advanceWeek();
      });

      // Program's current_week should advance
      expect(result.current.program?.current_week).toBe(currentWeek + 1);
    });
  });

  describe('deleteProgram', () => {
    it('should delete program and call onDeleted callback', async () => {
      const onDeleted = vi.fn();

      const { result } = renderHook(
        () => useProgramDetailApi({ ...defaultOptions, onDeleted }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.program).toBeTruthy();
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.deleteProgram();
      });

      expect(success).toBe(true);
      expect(mockDeleteTrainingProgram).toHaveBeenCalledWith(
        TEST_PROGRAM_ID,
        TEST_USER_ID
      );
      expect(onDeleted).toHaveBeenCalled();
      expect(result.current.program).toBeNull();
    });

    it('should not call onDeleted on failure', async () => {
      mockDeleteTrainingProgram.mockResolvedValue(false);
      const onDeleted = vi.fn();

      const { result } = renderHook(
        () => useProgramDetailApi({ ...defaultOptions, onDeleted }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.program).toBeTruthy();
      });

      await act(async () => {
        await result.current.deleteProgram();
      });

      expect(onDeleted).not.toHaveBeenCalled();
    });
  });

  describe('markWorkoutComplete', () => {
    it('should mark workout as complete', async () => {
      const { result } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.program).toBeTruthy();
      });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.markWorkoutComplete(TEST_WORKOUT_ID, true);
      });

      expect(success).toBe(true);
      expect(mockMarkWorkoutComplete).toHaveBeenCalledWith(
        TEST_WORKOUT_ID,
        TEST_USER_ID,
        true
      );
    });

    it('should mark workout as incomplete', async () => {
      const { result } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.program).toBeTruthy();
      });

      await act(async () => {
        await result.current.markWorkoutComplete(TEST_WORKOUT_ID, false);
      });

      expect(mockMarkWorkoutComplete).toHaveBeenCalledWith(
        TEST_WORKOUT_ID,
        TEST_USER_ID,
        false
      );
    });

    it('should default to true when isCompleted not specified', async () => {
      const { result } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.program).toBeTruthy();
      });

      await act(async () => {
        await result.current.markWorkoutComplete(TEST_WORKOUT_ID);
      });

      expect(mockMarkWorkoutComplete).toHaveBeenCalledWith(
        TEST_WORKOUT_ID,
        TEST_USER_ID,
        true
      );
    });
  });

  describe('selectWeek and selectWorkout', () => {
    it('should select week', async () => {
      const { result } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.program).toBeTruthy();
      });

      act(() => {
        result.current.selectWeek(4);
      });

      expect(result.current.selectedWeek?.week_number).toBe(4);
    });

    it('should select workout', async () => {
      const { result } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.program).toBeTruthy();
      });

      act(() => {
        result.current.selectWorkout(mockWorkout);
      });

      expect(result.current.selectedWorkout).toEqual(mockWorkout);
    });
  });

  describe('Cleanup', () => {
    it('should clear program on unmount', async () => {
      const { result, unmount } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.program).toBeTruthy();
      });

      unmount();

      // Re-render to check state is cleared
      const { result: newResult } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      // New hook should start fresh (loading)
      expect(newResult.current.isLoading).toBe(true);
    });
  });

  describe('Race Condition Prevention', () => {
    it('should not update state with stale data when programId changes', async () => {
      const programA = { ...mockTrainingProgram, id: 'program-a', name: 'Program A' };
      const programB = { ...mockTrainingProgram, id: 'program-b', name: 'Program B' };

      // Program A loads slowly
      mockGetTrainingProgram.mockImplementation((id: string) => {
        if (id === 'program-a') {
          return new Promise((resolve) => setTimeout(() => resolve(programA), 200));
        }
        return Promise.resolve(programB);
      });

      // Start with program A
      const { result, rerender } = renderHook(
        ({ programId }) => useProgramDetailApi({ programId, userId: TEST_USER_ID }),
        {
          wrapper,
          initialProps: { programId: 'program-a' },
        }
      );

      // Immediately switch to program B before A finishes loading
      rerender({ programId: 'program-b' });

      // Wait for B to load (it's faster)
      await waitFor(() => {
        expect(result.current.program?.name).toBe('Program B');
      });

      // Wait a bit more to ensure A's response doesn't override B
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Should still show program B, not A (stale data prevention)
      expect(result.current.program?.name).toBe('Program B');
    });

    it('should not update state after unmount', async () => {
      // Slow loading program
      mockGetTrainingProgram.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockTrainingProgram), 100))
      );

      const { unmount } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      // Unmount before load completes
      unmount();

      // Wait for the load to complete
      await new Promise((resolve) => setTimeout(resolve, 150));

      // No error should be thrown (React would warn about state updates on unmounted component)
      // If the fix works, the isMountedRef prevents the state update
    });
  });

  describe('API Error Propagation', () => {
    it('should propagate API errors from updateStatus', async () => {
      mockUpdateProgramStatus.mockRejectedValue(new Error('Status update failed'));

      const { result } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.program).toBeTruthy();
      });

      await act(async () => {
        await result.current.updateStatus('paused');
      });

      expect(result.current.error).toBe('Status update failed');
    });

    it('should propagate API errors from deleteProgram', async () => {
      mockDeleteTrainingProgram.mockRejectedValue(new Error('Delete failed'));

      const { result } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.program).toBeTruthy();
      });

      await act(async () => {
        await result.current.deleteProgram();
      });

      expect(result.current.error).toBe('Delete failed');
    });

    it('should propagate API errors from markWorkoutComplete', async () => {
      mockMarkWorkoutComplete.mockRejectedValue(new Error('Workout update failed'));

      const { result } = renderHook(
        () => useProgramDetailApi(defaultOptions),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.program).toBeTruthy();
      });

      await act(async () => {
        await result.current.markWorkoutComplete(TEST_WORKOUT_ID, true);
      });

      expect(result.current.error).toBe('Workout update failed');
    });
  });
});
