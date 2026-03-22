/**
 * Tests for ProgressOverlay component (AMA-1154).
 */
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProgressOverlay } from '../ProgressOverlay';
import type { ProgressOperation } from '../types';

describe('ProgressOverlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const baseOperation: ProgressOperation = {
    operationId: 'test-op',
    title: 'Test Operation',
    steps: [
      { id: 'step-1', label: 'Step one...', status: 'completed', elapsedMs: 1200 },
      { id: 'step-2', label: 'Step two...', status: 'active' },
      { id: 'step-3', label: 'Step three...', status: 'pending' },
    ],
    cancelled: false,
    startedAt: Date.now() - 2000,
  };

  it('renders title and all steps', () => {
    render(
      <ProgressOverlay
        operation={baseOperation}
        onCancel={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByTestId('progress-title')).toHaveTextContent('Test Operation');
    expect(screen.getByText('Step one...')).toBeInTheDocument();
    expect(screen.getByText('Step two...')).toBeInTheDocument();
    expect(screen.getByText('Step three...')).toBeInTheDocument();
  });

  it('shows step count footer for in-progress operation', () => {
    render(
      <ProgressOverlay
        operation={baseOperation}
        onCancel={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText('1 of 3 steps')).toBeInTheDocument();
  });

  it('shows cancel button and calls onCancel', () => {
    const onCancel = vi.fn();
    render(
      <ProgressOverlay
        operation={baseOperation}
        onCancel={onCancel}
        onDismiss={vi.fn()}
      />,
    );
    const cancelBtn = screen.getByTestId('progress-cancel-btn');
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('auto-dismisses after completion', () => {
    const completedOp: ProgressOperation = {
      ...baseOperation,
      steps: baseOperation.steps.map((s) => ({
        ...s,
        status: 'completed' as const,
        elapsedMs: 1000,
      })),
      finishedAt: Date.now(),
    };

    const onDismiss = vi.fn();
    render(
      <ProgressOverlay
        operation={completedOp}
        onCancel={vi.fn()}
        onDismiss={onDismiss}
        autoDismissMs={2000}
      />,
    );

    expect(screen.getByTestId('progress-done-label')).toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('shows cancelled state', () => {
    const cancelledOp: ProgressOperation = {
      ...baseOperation,
      cancelled: true,
      finishedAt: Date.now(),
    };

    render(
      <ProgressOverlay
        operation={cancelledOp}
        onCancel={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.getByTestId('progress-cancelled-label')).toHaveTextContent('Cancelled');
    expect(screen.getByTestId('progress-dismiss-btn')).toBeInTheDocument();
  });
});
