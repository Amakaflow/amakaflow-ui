/**
 * Tests for WorkoutList export button consolidation.
 * Verifies that there is exactly one export button per card, not two.
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
    toggleSelectId: vi.fn(),
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
    completions: [],
    completionsLoading: false,
    completionsTotal: 0,
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

describe('WorkoutList export buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders one export button per card, not two', () => {
    render(<WorkoutList {...defaultProps} />);

    // Find all export buttons - should have one per workout card
    // The ExportPopoverButton has data-testid="workout-export-{workoutId}"
    const exportButtons = screen.getAllByTestId(/^workout-export-/);
    
    // There should be exactly 2 export buttons (one per workout in our mock data)
    expect(exportButtons).toHaveLength(2);
  });

  it('does NOT render any CSV or FIT download buttons', () => {
    render(<WorkoutList {...defaultProps} />);

    // The old dropdown had these text labels - they should NOT be present
    expect(screen.queryByText('CSV (Strong/Hevy)')).not.toBeInTheDocument();
    expect(screen.queryByText('CSV (Strong/Hevy compatible)')).not.toBeInTheDocument();
    expect(screen.queryByText('CSV (Extended)')).not.toBeInTheDocument();
    expect(screen.queryByText('CSV (Extended for spreadsheets)')).not.toBeInTheDocument();
    expect(screen.queryByText('FIT (Garmin)')).not.toBeInTheDocument();
    expect(screen.queryByText('TCX')).not.toBeInTheDocument();
    expect(screen.queryByText('Text (TrainingPeaks)')).not.toBeInTheDocument();
    expect(screen.queryByText('JSON')).not.toBeInTheDocument();
    expect(screen.queryByText('PDF')).not.toBeInTheDocument();
  });
});
