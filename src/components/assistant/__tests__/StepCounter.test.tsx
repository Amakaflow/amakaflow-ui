/**
 * Unit tests for StepCounter component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepCounter } from '../StepCounter';

describe('StepCounter', () => {
  it('renders nothing when count is 0', () => {
    const { container } = render(
      <StepCounter count={0}>
        <div>Children</div>
      </StepCounter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders "1 step completed" when count is 1', () => {
    render(
      <StepCounter count={1}>
        <div>Child content</div>
      </StepCounter>
    );
    expect(screen.getByText('1 step completed')).toBeInTheDocument();
  });

  it('renders "N steps completed" when count > 1', () => {
    render(
      <StepCounter count={5}>
        <div>Child content</div>
      </StepCounter>
    );
    expect(screen.getByText('5 steps completed')).toBeInTheDocument();
  });

  it('children are hidden by default (collapsed)', () => {
    render(
      <StepCounter count={3}>
        <div data-testid="child">Child content</div>
      </StepCounter>
    );

    // Get the content wrapper (has id="step-counter-content")
    const content = screen.getByTestId('child').parentElement?.parentElement;
    expect(content).toHaveAttribute('aria-hidden', 'true');
  });

  it('click toggles children visibility', () => {
    render(
      <StepCounter count={3}>
        <div data-testid="child">Child content</div>
      </StepCounter>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    const content = screen.getByTestId('child').parentElement?.parentElement;
    expect(content).toHaveAttribute('aria-hidden', 'false');
  });

  it('click again toggles back to collapsed', () => {
    render(
      <StepCounter count={2}>
        <div data-testid="child">Child content</div>
      </StepCounter>
    );

    const button = screen.getByRole('button');

    // First click - expand
    fireEvent.click(button);

    // Second click - collapse
    fireEvent.click(button);

    const content = screen.getByTestId('child').parentElement?.parentElement;
    expect(content).toHaveAttribute('aria-hidden', 'true');
  });

  it('has aria-expanded that toggles on click', () => {
    render(
      <StepCounter count={2}>
        <div>Child content</div>
      </StepCounter>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('has aria-controls pointing to content', () => {
    render(
      <StepCounter count={2}>
        <div>Child content</div>
      </StepCounter>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-controls', 'step-counter-content');
  });

  it('renders children when expanded', () => {
    render(
      <StepCounter count={3}>
        <div data-testid="visible-child">Visible content</div>
      </StepCounter>
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(screen.getByTestId('visible-child')).toBeInTheDocument();
  });

  it('accepts custom className', () => {
    const { container } = render(
      <StepCounter count={1} className="custom-class">
        <div>Child</div>
      </StepCounter>
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('has accessible button role', () => {
    render(
      <StepCounter count={1}>
        <div>Child</div>
      </StepCounter>
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('chevron rotates when expanded', () => {
    render(
      <StepCounter count={2}>
        <div>Child</div>
      </StepCounter>
    );

    const chevron = screen.getByRole('button').querySelector('svg')?.parentElement;
    // Initially no rotation class
    expect(chevron).not.toHaveClass('rotate-90');

    fireEvent.click(screen.getByRole('button'));
    // After click, should have rotation class
    expect(chevron).toHaveClass('rotate-90');
  });

  it('renders correctly with different counts', () => {
    const { rerender } = render(
      <StepCounter count={1}>
        <div>Child</div>
      </StepCounter>
    );
    expect(screen.getByText('1 step completed')).toBeInTheDocument();

    rerender(
      <StepCounter count={10}>
        <div>Child</div>
      </StepCounter>
    );
    expect(screen.getByText('10 steps completed')).toBeInTheDocument();
  });
});
