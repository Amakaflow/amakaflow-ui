import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useWorkoutList } from '../useWorkoutList';

vi.mock('../../../../lib/unified-workouts', () => ({
  fetchAllWorkouts: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../../../lib/workout-api', () => ({
  getUserTags: vi.fn().mockResolvedValue([]),
  toggleWorkoutFavorite: vi.fn(),
  updateWorkoutTags: vi.fn(),
  saveWorkoutToAPI: vi.fn(),
}));
vi.mock('../../../../lib/completions-api', () => ({
  fetchWorkoutCompletions: vi.fn().mockResolvedValue({ completions: [], total: 0 }),
}));
vi.mock('../../../../lib/workout-history', () => ({
  deleteWorkoutFromHistory: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../../lib/follow-along-api', () => ({
  deleteFollowAlong: vi.fn().mockResolvedValue(undefined),
}));

const defaultProps = {
  profileId: 'user-1',
  onEditWorkout: vi.fn(),
  onLoadWorkout: vi.fn(),
  onDeleteWorkout: vi.fn(),
};

describe('useWorkoutList', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('initialises with loading true and empty workouts', async () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.allWorkouts).toEqual([]);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('toggleSelect adds id to selectedIds', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    act(() => { result.current.toggleSelect('w-1'); });
    expect(result.current.selectedIds).toContain('w-1');
  });

  it('toggleSelect removes already-selected id', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    act(() => { result.current.toggleSelect('w-1'); });
    act(() => { result.current.toggleSelect('w-1'); });
    expect(result.current.selectedIds).not.toContain('w-1');
  });

  it('clearSelection resets selectedIds to empty', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    act(() => { result.current.toggleSelect('w-1'); });
    act(() => { result.current.clearSelection(); });
    expect(result.current.selectedIds).toHaveLength(0);
  });

  it('handleDeleteClick sets confirmDeleteId', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    act(() => { result.current.handleDeleteClick('w-42'); });
    expect(result.current.confirmDeleteId).toBe('w-42');
  });

  it('handleDeleteCancel clears confirmDeleteId', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    act(() => { result.current.handleDeleteClick('w-42'); });
    act(() => { result.current.handleDeleteCancel(); });
    expect(result.current.confirmDeleteId).toBeNull();
  });

  it('handleBulkDeleteClick sets pendingDeleteIds and shows modal', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    act(() => { result.current.handleBulkDeleteClick(['w-1', 'w-2']); });
    expect(result.current.pendingDeleteIds).toEqual(['w-1', 'w-2']);
    expect(result.current.showDeleteModal).toBe(true);
  });

  it('cancelBulkDelete clears pending state', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    act(() => { result.current.handleBulkDeleteClick(['w-1']); });
    act(() => { result.current.cancelBulkDelete(); });
    expect(result.current.showDeleteModal).toBe(false);
    expect(result.current.pendingDeleteIds).toHaveLength(0);
  });

  it('viewMode defaults to compact', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    expect(result.current.viewMode).toBe('compact');
  });
});
