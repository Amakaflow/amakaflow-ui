/**
 * Tests for PRSummary component.
 *
 * Part of AMA-482: Create Personal Records (PRs) Component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PRSummary } from '../PRSummary';
import {
  createPersonalRecordsReturn,
  createPersonalRecordsLoadingReturn,
  createPersonalRecordsErrorReturn,
  createPersonalRecordsEmptyReturn,
  MOCK_PERSONAL_RECORDS,
  MOCK_RECORD_RECENT,
} from './fixtures/personal-records.fixtures';

// Mock the usePersonalRecords hook
vi.mock('../../../hooks/useProgressionApi', () => ({
  usePersonalRecords: vi.fn(),
}));

import { usePersonalRecords } from '../../../hooks/useProgressionApi';

const mockUsePersonalRecords = vi.mocked(usePersonalRecords);

describe('PRSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePersonalRecords.mockReturnValue(createPersonalRecordsReturn());
  });

  describe('loading state', () => {
    it('renders loading skeleton', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsLoadingReturn());
      render(<PRSummary />);
      expect(screen.getByTestId('pr-summary-loading')).toBeInTheDocument();
    });

    it('still renders card header when loading', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsLoadingReturn());
      render(<PRSummary />);
      expect(screen.getByText('Personal Records')).toBeInTheDocument();
    });

    it('renders multiple skeleton items based on maxRecords', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsLoadingReturn());
      render(<PRSummary maxRecords={3} />);
      const loadingContainer = screen.getByTestId('pr-summary-loading');
      expect(loadingContainer.children.length).toBeLessThanOrEqual(3);
    });
  });

  describe('error state', () => {
    it('renders error message', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsErrorReturn('API error'));
      render(<PRSummary />);
      expect(screen.getByTestId('pr-summary-error')).toHaveTextContent('API error');
    });

    it('displays descriptive error prefix', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsErrorReturn('Timeout'));
      render(<PRSummary />);
      expect(screen.getByTestId('pr-summary-error')).toHaveTextContent('Failed to load records');
    });
  });

  describe('empty state', () => {
    it('renders empty state', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsEmptyReturn());
      render(<PRSummary />);
      expect(screen.getByTestId('pr-summary-empty')).toBeInTheDocument();
    });

    it('shows encouraging message', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsEmptyReturn());
      render(<PRSummary />);
      expect(screen.getByText(/Start lifting to set your first PR/)).toBeInTheDocument();
    });

    it('does not show View All button when empty', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsEmptyReturn());
      const onViewAll = vi.fn();
      render(<PRSummary onViewAll={onViewAll} />);
      expect(screen.queryByTestId('pr-summary-view-all')).not.toBeInTheDocument();
    });

    it('has trophy icon in empty state', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsEmptyReturn());
      render(<PRSummary />);
      const emptyContainer = screen.getByTestId('pr-summary-empty');
      expect(emptyContainer.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('records display', () => {
    it('renders summary card', () => {
      render(<PRSummary />);
      expect(screen.getByTestId('pr-summary')).toBeInTheDocument();
    });

    it('renders Personal Records title with trophy icon', () => {
      render(<PRSummary />);
      expect(screen.getByText('Personal Records')).toBeInTheDocument();
    });

    it('renders records list', () => {
      render(<PRSummary />);
      expect(screen.getByTestId('pr-summary-list')).toBeInTheDocument();
    });

    it('renders correct number of items', () => {
      render(<PRSummary />);
      const items = screen.getAllByTestId('pr-summary-item');
      expect(items).toHaveLength(MOCK_PERSONAL_RECORDS.length);
    });

    it('respects maxRecords prop', () => {
      render(<PRSummary maxRecords={2} />);
      const items = screen.getAllByTestId('pr-summary-item');
      expect(items).toHaveLength(2);
    });

    it('passes correct limit to hook', () => {
      render(<PRSummary maxRecords={3} />);
      expect(mockUsePersonalRecords).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 3 })
      );
    });

    it('uses default maxRecords of 5', () => {
      render(<PRSummary />);
      expect(mockUsePersonalRecords).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5 })
      );
    });
  });

  describe('compact item display', () => {
    it('renders exercise name', () => {
      render(<PRSummary />);
      const exerciseNames = screen.getAllByTestId('pr-summary-exercise');
      expect(exerciseNames[0]).toHaveTextContent(MOCK_PERSONAL_RECORDS[0].exerciseName);
    });

    it('renders value with unit', () => {
      render(<PRSummary />);
      const values = screen.getAllByTestId('pr-summary-value');
      expect(values[0]).toHaveTextContent(`${MOCK_PERSONAL_RECORDS[0].value} ${MOCK_PERSONAL_RECORDS[0].unit}`);
    });

    it('renders record type badge', () => {
      render(<PRSummary />);
      const types = screen.getAllByTestId('pr-summary-type');
      expect(types[0]).toBeInTheDocument();
    });

    it('shows New badge for recent records', () => {
      mockUsePersonalRecords.mockReturnValue(
        createPersonalRecordsReturn({ records: [MOCK_RECORD_RECENT] })
      );
      render(<PRSummary />);
      expect(screen.getByTestId('pr-summary-new-badge')).toHaveTextContent('New!');
    });

    it('displays abbreviated record type labels', () => {
      render(<PRSummary />);
      const types = screen.getAllByTestId('pr-summary-type');
      // Check that at least one of the expected abbreviated labels exists
      const typeTexts = types.map(t => t.textContent);
      expect(typeTexts.some(t => t === '1RM' || t === 'Max' || t === 'Reps')).toBe(true);
    });
  });

  describe('View All button', () => {
    it('shows View All button when onViewAll is provided', () => {
      const onViewAll = vi.fn();
      render(<PRSummary onViewAll={onViewAll} />);
      expect(screen.getByTestId('pr-summary-view-all')).toBeInTheDocument();
    });

    it('does not show View All button when onViewAll is not provided', () => {
      render(<PRSummary />);
      expect(screen.queryByTestId('pr-summary-view-all')).not.toBeInTheDocument();
    });

    it('calls onViewAll when clicked', async () => {
      const user = userEvent.setup();
      const onViewAll = vi.fn();
      render(<PRSummary onViewAll={onViewAll} />);
      await user.click(screen.getByTestId('pr-summary-view-all'));
      expect(onViewAll).toHaveBeenCalledTimes(1);
    });

    it('View All button has correct text', () => {
      const onViewAll = vi.fn();
      render(<PRSummary onViewAll={onViewAll} />);
      expect(screen.getByTestId('pr-summary-view-all')).toHaveTextContent('View All');
    });
  });

  describe('click handling', () => {
    it('calls onRecordClick when item is clicked', async () => {
      const user = userEvent.setup();
      const onRecordClick = vi.fn();
      render(<PRSummary onRecordClick={onRecordClick} />);
      const items = screen.getAllByTestId('pr-summary-item');
      await user.click(items[0]);
      expect(onRecordClick).toHaveBeenCalledWith(MOCK_PERSONAL_RECORDS[0].exerciseId);
    });

    it('does not throw when onRecordClick is not provided', async () => {
      const user = userEvent.setup();
      render(<PRSummary />);
      const items = screen.getAllByTestId('pr-summary-item');
      await expect(user.click(items[0])).resolves.not.toThrow();
    });

    it('applies hover styles when clickable', () => {
      const onRecordClick = vi.fn();
      render(<PRSummary onRecordClick={onRecordClick} />);
      const items = screen.getAllByTestId('pr-summary-item');
      expect(items[0]).toHaveClass('cursor-pointer');
    });

    it('does not apply hover styles when not clickable', () => {
      render(<PRSummary />);
      const items = screen.getAllByTestId('pr-summary-item');
      expect(items[0]).not.toHaveClass('cursor-pointer');
    });

    it('calls onRecordClick with correct exerciseId for each record', async () => {
      const user = userEvent.setup();
      const onRecordClick = vi.fn();
      render(<PRSummary onRecordClick={onRecordClick} />);
      const items = screen.getAllByTestId('pr-summary-item');

      await user.click(items[1]);
      expect(onRecordClick).toHaveBeenCalledWith(MOCK_PERSONAL_RECORDS[1].exerciseId);
    });
  });

  describe('accessibility', () => {
    it('card has proper heading structure', () => {
      render(<PRSummary />);
      expect(screen.getByText('Personal Records')).toBeInTheDocument();
    });

    it('View All button is keyboard accessible', async () => {
      const user = userEvent.setup();
      const onViewAll = vi.fn();
      render(<PRSummary onViewAll={onViewAll} />);

      const viewAllButton = screen.getByTestId('pr-summary-view-all');
      viewAllButton.focus();
      await user.keyboard('{Enter}');
      expect(onViewAll).toHaveBeenCalled();
    });

    it('View All button can be activated with Space', async () => {
      const user = userEvent.setup();
      const onViewAll = vi.fn();
      render(<PRSummary onViewAll={onViewAll} />);

      const viewAllButton = screen.getByTestId('pr-summary-view-all');
      viewAllButton.focus();
      await user.keyboard(' ');
      expect(onViewAll).toHaveBeenCalled();
    });

    it('empty state has meaningful text for screen readers', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsEmptyReturn());
      render(<PRSummary />);
      expect(screen.getByText(/No personal records yet/i)).toBeInTheDocument();
    });

    it('error state has meaningful text for screen readers', () => {
      mockUsePersonalRecords.mockReturnValue(createPersonalRecordsErrorReturn('Network error'));
      render(<PRSummary />);
      expect(screen.getByText(/Failed to load records/)).toBeInTheDocument();
    });
  });
});
