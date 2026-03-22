/**
 * AMA-182: Tests for PatternSelector component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PatternSelector } from '../PatternSelector';

describe('AMA-182: PatternSelector', () => {
  it('renders all four pattern options', () => {
    render(<PatternSelector value="standard" onChange={vi.fn()} />);
    expect(screen.getByTestId('pattern-option-standard')).toBeInTheDocument();
    expect(screen.getByTestId('pattern-option-ascending')).toBeInTheDocument();
    expect(screen.getByTestId('pattern-option-descending')).toBeInTheDocument();
    expect(screen.getByTestId('pattern-option-pyramid')).toBeInTheDocument();
  });

  it('calls onChange when a pattern is clicked', () => {
    const onChange = vi.fn();
    render(<PatternSelector value="standard" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('pattern-option-ascending'));
    expect(onChange).toHaveBeenCalledWith('ascending');
  });

  it('shows preview for non-standard patterns', () => {
    render(<PatternSelector value="ascending" onChange={vi.fn()} baseReps={8} sets={3} />);
    expect(screen.getByTestId('pattern-preview')).toBeInTheDocument();
    expect(screen.getByTestId('pattern-preview')).toHaveTextContent('8 -> 10 -> 12');
  });

  it('does not show preview for standard pattern', () => {
    render(<PatternSelector value="standard" onChange={vi.fn()} />);
    expect(screen.queryByTestId('pattern-preview')).not.toBeInTheDocument();
  });

  it('shows descending preview', () => {
    render(<PatternSelector value="descending" onChange={vi.fn()} baseReps={8} sets={3} />);
    expect(screen.getByTestId('pattern-preview')).toHaveTextContent('12 -> 10 -> 8');
  });

  it('shows pyramid preview', () => {
    render(<PatternSelector value="pyramid" onChange={vi.fn()} baseReps={8} sets={5} />);
    expect(screen.getByTestId('pattern-preview')).toHaveTextContent('8 -> 10 -> 12 -> 10 -> 8');
  });

  it('has pattern-selector test id', () => {
    render(<PatternSelector value="standard" onChange={vi.fn()} />);
    expect(screen.getByTestId('pattern-selector')).toBeInTheDocument();
  });

  it('accepts className prop', () => {
    render(<PatternSelector value="standard" onChange={vi.fn()} className="my-class" />);
    expect(screen.getByTestId('pattern-selector')).toHaveClass('my-class');
  });
});
