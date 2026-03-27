/**
 * Tests for ProgressStepRow component (AMA-1154).
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProgressStepRow } from '../ProgressStep';
import type { ProgressStep } from '../types';

describe('ProgressStepRow', () => {
  const baseStep: ProgressStep = {
    id: 'test-step',
    label: 'Doing something...',
    status: 'pending',
  };

  it('renders pending step with gray circle icon', () => {
    render(<ProgressStepRow step={baseStep} index={0} />);
    expect(screen.getByText('Doing something...')).toBeInTheDocument();
    expect(screen.getByTestId('progress-step-test-step')).toHaveAttribute('data-status', 'pending');
    expect(screen.getByTestId('step-icon-pending-test-step')).toBeInTheDocument();
  });

  it('renders active step with spinning loader', () => {
    const step = { ...baseStep, status: 'active' as const };
    render(<ProgressStepRow step={step} index={0} />);
    expect(screen.getByTestId('step-icon-active-test-step')).toBeInTheDocument();
    expect(screen.getByTestId('progress-step-test-step')).toHaveAttribute('data-status', 'active');
  });

  it('renders completed step with green check and elapsed time', () => {
    const step = { ...baseStep, status: 'completed' as const, elapsedMs: 2100 };
    render(<ProgressStepRow step={step} index={0} />);
    expect(screen.getByTestId('step-icon-completed-test-step')).toBeInTheDocument();
    expect(screen.getByText('2.1s')).toBeInTheDocument();
  });

  it('renders error step with error icon and message', () => {
    const step = { ...baseStep, status: 'error' as const, error: 'Network timeout' };
    render(<ProgressStepRow step={step} index={0} />);
    expect(screen.getByTestId('step-icon-error-test-step')).toBeInTheDocument();
    expect(screen.getByText('Network timeout')).toBeInTheDocument();
  });
});
