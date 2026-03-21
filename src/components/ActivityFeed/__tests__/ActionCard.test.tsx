/**
 * Tests for ActionCard component (AMA-1124).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActionCard } from '../ActionCard';
import {
  MOCK_APPROVED_ACTION,
  MOCK_PENDING_ACTION,
  MOCK_REJECTED_ACTION,
  MOCK_UNDONE_ACTION,
  MOCK_IRREVERSIBLE_APPROVED,
} from './fixtures/actions.fixtures';

describe('ActionCard', () => {
  describe('rendering', () => {
    it('renders action type label', () => {
      render(<ActionCard action={MOCK_APPROVED_ACTION} />);
      expect(screen.getByTestId('action-type')).toHaveTextContent('Enrich Title');
    });

    it('renders agent badge', () => {
      render(<ActionCard action={MOCK_APPROVED_ACTION} />);
      expect(screen.getByTestId('agent-badge')).toHaveTextContent('Strava');
    });

    it('renders rationale text', () => {
      render(<ActionCard action={MOCK_PENDING_ACTION} />);
      expect(screen.getByTestId('action-rationale')).toHaveTextContent(
        'Acute:chronic ratio is high',
      );
    });

    it('renders time ago', () => {
      render(<ActionCard action={MOCK_APPROVED_ACTION} />);
      expect(screen.getByTestId('action-time')).toBeTruthy();
    });
  });

  describe('status icons', () => {
    it('shows green check for approved', () => {
      render(<ActionCard action={MOCK_APPROVED_ACTION} />);
      expect(screen.getByTestId('status-icon-approved')).toBeTruthy();
    });

    it('shows amber warning for pending', () => {
      render(<ActionCard action={MOCK_PENDING_ACTION} />);
      expect(screen.getByTestId('status-icon-pending')).toBeTruthy();
    });

    it('shows red X for rejected', () => {
      render(<ActionCard action={MOCK_REJECTED_ACTION} />);
      expect(screen.getByTestId('status-icon-rejected')).toBeTruthy();
    });

    it('shows gray icon for undone', () => {
      render(<ActionCard action={MOCK_UNDONE_ACTION} />);
      expect(screen.getByTestId('status-icon-undone')).toBeTruthy();
    });
  });

  describe('pending action buttons', () => {
    it('shows approve and reject buttons for pending actions', () => {
      render(<ActionCard action={MOCK_PENDING_ACTION} />);
      expect(screen.getByTestId('approve-btn')).toHaveTextContent('Approve');
      expect(screen.getByTestId('reject-btn')).toHaveTextContent('Reject');
    });

    it('calls onApprove when approve button clicked', async () => {
      const user = userEvent.setup();
      const onApprove = vi.fn();
      render(<ActionCard action={MOCK_PENDING_ACTION} onApprove={onApprove} />);
      await user.click(screen.getByTestId('approve-btn'));
      expect(onApprove).toHaveBeenCalledWith('test-act-002');
    });

    it('calls onReject when reject button clicked', async () => {
      const user = userEvent.setup();
      const onReject = vi.fn();
      render(<ActionCard action={MOCK_PENDING_ACTION} onReject={onReject} />);
      await user.click(screen.getByTestId('reject-btn'));
      expect(onReject).toHaveBeenCalledWith('test-act-002');
    });

    it('does not show approve/reject for non-pending actions', () => {
      render(<ActionCard action={MOCK_APPROVED_ACTION} />);
      expect(screen.queryByTestId('pending-actions')).toBeNull();
    });
  });

  describe('undo button', () => {
    it('shows undo button for recent reversible approved actions', () => {
      // Make applied_at recent (within 24h)
      const recentAction = {
        ...MOCK_APPROVED_ACTION,
        applied_at: new Date().toISOString(),
      };
      render(<ActionCard action={recentAction} />);
      expect(screen.getByTestId('undo-btn')).toHaveTextContent('Undo');
    });

    it('does not show undo for irreversible actions', () => {
      render(<ActionCard action={MOCK_IRREVERSIBLE_APPROVED} />);
      expect(screen.queryByTestId('undo-btn')).toBeNull();
    });

    it('does not show undo for undone actions', () => {
      render(<ActionCard action={MOCK_UNDONE_ACTION} />);
      expect(screen.queryByTestId('undo-btn')).toBeNull();
    });

    it('calls onUndo when undo button clicked', async () => {
      const user = userEvent.setup();
      const onUndo = vi.fn();
      const recentAction = {
        ...MOCK_APPROVED_ACTION,
        applied_at: new Date().toISOString(),
      };
      render(<ActionCard action={recentAction} onUndo={onUndo} />);
      await user.click(screen.getByTestId('undo-btn'));
      expect(onUndo).toHaveBeenCalledWith('test-act-001');
    });
  });
});
