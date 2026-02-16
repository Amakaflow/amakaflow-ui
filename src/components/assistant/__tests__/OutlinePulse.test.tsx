/**
 * Unit tests for OutlinePulse component.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { OutlinePulse } from '../OutlinePulse';

// Mock getBoundingClientRect
const mockGetBoundingClientRect = vi.fn(() => ({
  top: 100,
  left: 200,
  width: 300,
  height: 150,
  right: 500,
  bottom: 250,
  x: 200,
  y: 100,
  toJSON: () => '',
}));

describe('OutlinePulse', () => {
  beforeEach(() => {
    // Create a mock element in the DOM
    const mockElement = document.createElement('div');
    mockElement.setAttribute('data-testid', 'target-element');
    mockElement.getBoundingClientRect = mockGetBoundingClientRect;
    document.body.appendChild(mockElement);
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('renders nothing when target={null}', () => {
    const { container } = render(<OutlinePulse target={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when target is invalid selector', async () => {
    const { container } = render(<OutlinePulse target=".nonexistent-element" />);
    // Wait for the effect to run
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('renders pulse overlay when target has valid selector', async () => {
    render(<OutlinePulse target="[data-testid='target-element']" />);
    
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  it('has pointer-events-none class', async () => {
    render(<OutlinePulse target="[data-testid='target-element']" />);
    
    await waitFor(() => {
      const pulseOverlay = screen.getByRole('status');
      expect(pulseOverlay).toHaveClass('pointer-events-none');
    });
  });

  it('has absolute positioning', async () => {
    render(<OutlinePulse target="[data-testid='target-element']" />);
    
    await waitFor(() => {
      const pulseOverlay = screen.getByRole('status');
      expect(pulseOverlay).toHaveClass('absolute');
    });
  });

  it('auto-dismisses after specified duration', async () => {
    const { container } = render(
      <OutlinePulse target="[data-testid='target-element']" duration={50} />
    );
    
    // Should have the overlay initially
    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
    
    // Wait longer than the duration
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should no longer render
    expect(container.firstChild).toBeNull();
  });

  it('has correct animation style', async () => {
    render(<OutlinePulse target="[data-testid='target-element']" />);
    
    await waitFor(() => {
      const pulseOverlay = screen.getByRole('status');
      const innerDiv = pulseOverlay.firstChild as HTMLElement;
      expect(innerDiv.style.animation).toContain('outline-pulse');
    });
  });

  it('has role=status for accessibility', async () => {
    render(<OutlinePulse target="[data-testid='target-element']" />);
    
    await waitFor(() => {
      const pulseOverlay = screen.getByRole('status');
      expect(pulseOverlay).toHaveAttribute('role', 'status');
    });
  });

  it('has aria-live=polite for accessibility', async () => {
    render(<OutlinePulse target="[data-testid='target-element']" />);
    
    await waitFor(() => {
      const pulseOverlay = screen.getByRole('status');
      expect(pulseOverlay).toHaveAttribute('aria-live', 'polite');
    });
  });
});
