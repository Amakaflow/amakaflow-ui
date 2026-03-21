/**
 * Tests for PendingDecisionCard (AMA-1127).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PendingDecisionCard } from '../PendingDecisionCard';
import type { PendingDecision } from '../types';

const mockDecision: PendingDecision = {
  id: 'dec-001',
  type: 'conflict',
  title: 'Schedule conflict: Thursday tempo run',
  description: 'Your acute:chronic workload ratio is 1.4.',
  rationale: 'Moving the tempo run to Saturday brings your ratio to 1.2.',
  actions: [
    { id: 'move', label: 'Move to Saturday', variant: 'default', value: 'move_saturday' },
    { id: 'keep', label: 'Keep as is', variant: 'outline', value: 'keep' },
    { id: 'skip', label: 'Skip session', variant: 'ghost', value: 'skip' },
  ],
  createdAt: new Date().toISOString(),
  agent: 'scheduler',
};

describe('PendingDecisionCard', () => {
  it('renders title, description, and rationale', () => {
    render(<PendingDecisionCard decision={mockDecision} onResolve={() => {}} />);

    expect(screen.getByTestId('decision-title')).toHaveTextContent('Schedule conflict: Thursday tempo run');
    expect(screen.getByTestId('decision-description')).toHaveTextContent('Your acute:chronic workload ratio is 1.4.');
    expect(screen.getByTestId('decision-rationale')).toHaveTextContent('Moving the tempo run to Saturday');
  });

  it('renders all action buttons', () => {
    render(<PendingDecisionCard decision={mockDecision} onResolve={() => {}} />);

    expect(screen.getByTestId('decision-action-move')).toHaveTextContent('Move to Saturday');
    expect(screen.getByTestId('decision-action-keep')).toHaveTextContent('Keep as is');
    expect(screen.getByTestId('decision-action-skip')).toHaveTextContent('Skip session');
  });

  it('calls onResolve with correct parameters when action clicked', () => {
    const handleResolve = vi.fn();
    render(<PendingDecisionCard decision={mockDecision} onResolve={handleResolve} />);

    fireEvent.click(screen.getByTestId('decision-action-move'));
    expect(handleResolve).toHaveBeenCalledWith('dec-001', 'move_saturday');
  });

  it('shows agent badge', () => {
    render(<PendingDecisionCard decision={mockDecision} onResolve={() => {}} />);

    expect(screen.getByTestId('decision-agent')).toHaveTextContent('Scheduler');
  });

  it('renders conflict icon for conflict type', () => {
    render(<PendingDecisionCard decision={mockDecision} onResolve={() => {}} />);

    expect(screen.getByTestId('decision-icon-conflict')).toBeTruthy();
  });
});
