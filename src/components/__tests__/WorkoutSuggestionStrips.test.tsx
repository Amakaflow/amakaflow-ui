import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WarmupSuggestionStrip, CooldownSuggestionStrip, DefaultRestStrip } from '../WorkoutSuggestionStrips';

describe('WarmupSuggestionStrip', () => {
  it('renders warm-up suggestion', () => {
    render(<WarmupSuggestionStrip onAdd={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByText(/no warm-up found/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add warm-up/i })).toBeInTheDocument();
  });

  it('calls onAdd when Add Warm-up clicked', () => {
    const onAdd = vi.fn();
    render(<WarmupSuggestionStrip onAdd={onAdd} onSkip={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /add warm-up/i }));
    expect(onAdd).toHaveBeenCalled();
  });

  it('calls onSkip when Skip clicked', () => {
    const onSkip = vi.fn();
    render(<WarmupSuggestionStrip onAdd={vi.fn()} onSkip={onSkip} />);
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(onSkip).toHaveBeenCalled();
  });
});

describe('DefaultRestStrip', () => {
  it('renders default rest suggestion when no rest set', () => {
    render(<DefaultRestStrip onSet={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByText(/no default rest/i)).toBeInTheDocument();
  });
});
