import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConflictIndicator } from '../ConflictIndicator';
import type { SchedulingConflict } from '../types';

const warningConflict: SchedulingConflict = {
  type: 'same_muscle_group',
  severity: 'warning',
  message: 'Two hard strength sessions within 48h',
  affectedSessionIds: ['s1', 's2'],
  affectedDates: ['2026-03-17', '2026-03-18'],
  suggestedFixes: [{ label: 'Move to Thursday', action: 'move' }],
};

const criticalConflict: SchedulingConflict = {
  type: 'pre_fatigue',
  severity: 'critical',
  message: 'Hard session before A-priority event',
  affectedSessionIds: ['s1'],
  affectedDates: ['2026-03-18', '2026-03-20'],
  suggestedFixes: [{ label: 'Downgrade to easy', action: 'downgrade' }],
};

describe('ConflictIndicator', () => {
  it('renders nothing when no conflicts', () => {
    const { container } = render(<ConflictIndicator conflicts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders warning icon for warning-only conflicts', () => {
    render(<ConflictIndicator conflicts={[warningConflict]} />);
    expect(screen.getByTestId('conflict-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-icon-warning')).toBeInTheDocument();
    expect(screen.queryByTestId('conflict-icon-critical')).not.toBeInTheDocument();
  });

  it('renders critical icon when any conflict is critical', () => {
    render(<ConflictIndicator conflicts={[warningConflict, criticalConflict]} />);
    expect(screen.getByTestId('conflict-icon-critical')).toBeInTheDocument();
    expect(screen.queryByTestId('conflict-icon-warning')).not.toBeInTheDocument();
  });

  it('shows count badge when multiple conflicts', () => {
    render(<ConflictIndicator conflicts={[warningConflict, criticalConflict]} />);
    expect(screen.getByTestId('conflict-count-badge')).toHaveTextContent('2');
  });

  it('does not show count badge for single conflict', () => {
    render(<ConflictIndicator conflicts={[warningConflict]} />);
    expect(screen.queryByTestId('conflict-count-badge')).not.toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<ConflictIndicator conflicts={[warningConflict]} onClick={onClick} />);
    fireEvent.click(screen.getByTestId('conflict-indicator'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has accessible label', () => {
    render(<ConflictIndicator conflicts={[warningConflict, criticalConflict]} />);
    expect(screen.getByLabelText('2 conflicts detected')).toBeInTheDocument();
  });
});
