import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ConflictDetailPanel } from '../ConflictDetailPanel';
import type { SchedulingConflict } from '../types';

const warningConflict: SchedulingConflict = {
  type: 'same_muscle_group',
  severity: 'warning',
  message: 'Two hard strength sessions on Tuesday and Wednesday are less than 48h apart.',
  affectedSessionIds: ['s1', 's2'],
  affectedDates: ['2026-03-17', '2026-03-18'],
  suggestedFixes: [
    { label: 'Move to Thursday', action: 'move', sessionId: 's2', targetDate: '2026-03-19' },
    { label: 'Downgrade to easy', action: 'downgrade', sessionId: 's2', targetIntensity: 'easy' },
    { label: 'Keep as is', action: 'keep' },
  ],
};

const criticalConflict: SchedulingConflict = {
  type: 'pre_fatigue',
  severity: 'critical',
  message: 'Hard strength on Wednesday is within 48h of your A-priority event.',
  affectedSessionIds: ['s1'],
  affectedDates: ['2026-03-18', '2026-03-20'],
  suggestedFixes: [
    { label: 'Move to Monday', action: 'move', sessionId: 's1', targetDate: '2026-03-16' },
    { label: 'Keep as is', action: 'keep' },
  ],
};

describe('ConflictDetailPanel', () => {
  it('renders nothing when no conflicts', () => {
    const { container } = render(<ConflictDetailPanel conflicts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders conflict detail panel with summary', () => {
    render(<ConflictDetailPanel conflicts={[warningConflict, criticalConflict]} />);
    expect(screen.getByTestId('conflict-detail-panel')).toBeInTheDocument();
    expect(screen.getByText('2 conflicts detected')).toBeInTheDocument();
  });

  it('shows critical and warning count badges', () => {
    render(<ConflictDetailPanel conflicts={[warningConflict, criticalConflict]} />);
    expect(screen.getByTestId('critical-count')).toHaveTextContent('1 critical');
    expect(screen.getByTestId('warning-count')).toHaveTextContent('1 warning');
  });

  it('renders conflict cards with type labels', () => {
    render(<ConflictDetailPanel conflicts={[warningConflict, criticalConflict]} />);
    expect(screen.getByTestId('conflict-card-same_muscle_group')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-card-pre_fatigue')).toBeInTheDocument();
  });

  it('shows severity badges on cards', () => {
    render(<ConflictDetailPanel conflicts={[warningConflict, criticalConflict]} />);
    const badges = screen.getAllByTestId('conflict-severity-badge');
    expect(badges).toHaveLength(2);
    expect(badges[0]).toHaveTextContent('warning');
    expect(badges[1]).toHaveTextContent('critical');
  });

  it('shows conflict messages', () => {
    render(<ConflictDetailPanel conflicts={[warningConflict]} />);
    expect(screen.getByText(/Two hard strength sessions/)).toBeInTheDocument();
  });

  it('expands to show details when clicked', () => {
    render(<ConflictDetailPanel conflicts={[warningConflict]} />);
    expect(screen.queryByTestId('conflict-detail-expanded')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('conflict-toggle-same_muscle_group'));
    expect(screen.getByTestId('conflict-detail-expanded')).toBeInTheDocument();
  });

  it('shows affected dates when expanded', () => {
    render(<ConflictDetailPanel conflicts={[warningConflict]} />);
    fireEvent.click(screen.getByTestId('conflict-toggle-same_muscle_group'));
    expect(screen.getByText('2026-03-17')).toBeInTheDocument();
    expect(screen.getByText('2026-03-18')).toBeInTheDocument();
  });

  it('shows suggested fix buttons when expanded', () => {
    render(<ConflictDetailPanel conflicts={[warningConflict]} />);
    fireEvent.click(screen.getByTestId('conflict-toggle-same_muscle_group'));
    expect(screen.getByTestId('fix-btn-move')).toHaveTextContent('Move to Thursday');
    expect(screen.getByTestId('fix-btn-downgrade')).toHaveTextContent('Downgrade to easy');
    expect(screen.getByTestId('fix-btn-keep')).toHaveTextContent('Keep as is');
  });

  it('calls onApplyFix when fix button is clicked', () => {
    const onApplyFix = vi.fn();
    render(<ConflictDetailPanel conflicts={[warningConflict]} onApplyFix={onApplyFix} />);
    fireEvent.click(screen.getByTestId('conflict-toggle-same_muscle_group'));
    fireEvent.click(screen.getByTestId('fix-btn-move'));
    expect(onApplyFix).toHaveBeenCalledTimes(1);
    expect(onApplyFix).toHaveBeenCalledWith(
      warningConflict,
      warningConflict.suggestedFixes[0],
    );
  });

  it('collapses when clicked again', () => {
    render(<ConflictDetailPanel conflicts={[warningConflict]} />);
    const toggle = screen.getByTestId('conflict-toggle-same_muscle_group');
    fireEvent.click(toggle);
    expect(screen.getByTestId('conflict-detail-expanded')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByTestId('conflict-detail-expanded')).not.toBeInTheDocument();
  });
});
