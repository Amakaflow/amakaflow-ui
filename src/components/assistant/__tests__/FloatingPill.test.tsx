/**
 * Unit tests for FloatingPill component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FloatingPill } from '../FloatingPill';

describe('FloatingPill', () => {
  it('renders nothing when visible={false}', () => {
    const { container } = render(
      <FloatingPill
        visible={false}
        currentStep={1}
        totalSteps={5}
        label="Processing"
      />
    );
    // Should render nothing (empty container)
    expect(container.firstChild).toBeNull();
  });

  it('renders pill when visible={true}', () => {
    render(
      <FloatingPill
        visible={true}
        currentStep={1}
        totalSteps={5}
        label="Processing"
      />
    );
    const floatingPill = screen.getByRole('status');
    expect(floatingPill).toBeInTheDocument();
  });

  it('displays the label text', () => {
    render(
      <FloatingPill
        visible={true}
        currentStep={3}
        totalSteps={7}
        label="Analyzing request"
      />
    );
    expect(screen.getByText('Analyzing request')).toBeInTheDocument();
  });

  it('displays the correct step counter format', () => {
    render(
      <FloatingPill
        visible={true}
        currentStep={3}
        totalSteps={7}
        label="Working"
      />
    );
    expect(screen.getByText('3 of 7')).toBeInTheDocument();
  });

  it('has role=status attribute', () => {
    render(
      <FloatingPill
        visible={true}
        currentStep={1}
        totalSteps={5}
        label="Processing"
      />
    );
    const floatingPill = screen.getByRole('status');
    expect(floatingPill).toHaveAttribute('role', 'status');
  });

  it('has aria-live="polite"', () => {
    render(
      <FloatingPill
        visible={true}
        currentStep={1}
        totalSteps={5}
        label="Processing"
      />
    );
    const floatingPill = screen.getByRole('status');
    expect(floatingPill).toHaveAttribute('aria-live', 'polite');
  });

  it('has aria-atomic="true"', () => {
    render(
      <FloatingPill
        visible={true}
        currentStep={1}
        totalSteps={5}
        label="Processing"
      />
    );
    const floatingPill = screen.getByRole('status');
    expect(floatingPill).toHaveAttribute('aria-atomic', 'true');
  });

  it('has fixed positioning and centered horizontally', () => {
    render(
      <FloatingPill
        visible={true}
        currentStep={1}
        totalSteps={5}
        label="Processing"
      />
    );
    const floatingPill = screen.getByRole('status');
    expect(floatingPill).toHaveClass('fixed', 'bottom-6', 'left-1/2', '-translate-x-1/2', 'z-50');
  });

  it('has rounded-full pill styling', () => {
    render(
      <FloatingPill
        visible={true}
        currentStep={1}
        totalSteps={5}
        label="Processing"
      />
    );
    const floatingPill = screen.getByRole('status');
    // Check for rounded-full in the inner div
    const innerDiv = floatingPill.querySelector('.rounded-full');
    expect(innerDiv).toBeInTheDocument();
  });

  it('contains pulsing green dot with animation', () => {
    render(
      <FloatingPill
        visible={true}
        currentStep={1}
        totalSteps={5}
        label="Processing"
      />
    );
    const floatingPill = screen.getByRole('status');
    // Check for animate-ping class on the span
    const pingSpan = floatingPill.querySelector('.animate-ping');
    expect(pingSpan).toBeInTheDocument();
    expect(pingSpan).toHaveClass('bg-emerald-400');
  });

  it('renders with different step values', () => {
    const { rerender } = render(
      <FloatingPill
        visible={true}
        currentStep={1}
        totalSteps={1}
        label="Starting"
      />
    );
    expect(screen.getByText('1 of 1')).toBeInTheDocument();

    rerender(
      <FloatingPill
        visible={true}
        currentStep={10}
        totalSteps={15}
        label="Final step"
      />
    );
    expect(screen.getByText('10 of 15')).toBeInTheDocument();
  });
});
