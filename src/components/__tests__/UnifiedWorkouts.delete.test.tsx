import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnifiedWorkouts } from '../UnifiedWorkouts';
import type { UnifiedWorkout } from '../../types/unified-workout';

// Mock all dependencies comprehensively
vi.mock('../../lib/unified-workouts', () => ({
  fetchAllWorkouts: vi.fn().mockResolvedValue({ workouts: [], errors: [] }),
}));

vi.mock('../../lib/workout-history', () => ({
  getWorkoutHistory: vi.fn().mockResolvedValue([]),
  deleteWorkoutFromHistory: vi.fn().mockResolvedValue(true),
  saveWorkoutToHistory: vi.fn().mockResolvedValue({ id: '1' }),
  clearWorkoutHistory: vi.fn(),
  updateStravaSyncStatus: vi.fn(),
  getWorkoutStats: vi.fn().mockResolvedValue({ totalWorkouts: 0, thisWeek: 0 }),
}));

vi.mock('../../lib/follow-along-api', () => ({
  deleteFollowAlong: vi.fn().mockResolvedValue({ success: true }),
  listFollowAlong: vi.fn().mockResolvedValue({ items: [] }),
  getFollowAlong: vi.fn(),
  ingestFollowAlong: vi.fn(),
  createFollowAlongManual: vi.fn(),
  pushToGarmin: vi.fn(),
  pushToAppleWatch: vi.fn(),
  pushToIOSCompanion: vi.fn(),
}));

vi.mock('../../lib/workout-api', () => ({
  getUserTags: vi.fn().mockResolvedValue([]),
  toggleWorkoutFavorite: vi.fn().mockResolvedValue(true),
  updateWorkoutTags: vi.fn().mockResolvedValue(true),
  getPrograms: vi.fn().mockResolvedValue([]),
  saveWorkoutToAPI: vi.fn(),
  getWorkout: vi.fn(),
  deleteWorkout: vi.fn(),
}));

vi.mock('../../lib/completions-api', () => ({
  fetchWorkoutCompletions: vi.fn().mockResolvedValue({ completions: [], total: 0 }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Import after mocks are set up
import { fetchAllWorkouts } from '../../lib/unified-workouts';
import { deleteWorkoutFromHistory } from '../../lib/workout-history';

describe('UnifiedWorkouts - Delete Confirmation Flow', () => {
  const mockOnEditWorkout = vi.fn();
  const mockOnLoadWorkout = vi.fn();
  const mockOnDeleteWorkout = vi.fn();

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

  describe('Delete Confirmation Dialog', () => {
    it('should show delete confirmation dialog when delete button is clicked', async () => {
      // Arrange
      const mockWorkouts = [createMockWorkout('1')];
      (fetchAllWorkouts as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        workouts: mockWorkouts,
        errors: [],
      });

      // Act
      render(
        <UnifiedWorkouts
          profileId="user-123"
          onEditWorkout={mockOnEditWorkout}
          onLoadWorkout={mockOnLoadWorkout}
          onDeleteWorkout={mockOnDeleteWorkout}
        />
      );

      // Wait for workouts to load
      await waitFor(() => {
        expect(screen.getByText('Test Workout 1')).toBeInTheDocument();
      });

      // Click the delete button
      const deleteButtons = screen.getAllByRole('button', { name: 'Delete workout' });
      fireEvent.click(deleteButtons[0]);

      // Assert - dialog should be visible
      await waitFor(() => {
        expect(screen.getByText('Delete Workout')).toBeInTheDocument();
        expect(screen.getByText(/are you sure you want to delete this workout/i)).toBeInTheDocument();
      });
    });

    it('should have Cancel and Delete buttons in confirmation dialog', async () => {
      // Arrange
      const mockWorkouts = [createMockWorkout('1')];
      (fetchAllWorkouts as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        workouts: mockWorkouts,
        errors: [],
      });

      // Act
      render(
        <UnifiedWorkouts
          profileId="user-123"
          onEditWorkout={mockOnEditWorkout}
          onLoadWorkout={mockOnLoadWorkout}
          onDeleteWorkout={mockOnDeleteWorkout}
        />
      );

      // Wait for workouts to load and click delete
      await waitFor(() => {
        expect(screen.getByText('Test Workout 1')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: 'Delete workout' });
      fireEvent.click(deleteButtons[0]);

      // Assert - check both buttons exist
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
      });
    });

    it('should close dialog when Cancel is clicked', async () => {
      // Arrange
      const mockWorkouts = [createMockWorkout('1')];
      (fetchAllWorkouts as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        workouts: mockWorkouts,
        errors: [],
      });

      // Act
      render(
        <UnifiedWorkouts
          profileId="user-123"
          onEditWorkout={mockOnEditWorkout}
          onLoadWorkout={mockOnLoadWorkout}
          onDeleteWorkout={mockOnDeleteWorkout}
        />
      );

      // Wait for workouts to load
      await waitFor(() => {
        expect(screen.getByText('Test Workout 1')).toBeInTheDocument();
      });

      // Click delete button to open dialog
      const deleteButtons = screen.getAllByRole('button', { name: 'Delete workout' });
      fireEvent.click(deleteButtons[0]);

      // Wait for dialog to appear
      await waitFor(() => {
        expect(screen.getByText('Delete Workout')).toBeInTheDocument();
      });

      // Click Cancel
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      // Assert - dialog should be closed
      await waitFor(() => {
        expect(screen.queryByText('Delete Workout')).not.toBeInTheDocument();
      });
    });

    it('should delete workout and close dialog when Delete is confirmed', async () => {
      // Arrange
      const mockWorkouts = [createMockWorkout('1')];
      (fetchAllWorkouts as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        workouts: mockWorkouts,
        errors: [],
      });

      // Act
      render(
        <UnifiedWorkouts
          profileId="user-123"
          onEditWorkout={mockOnEditWorkout}
          onLoadWorkout={mockOnLoadWorkout}
          onDeleteWorkout={mockOnDeleteWorkout}
        />
      );

      // Wait for workouts to load
      await waitFor(() => {
        expect(screen.getByText('Test Workout 1')).toBeInTheDocument();
      });

      // Click delete button to open dialog
      const deleteButtons = screen.getAllByRole('button', { name: 'Delete workout' });
      fireEvent.click(deleteButtons[0]);

      // Wait for dialog to appear
      await waitFor(() => {
        expect(screen.getByText('Delete Workout')).toBeInTheDocument();
      });

      // Click Delete to confirm
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      // Assert - workout should be deleted
      await waitFor(() => {
        expect(deleteWorkoutFromHistory).toHaveBeenCalledWith('1', 'user-123');
      });
    });

    it('should call delete with correct workout id and profile id', async () => {
      // Arrange
      const mockWorkouts = [createMockWorkout('test-123')];
      (fetchAllWorkouts as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        workouts: mockWorkouts,
        errors: [],
      });

      // Act
      render(
        <UnifiedWorkouts
          profileId="user-456"
          onEditWorkout={mockOnEditWorkout}
          onLoadWorkout={mockOnLoadWorkout}
          onDeleteWorkout={mockOnDeleteWorkout}
        />
      );

      // Wait for workouts to load
      await waitFor(() => {
        expect(screen.getByText('Test Workout test-123')).toBeInTheDocument();
      });

      // Click delete button to open dialog
      const deleteButtons = screen.getAllByRole('button', { name: 'Delete workout' });
      fireEvent.click(deleteButtons[0]);

      // Wait for dialog to appear
      await waitFor(() => {
        expect(screen.getByText('Delete Workout')).toBeInTheDocument();
      });

      // Click Delete to confirm
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);

      // Assert - verify delete was called with correct parameters
      await waitFor(() => {
        expect(deleteWorkoutFromHistory).toHaveBeenCalledWith('test-123', 'user-456');
      });
    });
  });
});
