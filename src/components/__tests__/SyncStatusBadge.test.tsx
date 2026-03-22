/**
 * AMA-305: Tests for SyncStatusBadge component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncStatusBadge } from '../SyncStatusBadge';
import type { SyncState } from '../../types/unified-workout';

describe('AMA-305: SyncStatusBadge', () => {
  it('renders synced state with green check', () => {
    render(<SyncStatusBadge status="synced" />);
    expect(screen.getByText('Synced')).toBeInTheDocument();
    expect(screen.getByTestId('icon-check')).toBeInTheDocument();
  });

  it('renders pending state with spinner', () => {
    render(<SyncStatusBadge status="pending" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByTestId('icon-spinner')).toBeInTheDocument();
  });

  it('renders syncing state with spinner', () => {
    render(<SyncStatusBadge status="syncing" />);
    expect(screen.getByText('Syncing')).toBeInTheDocument();
    expect(screen.getByTestId('icon-spinner')).toBeInTheDocument();
  });

  it('renders failed state with X icon', () => {
    render(<SyncStatusBadge status="failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByTestId('icon-x')).toBeInTheDocument();
  });

  it('shows retry button on failed state when onRetry provided', () => {
    const onRetry = vi.fn();
    render(<SyncStatusBadge status="failed" onRetry={onRetry} />);
    const retryButton = screen.getByTestId('sync-retry-button');
    expect(retryButton).toBeInTheDocument();
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('does not show retry button when onRetry not provided', () => {
    render(<SyncStatusBadge status="failed" />);
    expect(screen.queryByTestId('sync-retry-button')).not.toBeInTheDocument();
  });

  it('does not show retry button for non-failed states', () => {
    const onRetry = vi.fn();
    render(<SyncStatusBadge status="synced" onRetry={onRetry} />);
    expect(screen.queryByTestId('sync-retry-button')).not.toBeInTheDocument();
  });

  it('renders not_assigned state', () => {
    render(<SyncStatusBadge status="not_assigned" />);
    expect(screen.getByText('Not synced')).toBeInTheDocument();
  });

  it('renders outdated state', () => {
    render(<SyncStatusBadge status="outdated" />);
    expect(screen.getByText('Outdated')).toBeInTheDocument();
  });

  it('has sync-status-badge test id', () => {
    render(<SyncStatusBadge status="synced" />);
    expect(screen.getByTestId('sync-status-badge')).toBeInTheDocument();
  });

  it('accepts className prop', () => {
    render(<SyncStatusBadge status="synced" className="my-custom-class" />);
    expect(screen.getByTestId('sync-status-badge')).toHaveClass('my-custom-class');
  });
});
