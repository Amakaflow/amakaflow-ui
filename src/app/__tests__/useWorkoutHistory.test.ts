import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/workout-history', () => ({
  getWorkoutHistory: vi.fn(),
  getWorkoutHistoryFromLocalStorage: vi.fn().mockReturnValue([]),
}));

import { useWorkoutHistory } from '../useWorkoutHistory';
import { getWorkoutHistory, getWorkoutHistoryFromLocalStorage } from '../../lib/workout-history';

const mockGetHistory = vi.mocked(getWorkoutHistory);
const mockLocalHistory = vi.mocked(getWorkoutHistoryFromLocalStorage);

describe('useWorkoutHistory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty list when user is null', async () => {
    const { result } = renderHook(() => useWorkoutHistory(null));
    // Give the effect time to settle
    await waitFor(() => expect(mockGetHistory).not.toHaveBeenCalled());
    expect(result.current.workoutHistoryList).toEqual([]);
  });

  it('loads history from API when user is provided', async () => {
    const fakeHistory = [{ id: '1', title: 'Push Day' }];
    mockGetHistory.mockResolvedValue(fakeHistory);
    const user = { id: 'user-123' } as any;
    const { result } = renderHook(() => useWorkoutHistory(user));
    await waitFor(() => expect(result.current.workoutHistoryList).toEqual(fakeHistory));
    expect(mockGetHistory).toHaveBeenCalledWith('user-123');
  });

  it('falls back to localStorage when API fails', async () => {
    const localHistory = [{ id: '2', title: 'Pull Day' }];
    mockGetHistory.mockRejectedValue(new Error('network error'));
    mockLocalHistory.mockReturnValue(localHistory);
    const user = { id: 'user-456' } as any;
    const { result } = renderHook(() => useWorkoutHistory(user));
    await waitFor(() => expect(result.current.workoutHistoryList).toEqual(localHistory));
  });

  it('refreshHistory reloads from API', async () => {
    const initial = [{ id: '1' }];
    const updated = [{ id: '1' }, { id: '2' }];
    mockGetHistory.mockResolvedValueOnce(initial).mockResolvedValueOnce(updated);
    const user = { id: 'user-789' } as any;
    const { result } = renderHook(() => useWorkoutHistory(user));
    await waitFor(() => expect(result.current.workoutHistoryList).toEqual(initial));
    await act(async () => {
      await result.current.refreshHistory();
    });
    expect(result.current.workoutHistoryList).toEqual(updated);
  });
});
