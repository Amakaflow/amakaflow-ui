/**
 * useWorkoutList — extracted hook from UnifiedWorkouts.tsx
 *
 * Contains all state, effects, memos, and handlers for the workouts list feature.
 * The JSX shell (WorkoutList.tsx) imports this hook and owns only rendering.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Watch,
  Bike,
  Dumbbell,
  Youtube,
  Video,
} from 'lucide-react';
import { exportAndDownload, CsvStyle, ExportFormat } from '../../../lib/export-api';
import type { UnifiedWorkout } from '../../../types/unified-workout';
import type { WorkoutFilters, SortOption } from '../../../lib/workout-filters';
import {
  sortWorkouts,
} from '../../../lib/workout-filters';
import { fetchAllWorkouts } from '../../../lib/unified-workouts';
import { deleteWorkoutFromHistory } from '../../../lib/workout-history';
import { toggleWorkoutFavorite, getUserTags, updateWorkoutTags } from '../../../lib/workout-api';
import { deleteFollowAlong } from '../../../lib/follow-along-api';
import {
  isHistoryWorkout,
  isFollowAlongWorkout,
  VIDEO_PLATFORM_DISPLAY_NAMES,
} from '../../../types/unified-workout';
import type { WorkoutHistoryItem } from '../../../lib/workout-history';
import type { FollowAlongWorkout } from '../../../types/follow-along';
import type { WorkoutCoreData } from '../../WorkoutEditor/WorkoutEditorCore';
import type { UserTag } from '../../../types/unified-workout';
import { fetchWorkoutCompletions, type WorkoutCompletion } from '../../../lib/completions-api';
import { toast } from 'sonner';

// =============================================================================
// Module-level pure helpers (copied verbatim from UnifiedWorkouts.tsx)
// =============================================================================

export const formatDate = (dateString: string) => {
  if (!dateString) return 'Unknown date';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Invalid date';
  }
};

export const getDeviceIcon = (device: string | undefined) => {
  switch (device) {
    case 'garmin':
    case 'apple':
      return React.createElement(Watch, { className: 'w-4 h-4' });
    case 'zwift':
      return React.createElement(Bike, { className: 'w-4 h-4' });
    default:
      return React.createElement(Dumbbell, { className: 'w-4 h-4' });
  }
};

export const getSourceIcon = (workout: UnifiedWorkout) => {
  if (workout.sourceType === 'video') {
    switch (workout.videoPlatform) {
      case 'youtube':
        return React.createElement(Youtube, { className: 'w-4 h-4 text-red-500' });
      case 'instagram':
        return React.createElement(Video, { className: 'w-4 h-4 text-pink-500' });
      case 'tiktok':
        return React.createElement(Video, { className: 'w-4 h-4' });
      default:
        return React.createElement(Video, { className: 'w-4 h-4' });
    }
  }
  return getDeviceIcon(workout.devicePlatform);
};

export const getSourceLabel = (workout: UnifiedWorkout) => {
  if (workout.sourceType === 'video' && workout.videoPlatform) {
    return VIDEO_PLATFORM_DISPLAY_NAMES[workout.videoPlatform];
  }
  return workout.devicePlatform || 'Manual';
};

// =============================================================================
// Props
// =============================================================================

export interface UseWorkoutListProps {
  profileId: string;
  onEditWorkout: (item: WorkoutHistoryItem) => void;
  onLoadWorkout: (item: WorkoutHistoryItem) => void;
  onDeleteWorkout: (id: string) => void;
  onBulkDeleteWorkouts?: (ids: string[]) => Promise<void> | void;
  onViewProgram?: (programId: string) => void;
}

// =============================================================================
// Hook
// =============================================================================

export function useWorkoutList({
  profileId,
  onEditWorkout,
  onLoadWorkout,
  onDeleteWorkout,
  onBulkDeleteWorkouts,
  onViewProgram,
}: UseWorkoutListProps) {
  // Loading and data state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allWorkouts, setAllWorkouts] = useState<UnifiedWorkout[]>([]);

  // View state
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>('compact');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'history' | 'video'>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [syncFilter, setSyncFilter] = useState<'all' | 'synced' | 'not-synced'>('all');
  const [sortOption, setSortOption] = useState<SortOption>('recently-added');
  const [pageIndex, setPageIndex] = useState(0);
  const PAGE_SIZE = 10;

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // View workout modal state
  const [viewingWorkout, setViewingWorkout] = useState<WorkoutHistoryItem | null>(null);

  // Edit workout sheet state
  const [editingWorkout, setEditingWorkout] = useState<{
    id: string; title: string; updated_at: string; workout_data: WorkoutCoreData
  } | null>(null);

  // Ref to hold a pending edit that should open after ViewWorkout closes
  const pendingEditRef = useRef<UnifiedWorkout | null>(null);

  // Tag state
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<UserTag[]>([]);
  const [showTagManagement, setShowTagManagement] = useState(false);

  // Mix Workouts wizard state
  const [showMixWizard, setShowMixWizard] = useState(false);

  // Activity History state (AMA-196)
  const [showActivityHistory, setShowActivityHistory] = useState(false);
  const [completions, setCompletions] = useState<WorkoutCompletion[]>([]);
  const [completionsLoading, setCompletionsLoading] = useState(false);
  const [completionsTotal, setCompletionsTotal] = useState(0);
  const [selectedCompletionId, setSelectedCompletionId] = useState<string | null>(null);

  // Fetch workouts
  const loadWorkouts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchAllWorkouts({ profileId });
      setAllWorkouts(result?.workouts ?? []);

      if (result?.errors && result.errors.length > 0) {
        console.warn('[WorkoutList] Fetch errors:', result.errors);
      }
    } catch (err) {
      console.error('[WorkoutList] Error loading workouts:', err);
      setError('Failed to load workouts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadWorkouts();
  }, [loadWorkouts]);

  // Load user tags
  const loadTags = useCallback(async () => {
    try {
      const tags = await getUserTags(profileId);
      setAvailableTags(tags);
    } catch (err) {
      console.error('[WorkoutList] Error loading tags:', err);
    }
  }, [profileId]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  // Load completions when Activity History is shown (AMA-196)
  const loadCompletions = useCallback(async () => {
    setCompletionsLoading(true);
    try {
      const result = await fetchWorkoutCompletions(50, 0);
      setCompletions(result.completions);
      setCompletionsTotal(result.total);
    } catch (err) {
      console.error('[WorkoutList] Error loading completions:', err);
    } finally {
      setCompletionsLoading(false);
    }
  }, []);

  const loadMoreCompletions = useCallback(async () => {
    if (completionsLoading) return;
    setCompletionsLoading(true);
    try {
      const result = await fetchWorkoutCompletions(50, completions.length);
      setCompletions((prev) => [...prev, ...result.completions]);
    } catch (err) {
      console.error('[WorkoutList] Error loading more completions:', err);
    } finally {
      setCompletionsLoading(false);
    }
  }, [completions.length, completionsLoading]);

  useEffect(() => {
    if (showActivityHistory && completions.length === 0) {
      loadCompletions();
    }
  }, [showActivityHistory, completions.length, loadCompletions]);

  // When ViewWorkout closes, open the pending edit if one was queued
  useEffect(() => {
    if (!viewingWorkout && pendingEditRef.current) {
      handleEditWorkout(pendingEditRef.current);
      pendingEditRef.current = null;
    }
  }, [viewingWorkout]);

  // Derive available platforms from data
  const availablePlatforms = useMemo(() => {
    const platforms = new Set<string>();
    allWorkouts.forEach((w) => {
      if (w.devicePlatform) platforms.add(w.devicePlatform);
      if (w.videoPlatform) platforms.add(w.videoPlatform);
    });
    return Array.from(platforms).sort();
  }, [allWorkouts]);

  // Derive available categories from data
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    allWorkouts.forEach((w) => {
      if (w.category) categories.add(w.category);
    });
    return Array.from(categories).sort();
  }, [allWorkouts]);

  // Filter workouts
  const filteredWorkouts = useMemo(() => {
    let filtered = allWorkouts;

    // Source filter
    if (sourceFilter === 'history') {
      filtered = filtered.filter((w) => w._original.type === 'history');
    } else if (sourceFilter === 'video') {
      filtered = filtered.filter((w) => w._original.type === 'follow-along');
    }

    // Platform filter
    if (platformFilter !== 'all') {
      filtered = filtered.filter(
        (w) => w.devicePlatform === platformFilter || w.videoPlatform === platformFilter
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((w) => w.category === categoryFilter);
    }

    // Sync status filter
    if (syncFilter === 'synced') {
      filtered = filtered.filter(
        (w) =>
          w.syncStatus.garmin?.synced ||
          w.syncStatus.apple?.synced ||
          w.syncStatus.strava?.synced ||
          w.syncStatus.ios?.synced
      );
    } else if (syncFilter === 'not-synced') {
      filtered = filtered.filter(
        (w) =>
          !w.syncStatus.garmin?.synced &&
          !w.syncStatus.apple?.synced &&
          !w.syncStatus.strava?.synced &&
          !w.syncStatus.ios?.synced
      );
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (w) =>
          w.title.toLowerCase().includes(q) ||
          w.searchableText.includes(q)
      );
    }

    // Tag filter
    if (tagFilter.length > 0) {
      filtered = filtered.filter((w) =>
        tagFilter.some((tag) => w.tags.includes(tag))
      );
    }

    // Apply sorting
    filtered = sortWorkouts(filtered, sortOption);

    return filtered;
  }, [allWorkouts, sourceFilter, platformFilter, categoryFilter, syncFilter, searchQuery, sortOption, tagFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredWorkouts.length / PAGE_SIZE));
  const currentPageIndex = Math.min(pageIndex, totalPages - 1);
  const pageStart = currentPageIndex * PAGE_SIZE;
  const displayedWorkouts = filteredWorkouts.slice(pageStart, pageStart + PAGE_SIZE);

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const isAllSelected =
    displayedWorkouts.length > 0 &&
    displayedWorkouts.every((w) => selectedIds.includes(w.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !displayedWorkouts.some((w) => w.id === id))
      );
    } else {
      const idsOnPage = displayedWorkouts.map((w) => w.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...idsOnPage])));
    }
  };

  const clearSelection = () => setSelectedIds([]);

  // Delete handlers
  const handleBulkDeleteClick = (ids: string[]) => {
    if (ids.length === 0) return;
    setPendingDeleteIds(ids);
    setShowDeleteModal(true);
  };

  const confirmBulkDelete = async () => {
    if (pendingDeleteIds.length === 0) return;

    const successIds: string[] = [];
    let failCount = 0;

    for (const id of pendingDeleteIds) {
      const workout = allWorkouts.find((w) => w.id === id);
      if (!workout) continue;

      try {
        let success = false;

        if (isHistoryWorkout(workout)) {
          success = await deleteWorkoutFromHistory(id, profileId);
        } else if (isFollowAlongWorkout(workout)) {
          const result = await deleteFollowAlong(id, profileId);
          success = result.success;
        }

        if (success) {
          successIds.push(id);
        } else {
          failCount++;
        }
      } catch (err) {
        console.error('Error deleting workout:', err);
        failCount++;
      }
    }

    if (successIds.length > 0) {
      setAllWorkouts((prev) => prev.filter((w) => !successIds.includes(w.id)));
    }
    if (failCount > 0) {
      toast.error(`Failed to delete ${failCount} workout${failCount > 1 ? 's' : ''}. Please try again.`);
    }

    clearSelection();
    setPendingDeleteIds([]);
    setShowDeleteModal(false);
  };

  const cancelBulkDelete = () => {
    setPendingDeleteIds([]);
    setShowDeleteModal(false);
  };

  const handleDeleteClick = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return;

    setDeletingId(confirmDeleteId);
    const workout = allWorkouts.find((w) => w.id === confirmDeleteId);

    try {
      let success = false;

      if (workout && isHistoryWorkout(workout)) {
        success = await deleteWorkoutFromHistory(confirmDeleteId, profileId);
      } else if (workout && isFollowAlongWorkout(workout)) {
        const result = await deleteFollowAlong(confirmDeleteId, profileId);
        success = result.success;
      }

      if (success) {
        setAllWorkouts((prev) => prev.filter((w) => w.id !== confirmDeleteId));
      } else {
        toast.error('Failed to delete workout. Please try again.');
      }
    } catch (err) {
      console.error('[handleDeleteConfirm] Error:', err);
      toast.error('Failed to delete workout. Please try again.');
    } finally {
      setConfirmDeleteId(null);
      setDeletingId(null);
    }
  };

  const handleDeleteCancel = () => {
    setConfirmDeleteId(null);
  };

  // Favorite toggle handler
  const handleFavoriteToggle = async (workout: UnifiedWorkout, e: React.MouseEvent) => {
    e.stopPropagation();

    const newFavoriteState = !workout.isFavorite;

    // Optimistic update
    setAllWorkouts((prev) =>
      prev.map((w) =>
        w.id === workout.id ? { ...w, isFavorite: newFavoriteState } : w
      )
    );

    // Only call API for history workouts (follow-along favorites handled separately)
    if (isHistoryWorkout(workout)) {
      try {
        await toggleWorkoutFavorite(workout.id, profileId, newFavoriteState);
      } catch (err) {
        console.error('[handleFavoriteToggle] Error:', err);
        // Revert on error
        setAllWorkouts((prev) =>
          prev.map((w) =>
            w.id === workout.id ? { ...w, isFavorite: !newFavoriteState } : w
          )
        );
      }
    }
  };

  // Tags update handler - updates local state
  const handleTagsUpdate = (workoutId: string, newTags: string[]) => {
    setAllWorkouts((prev) =>
      prev.map((w) =>
        w.id === workoutId ? { ...w, tags: newTags } : w
      )
    );
  };

  // Edit handler - converts unified workout back to original type
  const handleEdit = (workout: UnifiedWorkout) => {
    if (isHistoryWorkout(workout)) {
      onEditWorkout(workout._original.data);
    } else if (isFollowAlongWorkout(workout)) {
      // For follow-along, we need to convert to history-like format
      const followAlong = workout._original.data as FollowAlongWorkout;
      // Create a minimal WorkoutHistoryItem for editing
      const historyItem: WorkoutHistoryItem = {
        id: followAlong.id,
        workout: {
          title: followAlong.title,
          source: followAlong.source,
          blocks: [
            {
              label: 'Follow Along',
              structure: 'regular',
              exercises: followAlong.steps.map((step) => ({
                id: step.id,
                name: step.label,
                sets: null,
                reps: step.targetReps || null,
                reps_range: null,
                duration_sec: step.durationSec || null,
                rest_sec: null,
                distance_m: null,
                distance_range: null,
                type: 'strength',
                notes: step.notes,
              })),
            },
          ],
        },
        sources: [followAlong.sourceUrl],
        device: 'garmin',
        createdAt: followAlong.createdAt,
        updatedAt: followAlong.updatedAt,
      };
      onEditWorkout(historyItem);
    }
  };

  // Load handler
  const handleLoad = (workout: UnifiedWorkout) => {
    if (isHistoryWorkout(workout)) {
      onLoadWorkout(workout._original.data);
    }
  };

  // View handler - opens workout detail modal
  const handleView = (workout: UnifiedWorkout) => {
    if (isHistoryWorkout(workout)) {
      setViewingWorkout(workout._original.data);
    } else if (isFollowAlongWorkout(workout)) {
      // Convert follow-along to history-like format for viewing
      const followAlong = workout._original.data as FollowAlongWorkout;
      const historyItem: WorkoutHistoryItem = {
        id: followAlong.id,
        workout: {
          title: followAlong.title,
          source: followAlong.source,
          blocks: [
            {
              label: 'Follow Along',
              structure: 'regular',
              exercises: followAlong.steps.map((step) => ({
                id: step.id,
                name: step.label,
                sets: null,
                reps: step.targetReps || null,
                reps_range: null,
                duration_sec: step.durationSec || null,
                rest_sec: null,
                distance_m: null,
                distance_range: null,
                type: 'strength',
                notes: step.notes,
              })),
            },
          ],
        },
        sources: [followAlong.sourceUrl],
        device: 'garmin',
        createdAt: followAlong.createdAt,
        updatedAt: followAlong.updatedAt,
      };
      setViewingWorkout(historyItem);
    }
  };

  // Edit workout sheet handler - opens WorkoutEditSheet for history workouts
  const handleEditWorkout = (workout: UnifiedWorkout) => {
    // Only saved history workouts support operations
    const raw = (workout._original?.data ?? workout._original) as any;
    if (!raw?.id) return;
    setEditingWorkout({
      id: raw.id,
      title: raw.title ?? raw.workout_data?.title ?? raw.workout?.title ?? 'Workout',
      updated_at: raw.updated_at ?? raw.updatedAt ?? new Date().toISOString(),
      workout_data: (raw.workout_data ?? raw.workout ?? {}) as WorkoutCoreData,
    });
  };

  // Export to CSV format via API
  const handleCsvExport = async (workout: UnifiedWorkout, style: CsvStyle) => {
    try {
      if (isHistoryWorkout(workout)) {
        await exportAndDownload(workout._original.data.workout, 'csv', { csvStyle: style });
      } else if (isFollowAlongWorkout(workout)) {
        // Convert follow-along to exportable format
        const followAlong = workout._original.data as FollowAlongWorkout;
        const workoutData = {
          title: followAlong.title,
          source: followAlong.source,
          blocks: [
            {
              label: 'Follow Along',
              structure: 'regular',
              exercises: followAlong.steps.map((step) => ({
                name: step.label,
                sets: 1,
                reps: step.targetReps || null,
                duration_sec: step.durationSec || null,
              })),
              supersets: [],
            },
          ],
        };
        await exportAndDownload(workoutData, 'csv', { csvStyle: style });
      }
    } catch (error) {
      console.error('CSV export failed:', error);
    }
  };

  // Export to other formats via API (FIT, TCX, Text)
  const handleApiExport = async (workout: UnifiedWorkout, format: ExportFormat) => {
    try {
      if (isHistoryWorkout(workout)) {
        await exportAndDownload(workout._original.data.workout, format);
      } else if (isFollowAlongWorkout(workout)) {
        // Convert follow-along to exportable format
        const followAlong = workout._original.data as FollowAlongWorkout;
        const workoutData = {
          title: followAlong.title,
          source: followAlong.source,
          blocks: [
            {
              label: 'Follow Along',
              structure: 'regular',
              exercises: followAlong.steps.map((step) => ({
                name: step.label,
                sets: 1,
                reps: step.targetReps || null,
                duration_sec: step.durationSec || null,
              })),
              supersets: [],
            },
          ],
        };
        await exportAndDownload(workoutData, format);
      }
    } catch (error) {
      console.error(`${format.toUpperCase()} export failed:`, error);
    }
  };

  // Handle loading a unified workout (converts to WorkoutHistoryItem for parent)
  const handleLoadUnified = (workout: UnifiedWorkout) => {
    if (isHistoryWorkout(workout)) {
      onLoadWorkout(workout._original.data);
    } else if (isFollowAlongWorkout(workout)) {
      // Convert follow-along to history-like format for loading
      const followAlong = workout._original.data as FollowAlongWorkout;
      const historyItem: WorkoutHistoryItem = {
        id: followAlong.id,
        workout: {
          title: followAlong.title,
          source: followAlong.source,
          blocks: [
            {
              label: 'Follow Along',
              structure: 'regular',
              exercises: followAlong.steps.map((step) => ({
                id: step.id,
                name: step.label,
                sets: null,
                reps: step.targetReps || null,
                reps_range: null,
                duration_sec: step.durationSec || null,
                rest_sec: null,
                distance_m: null,
                distance_range: null,
                type: 'strength',
                notes: step.notes,
              })),
            },
          ],
        },
        sources: [followAlong.sourceUrl],
        device: 'garmin',
        createdAt: followAlong.createdAt,
        updatedAt: followAlong.updatedAt,
      };
      onLoadWorkout(historyItem);
    }
  };

  return {
    // State values
    isLoading,
    error,
    allWorkouts,
    setAllWorkouts,
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    sourceFilter,
    setSourceFilter,
    platformFilter,
    setPlatformFilter,
    categoryFilter,
    setCategoryFilter,
    syncFilter,
    setSyncFilter,
    sortOption,
    setSortOption,
    pageIndex,
    setPageIndex,
    PAGE_SIZE,
    selectedIds,
    setSelectedIds,
    showDeleteModal,
    setShowDeleteModal,
    pendingDeleteIds,
    setPendingDeleteIds,
    confirmDeleteId,
    setConfirmDeleteId,
    deletingId,
    setDeletingId,
    viewingWorkout,
    setViewingWorkout,
    editingWorkout,
    setEditingWorkout,
    pendingEditRef,
    tagFilter,
    setTagFilter,
    availableTags,
    setAvailableTags,
    showTagManagement,
    setShowTagManagement,
    showMixWizard,
    setShowMixWizard,
    showActivityHistory,
    setShowActivityHistory,
    completions,
    setCompletions,
    completionsLoading,
    completionsTotal,
    selectedCompletionId,
    setSelectedCompletionId,

    // Derived / memos
    availablePlatforms,
    availableCategories,
    filteredWorkouts,
    totalPages,
    currentPageIndex,
    pageStart,
    displayedWorkouts,
    isAllSelected,

    // Callbacks / handlers
    loadWorkouts,
    loadTags,
    loadCompletions,
    loadMoreCompletions,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    handleBulkDeleteClick,
    confirmBulkDelete,
    cancelBulkDelete,
    handleDeleteClick,
    handleDeleteConfirm,
    handleDeleteCancel,
    handleFavoriteToggle,
    handleTagsUpdate,
    handleEdit,
    handleLoad,
    handleView,
    handleEditWorkout,
    handleCsvExport,
    handleApiExport,
    handleLoadUnified,
  };
}
