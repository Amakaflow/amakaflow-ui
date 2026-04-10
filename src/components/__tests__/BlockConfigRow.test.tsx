import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BlockConfigRow } from '../BlockConfigRow';
import type { Block } from '../../types/workout';

const makeBlock = (overrides: Partial<Block>): Block => ({
  id: 'b1', label: 'Test', structure: null, exercises: [], ...overrides,
});

describe('BlockConfigRow', () => {
  it('renders rounds and rest steppers for circuit', () => {
    const onUpdate = vi.fn();
    render(
      <BlockConfigRow
        block={makeBlock({ structure: 'circuit', rounds: 4, rest_between_rounds_sec: 30 })}
        onUpdate={onUpdate}
      />
    );
    expect(screen.getByText('Rounds')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Rest')).toBeInTheDocument();
    expect(screen.getByText('30s')).toBeInTheDocument();
  });

  it('renders time cap for amrap', () => {
    const onUpdate = vi.fn();
    render(
      <BlockConfigRow
        block={makeBlock({ structure: 'amrap', time_cap_sec: 1200 })}
        onUpdate={onUpdate}
      />
    );
    expect(screen.getByText('Time Cap')).toBeInTheDocument();
    expect(screen.getByText('20:00')).toBeInTheDocument();
  });

  it('renders work/rest/rounds for tabata', () => {
    const onUpdate = vi.fn();
    render(
      <BlockConfigRow
        block={makeBlock({ structure: 'tabata', time_work_sec: 20, time_rest_sec: 10, rounds: 8 })}
        onUpdate={onUpdate}
      />
    );
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Rest')).toBeInTheDocument();
    expect(screen.getByText('Rounds')).toBeInTheDocument();
  });

  it('increments rounds when + is clicked for circuit', () => {
    const onUpdate = vi.fn();
    render(
      <BlockConfigRow
        block={makeBlock({ structure: 'circuit', rounds: 4, rest_between_rounds_sec: 30 })}
        onUpdate={onUpdate}
      />
    );
    const plusButtons = screen.getAllByRole('button', { name: '+' });
    fireEvent.click(plusButtons[0]); // first + is rounds
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ rounds: 5 }));
  });

  it('renders activity selector and duration for warmup', () => {
    const onUpdate = vi.fn();
    render(
      <BlockConfigRow
        block={makeBlock({ structure: 'warmup', warmup_duration_sec: 300, warmup_activity: 'jump_rope' })}
        onUpdate={onUpdate}
      />
    );
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
  });
});
