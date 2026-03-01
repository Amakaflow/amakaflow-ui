/**
 * UnifiedWorkouts - Combined Workout History & Follow-Along Page
 *
 * Displays all workouts in a unified view matching the history page style
 * with compact/card view toggle, search, pagination, and edit-to-workflow.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Dumbbell,
  Clock,
  Watch,
  Bike,
  Download,
  CheckCircle2,
  Eye,
  Trash2,
  ChevronRight,
  ChevronDown,
  Edit,
  List,
  LayoutGrid,
  Video,
  Youtube,
  Play,
  ExternalLink,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Activity,
  Star,
  Tag,
  Settings2,
  Shuffle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { exportAndDownload, CsvStyle, ExportFormat } from '../lib/export-api';

import type { UnifiedWorkout } from '../types/unified-workout';
import type { WorkoutFilters, SortOption } from '../lib/workout-filters';
import {
  DEFAULT_FILTERS,
  filterWorkouts,
  hasActiveFilters,
  sortWorkouts,
  SORT_OPTIONS,
} from '../lib/workout-filters';
import { fetchAllWorkouts } from '../lib/unified-workouts';
import { deleteWorkoutFromHistory } from '../lib/workout-history';
import { toggleWorkoutFavorite, saveWorkoutToAPI } from '../lib/workout-api';
import { deleteFollowAlong } from '../lib/follow-along-api';
import {
  isHistoryWorkout,
  isFollowAlongWorkout,
  CATEGORY_DISPLAY_NAMES,
  VIDEO_PLATFORM_DISPLAY_NAMES,
} from '../types/unified-workout';
import type { WorkoutHistoryItem } from '../lib/workout-history';
import type { FollowAlongWorkout } from '../types/follow-along';
import { ViewWorkout } from './ViewWorkout';
import { WorkoutEditSheet } from './WorkoutEditor/WorkoutEditSheet';
import { MixWizardModal } from './MixWizard/MixWizardModal';
import { WorkoutCoreData } from './WorkoutEditor/WorkoutEditorCore';
import { ProgramsSection } from './ProgramsSection';
import { TagPill } from './TagPill';
import { TagManagementModal } from './TagManagementModal';
import { WorkoutTagsEditor } from './WorkoutTagsEditor';
import { getUserTags, updateWorkoutTags } from '../lib/workout-api';
import type { UserTag } from '../types/unified-workout';
import { ActivityHistory } from './ActivityHistory';
import { CompletionDetailView } from './CompletionDetailView';
import { fetchWorkoutCompletions, type WorkoutCompletion } from '../lib/completions-api';
import { SyncStatusIndicator } from './workouts/UnifiedWorkoutCard';
import { toast } from 'sonner';

// =============================================================================
// Types
// =============================================================================

interface UnifiedWorkoutsProps {
  profileId: string;
  onEditWorkout: (item: WorkoutHistoryItem) => void;
  onLoadWorkout: (item: WorkoutHistoryItem) => void;
  onDeleteWorkout: (id: string) => void;
  onBulkDeleteWorkouts?: (ids: string[]) => Promise<void> | void;
  onViewProgram?: (programId: string) => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

const formatDate = (dateString: string) => {
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

const getDeviceIcon = (device: string | undefined) => {
  switch (device) {
    case 'garmin':
    case 'apple':
      return <Watch className="w-4 h-4" />;
    case 'zwift':
      return <Bike className="w-4 h-4" />;
    default:
      return <Dumbbell className="w-4 h-4" />;
  }
};

const getSourceIcon = (workout: UnifiedWorkout) => {
  if (workout.sourceType === 'video') {
    switch (workout.videoPlatform) {
      case 'youtube':
        return <Youtube className="w-4 h-4 text-red-500" />;
      case 'instagram':
        return <Video className="w-4 h-4 text-pink-500" />;
      case 'tiktok':
        return <Video className="w-4 h-4" />;
      default:
        return <Video className="w-4 h-4" />;
    }
  }
  return getDeviceIcon(workout.devicePlatform);
};

const getSourceLabel = (workout: UnifiedWorkout) => {
  if (workout.sourceType === 'video' && workout.videoPlatform) {
    return VIDEO_PLATFORM_DISPLAY_NAMES[workout.videoPlatform];
  }
  return workout.devicePlatform || 'Manual';
};

// =============================================================================
// Main Component
// =============================================================================

export function UnifiedWorkouts({
  profileId,
  onEditWorkout,
  onLoadWorkout,
  onDeleteWorkout,
  onBulkDeleteWorkouts,
  onViewProgram,
}: UnifiedWorkoutsProps) {
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
      setAllWorkouts(result.workouts);

      if (result.errors.length > 0) {
        console.warn('[UnifiedWorkouts] Fetch errors:', result.errors);
      }
    } catch (err) {
      console.error('[UnifiedWorkouts] Error loading workouts:', err);
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
      console.error('[UnifiedWorkouts] Error loading tags:', err);
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
      console.error('[UnifiedWorkouts] Error loading completions:', err);
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
      console.error('[UnifiedWorkouts] Error loading more completions:', err);
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
  const handleBulkDeleteClick = () => {
    if (selectedIds.length === 0) return;
    setPendingDeleteIds(selectedIds);
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

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-destructive opacity-50" />
        <h3 className="text-xl mb-2">Error Loading Workouts</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={loadWorkouts}>Retry</Button>
      </div>
    );
  }

  // Render empty state
  if (allWorkouts.length === 0) {
    return (
      <div className="text-center py-16">
        <Dumbbell className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
        <h3 className="text-xl mb-2">No workouts yet</h3>
        <p className="text-muted-foreground mb-4">
          Your saved workouts and follow-along videos will appear here.
        </p>
      </div>
    );
  }

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

  return (
    <div className="space-y-4">
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-xl shadow-xl w-[360px] border">
            <h2 className="text-lg font-semibold mb-3">
              Delete {pendingDeleteIds.length} workout(s)?
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelBulkDelete}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmBulkDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl mb-1">My Workouts</h2>
            <p className="text-sm text-muted-foreground">
              {filteredWorkouts.length} workout{filteredWorkouts.length !== 1 ? 's' : ''}
              {filteredWorkouts.length !== allWorkouts.length && ` (of ${allWorkouts.length})`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={toggleSelectAll}
              aria-label="Select all workouts"
              className="w-4 h-4"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedIds.length === 0}
              onClick={handleBulkDeleteClick}
              className="gap-2"
            >
              Delete selected ({selectedIds.length})
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="gap-2"
              data-testid="view-mode-cards"
            >
              <LayoutGrid className="w-4 h-4" />
              Cards
            </Button>
            <Button
              variant={viewMode === 'compact' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('compact')}
              className="gap-2"
              data-testid="view-mode-compact"
            >
              <List className="w-4 h-4" />
              Compact
            </Button>
            <div className="w-px h-6 bg-border mx-1" />
            <Button
              variant={showActivityHistory ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowActivityHistory(!showActivityHistory)}
              className="gap-2"
            >
              <Activity className="w-4 h-4" />
              Activity History
            </Button>
          </div>
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPageIndex(0);
            }}
            placeholder="Search workouts..."
            data-assistant-target="search-input"
            data-testid="workout-search-input"
            className="h-8 w-48 rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <select
            aria-label="Filter by source"
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value as 'all' | 'history' | 'video');
              setPageIndex(0);
            }}
            className="h-8 rounded-md border px-2 text-sm bg-background"
          >
            <option value="all">All sources</option>
            <option value="history">Workout History</option>
            <option value="video">Follow Along</option>
          </select>
          <select
            aria-label="Filter by platform"
            value={platformFilter}
            onChange={(e) => {
              setPlatformFilter(e.target.value);
              setPageIndex(0);
            }}
            className="h-8 rounded-md border px-2 text-sm bg-background"
          >
            <option value="all">All platforms</option>
            {availablePlatforms.map((platform) => (
              <option key={platform} value={platform}>
                {platform === 'garmin' ? 'Garmin' :
                 platform === 'apple' ? 'Apple Watch' :
                 platform === 'strava' ? 'Strava' :
                 platform === 'youtube' ? 'YouTube' :
                 platform === 'instagram' ? 'Instagram' :
                 platform === 'tiktok' ? 'TikTok' :
                 platform === 'vimeo' ? 'Vimeo' :
                 platform}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPageIndex(0);
            }}
            className="h-8 rounded-md border px-2 text-sm bg-background"
          >
            <option value="all">All categories</option>
            {availableCategories.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_DISPLAY_NAMES[category as keyof typeof CATEGORY_DISPLAY_NAMES] || category}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by sync status"
            value={syncFilter}
            onChange={(e) => {
              setSyncFilter(e.target.value as 'all' | 'synced' | 'not-synced');
              setPageIndex(0);
            }}
            className="h-8 rounded-md border px-2 text-sm bg-background"
          >
            <option value="all">All sync status</option>
            <option value="synced">Synced</option>
            <option value="not-synced">Not synced</option>
          </select>
          {/* Tag filter dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={`h-8 gap-1.5 ${tagFilter.length > 0 ? 'border-primary text-primary' : ''}`}
              >
                <Tag className="w-4 h-4" />
                Tags
                {tagFilter.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                    {tagFilter.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Filter by Tags</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableTags.length === 0 ? (
                <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                  No tags yet
                </div>
              ) : (
                availableTags.map((tag) => (
                  <DropdownMenuItem
                    key={tag.id}
                    onClick={(e) => {
                      e.preventDefault();
                      setTagFilter((prev) =>
                        prev.includes(tag.name)
                          ? prev.filter((t) => t !== tag.name)
                          : [...prev, tag.name]
                      );
                      setPageIndex(0);
                    }}
                    className="gap-2"
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        tagFilter.includes(tag.name) ? 'bg-primary border-primary' : ''
                      }`}
                    >
                      {tagFilter.includes(tag.name) && (
                        <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                      )}
                    </div>
                    <TagPill name={tag.name} color={tag.color} size="sm" />
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowTagManagement(true)}>
                <Settings2 className="w-4 h-4 mr-2" />
                Manage Tags
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="h-4 border-l mx-1" /> {/* Divider */}
          <select
            aria-label="Sort by"
            value={sortOption}
            onChange={(e) => {
              setSortOption(e.target.value as SortOption);
              setPageIndex(0);
            }}
            className="h-8 rounded-md border px-2 text-sm bg-background"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {(sourceFilter !== 'all' || platformFilter !== 'all' || categoryFilter !== 'all' || syncFilter !== 'all' || tagFilter.length > 0 || searchQuery || sortOption !== 'recently-added') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSourceFilter('all');
                setPlatformFilter('all');
                setCategoryFilter('all');
                setSyncFilter('all');
                setTagFilter([]);
                setSearchQuery('');
                setSortOption('recently-added');
                setPageIndex(0);
              }}
              className="h-8 text-xs text-muted-foreground"
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Activity History View (AMA-196) */}
      {showActivityHistory ? (
        <div className="pr-4 max-w-7xl mx-auto">
          <ActivityHistory
            completions={completions}
            loading={completionsLoading}
            onLoadMore={loadMoreCompletions}
            hasMore={completions.length < completionsTotal}
            onCompletionClick={setSelectedCompletionId}
          />
        </div>
      ) : (
        <>
          {/* Programs Section */}
          <ProgramsSection
            profileId={profileId}
            workouts={allWorkouts}
            onLoadWorkout={handleLoadUnified}
            onViewProgram={onViewProgram}
          />

          {/* Workout List */}
          <ScrollArea className="h-[calc(100vh-280px)]">
        <div data-assistant-target="library-results" className={viewMode === 'cards' ? 'space-y-2 pr-4 max-w-7xl mx-auto' : 'space-y-1 pr-4 max-w-7xl mx-auto'}>
          {displayedWorkouts.map((workout) => {
            const isVideo = workout._original.type === 'follow-along';
            const hasSyncStatus =
              workout.syncStatus.garmin?.synced ||
              workout.syncStatus.apple?.synced ||
              workout.syncStatus.strava?.synced;

            // Compact view
            if (viewMode === 'compact') {
              return (
                <div
                  key={workout.id}
                  data-testid={`workout-item-${workout.id}`}
                  className={`flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors group ${
                    selectedIds.includes(workout.id) ? 'bg-muted/40 border-primary/40' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(workout.id)}
                    onChange={() => toggleSelect(workout.id)}
                    aria-label="Select workout"
                    className="w-4 h-4 flex-shrink-0"
                  />
                  {/* Thumbnail for video workouts */}
                  {isVideo && workout.thumbnailUrl && (
                    <div className="w-16 h-12 rounded overflow-hidden flex-shrink-0 bg-muted">
                      <img
                        src={workout.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold truncate">{workout.title}</h3>
                      {isVideo ? (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Video className="w-3 h-3" />
                          Video
                        </Badge>
                      ) : (
                        <SyncStatusIndicator workout={workout} />
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(workout.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        {getSourceIcon(workout)}
                        <span className="capitalize">{getSourceLabel(workout)}</span>
                      </span>
                      <span>{workout.exerciseCount} exercises</span>
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        {CATEGORY_DISPLAY_NAMES[workout.category]}
                      </Badge>
                      {/* Tags */}
                      {workout.tags.length > 0 && (
                        <div className="flex items-center gap-1">
                          {workout.tags.slice(0, 3).map((tagName) => {
                            const tag = availableTags.find((t) => t.name === tagName);
                            return (
                              <TagPill
                                key={tagName}
                                name={tagName}
                                color={tag?.color}
                                size="sm"
                              />
                            );
                          })}
                          {workout.tags.length > 3 && (
                            <span className="text-xs text-muted-foreground">
                              +{workout.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Tag editor */}
                    <WorkoutTagsEditor
                      workoutId={workout.id}
                      profileId={profileId}
                      currentTags={workout.tags}
                      onTagsUpdate={(tags) => handleTagsUpdate(workout.id, tags)}
                      title="Edit tags"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handleFavoriteToggle(workout, e)}
                      className="h-8 w-8 p-0"
                      title={workout.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <Star
                        className={`w-4 h-4 ${
                          workout.isFavorite
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-muted-foreground hover:text-yellow-400'
                        }`}
                      />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleView(workout)}
                      className="h-8 w-8 p-0"
                      title="View"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(workout)}
                      className="h-8 w-8 p-0"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    {!isVideo && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleLoad(workout)}
                        className="h-8 w-8 p-0"
                        title="Load"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    )}
                    {isVideo && workout.sourceUrl && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(workout.sourceUrl, '_blank')}
                        className="h-8 w-8 p-0"
                        aria-label="Open video source"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          title="Export"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleCsvExport(workout, 'strong')}>
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          CSV (Strong/Hevy)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCsvExport(workout, 'extended')}>
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          CSV (Extended)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleApiExport(workout, 'fit')}>
                          <Activity className="w-4 h-4 mr-2" />
                          FIT (Garmin)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleApiExport(workout, 'tcx')}>
                          <FileText className="w-4 h-4 mr-2" />
                          TCX
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleApiExport(workout, 'text')}>
                          <FileText className="w-4 h-4 mr-2" />
                          Text (TrainingPeaks)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleApiExport(workout, 'json')}>
                          <FileText className="w-4 h-4 mr-2" />
                          JSON
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleApiExport(workout, 'pdf')}>
                          <FileText className="w-4 h-4 mr-2" />
                          PDF
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteClick(workout.id)}
                      disabled={deletingId === workout.id}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Delete"
                      data-testid={`workout-delete-${workout.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            }

            // Card view
            return (
              <Card
                key={workout.id}
                data-testid={`workout-item-${workout.id}`}
                className={`hover:shadow-md transition-all border-border/50 bg-card ${
                  selectedIds.includes(workout.id) ? 'bg-muted/40 border-primary/40 shadow-sm' : ''
                }`}
              >
                <CardHeader className="pb-3 px-4 pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(workout.id)}
                      onChange={() => toggleSelect(workout.id)}
                      aria-label="Select workout"
                      className="w-4 h-4 flex-shrink-0 mt-1"
                    />
                    {/* Thumbnail for video workouts */}
                    {isVideo && workout.thumbnailUrl && (
                      <div className="w-24 h-16 rounded overflow-hidden flex-shrink-0 bg-muted">
                        <img
                          src={workout.thumbnailUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-2">
                      <CardTitle className="text-lg font-bold truncate text-foreground">
                        {workout.title}
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span className="font-medium">{formatDate(workout.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          {getSourceIcon(workout)}
                          <span className="font-medium capitalize">{getSourceLabel(workout)}</span>
                        </div>
                        <div className="text-muted-foreground">
                          <span className="font-medium">{workout.exerciseCount}</span> exercises
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {CATEGORY_DISPLAY_NAMES[workout.category]}
                        </Badge>
                        {hasSyncStatus && (
                          <div className="flex items-center gap-1.5 text-green-700 dark:text-green-400 font-medium">
                            <CheckCircle2 className="w-4 h-4" />
                            Synced
                          </div>
                        )}
                      </div>
                      {/* Tags */}
                      {workout.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 mt-2">
                          {workout.tags.slice(0, 5).map((tagName) => {
                            const tag = availableTags.find((t) => t.name === tagName);
                            return (
                              <TagPill
                                key={tagName}
                                name={tagName}
                                color={tag?.color}
                                size="sm"
                              />
                            );
                          })}
                          {workout.tags.length > 5 && (
                            <span className="text-xs text-muted-foreground">
                              +{workout.tags.length - 5}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {isVideo ? (
                        <Badge variant="secondary" className="gap-1">
                          <Video className="w-3 h-3" />
                          Video
                        </Badge>
                      ) : hasSyncStatus ? (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                          <CheckCircle2 className="w-3 h-3 mr-1.5" />
                          Synced
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-medium">Draft</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0 border-t bg-muted/20">
                  <div className="flex items-center justify-between gap-3 pt-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => handleFavoriteToggle(workout, e)}
                        className="h-9 w-9 p-0"
                        title={workout.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Star
                          className={`w-5 h-5 ${
                            workout.isFavorite
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-muted-foreground hover:text-yellow-400'
                          }`}
                        />
                      </Button>
                      <WorkoutTagsEditor
                        workoutId={workout.id}
                        profileId={profileId}
                        currentTags={workout.tags}
                        onTagsUpdate={(tags) => handleTagsUpdate(workout.id, tags)}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleView(workout)}
                        className="gap-2 h-9 font-medium"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(workout)}
                        className="gap-2 h-9 font-medium"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </Button>
                      {!isVideo && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleLoad(workout)}
                          className="gap-2 h-9 font-medium"
                        >
                          Load
                        </Button>
                      )}
                      {isVideo && workout.sourceUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(workout.sourceUrl, '_blank')}
                          className="gap-2 h-9 font-medium"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open Video
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 h-9 font-medium"
                          >
                            <Download className="w-4 h-4" />
                            Export
                            <ChevronDown className="w-3 h-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Export Format</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleCsvExport(workout, 'strong')}>
                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                            CSV (Strong/Hevy compatible)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCsvExport(workout, 'extended')}>
                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                            CSV (Extended for spreadsheets)
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleApiExport(workout, 'fit')}>
                            <Activity className="w-4 h-4 mr-2" />
                            FIT (Garmin)
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleApiExport(workout, 'tcx')}>
                            <FileText className="w-4 h-4 mr-2" />
                            TCX
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleApiExport(workout, 'text')}>
                            <FileText className="w-4 h-4 mr-2" />
                            Text (TrainingPeaks)
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleApiExport(workout, 'json')}>
                            <FileText className="w-4 h-4 mr-2" />
                            JSON
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleApiExport(workout, 'pdf')}>
                            <FileText className="w-4 h-4 mr-2" />
                            PDF
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteClick(workout.id)}
                      disabled={deletingId === workout.id}
                      className="h-9 gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 font-medium"
                      data-testid={`workout-delete-${workout.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                      {deletingId === workout.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
        </>
      )}

      {/* Pagination - hide when showing Activity History */}
      {!showActivityHistory && (
        <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
          <div>
            Showing {filteredWorkouts.length === 0 ? 0 : pageStart + 1} –{' '}
            {Math.min(pageStart + PAGE_SIZE, filteredWorkouts.length)} of{' '}
            {filteredWorkouts.length} workout{filteredWorkouts.length === 1 ? '' : 's'}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPageIndex === 0}
              onClick={() => setPageIndex((prev) => Math.max(0, prev - 1))}
            >
              Previous
            </Button>
            <span>
              Page {currentPageIndex + 1} of {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPageIndex >= totalPages - 1}
              onClick={() => setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => !open && handleDeleteCancel()}>
        <AlertDialogContent data-testid="delete-confirmation-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="delete-confirmation-title">Delete Workout</AlertDialogTitle>
            <AlertDialogDescription data-testid="delete-confirmation-description">
              Are you sure you want to delete this workout? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={handleDeleteCancel} 
              disabled={!!deletingId}
              data-testid="delete-confirmation-cancel"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={!!deletingId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="delete-confirmation-confirm"
            >
              {deletingId ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Workout Modal */}
      {viewingWorkout && (
        <ViewWorkout
          workout={viewingWorkout}
          onClose={() => setViewingWorkout(null)}
          onEdit={() => {
            const unified = allWorkouts.find(w => w.id === viewingWorkout.id);
            if (unified) pendingEditRef.current = unified;
            setViewingWorkout(null);
          }}
        />
      )}

      {/* Edit Workout Sheet */}
      {editingWorkout && (
        <WorkoutEditSheet
          workout={editingWorkout}
          open={true}
          onClose={() => setEditingWorkout(null)}
          onSaved={(updated) => {
            setAllWorkouts(prev =>
              prev.map(w => w.id === updated.id ? { ...w, title: updated.title } : w)
            );
            setEditingWorkout(null);
          }}
        />
      )}

      {/* Completion Detail Modal */}
      {selectedCompletionId && (
        <CompletionDetailView
          completionId={selectedCompletionId}
          onClose={() => setSelectedCompletionId(null)}
        />
      )}

      {/* Tag Management Modal */}
      <TagManagementModal
        isOpen={showTagManagement}
        onClose={() => setShowTagManagement(false)}
        profileId={profileId}
        onTagsChange={loadTags}
      />

      {/* Mix Workouts FAB */}
      <button
        onClick={() => setShowMixWizard(true)}
        className="fixed bottom-24 right-6 z-30 flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        aria-label="Mix workouts"
      >
        <Shuffle className="w-5 h-5" />
        <span className="text-sm font-medium hidden sm:inline">Mix</span>
      </button>

      {/* Mix Workouts Wizard */}
      <MixWizardModal
        open={showMixWizard}
        workouts={allWorkouts}
        onClose={() => setShowMixWizard(false)}
        onSave={async (preview, title) => {
          await saveWorkoutToAPI({
            profile_id: profileId,
            workout_data: preview.workout,
            title,
            sources: [],
            device: 'web',
          });
          setShowMixWizard(false);
          loadWorkouts();
        }}
      />
    </div>
  );
}

export default UnifiedWorkouts;
