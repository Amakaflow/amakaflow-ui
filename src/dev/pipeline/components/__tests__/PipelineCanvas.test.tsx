import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PipelineCanvas } from '../PipelineCanvas';
import type { PipelineRun } from '../../store/runTypes';

function makeRun(overrides: Partial<PipelineRun> = {}): PipelineRun {
  return {
    id: 'run-1',
    flowId: 'ingest-only',
    label: 'Test run',
    mode: 'auto',
    status: 'success',
    startedAt: Date.now(),
    inputs: {},
    steps: [],
    ...overrides,
  };
}

const defaultProps = {
  run: null,
  isRunning: false,
  selectedStepId: null,
  onSelectStep: vi.fn(),
  onStart: vi.fn(),
  onCancel: vi.fn(),
};

describe('PipelineCanvas', () => {
  it('shows empty state when no run', () => {
    render(<PipelineCanvas {...defaultProps} />);
    expect(screen.getByText('Garmin Full Pipeline')).toBeTruthy();
  });

  it('calls onStart with flowId and inputs when Run is clicked', () => {
    const onStart = vi.fn();
    render(<PipelineCanvas {...defaultProps} onStart={onStart} />);
    screen.getByText('▶ Run').click();
    expect(onStart).toHaveBeenCalledOnce();
    const [flow, inputs, mode] = onStart.mock.calls[0];
    expect(flow).toMatchObject({ id: 'garmin-full' });
    expect(inputs).toHaveProperty('workoutText');
    expect(mode).toBe('auto');
  });

  it('shows Stop button when running', () => {
    render(<PipelineCanvas {...defaultProps} isRunning={true} />);
    expect(screen.getByText('⏹ Stop')).toBeTruthy();
    expect(screen.queryByText('▶ Run')).toBeNull();
  });

  it('calls onCancel when Stop is clicked', () => {
    const onCancel = vi.fn();
    render(<PipelineCanvas {...defaultProps} isRunning={true} onCancel={onCancel} />);
    screen.getByText('⏹ Stop').click();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('renders steps when run has steps', () => {
    const run = makeRun({
      steps: [{ id: 's1', service: 'ingestor', label: 'Ingest', status: 'success', edited: false }],
    });
    render(<PipelineCanvas {...defaultProps} run={run} isRunning={false} />);
    expect(screen.getByText('Ingest')).toBeTruthy();
  });

  it('switches to raw JSON view', () => {
    const run = makeRun();
    const { container } = render(<PipelineCanvas {...defaultProps} run={run} />);
    fireEvent.click(screen.getByText('raw'));
    // In raw mode, the run JSON should be visible
    expect(container.querySelector('pre')).not.toBeNull();
  });

  it('shows StepEditForm when pausedStepId is set', () => {
    const pausedStep = { id: 'step-paused', service: 'ingestor' as const, label: 'Ingest', status: 'paused' as const, edited: false };
    const run = makeRun({ steps: [pausedStep] });
    const onStepContinue = vi.fn();
    render(
      <PipelineCanvas
        {...defaultProps}
        run={run}
        isRunning={true}
        pausedStepId="step-paused"
        onStepContinue={onStepContinue}
      />,
    );
    // StepEditForm should be visible with Continue and Abort buttons
    expect(screen.getByText('Continue →')).toBeTruthy();
    expect(screen.getByText('Abort')).toBeTruthy();
  });
});
