/**
 * Unit tests for BorderTrace component.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BorderTrace } from '../BorderTrace';

describe('BorderTrace', () => {
  it('renders with active=false by default', () => {
    render(<BorderTrace />);
    const borderTrace = screen.getByRole('status', { hidden: true });
    expect(borderTrace).toBeInTheDocument();
  });

  it('applies opacity-0 when active={false}', () => {
    render(<BorderTrace active={false} />);
    const borderTrace = screen.getByRole('status', { hidden: true });
    expect(borderTrace).toHaveClass('opacity-0');
    expect(borderTrace).not.toHaveClass('opacity-100');
  });

  it('applies opacity-100 when active={true}', () => {
    render(<BorderTrace active={true} />);
    const borderTrace = screen.getByRole('status', { hidden: true });
    expect(borderTrace).toHaveClass('opacity-100');
  });

  it('has pointer-events-none class', () => {
    render(<BorderTrace />);
    const borderTrace = screen.getByRole('status', { hidden: true });
    expect(borderTrace).toHaveClass('pointer-events-none');
  });

  it('has absolute positioning and inset-0', () => {
    render(<BorderTrace />);
    const borderTrace = screen.getByRole('status', { hidden: true });
    expect(borderTrace).toHaveClass('absolute', 'inset-0');
  });

  it('has rounded-xl class', () => {
    render(<BorderTrace />);
    const borderTrace = screen.getByRole('status', { hidden: true });
    expect(borderTrace).toHaveClass('rounded-xl');
  });

  it('has role=status and aria-hidden=true', () => {
    render(<BorderTrace />);
    const borderTrace = screen.getByRole('status', { hidden: true });
    expect(borderTrace).toHaveAttribute('role', 'status');
    expect(borderTrace).toHaveAttribute('aria-hidden', 'true');
  });

  it('has correct animation style when active', () => {
    render(<BorderTrace active={true} />);
    const borderTrace = screen.getByRole('status', { hidden: true });
    expect(borderTrace.style.animation).toContain('border-trace-spin');
    expect(borderTrace.style.animation).toContain('3s');
    expect(borderTrace.style.animation).toContain('linear');
    expect(borderTrace.style.animation).toContain('infinite');
  });
});
