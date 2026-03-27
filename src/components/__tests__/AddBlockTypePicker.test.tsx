import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddBlockTypePicker } from '../AddBlockTypePicker';

describe('AddBlockTypePicker', () => {
  it('shows type chips when open', () => {
    render(<AddBlockTypePicker onSelect={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Circuit')).toBeInTheDocument();
    expect(screen.getByText('EMOM')).toBeInTheDocument();
    expect(screen.getByText('AMRAP')).toBeInTheDocument();
    expect(screen.getByText('Warm-up')).toBeInTheDocument();
  });

  it('calls onSelect with structure type when chip clicked', () => {
    const onSelect = vi.fn();
    render(<AddBlockTypePicker onSelect={onSelect} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Circuit'));
    expect(onSelect).toHaveBeenCalledWith('circuit');
  });

  it('calls onCancel when cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<AddBlockTypePicker onSelect={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });
});
