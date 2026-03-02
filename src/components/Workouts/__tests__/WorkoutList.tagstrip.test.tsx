import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { WorkoutList } from '../WorkoutList';
import type { UserTag, UnifiedWorkout } from '../../../types/unified-workout';

// Mock the useWorkoutList hook
const mockAvailableTags: UserTag[] = [
  { id: '1', name: 'Cardio', color: '#ef4444' },
  { id: '2', name: 'Strength', color: '#3b82f6' },
  { id: '3', name: 'Yoga', color: '#22c55e' },
];

// Minimal mock workout to prevent empty state
const mockWorkout: UnifiedWorkout = {
  id: 'workout-1',
  title: 'Test Workout',
  category: 'strength',
  exerciseCount: 5,
  createdAt: '2024-01-01',
  tags: [],
  isFavorite: false,
  syncStatus: {},
  _original: {
    type: 'history',
    data: {} as any,
  },
} as UnifiedWorkout;

const mockSetTagFilter = vi.fn();
const mockSetPageIndex = vi.fn();

const mockUseWorkoutList = {
  isLoading: false,
  error: null,
  allWorkouts: [mockWorkout],
  viewMode: 'compact' as const,
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
  setPageIndex: mockSetPageIndex,
  PAGE_SIZE: 10,
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
  tagFilter: null as string | null,
  setTagFilter: mockSetTagFilter,
  availableTags: mockAvailableTags,
  showTagManagement: false,
  setShowTagManagement: vi.fn(),
  showMixWizard: false,
  setShowMixWizard: vi.fn(),
  showActivityHistory: false,
  setShowActivityHistory: vi.fn(),
  completions: [],
  completionsLoading: false,
  completionsTotal: 0,
  selectedCompletionId: null,
  setSelectedCompletionId: vi.fn(),
  availablePlatforms: [],
  availableCategories: [],
  filteredWorkouts: [mockWorkout],
  totalPages: 1,
  currentPageIndex: 0,
  pageStart: 0,
  displayedWorkouts: [mockWorkout],
  isAllSelected: false,
  loadWorkouts: vi.fn(),
  loadTags: vi.fn(),
  loadMoreCompletions: vi.fn(),
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
  handleEditWorkout: vi.fn(),
  handleCsvExport: vi.fn(),
  handleApiExport: vi.fn(),
  handleLoadUnified: vi.fn(),
  // Also need to export the helper functions
  formatDate: vi.fn(() => 'Jan 1, 2024'),
  getSourceIcon: vi.fn(() => null),
  getSourceLabel: vi.fn(() => 'Manual'),
};

vi.mock('../hooks/useWorkoutList', () => ({
  useWorkoutList: vi.fn(() => mockUseWorkoutList),
  formatDate: vi.fn(() => 'Jan 1, 2024'),
  getSourceIcon: vi.fn(() => null),
  getSourceLabel: vi.fn(() => 'Manual'),
}));

// Mock child components
vi.mock('../ViewWorkout', () => ({
  ViewWorkout: vi.fn(() => null),
}));

vi.mock('../WorkoutEditor/WorkoutEditSheet', () => ({
  WorkoutEditSheet: vi.fn(() => null),
}));

vi.mock('../MixWizard/MixWizardModal', () => ({
  MixWizardModal: vi.fn(() => null),
}));

vi.mock('../ProgramsSection', () => ({
  ProgramsSection: vi.fn(() => null),
}));

vi.mock('../ActivityHistory', () => ({
  ActivityHistory: vi.fn(() => null),
}));

vi.mock('../CompletionDetailView', () => ({
  CompletionDetailView: vi.fn(() => null),
}));

vi.mock('../TagManagementModal', () => ({
  TagManagementModal: vi.fn(() => null),
}));

vi.mock('../WorkoutTagsEditor', () => ({
  WorkoutTagsEditor: vi.fn(() => null),
}));

vi.mock('../Export', () => ({
  ExportDevicePicker: vi.fn(() => null),
}));

vi.mock('../../lib/devices', () => ({
  getPrimaryExportDestinations: vi.fn(() => []),
}));

vi.mock('../../lib/workout-api', () => ({
  saveWorkoutToAPI: vi.fn(),
}));

describe('Library tag strip', () => {
  const defaultProps = {
    profileId: 'user-1',
    onEditWorkout: vi.fn(),
    onLoadWorkout: vi.fn(),
    onDeleteWorkout: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetTagFilter.mockClear();
    mockSetPageIndex.mockClear();
  });

  it('renders All tag and available user tags', async () => {
    render(<WorkoutList {...defaultProps} />);

    // Check All tag is rendered
    expect(screen.getByTestId('tag-all')).toBeInTheDocument();
    expect(screen.getByTestId('tag-all')).toHaveTextContent('All');

    // Check user tags are rendered
    expect(screen.getByTestId('tag-Cardio')).toBeInTheDocument();
    expect(screen.getByTestId('tag-Cardio')).toHaveTextContent('Cardio');

    expect(screen.getByTestId('tag-Strength')).toBeInTheDocument();
    expect(screen.getByTestId('tag-Strength')).toHaveTextContent('Strength');

    expect(screen.getByTestId('tag-Yoga')).toBeInTheDocument();
    expect(screen.getByTestId('tag-Yoga')).toHaveTextContent('Yoga');
  });

  it('does NOT render source/platform/category/sync dropdowns', async () => {
    render(<WorkoutList {...defaultProps} />);

    // Check that the old filter dropdowns are NOT rendered
    expect(screen.queryByTestId('filter-source')).not.toBeInTheDocument();
    expect(screen.queryByTestId('filter-platform')).not.toBeInTheDocument();
    expect(screen.queryByTestId('filter-category')).not.toBeInTheDocument();
    expect(screen.queryByTestId('filter-sync')).not.toBeInTheDocument();
  });

  it('clicking a tag button sets it as active', async () => {
    render(<WorkoutList {...defaultProps} />);

    // Click on a tag
    const cardioTag = screen.getByTestId('tag-Cardio');
    fireEvent.click(cardioTag);

    // Check setTagFilter was called with the tag name
    expect(mockSetTagFilter).toHaveBeenCalledWith('Cardio');
    expect(mockSetPageIndex).toHaveBeenCalledWith(0);
  });
});
