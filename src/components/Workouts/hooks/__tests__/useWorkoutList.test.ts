import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useWorkoutList } from '../useWorkoutList';
import type { UnifiedWorkout } from '../../../../types/unified-workout';

vi.mock('../../../../lib/unified-workouts', () => ({
  fetchAllWorkouts: vi.fn().mockResolvedValue({ workouts: [], errors: [] }),
}));
vi.mock('../../../../lib/workout-api', () => ({
  getUserTags: vi.fn().mockResolvedValue([]),
  toggleWorkoutFavorite: vi.fn().mockResolvedValue(undefined),
  updateWorkoutTags: vi.fn(),
  saveWorkoutToAPI: vi.fn(),
}));
vi.mock('../../../../lib/completions-api', () => ({
  fetchWorkoutCompletions: vi.fn().mockResolvedValue({ completions: [], total: 0 }),
}));
vi.mock('../../../../lib/workout-history', () => ({
  deleteWorkoutFromHistory: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../../../lib/follow-along-api', () => ({
  deleteFollowAlong: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock('../../../../lib/export-api', () => ({
  exportAndDownload: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
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

  // ---------------------------------------------------------------------------
  // View mode transitions
  // ---------------------------------------------------------------------------

  it('setViewMode("cards") changes viewMode to cards', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    act(() => { result.current.setViewMode('cards'); });
    expect(result.current.viewMode).toBe('cards');
  });

  it('setViewMode("compact") changes viewMode to compact after switching to cards', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    act(() => { result.current.setViewMode('cards'); });
    act(() => { result.current.setViewMode('compact'); });
    expect(result.current.viewMode).toBe('compact');
  });

  // ---------------------------------------------------------------------------
  // Search and filter state setters
  // ---------------------------------------------------------------------------

  it('setSearchQuery updates searchQuery', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    act(() => { result.current.setSearchQuery('test'); });
    expect(result.current.searchQuery).toBe('test');
  });

  it('setSourceFilter updates sourceFilter to history', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    act(() => { result.current.setSourceFilter('history'); });
    expect(result.current.sourceFilter).toBe('history');
  });

  it('setSourceFilter updates sourceFilter to video', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    act(() => { result.current.setSourceFilter('video'); });
    expect(result.current.sourceFilter).toBe('video');
  });

  it('setSortOption updates sortOption to oldest', () => {
    const { result } = renderHook(() => useWorkoutList(defaultProps));
    act(() => { result.current.setSortOption('oldest'); });
    expect(result.current.sortOption).toBe('oldest');
  });

  // ---------------------------------------------------------------------------
  // toggleSelectAll
  // ---------------------------------------------------------------------------

  const makeHistoryWorkout = (id: string): UnifiedWorkout => ({
    id,
    title: `Workout ${id}`,
    category: 'strength',
    sourceType: 'manual',
    durationSec: 3600,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    exerciseCount: 1,
    exerciseNames: ['Squat'],
    syncStatus: {},
    searchableText: `workout ${id}`,
    isFavorite: false,
    timesCompleted: 0,
    tags: [],
    _original: {
      type: 'history',
      data: {
        id,
        workout: { title: `Workout ${id}`, source: 'manual', blocks: [] },
        sources: [],
        device: 'garmin',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      } as any,
    },
  });

  it('toggleSelectAll selects all displayed workout IDs when none are selected', async () => {
    const { fetchAllWorkouts } = await import('../../../../lib/unified-workouts');
    const w1 = makeHistoryWorkout('w-1');
    const w2 = makeHistoryWorkout('w-2');
    vi.mocked(fetchAllWorkouts).mockResolvedValueOnce({ workouts: [w1, w2], errors: [] } as any);

    const { result } = renderHook(() => useWorkoutList(defaultProps));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.displayedWorkouts).toHaveLength(2);

    act(() => { result.current.toggleSelectAll(); });

    expect(result.current.selectedIds).toContain('w-1');
    expect(result.current.selectedIds).toContain('w-2');
  });

  it('toggleSelectAll deselects all displayed workouts when all are already selected', async () => {
    const { fetchAllWorkouts } = await import('../../../../lib/unified-workouts');
    const w1 = makeHistoryWorkout('w-1');
    const w2 = makeHistoryWorkout('w-2');
    vi.mocked(fetchAllWorkouts).mockResolvedValueOnce({ workouts: [w1, w2], errors: [] } as any);

    const { result } = renderHook(() => useWorkoutList(defaultProps));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Select all first
    act(() => { result.current.toggleSelectAll(); });
    expect(result.current.isAllSelected).toBe(true);

    // Toggle off
    act(() => { result.current.toggleSelectAll(); });
    expect(result.current.selectedIds).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // handleFavoriteToggle
  // ---------------------------------------------------------------------------

  it('handleFavoriteToggle calls toggleWorkoutFavorite API with correct args', async () => {
    const { fetchAllWorkouts } = await import('../../../../lib/unified-workouts');
    const { toggleWorkoutFavorite } = await import('../../../../lib/workout-api');
    const w1 = makeHistoryWorkout('w-fav');
    vi.mocked(fetchAllWorkouts).mockResolvedValueOnce({ workouts: [w1], errors: [] } as any);

    const { result } = renderHook(() => useWorkoutList(defaultProps));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const mockEvent = { stopPropagation: vi.fn() } as unknown as React.MouseEvent;

    await act(async () => {
      await result.current.handleFavoriteToggle(w1, mockEvent);
    });

    expect(mockEvent.stopPropagation).toHaveBeenCalled();
    expect(toggleWorkoutFavorite).toHaveBeenCalledWith('w-fav', 'user-1', true);
  });

  it('handleFavoriteToggle performs an optimistic update of isFavorite', async () => {
    const { fetchAllWorkouts } = await import('../../../../lib/unified-workouts');
    const w1 = makeHistoryWorkout('w-fav2');
    vi.mocked(fetchAllWorkouts).mockResolvedValueOnce({ workouts: [w1], errors: [] } as any);

    const { result } = renderHook(() => useWorkoutList(defaultProps));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const mockEvent = { stopPropagation: vi.fn() } as unknown as React.MouseEvent;

    await act(async () => {
      await result.current.handleFavoriteToggle(w1, mockEvent);
    });

    const updated = result.current.allWorkouts.find((w) => w.id === 'w-fav2');
    expect(updated?.isFavorite).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // confirmBulkDelete
  // ---------------------------------------------------------------------------

  it('confirmBulkDelete calls delete API and clears modal state', async () => {
    const { fetchAllWorkouts } = await import('../../../../lib/unified-workouts');
    const { deleteWorkoutFromHistory } = await import('../../../../lib/workout-history');
    const w1 = makeHistoryWorkout('del-1');
    const w2 = makeHistoryWorkout('del-2');
    vi.mocked(fetchAllWorkouts).mockResolvedValueOnce({ workouts: [w1, w2], errors: [] } as any);
    vi.mocked(deleteWorkoutFromHistory).mockResolvedValue(true);

    const { result } = renderHook(() => useWorkoutList(defaultProps));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => { result.current.handleBulkDeleteClick(['del-1', 'del-2']); });
    expect(result.current.showDeleteModal).toBe(true);
    expect(result.current.pendingDeleteIds).toEqual(['del-1', 'del-2']);

    await act(async () => {
      await result.current.confirmBulkDelete();
    });

    expect(deleteWorkoutFromHistory).toHaveBeenCalledWith('del-1', 'user-1');
    expect(deleteWorkoutFromHistory).toHaveBeenCalledWith('del-2', 'user-1');
    expect(result.current.pendingDeleteIds).toHaveLength(0);
    expect(result.current.showDeleteModal).toBe(false);
  });

  it('confirmBulkDelete removes deleted workouts from allWorkouts', async () => {
    const { fetchAllWorkouts } = await import('../../../../lib/unified-workouts');
    const { deleteWorkoutFromHistory } = await import('../../../../lib/workout-history');
    const w1 = makeHistoryWorkout('del-3');
    const w2 = makeHistoryWorkout('keep-1');
    vi.mocked(fetchAllWorkouts).mockResolvedValueOnce({ workouts: [w1, w2], errors: [] } as any);
    vi.mocked(deleteWorkoutFromHistory).mockResolvedValue(true);

    const { result } = renderHook(() => useWorkoutList(defaultProps));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => { result.current.handleBulkDeleteClick(['del-3']); });

    await act(async () => {
      await result.current.confirmBulkDelete();
    });

    expect(result.current.allWorkouts.find((w) => w.id === 'del-3')).toBeUndefined();
    expect(result.current.allWorkouts.find((w) => w.id === 'keep-1')).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // handleDeleteConfirm (single workout delete)
  // ---------------------------------------------------------------------------

  it('handleDeleteConfirm calls deleteWorkoutFromHistory and clears confirmDeleteId', async () => {
    const { fetchAllWorkouts } = await import('../../../../lib/unified-workouts');
    const { deleteWorkoutFromHistory } = await import('../../../../lib/workout-history');
    const w1 = makeHistoryWorkout('single-del-1');
    vi.mocked(fetchAllWorkouts).mockResolvedValueOnce({ workouts: [w1], errors: [] } as any);
    vi.mocked(deleteWorkoutFromHistory).mockResolvedValue(true);

    const { result } = renderHook(() => useWorkoutList(defaultProps));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => { result.current.handleDeleteClick('single-del-1'); });
    expect(result.current.confirmDeleteId).toBe('single-del-1');

    await act(async () => {
      await result.current.handleDeleteConfirm();
    });

    expect(deleteWorkoutFromHistory).toHaveBeenCalledWith('single-del-1', 'user-1');
    expect(result.current.confirmDeleteId).toBeNull();
    expect(result.current.deletingId).toBeNull();
  });

  it('handleDeleteConfirm removes the workout from allWorkouts on success', async () => {
    const { fetchAllWorkouts } = await import('../../../../lib/unified-workouts');
    const { deleteWorkoutFromHistory } = await import('../../../../lib/workout-history');
    const w1 = makeHistoryWorkout('single-del-2');
    const w2 = makeHistoryWorkout('keep-2');
    vi.mocked(fetchAllWorkouts).mockResolvedValueOnce({ workouts: [w1, w2], errors: [] } as any);
    vi.mocked(deleteWorkoutFromHistory).mockResolvedValue(true);

    const { result } = renderHook(() => useWorkoutList(defaultProps));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => { result.current.handleDeleteClick('single-del-2'); });

    await act(async () => {
      await result.current.handleDeleteConfirm();
    });

    expect(result.current.allWorkouts.find((w) => w.id === 'single-del-2')).toBeUndefined();
    expect(result.current.allWorkouts.find((w) => w.id === 'keep-2')).toBeDefined();
  });

  it('handleDeleteConfirm does nothing when confirmDeleteId is null', async () => {
    const { deleteWorkoutFromHistory } = await import('../../../../lib/workout-history');

    const { result } = renderHook(() => useWorkoutList(defaultProps));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.handleDeleteConfirm();
    });

    expect(deleteWorkoutFromHistory).not.toHaveBeenCalled();
  });
});
