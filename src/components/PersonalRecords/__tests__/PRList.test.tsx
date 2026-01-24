/**
 * Tests for PRList component.
 *
 * Part of AMA-482: Create Personal Records (PRs) Component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PRList } from '../PRList';
import {
  createPersonalRecordsReturn,
  createPersonalRecordsLoadingReturn,
  createPersonalRecordsErrorReturn,
  createPersonalRecordsEmptyReturn,
  MOCK_PERSONAL_RECORDS,
} from './fixtures/personal-records.fixtures';

// Mock the usePersonalRecords hook
vi.mock('../../../hooks/useProgressionApi', () => ({
  usePersonalRecords: vi.fn(),
}));

import { usePersonalRecords } from '../../../hooks/useProgressionApi';

const mockUsePersonalRecords = vi.mocked(usePersonalRecords);

describe('PRList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePersonalRecords.mockReturnValue(createPersonalRecordsReturn());
  });

  describe('loading state', () => {
    it('renders loading skeleton', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsLoadingReturn());
      render(<PRList />);
      expect(screen.getByTestId('pr-list-loading')).toBeInTheDocument();
    });

    it('shows filter in loading state', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsLoadingReturn());
      render(<PRList showFilter={true} />);
      expect(screen.getByTestId('record-type-filter')).toBeInTheDocument();
    });

    it('renders multiple skeleton cards', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsLoadingReturn());
      render(<PRList />);
      const loadingContainer = screen.getByTestId('pr-list-loading');
      expect(loadingContainer.children.length).toBeGreaterThan(0);
    });
  });

  describe('error state', () => {
    it('renders error message', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsErrorReturn('Network error'));
      render(<PRList />);
      expect(screen.getByTestId('pr-list-error')).toHaveTextContent('Network error');
    });

    it('shows filter in error state', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsErrorReturn());
      render(<PRList showFilter={true} />);
      expect(screen.getByTestId('record-type-filter')).toBeInTheDocument();
    });

    it('displays descriptive error prefix', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsErrorReturn('API timeout'));
      render(<PRList />);
      expect(screen.getByTestId('pr-list-error')).toHaveTextContent('Failed to load personal records');
    });
  });

  describe('empty state', () => {
    it('renders empty state message', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsEmptyReturn());
      render(<PRList />);
      expect(screen.getByTestId('pr-list-empty')).toBeInTheDocument();
      expect(screen.getByText('No Personal Records Yet')).toBeInTheDocument();
    });

    it('shows encouraging message in empty state', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsEmptyReturn());
      render(<PRList />);
      expect(screen.getByText(/Complete workouts with weight tracking/)).toBeInTheDocument();
    });

    it('has trophy icon in empty state', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsEmptyReturn());
      render(<PRList />);
      const emptyContainer = screen.getByTestId('pr-list-empty');
      expect(emptyContainer.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('records display', () => {
    it('renders all records', () => {
      render(<PRList />);
      const cards = screen.getAllByTestId('pr-card');
      expect(cards).toHaveLength(MOCK_PERSONAL_RECORDS.length);
    });

    it('renders PR list container', () => {
      render(<PRList />);
      expect(screen.getByTestId('pr-list')).toBeInTheDocument();
    });

    it('renders records in scrollable area', () => {
      render(<PRList />);
      const listContainer = screen.getByTestId('pr-list');
      expect(listContainer).toBeInTheDocument();
    });
  });

  describe('filtering', () => {
    it('shows filter by default', () => {
      render(<PRList />);
      expect(screen.getByTestId('record-type-filter')).toBeInTheDocument();
    });

    it('hides filter when showFilter is false', () => {
      render(<PRList showFilter={false} />);
      expect(screen.queryByTestId('record-type-filter')).not.toBeInTheDocument();
    });

    it('calls hook with recordType when filter changes', async () => {
      const user = userEvent.setup();
      render(<PRList />);
      await user.click(screen.getByTestId('filter-1rm'));
      expect(mockUsePersonalRecords).toHaveBeenCalledWith(
        expect.objectContaining({ recordType: '1rm' })
      );
    });

    it('calls hook without recordType when filter is all', async () => {
      const user = userEvent.setup();
      render(<PRList />);
      await user.click(screen.getByTestId('filter-all'));
      expect(mockUsePersonalRecords).toHaveBeenCalledWith(
        expect.objectContaining({ recordType: undefined })
      );
    });

    it('calls hook with max_weight when Max Weight filter clicked', async () => {
      const user = userEvent.setup();
      render(<PRList />);
      await user.click(screen.getByTestId('filter-max_weight'));
      expect(mockUsePersonalRecords).toHaveBeenCalledWith(
        expect.objectContaining({ recordType: 'max_weight' })
      );
    });

    it('calls hook with max_reps when Max Reps filter clicked', async () => {
      const user = userEvent.setup();
      render(<PRList />);
      await user.click(screen.getByTestId('filter-max_reps'));
      expect(mockUsePersonalRecords).toHaveBeenCalledWith(
        expect.objectContaining({ recordType: 'max_reps' })
      );
    });
  });

  describe('props', () => {
    it('passes exerciseId to hook', () => {
      render(<PRList exerciseId="test-exercise" />);
      expect(mockUsePersonalRecords).toHaveBeenCalledWith(
        expect.objectContaining({ exerciseId: 'test-exercise' })
      );
    });

    it('passes limit to hook', () => {
      render(<PRList limit={10} />);
      expect(mockUsePersonalRecords).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10 })
      );
    });
  });

  describe('click handling', () => {
    it('calls onRecordClick when record is clicked', async () => {
      const user = userEvent.setup();
      const onRecordClick = vi.fn();
      render(<PRList onRecordClick={onRecordClick} />);
      const cards = screen.getAllByTestId('pr-card');
      await user.click(cards[0]);
      expect(onRecordClick).toHaveBeenCalledWith(MOCK_PERSONAL_RECORDS[0].exerciseId);
    });

    it('does not throw when onRecordClick is not provided', async () => {
      const user = userEvent.setup();
      render(<PRList />);
      const cards = screen.getAllByTestId('pr-card');
      await expect(user.click(cards[0])).resolves.not.toThrow();
    });

    it('calls onRecordClick with correct exerciseId for each record', async () => {
      const user = userEvent.setup();
      const onRecordClick = vi.fn();
      render(<PRList onRecordClick={onRecordClick} />);
      const cards = screen.getAllByTestId('pr-card');

      await user.click(cards[1]);
      expect(onRecordClick).toHaveBeenCalledWith(MOCK_PERSONAL_RECORDS[1].exerciseId);
    });
  });

  describe('accessibility', () => {
    it('filter buttons are keyboard accessible', async () => {
      const user = userEvent.setup();
      render(<PRList />);

      await user.tab();
      expect(screen.getByTestId('filter-all')).toHaveFocus();
    });

    it('empty state has meaningful text for screen readers', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsEmptyReturn());
      render(<PRList />);
      expect(screen.getByText('No Personal Records Yet')).toBeInTheDocument();
      expect(screen.getByText(/Complete workouts with weight tracking/)).toBeInTheDocument();
    });

    it('error state has meaningful text for screen readers', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsErrorReturn('Connection failed'));
      render(<PRList />);
      expect(screen.getByText(/Failed to load personal records/)).toBeInTheDocument();
    });
  });
});
