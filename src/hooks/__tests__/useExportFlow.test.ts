/**
 * Unit tests for useExportFlow hook
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExportWorkoutToDevice, mockSaveWorkoutToHistory, mockCheckMapperApiHealth } = vi.hoisted(() => ({
  mockExportWorkoutToDevice: vi.fn().mockResolvedValue({ yaml: 'export-result' }),
  mockSaveWorkoutToHistory: vi.fn().mockResolvedValue(undefined),
  mockCheckMapperApiHealth: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../lib/mapper-api', () => ({
  exportWorkoutToDevice: mockExportWorkoutToDevice,
  checkMapperApiHealth: mockCheckMapperApiHealth,
  saveUserMapping: vi.fn().mockResolvedValue({ message: 'ok' }),
  validateWorkoutMapping: vi.fn().mockResolvedValue({
    validated_exercises: [],
    needs_review: [],
    unmapped_exercises: [],
    can_proceed: true,
  }),
}));

vi.mock('../../lib/workout-history', () => ({
  saveWorkoutToHistory: mockSaveWorkoutToHistory,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { useExportFlow } from '../useExportFlow';
import type { WorkoutStructure } from '../../types/workout';

const MOCK_USER_ID = 'user-123';

const SIMPLE_WORKOUT: WorkoutStructure = {
  title: 'Test Workout',
  blocks: [
    {
      label: 'Main',
      structure: 'regular',
      exercises: [{ id: 'e1', name: 'Squat', sets: 3, reps: 10, reps_range: null, duration_sec: null, rest_sec: 60, distance_m: null, distance_range: null, type: 'strength' }],
    },
  ],
};

const COMPLEX_WORKOUT: WorkoutStructure = {
  title: 'EMOM Workout',
  blocks: [
    {
      label: 'EMOM Block',
      structure: 'emom',
      exercises: [{ id: 'e2', name: 'Burpees', sets: 1, reps: 10, reps_range: null, duration_sec: 60, rest_sec: null, distance_m: null, distance_range: null, type: 'HIIT' }],
    },
  ],
};

describe('useExportFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initialises with empty queue and default destination', () => {
    const { result } = renderHook(() => useExportFlow({ userId: MOCK_USER_ID }));
    expect(result.current.queue).toHaveLength(0);
    expect(result.current.destination).toBe('garmin');
    expect(result.current.loading).toBe(false);
  });

  it('addToQueue adds a workout with pending status', () => {
    const { result } = renderHook(() => useExportFlow({ userId: MOCK_USER_ID }));
    act(() => { result.current.addToQueue(SIMPLE_WORKOUT); });
    expect(result.current.queue).toHaveLength(1);
    expect(result.current.queue[0].status).toBe('pending');
    expect(result.current.queue[0].workout.title).toBe('Test Workout');
  });

  it('removeFromQueue removes by workoutId', () => {
    const { result } = renderHook(() => useExportFlow({ userId: MOCK_USER_ID }));
    act(() => { result.current.addToQueue(SIMPLE_WORKOUT); });
    const id = result.current.queue[0].workoutId;
    act(() => { result.current.removeFromQueue(id); });
    expect(result.current.queue).toHaveLength(0);
  });

  it('setDestination updates destination', () => {
    const { result } = renderHook(() => useExportFlow({ userId: MOCK_USER_ID }));
    act(() => { result.current.setDestination('apple'); });
    expect(result.current.destination).toBe('apple');
  });

  it('detectConflicts returns empty array for simple workout on Garmin', () => {
    const { result } = renderHook(() => useExportFlow({ userId: MOCK_USER_ID }));
    const conflicts = result.current.detectConflicts(SIMPLE_WORKOUT, 'garmin');
    expect(conflicts).toHaveLength(0);
  });

  it('detectConflicts returns conflict for EMOM block on Garmin', () => {
    const { result } = renderHook(() => useExportFlow({ userId: MOCK_USER_ID }));
    const conflicts = result.current.detectConflicts(COMPLEX_WORKOUT, 'garmin');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].structure).toBe('emom');
    expect(conflicts[0].blockLabel).toBe('EMOM Block');
  });

  it('detectConflicts returns empty for no-mapping device (apple)', () => {
    const { result } = renderHook(() => useExportFlow({ userId: MOCK_USER_ID }));
    const conflicts = result.current.detectConflicts(COMPLEX_WORKOUT, 'apple');
    expect(conflicts).toHaveLength(0);
  });

  it('exportInline calls export + save + toast', async () => {
    const { toast } = await import('sonner');
    const { result } = renderHook(() => useExportFlow({ userId: MOCK_USER_ID }));

    await act(async () => {
      await result.current.exportInline(SIMPLE_WORKOUT, 'apple', MOCK_USER_ID);
    });

    expect(mockExportWorkoutToDevice).toHaveBeenCalledWith(SIMPLE_WORKOUT, 'apple', null);
    expect(mockSaveWorkoutToHistory).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalled();
  });

  it('resolveMapping stores the mapping', () => {
    const { result } = renderHook(() => useExportFlow({ userId: MOCK_USER_ID }));
    act(() => { result.current.resolveMapping('Squat', 'Squat (Barbell)'); });
    expect(result.current.mappings['Squat']).toBe('Squat (Barbell)');
  });
});
