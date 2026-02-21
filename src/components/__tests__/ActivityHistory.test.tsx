import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityHistory, formatDuration } from '../ActivityHistory';
import type { WorkoutCompletion } from '../../lib/completions-api';

describe('ActivityHistory', () => {
  const mockOnLoadMore = vi.fn();

  const mockCompletions: WorkoutCompletion[] = [
    {
      id: '1',
      workoutName: 'HIIT Cardio',
      startedAt: '2025-01-15T10:00:00Z',
      durationSeconds: 2700, // 45 minutes
      avgHeartRate: 142,
      maxHeartRate: 175,
      activeCalories: 320,
      source: 'apple_watch',
    },
    {
      id: '2',
      workoutName: 'Strength Training',
      startedAt: '2025-01-14T18:30:00Z',
      durationSeconds: 3150, // 52:30
      avgHeartRate: 118,
      maxHeartRate: 145,
      activeCalories: 280,
      source: 'garmin',
    },
    {
      id: '3',
      workoutName: 'Quick Workout',
      startedAt: '2025-01-13T07:00:00Z',
      durationSeconds: 900, // 15 minutes
      source: 'manual',
    },
  ];

  beforeEach(() => {
    mockOnLoadMore.mockClear();
  });

  describe('formatDuration', () => {
    it('formats seconds to MM:SS for durations under an hour', () => {
      expect(formatDuration(2700)).toBe('45:00');
      expect(formatDuration(900)).toBe('15:00');
      expect(formatDuration(90)).toBe('1:30');
      expect(formatDuration(5)).toBe('0:05');
    });

    it('formats seconds to HH:MM:SS for durations over an hour', () => {
      expect(formatDuration(3661)).toBe('1:01:01');
      expect(formatDuration(7200)).toBe('2:00:00');
      expect(formatDuration(5400)).toBe('1:30:00');
    });
  });

  describe('Loading State', () => {
    it('renders loading skeleton when loading with no completions', () => {
      render(
        <ActivityHistory
          completions={[]}
          loading={true}
          onLoadMore={mockOnLoadMore}
        />
      );

      // Should show skeleton cards (animated pulse elements)
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Empty State', () => {
    it('renders empty state when not loading and no completions', () => {
      render(
        <ActivityHistory
          completions={[]}
          loading={false}
          onLoadMore={mockOnLoadMore}
        />
      );

      expect(screen.getByText(/no activity history yet/i)).toBeInTheDocument();
      expect(screen.getByText(/complete workouts with the ios or android companion app/i)).toBeInTheDocument();
    });
  });

  describe('Completion Cards', () => {
    it('renders completion cards with workout names', () => {
      render(
        <ActivityHistory
          completions={mockCompletions}
          loading={false}
          onLoadMore={mockOnLoadMore}
        />
      );

      expect(screen.getByText('HIIT Cardio')).toBeInTheDocument();
      expect(screen.getByText('Strength Training')).toBeInTheDocument();
      expect(screen.getByText('Quick Workout')).toBeInTheDocument();
    });

    it('renders formatted duration', () => {
      render(
        <ActivityHistory
          completions={mockCompletions}
          loading={false}
          onLoadMore={mockOnLoadMore}
        />
      );

      expect(screen.getByText('45:00')).toBeInTheDocument();
      expect(screen.getByText('52:30')).toBeInTheDocument();
      expect(screen.getByText('15:00')).toBeInTheDocument();
    });

    it('renders heart rate data when available', () => {
      render(
        <ActivityHistory
          completions={mockCompletions}
          loading={false}
          onLoadMore={mockOnLoadMore}
        />
      );

      // Check for heart rate values
      expect(screen.getByText('142')).toBeInTheDocument();
      expect(screen.getByText('175')).toBeInTheDocument();
      expect(screen.getAllByText('bpm').length).toBeGreaterThan(0);
    });

    it('renders calories when available', () => {
      render(
        <ActivityHistory
          completions={mockCompletions}
          loading={false}
          onLoadMore={mockOnLoadMore}
        />
      );

      expect(screen.getByText('320')).toBeInTheDocument();
      expect(screen.getByText('280')).toBeInTheDocument();
      expect(screen.getAllByText('cal').length).toBeGreaterThan(0);
    });

    it('renders source badges', () => {
      render(
        <ActivityHistory
          completions={mockCompletions}
          loading={false}
          onLoadMore={mockOnLoadMore}
        />
      );

      expect(screen.getByText('iOS Companion')).toBeInTheDocument();
      expect(screen.getByText('Garmin')).toBeInTheDocument();
      expect(screen.getByText('Manual')).toBeInTheDocument();
    });
  });

  describe('Load More', () => {
    it('shows Load More button when hasMore is true', () => {
      render(
        <ActivityHistory
          completions={mockCompletions}
          loading={false}
          onLoadMore={mockOnLoadMore}
          hasMore={true}
        />
      );

      expect(screen.getByText('Load More')).toBeInTheDocument();
    });

    it('hides Load More button when hasMore is false', () => {
      render(
        <ActivityHistory
          completions={mockCompletions}
          loading={false}
          onLoadMore={mockOnLoadMore}
          hasMore={false}
        />
      );

      expect(screen.queryByText('Load More')).not.toBeInTheDocument();
    });

    it('calls onLoadMore when Load More button is clicked', () => {
      render(
        <ActivityHistory
          completions={mockCompletions}
          loading={false}
          onLoadMore={mockOnLoadMore}
          hasMore={true}
        />
      );

      fireEvent.click(screen.getByText('Load More'));
      expect(mockOnLoadMore).toHaveBeenCalledTimes(1);
    });

    it('shows loading state on Load More button when loading with existing completions', () => {
      render(
        <ActivityHistory
          completions={mockCompletions}
          loading={true}
          onLoadMore={mockOnLoadMore}
          hasMore={true}
        />
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('disables Load More button when loading', () => {
      render(
        <ActivityHistory
          completions={mockCompletions}
          loading={true}
          onLoadMore={mockOnLoadMore}
          hasMore={true}
        />
      );

      const button = screen.getByRole('button', { name: /loading/i });
      expect(button).toBeDisabled();
    });
  });
});
