/**
 * WorkoutList tabs test - verifies 3-tab shell structure
 *
 * Tests: Library, Programs, History tabs rendering and switching
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkoutList } from '../WorkoutList';
import type { UnifiedWorkout } from '../../../types/unified-workout';

// Mock lucide-react so icon components work as plain function calls in jsdom
vi.mock('lucide-react', async () => {
  const React = await import('react');
  const icon = (props: Record<string, unknown>) =>
    React.createElement('span', { 'data-testid': 'icon', ...props });
  const handler = { get: (_: unknown, name: string) => name === '__esModule' ? true : icon };
  return new Proxy({}, handler);
});

// Mock all dependencies comprehensively
vi.mock('../../../lib/unified-workouts', () => ({
  fetchAllWorkouts: vi.fn().mockResolvedValue({ workouts: [], errors: [] }),
}));

vi.mock('../../../lib/workout-history', () => ({
  getWorkoutHistory: vi.fn().mockResolvedValue([]),
  deleteWorkoutFromHistory: vi.fn().mockResolvedValue(true),
  saveWorkoutToHistory: vi.fn().mockResolvedValue({ id: '1' }),
  clearWorkoutHistory: vi.fn(),
  updateStravaSyncStatus: vi.fn(),
  getWorkoutStats: vi.fn().mockResolvedValue({ totalWorkouts: 0, thisWeek: 0 }),
}));

vi.mock('../../../lib/follow-along-api', () => ({
  deleteFollowAlong: vi.fn().mockResolvedValue({ success: true }),
  listFollowAlong: vi.fn().mockResolvedValue({ items: [] }),
  getFollowAlong: vi.fn(),
  ingestFollowAlong: vi.fn(),
  createFollowAlongManual: vi.fn(),
  pushToGarmin: vi.fn(),
  pushToAppleWatch: vi.fn(),
  pushToIOSCompanion: vi.fn(),
}));

vi.mock('../../../lib/workout-api', () => ({
  getUserTags: vi.fn().mockResolvedValue([]),
  toggleWorkoutFavorite: vi.fn().mockResolvedValue(true),
  updateWorkoutTags: vi.fn().mockResolvedValue(true),
  getPrograms: vi.fn().mockResolvedValue([]),
  saveWorkoutToAPI: vi.fn(),
  getWorkout: vi.fn(),
  deleteWorkout: vi.fn(),
}));

vi.mock('../../../lib/completions-api', () => ({
  fetchWorkoutCompletions: vi.fn().mockResolvedValue({ completions: [], total: 0 }),
}));

vi.mock('../../../lib/training-program-api', () => ({
  getTrainingPrograms: vi.fn().mockResolvedValue([]),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Import after mocks are set up
import { fetchAllWorkouts } from '../../../lib/unified-workouts';

describe('WorkoutList tabs', () => {
  const mockOnEditWorkout = vi.fn();
  const mockOnLoadWorkout = vi.fn();
  const mockOnDeleteWorkout = vi.fn();
  const mockOnViewProgram = vi.fn();

  const createMockWorkout = (id: string): UnifiedWorkout => ({
    id,
    title: `Test Workout ${id}`,
    category: 'strength',
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T10:00:00Z',
    exerciseCount: 5,
    sourceType: 'history',
    devicePlatform: 'garmin',
    videoPlatform: undefined,
    thumbnailUrl: undefined,
    videoProxyUrl: undefined,
    sourceUrl: undefined,
    syncStatus: {
      garmin: { synced: false },
      apple: { synced: false },
      strava: { synced: false },
      ios: { synced: false },
    },
    isFavorite: false,
    searchableText: `test workout ${id}`,
    tags: [],
    _original: {
      type: 'history',
      data: {
        id,
        workout: { title: `Test Workout ${id}`, blocks: [] },
        sources: [],
        device: 'garmin',
      },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Library, Programs, and History tabs', async () => {
    // Arrange
    const mockWorkouts = [createMockWorkout('1')];
    (fetchAllWorkouts as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      workouts: mockWorkouts,
      errors: [],
    });

    // Act
    render(
      <WorkoutList
        profileId="user-123"
        onEditWorkout={mockOnEditWorkout}
        onLoadWorkout={mockOnLoadWorkout}
        onDeleteWorkout={mockOnDeleteWorkout}
        onViewProgram={mockOnViewProgram}
      />
    );

    // Wait for workouts to load
    await waitFor(() => {
      expect(screen.getByText('My Workouts')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Assert - all three tabs should be visible
    expect(screen.getByRole('tab', { name: /library/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /programs/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /history/i })).toBeInTheDocument();
  });

  it('Library tab is selected by default', async () => {
    // Arrange
    const mockWorkouts = [createMockWorkout('1')];
    (fetchAllWorkouts as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      workouts: mockWorkouts,
      errors: [],
    });

    // Act
    render(
      <WorkoutList
        profileId="user-123"
        onEditWorkout={mockOnEditWorkout}
        onLoadWorkout={mockOnLoadWorkout}
        onDeleteWorkout={mockOnDeleteWorkout}
        onViewProgram={mockOnViewProgram}
      />
    );

    // Wait for workouts to load
    await waitFor(() => {
      expect(screen.getByText('My Workouts')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Assert - Library tab should be selected by default (check via data-state attribute)
    const libraryTab = screen.getByRole('tab', { name: /library/i });
    expect(libraryTab).toHaveAttribute('data-state', 'active');
  });

  it('clicking History tab shows activity-history content', async () => {
    // Arrange
    const mockWorkouts = [createMockWorkout('1')];
    (fetchAllWorkouts as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      workouts: mockWorkouts,
      errors: [],
    });

    // Act
    render(
      <WorkoutList
        profileId="user-123"
        onEditWorkout={mockOnEditWorkout}
        onLoadWorkout={mockOnLoadWorkout}
        onDeleteWorkout={mockOnDeleteWorkout}
        onViewProgram={mockOnViewProgram}
      />
    );

    // Wait for workouts to load
    await waitFor(() => {
      expect(screen.getByText('My Workouts')).toBeInTheDocument();
    }, { timeout: 5000 });

    // Click the History tab
    const historyTab = screen.getByRole('tab', { name: /history/i });
    fireEvent.click(historyTab);

    // Assert - activity-history content should be visible
    expect(screen.getByTestId('activity-history')).toBeInTheDocument();
  });
});
