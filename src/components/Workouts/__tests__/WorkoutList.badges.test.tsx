/**
 * Tests for WorkoutList card badges (AMA-891).
 * Verifies completion count and sync status badges on workout cards.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { WorkoutList } from '../WorkoutList';

// Mock the useWorkoutList hook to avoid complex dependencies
vi.mock('../hooks/useWorkoutList', () => ({
  useWorkoutList: vi.fn(() => ({
    isLoading: false,
    error: null,
    allWorkouts: [
      {
        id: 'workout-1',
        title: 'Test Workout 1',
        category: 'strength',
        tags: [],
        isFavorite: false,
        createdAt: '2024-01-01',
        exerciseCount: 5,
        syncStatus: {},
        _original: {
          type: 'history',
          data: {
            id: 'workout-1',
            workout: { exercises: [] },
          },
        },
      },
      {
        id: 'workout-2',
        title: 'Test Workout 2',
        category: 'cardio',
        tags: [],
        isFavorite: true,
        createdAt: '2024-01-02',
        exerciseCount: 3,
        syncStatus: { garmin: { synced: true } },
        _original: {
          type: 'history',
          data: {
            id: 'workout-2',
            workout: { exercises: [] },
          },
        },
      },
    ],
    displayedWorkouts: [
      {
        id: 'workout-1',
        title: 'Test Workout 1',
        category: 'strength',
        tags: [],
        isFavorite: false,
        createdAt: '2024-01-01',
        exerciseCount: 5,
        syncStatus: {},
        _original: {
          type: 'history',
          data: {
            id: 'workout-1',
            workout: { exercises: [] },
          },
        },
      },
      {
        id: 'workout-2',
        title: 'Test Workout 2',
        category: 'cardio',
        tags: [],
        isFavorite: true,
        createdAt: '2024-01-02',
        exerciseCount: 3,
        syncStatus: { garmin: { synced: true } },
        _original: {
          type: 'history',
          data: {
            id: 'workout-2',
            workout: { exercises: [] },
          },
        },
      },
    ],
    filteredWorkouts: [
      {
        id: 'workout-1',
        title: 'Test Workout 1',
        category: 'strength',
        tags: [],
        isFavorite: false,
        createdAt: '2024-01-01',
        exerciseCount: 5,
        syncStatus: {},
        _original: {
          type: 'history',
          data: {
            id: 'workout-1',
            workout: { exercises: [] },
          },
        },
      },
      {
        id: 'workout-2',
        title: 'Test Workout 2',
        category: 'cardio',
        tags: [],
        isFavorite: true,
        createdAt: '2024-01-02',
        exerciseCount: 3,
        syncStatus: { garmin: { synced: true } },
        _original: {
          type: 'history',
          data: {
            id: 'workout-2',
            workout: { exercises: [] },
          },
        },
      },
    ],
    viewMode: 'cards',
    selectedIds: [],
    showDeleteModal: false,
    loadWorkouts: vi.fn(),
    toggleSelect: vi.fn(),
    toggleSelectAll: vi.fn(),
    handleBulkDeleteClick: vi.fn(),
    confirmBulkDelete: vi.fn(),
    cancelBulkDelete: vi.fn(),
    handleDeleteClick: vi.fn(),
    handleDeleteConfirm: vi.fn(),
    handleDeleteCancel: vi.fn(),
    handleFavoriteToggle: vi.fn(),
    handleTagsUpdate: vi.fn(),
    handleEdit: vi.fn(),
    handleLoad: vi.fn(),
    handleView: vi.fn(),
    handleCsvExport: vi.fn(),
    handleApiExport: vi.fn(),
    handleLoadUnified: vi.fn(),
    availableTags: [],
    setViewMode: vi.fn(),
    setSearchQuery: vi.fn(),
    setSourceFilter: vi.fn(),
    setPlatformFilter: vi.fn(),
    setCategoryFilter: vi.fn(),
    setSyncFilter: vi.fn(),
    setSortOption: vi.fn(),
    setPageIndex: vi.fn(),
    showActivityHistory: false,
    setShowActivityHistory: vi.fn(),
    showTagManagement: false,
    setShowTagManagement: vi.fn(),
    // Mock completions for badge tests
    completions: [
      {
        id: 'comp-1',
        workoutName: 'Test Workout 2',
        startedAt: '2024-01-15T10:00:00',
        durationSeconds: 3600,
        source: 'garmin',
        sourceWorkoutId: 'workout-2',
      },
      {
        id: 'comp-2',
        workoutName: 'Test Workout 2',
        startedAt: '2024-01-10T09:00:00',
        durationSeconds: 3600,
        source: 'garmin',
        sourceWorkoutId: 'workout-2',
      },
    ],
    completionsLoading: false,
    completionsTotal: 2,
    selectedCompletionId: null,
    setSelectedCompletionId: vi.fn(),
    confirmDeleteId: null,
    deletingId: null,
    pendingDeleteIds: [],
    pendingEditRef: { current: null },
    tagFilter: [],
    setTagFilter: vi.fn(),
    sortOption: 'recently-added',
    sourceFilter: 'all',
    platformFilter: 'all',
    categoryFilter: 'all',
    syncFilter: 'all',
    searchQuery: '',
    pageIndex: 0,
    totalPages: 1,
    currentPageIndex: 0,
    pageStart: 0,
    PAGE_SIZE: 10,
    isAllSelected: false,
    loadTags: vi.fn(),
    loadMoreCompletions: vi.fn(),
    viewingWorkout: null,
    setViewingWorkout: vi.fn(),
    editingWorkout: null,
    setEditingWorkout: vi.fn(),
    availablePlatforms: [],
    availableCategories: ['strength', 'cardio'],
    setAllWorkouts: vi.fn(),
  })),
  formatDate: vi.fn(() => 'Jan 1, 2024'),
  getSourceIcon: vi.fn(() => null),
  getSourceLabel: vi.fn(() => 'History'),
}));

// Mock ExportDevicePicker
vi.mock('../Export', () => ({
  ExportDevicePicker: vi.fn(() => <div data-testid="export-device-picker">Export Device Picker</div>),
}));

// Mock getPrimaryExportDestinations
vi.mock('../../lib/devices', () => ({
  getPrimaryExportDestinations: vi.fn(() => []),
}));

const defaultProps = {
  profileId: 'user-1',
  onEditWorkout: vi.fn(),
  onLoadWorkout: vi.fn(),
  onDeleteWorkout: vi.fn(),
  onExportWorkout: vi.fn(),
};

describe('Library card badges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows completion count on a workout card with completions', () => {
    render(<WorkoutList {...defaultProps} />);

    // Workout "Test Workout 2" has 2 completions in the mock
    // Should show "Done 2×" text
    expect(screen.getByText(/Done 2×/)).toBeInTheDocument();
  });

  it('shows sync status on a workout card', () => {
    render(<WorkoutList {...defaultProps} />);

    // Workout "Test Workout 2" has garmin synced: true
    // Should show "Garmin ✓" - there are two instances (badge below title and top-right badge)
    const syncBadges = screen.getAllByText(/Garmin ✓/);
    expect(syncBadges.length).toBeGreaterThanOrEqual(1);
  });
});
