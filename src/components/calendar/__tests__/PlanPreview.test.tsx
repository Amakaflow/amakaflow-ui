/**
 * Tests for AMA-1128: Plan Preview Overlay components.
 *
 * Covers:
 *  - ProposedSessionCard rendering for new / moved / removed
 *  - PlanSummary rendering with warnings
 *  - PlanPreviewOverlay shows proposals grouped by day
 *  - useWeekState preview flow: generate -> preview -> apply / cancel
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { ProposedSessionCard } from '../ProposedSessionCard';
import { PlanSummary } from '../PlanSummary';
import { PlanPreviewOverlay } from '../PlanPreviewOverlay';
import { useWeekState } from '../hooks/useWeekState';
import { getMockPlanPreview, mockPlanSummary, mockProposedSessions } from '../mockData';
import type { ProposedSession, PlanPreviewState, PlanSummaryData } from '../types';

// ---------- ProposedSessionCard ----------

describe('ProposedSessionCard', () => {
  const newProposal: ProposedSession = mockProposedSessions[0]; // kind: 'new'
  const movedProposal: ProposedSession = mockProposedSessions[2]; // kind: 'moved'

  it('renders NEW badge for new sessions', () => {
    render(<ProposedSessionCard proposal={newProposal} />);
    expect(screen.getByTestId('badge-new')).toHaveTextContent('NEW');
    expect(screen.getByText(newProposal.session.title)).toBeInTheDocument();
  });

  it('renders MOVED badge with arrow for moved sessions', () => {
    render(<ProposedSessionCard proposal={movedProposal} />);
    expect(screen.getByTestId('badge-moved')).toHaveTextContent('MOVED');
    // Should show "Wed -> Fri" arrow indicator
    expect(screen.getByText('Wed')).toBeInTheDocument();
    expect(screen.getByText('Fri')).toBeInTheDocument();
  });

  it('shows rationale on toggle click', () => {
    render(<ProposedSessionCard proposal={newProposal} />);
    expect(screen.queryByTestId('rationale-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('rationale-toggle'));
    expect(screen.getByTestId('rationale-panel')).toBeInTheDocument();
    expect(screen.getByText(/Monday is your highest readiness day/)).toBeInTheDocument();
  });

  it('allows duration adjustment', () => {
    const onDuration = vi.fn();
    render(
      <ProposedSessionCard proposal={newProposal} onDurationChange={onDuration} />,
    );

    fireEvent.click(screen.getByTestId('duration-increase'));
    expect(onDuration).toHaveBeenCalledWith(newProposal.id, newProposal.session.duration + 15);
  });

  it('allows intensity cycling', () => {
    const onIntensity = vi.fn();
    render(
      <ProposedSessionCard proposal={newProposal} onIntensityChange={onIntensity} />,
    );

    fireEvent.click(screen.getByTestId('intensity-toggle'));
    // hard -> easy (cycles)
    expect(onIntensity).toHaveBeenCalledWith(newProposal.id, 'easy');
  });
});

// ---------- PlanSummary ----------

describe('PlanSummary', () => {
  it('renders change counts', () => {
    render(<PlanSummary summary={mockPlanSummary} />);
    expect(screen.getByText(/2 added/)).toBeInTheDocument();
    expect(screen.getByText(/1 moved/)).toBeInTheDocument();
    expect(screen.getByText(/0 removed/)).toBeInTheDocument();
  });

  it('renders total volume and hard days', () => {
    render(<PlanSummary summary={mockPlanSummary} />);
    expect(screen.getByText('6h 30min')).toBeInTheDocument();
    expect(screen.getByText(/3 of 4 cap/)).toBeInTheDocument();
  });

  it('renders warnings', () => {
    render(<PlanSummary summary={mockPlanSummary} />);
    expect(screen.getByTestId('plan-warnings')).toBeInTheDocument();
    expect(screen.getByText(/Approaching hard-day cap/)).toBeInTheDocument();
  });

  it('does not render warnings section when empty', () => {
    const noWarnings: PlanSummaryData = { ...mockPlanSummary, warnings: [] };
    render(<PlanSummary summary={noWarnings} />);
    expect(screen.queryByTestId('plan-warnings')).not.toBeInTheDocument();
  });
});

// ---------- PlanPreviewOverlay ----------

describe('PlanPreviewOverlay', () => {
  const preview = getMockPlanPreview();
  const handlers = {
    onApply: vi.fn(),
    onCancel: vi.fn(),
    onAdjust: vi.fn(),
  };

  it('renders nothing when preview is not active', () => {
    const inactive: PlanPreviewState = { ...preview, active: false };
    const { container } = render(
      <PlanPreviewOverlay preview={inactive} {...handlers} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders overlay when active', () => {
    render(<PlanPreviewOverlay preview={preview} {...handlers} />);
    expect(screen.getByTestId('plan-preview-overlay')).toBeInTheDocument();
    expect(screen.getByText('Review Proposed Plan')).toBeInTheDocument();
  });

  it('shows proposals in correct day columns', () => {
    render(<PlanPreviewOverlay preview={preview} {...handlers} />);
    // Monday (index 0) should have proposal-1
    const monday = screen.getByTestId('preview-day-0');
    expect(monday).toBeInTheDocument();
    expect(screen.getByTestId('proposed-session-proposal-1')).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(<PlanPreviewOverlay preview={preview} {...handlers} />);
    expect(screen.getByTestId('apply-plan-btn')).toBeInTheDocument();
    expect(screen.getByTestId('adjust-plan-btn')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-plan-btn')).toBeInTheDocument();
  });

  it('calls onApply when Apply Plan clicked', () => {
    render(<PlanPreviewOverlay preview={preview} {...handlers} />);
    fireEvent.click(screen.getByTestId('apply-plan-btn'));
    expect(handlers.onApply).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel clicked', () => {
    render(<PlanPreviewOverlay preview={preview} {...handlers} />);
    fireEvent.click(screen.getByTestId('cancel-plan-btn'));
    expect(handlers.onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders the plan summary inside the overlay', () => {
    render(<PlanPreviewOverlay preview={preview} {...handlers} />);
    expect(screen.getByTestId('plan-summary')).toBeInTheDocument();
  });
});

// ---------- useWeekState preview flow ----------

describe('useWeekState plan preview flow', () => {
  it('starts with inactive preview', () => {
    const { result } = renderHook(() => useWeekState());
    expect(result.current.planPreview.active).toBe(false);
    expect(result.current.planPreview.proposals).toHaveLength(0);
  });

  it('generateWeek activates the preview', async () => {
    const { result } = renderHook(() => useWeekState());

    await act(async () => {
      await result.current.generateWeek();
    });

    expect(result.current.planPreview.active).toBe(true);
    expect(result.current.planPreview.proposals.length).toBeGreaterThan(0);
  });

  it('cancelPlan deactivates the preview without changing weekState', async () => {
    const { result } = renderHook(() => useWeekState());
    const initialDays = result.current.weekState.days;

    await act(async () => {
      await result.current.generateWeek();
    });
    expect(result.current.planPreview.active).toBe(true);

    act(() => {
      result.current.cancelPlan();
    });

    expect(result.current.planPreview.active).toBe(false);
    // weekState should be unchanged
    expect(result.current.weekState.days.length).toBe(initialDays.length);
  });

  it('applyPlan merges proposals into weekState and deactivates preview', async () => {
    const { result } = renderHook(() => useWeekState());

    await act(async () => {
      await result.current.generateWeek();
    });

    const proposalCount = result.current.planPreview.proposals.filter(p => p.kind === 'new').length;

    act(() => {
      result.current.applyPlan();
    });

    expect(result.current.planPreview.active).toBe(false);
    // New sessions should have been added
    const allSessions = result.current.weekState.days.flatMap(d => d.sessions);
    // Should have more sessions than before
    expect(allSessions.length).toBeGreaterThanOrEqual(proposalCount);
    expect(result.current.weekState.generated).toBe(true);
  });

  it('updateProposalDuration edits a proposal session duration', async () => {
    const { result } = renderHook(() => useWeekState());

    await act(async () => {
      await result.current.generateWeek();
    });

    const firstProposal = result.current.planPreview.proposals[0];
    act(() => {
      result.current.updateProposalDuration(firstProposal.id, 99);
    });

    const updated = result.current.planPreview.proposals.find(p => p.id === firstProposal.id);
    expect(updated?.session.duration).toBe(99);
  });

  it('updateProposalIntensity edits a proposal session intensity', async () => {
    const { result } = renderHook(() => useWeekState());

    await act(async () => {
      await result.current.generateWeek();
    });

    const firstProposal = result.current.planPreview.proposals[0];
    act(() => {
      result.current.updateProposalIntensity(firstProposal.id, 'easy');
    });

    const updated = result.current.planPreview.proposals.find(p => p.id === firstProposal.id);
    expect(updated?.session.intensity).toBe('easy');
  });
});
