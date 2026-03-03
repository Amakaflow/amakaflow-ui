/**
 * Tests for Add to Calendar functionality in WorkoutList component.
 *
 * Part of AMA-894: Add "Add to Calendar" button to Library cards
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkoutList } from '../WorkoutList';
import type { WorkoutHistoryItem } from '../../lib/workout-history';

// Create a mock implementation for useWorkoutList
const createMockUseWorkoutList = (workouts: any[]) => ({
  isLoading: false,
  error: null,
  allWorkouts: workouts,
  setAllWorkouts: vi.fn(),
  viewMode: 'cards' as const,
  setViewMode: vi.fn(),
  searchQuery: '',
  setSearchQuery: vi.fn(),
  sourceFilter: 'all' as const,
  setSourceFilter: vi.fn(),
  platformFilter: 'all',
  setPlatformFilter: vi.fn(),
  categoryFilter: 'all',
  setCategoryFilter: vi.fn(),
  syncFilter: 'all' as const,
  setSyncFilter: vi.fn(),
  sortOption: 'recently-added' as const,
  setSortOption: vi.fn(),
  pageIndex: 0,
  setPageIndex: vi.fn(),
  PAGE_SIZE: 20,
  selectedIds: [],
  showDeleteModal: false,
  pendingDeleteIds: [],
  confirmDeleteId: null,
  deletingId: null,
  viewingWorkout: null,
  setViewingWorkout: vi.fn(),
  editingWorkout: null,
  setEditingWorkout: vi.fn(),
  pendingEditRef: { current: null },
  tagFilter: [],
  setTagFilter: vi.fn(),
  availableTags: [],
  showTagManagement: false,
  setShowTagManagement: vi.fn(),
  showActivityHistory: false,
  setShowActivityHistory: vi.fn(),
  completions: [],
  completionsLoading: false,
  completionsTotal: 0,
  selectedCompletionId: null,
  setSelectedCompletionId: vi.fn(),
  availablePlatforms: [],
  availableCategories: [],
  filteredWorkouts: workouts,
  totalPages: 1,
  currentPageIndex: 0,
  pageStart: 0,
  displayedWorkouts: workouts,
  isAllSelected: false,
  loadWorkouts: vi.fn(),
  loadTags: vi.fn(),
  loadMoreCompletions: vi.fn(),
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
  handleEditWorkout: vi.fn(),
  handleCsvExport: vi.fn(),
  handleApiExport: vi.fn(),
  handleLoadUnified: vi.fn(),
});

// Mock the useWorkoutList hook
vi.mock('../hooks/useWorkoutList', () => ({
  useWorkoutList: vi.fn(),
  formatDate: vi.fn(() => 'Jan 1, 2024'),
  getSourceIcon: vi.fn(() => null),
  getSourceLabel: vi.fn(() => 'History'),
}));

// Mock sub-components
vi.mock('../ViewWorkout', () => ({
  ViewWorkout: vi.fn(() => null),
}));

vi.mock('../WorkoutEditor/WorkoutEditSheet', () => ({
  WorkoutEditSheet: vi.fn(() => null),
}));

vi.mock('../ProgramsSection', () => ({
  ProgramsSection: vi.fn(() => null),
}));

vi.mock('../TagPill', () => ({
  TagPill: vi.fn(() => null),
}));

vi.mock('../TagManagementModal', () => ({
  TagManagementModal: vi.fn(() => null),
}));

vi.mock('../WorkoutTagsEditor', () => ({
  WorkoutTagsEditor: vi.fn(() => null),
}));

vi.mock('../ActivityHistory', () => ({
  ActivityHistory: vi.fn(() => null),
}));

vi.mock('../CompletionDetailView', () => ({
  CompletionDetailView: vi.fn(() => null),
}));

vi.mock('../UnifiedWorkoutCard', () => ({
  SyncStatusIndicator: vi.fn(() => null),
}));

vi.mock('../Export', () => ({
  ExportDevicePicker: vi.fn(() => null),
}));

// Sample workout data
const mockWorkout: WorkoutHistoryItem = {
  id: 'workout-1',
  workout: {
    id: 'workout-1',
    name: 'Test Workout',
    blocks: [],
  },
  created_at: new Date().toISOString(),
  type: 'history',
  sources: [],
  device: 'web',
};

// Import the mocked module
import { useWorkoutList } from '../hooks/useWorkoutList';

describe('Add to Calendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUnifiedWorkout = {
    id: 'workout-1',
    title: 'Test Workout',
    _original: mockWorkout,
    createdAt: new Date().toISOString(),
    category: 'strength',
    exerciseCount: 5,
    tags: [],
    syncStatus: {},
    isFavorite: false,
    thumbnailUrl: null,
  };

  it('renders Add to Calendar button on each Library card when onAddToCalendar prop is provided', () => {
    // Set up the mock to return workouts
    vi.mocked(useWorkoutList).mockReturnValue(createMockUseWorkoutList([mockUnifiedWorkout]));

    render(
      <WorkoutList
        profileId="user-1"
        onEditWorkout={vi.fn()}
        onLoadWorkout={vi.fn()}
        onDeleteWorkout={vi.fn()}
        onAddToCalendar={vi.fn()}
      />
    );

    // The button should be present
    expect(screen.getByText('Add to Calendar')).toBeInTheDocument();
  });

  it('does not render Add to Calendar button when onAddToCalendar prop is not provided', () => {
    // Set up the mock to return workouts
    vi.mocked(useWorkoutList).mockReturnValue(createMockUseWorkoutList([mockUnifiedWorkout]));

    render(
      <WorkoutList
        profileId="user-1"
        onEditWorkout={vi.fn()}
        onLoadWorkout={vi.fn()}
        onDeleteWorkout={vi.fn()}
      />
    );

    // The button should not be present
    expect(screen.queryByText('Add to Calendar')).not.toBeInTheDocument();
  });

  it('clicking Add to Calendar calls onAddToCalendar with the workout item', () => {
    const onAddToCalendar = vi.fn();

    // Set up the mock to return workouts
    vi.mocked(useWorkoutList).mockReturnValue(createMockUseWorkoutList([mockUnifiedWorkout]));

    render(
      <WorkoutList
        profileId="user-1"
        onEditWorkout={vi.fn()}
        onLoadWorkout={vi.fn()}
        onDeleteWorkout={vi.fn()}
        onAddToCalendar={onAddToCalendar}
      />
    );

    const button = screen.getByText('Add to Calendar');
    fireEvent.click(button);

    expect(onAddToCalendar).toHaveBeenCalledWith(mockWorkout);
  });
});
