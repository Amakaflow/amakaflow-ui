/**
 * Unit tests for BorderTrace component.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BorderTrace } from '../BorderTrace';

describe('BorderTrace', () => {
  it('renders with active=false by default', () => {
    const { container } = render(<BorderTrace />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('applies opacity-0 when active={false}', () => {
    const { container } = render(<BorderTrace active={false} />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('opacity-0');
    expect(el).not.toHaveClass('opacity-100');
  });

  it('applies opacity-100 when active={true}', () => {
    const { container } = render(<BorderTrace active={true} />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('opacity-100');
  });

  it('has pointer-events-none class', () => {
    const { container } = render(<BorderTrace />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('pointer-events-none');
  });

  it('has absolute positioning and inset-0', () => {
    const { container } = render(<BorderTrace />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('absolute', 'inset-0');
  });

  it('has rounded-xl class', () => {
    const { container } = render(<BorderTrace />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('rounded-xl');
  });

  it('is purely decorative with aria-hidden=true and no role', () => {
    const { container } = render(<BorderTrace />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el).not.toHaveAttribute('role');
  });

  it('has correct animation style when active', () => {
    const { container } = render(<BorderTrace active={true} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.animation).toContain('border-trace-spin');
    expect(el.style.animation).toContain('3s');
    expect(el.style.animation).toContain('linear');
    expect(el.style.animation).toContain('infinite');
  });
});
