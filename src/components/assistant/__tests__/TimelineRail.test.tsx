/**
 * Unit tests for TimelineRail component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimelineRail } from '../TimelineRail';
import type { TimelineStepData } from '../TimelineRail';

describe('TimelineRail', () => {
  it('renders nothing when steps array is empty', () => {
    const { container } = render(<TimelineRail steps={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when steps is undefined', () => {
    const { container } = render(<TimelineRail steps={undefined as unknown as TimelineStepData[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders all steps with correct status indicators', () => {
    const steps: TimelineStepData[] = [
      { label: 'Step 1', status: 'done' },
      { label: 'Step 2', status: 'active' },
      { label: 'Step 3', status: 'pending' },
    ];
    
    render(<TimelineRail steps={steps} />);
    
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.getByText('Step 2')).toBeInTheDocument();
    expect(screen.getByText('Step 3')).toBeInTheDocument();
  });

  it('done step has data-status="done" attribute', () => {
    const steps: TimelineStepData[] = [
      { label: 'Completed step', status: 'done' },
    ];
    
    render(<TimelineRail steps={steps} />);
    
    const stepElement = screen.getByText('Completed step').closest('div[data-status]');
    expect(stepElement).toHaveAttribute('data-status', 'done');
  });

  it('renders step labels correctly', () => {
    const steps: TimelineStepData[] = [
      { label: 'Analyzing request', status: 'done' },
      { label: 'Processing data', status: 'active' },
    ];
    
    render(<TimelineRail steps={steps} />);
    
    expect(screen.getByText('Analyzing request')).toBeInTheDocument();
    expect(screen.getByText('Processing data')).toBeInTheDocument();
  });

  it('renders result summaries when provided', () => {
    const steps: TimelineStepData[] = [
      { label: 'Step 1', result: 'Found 3 files', status: 'done' },
      { label: 'Step 2', status: 'pending' },
    ];
    
    render(<TimelineRail steps={steps} />);
    
    expect(screen.getByText('Found 3 files')).toBeInTheDocument();
  });

  it('does not render result for steps without result field', () => {
    const steps: TimelineStepData[] = [
      { label: 'Step 1', status: 'pending' },
    ];
    
    render(<TimelineRail steps={steps} />);
    
    // Should only have the label, no result text
    expect(screen.getByText('Step 1')).toBeInTheDocument();
    expect(screen.queryByText(/Found/)).not.toBeInTheDocument();
  });

  it('renders with different status types', () => {
    const steps: TimelineStepData[] = [
      { label: 'Done step', status: 'done' },
      { label: 'Active step', status: 'active' },
      { label: 'Pending step', status: 'pending' },
      { label: 'Error step', status: 'error', result: 'Failed to process' },
    ];
    
    render(<TimelineRail steps={steps} />);
    
    expect(screen.getByText('Done step')).toBeInTheDocument();
    expect(screen.getByText('Active step')).toBeInTheDocument();
    expect(screen.getByText('Pending step')).toBeInTheDocument();
    expect(screen.getByText('Error step')).toBeInTheDocument();
    expect(screen.getByText('Failed to process')).toBeInTheDocument();
  });

  it('has role="list" attribute', () => {
    const steps: TimelineStepData[] = [
      { label: 'Step 1', status: 'done' },
    ];
    
    render(<TimelineRail steps={steps} />);
    
    const listElement = screen.getByRole('list');
    expect(listElement).toBeInTheDocument();
  });

  it('has aria-label for accessibility', () => {
    const steps: TimelineStepData[] = [
      { label: 'Step 1', status: 'done' },
    ];
    
    render(<TimelineRail steps={steps} />);
    
    expect(screen.getByRole('list')).toHaveAttribute('aria-label', 'Execution timeline');
  });

  it('renders single step correctly', () => {
    const steps: TimelineStepData[] = [
      { label: 'Only step', status: 'active' },
    ];
    
    render(<TimelineRail steps={steps} />);
    
    expect(screen.getByText('Only step')).toBeInTheDocument();
    const stepElement = screen.getByText('Only step').closest('div[data-status]');
    expect(stepElement).toHaveAttribute('data-status', 'active');
  });

  it('accepts custom className', () => {
    const steps: TimelineStepData[] = [
      { label: 'Step 1', status: 'done' },
    ];
    
    const { container } = render(<TimelineRail steps={steps} className="custom-class" />);
    
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
