/**
 * Tests for RecordTypeFilter component.
 *
 * Part of AMA-482: Create Personal Records (PRs) Component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecordTypeFilter, type RecordTypeFilterValue } from '../RecordTypeFilter';

describe('RecordTypeFilter', () => {
  const defaultProps = {
    value: 'all' as RecordTypeFilterValue,
    onChange: vi.fn(),
  };

  describe('rendering', () => {
    it('renders filter container', () => {
      render(<RecordTypeFilter {...defaultProps} />);
      expect(screen.getByTestId('record-type-filter')).toBeInTheDocument();
    });

    it('renders all four filter options', () => {
      render(<RecordTypeFilter {...defaultProps} />);
      expect(screen.getByTestId('filter-all')).toBeInTheDocument();
      expect(screen.getByTestId('filter-1rm')).toBeInTheDocument();
      expect(screen.getByTestId('filter-max_weight')).toBeInTheDocument();
      expect(screen.getByTestId('filter-max_reps')).toBeInTheDocument();
    });

    it('shows correct labels', () => {
      render(<RecordTypeFilter {...defaultProps} />);
      expect(screen.getByTestId('filter-all')).toHaveTextContent('All');
      expect(screen.getByTestId('filter-1rm')).toHaveTextContent('1RM');
      expect(screen.getByTestId('filter-max_weight')).toHaveTextContent('Max Weight');
      expect(screen.getByTestId('filter-max_reps')).toHaveTextContent('Max Reps');
    });

    it('renders All as first option', () => {
      render(<RecordTypeFilter {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toHaveTextContent('All');
    });
  });

  describe('selection state', () => {
    it('highlights selected filter when value is all', () => {
      render(<RecordTypeFilter value="all" onChange={vi.fn()} />);
      const allButton = screen.getByTestId('filter-all');
      // Default variant has bg-primary class
      expect(allButton).toHaveClass('bg-primary');
    });

    it('highlights selected filter when value is 1rm', () => {
      render(<RecordTypeFilter value="1rm" onChange={vi.fn()} />);
      const button = screen.getByTestId('filter-1rm');
      expect(button).toHaveClass('bg-primary');
    });

    it('highlights selected filter when value is max_weight', () => {
      render(<RecordTypeFilter value="max_weight" onChange={vi.fn()} />);
      const button = screen.getByTestId('filter-max_weight');
      expect(button).toHaveClass('bg-primary');
    });

    it('highlights selected filter when value is max_reps', () => {
      render(<RecordTypeFilter value="max_reps" onChange={vi.fn()} />);
      const button = screen.getByTestId('filter-max_reps');
      expect(button).toHaveClass('bg-primary');
    });

    it('non-selected filters have outline variant', () => {
      render(<RecordTypeFilter value="1rm" onChange={vi.fn()} />);
      const allButton = screen.getByTestId('filter-all');
      // Outline variant has border class but not bg-primary
      expect(allButton).not.toHaveClass('bg-primary');
    });
  });

  describe('click interactions', () => {
    it('calls onChange with "all" when All clicked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<RecordTypeFilter value="1rm" onChange={onChange} />);

      await user.click(screen.getByTestId('filter-all'));
      expect(onChange).toHaveBeenCalledWith('all');
    });

    it('calls onChange with "1rm" when 1RM clicked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<RecordTypeFilter value="all" onChange={onChange} />);

      await user.click(screen.getByTestId('filter-1rm'));
      expect(onChange).toHaveBeenCalledWith('1rm');
    });

    it('calls onChange with "max_weight" when Max Weight clicked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<RecordTypeFilter value="all" onChange={onChange} />);

      await user.click(screen.getByTestId('filter-max_weight'));
      expect(onChange).toHaveBeenCalledWith('max_weight');
    });

    it('calls onChange with "max_reps" when Max Reps clicked', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<RecordTypeFilter value="all" onChange={onChange} />);

      await user.click(screen.getByTestId('filter-max_reps'));
      expect(onChange).toHaveBeenCalledWith('max_reps');
    });

    it('calls onChange even when clicking already selected filter', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<RecordTypeFilter value="all" onChange={onChange} />);

      await user.click(screen.getByTestId('filter-all'));
      expect(onChange).toHaveBeenCalledWith('all');
    });
  });

  describe('accessibility', () => {
    it('renders buttons with accessible role', () => {
      render(<RecordTypeFilter {...defaultProps} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(4);
    });

    it('buttons have accessible text content', () => {
      render(<RecordTypeFilter {...defaultProps} />);
      expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '1RM' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Max Weight' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Max Reps' })).toBeInTheDocument();
    });

    it('supports keyboard activation with Enter', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<RecordTypeFilter value="all" onChange={onChange} />);

      const button = screen.getByTestId('filter-1rm');
      button.focus();
      await user.keyboard('{Enter}');
      expect(onChange).toHaveBeenCalledWith('1rm');
    });

    it('supports keyboard activation with Space', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<RecordTypeFilter value="all" onChange={onChange} />);

      const button = screen.getByTestId('filter-max_weight');
      button.focus();
      await user.keyboard(' ');
      expect(onChange).toHaveBeenCalledWith('max_weight');
    });

    it('buttons are tabbable', async () => {
      const user = userEvent.setup();
      render(<RecordTypeFilter {...defaultProps} />);

      await user.tab();
      expect(screen.getByTestId('filter-all')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('filter-1rm')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('filter-max_weight')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('filter-max_reps')).toHaveFocus();
    });
  });
});
