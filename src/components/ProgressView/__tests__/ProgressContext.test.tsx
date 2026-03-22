/**
 * Tests for ProgressContext / ProgressProvider (AMA-1154).
 */
import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProgressProvider, useProgress } from '../ProgressContext';

function TestConsumer() {
  const { startProgress, cancelProgress, isProgressActive } = useProgress();

  return (
    <div>
      <span data-testid="active-status">{isProgressActive ? 'active' : 'idle'}</span>
      <button
        data-testid="start-btn"
        onClick={() =>
          startProgress('test-op', 'Test Operation', [
            { id: 'a', label: 'Step A' },
            { id: 'b', label: 'Step B' },
          ])
        }
      >
        Start
      </button>
      <button data-testid="cancel-btn" onClick={cancelProgress}>
        Cancel
      </button>
    </div>
  );
}

describe('ProgressContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws when useProgress is used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      'useProgress must be used within a ProgressProvider',
    );
    spy.mockRestore();
  });

  it('shows progress overlay when startProgress is called', () => {
    render(
      <ProgressProvider demo demoStepDelayMs={1000}>
        <TestConsumer />
      </ProgressProvider>,
    );

    expect(screen.getByTestId('active-status')).toHaveTextContent('idle');
    expect(screen.queryByTestId('progress-overlay')).not.toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByTestId('start-btn'));
    });

    expect(screen.getByTestId('progress-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('progress-title')).toHaveTextContent('Test Operation');
    expect(screen.getByTestId('active-status')).toHaveTextContent('active');
  });

  it('hides overlay on cancel then dismiss', () => {
    render(
      <ProgressProvider demo demoStepDelayMs={1000}>
        <TestConsumer />
      </ProgressProvider>,
    );

    act(() => {
      fireEvent.click(screen.getByTestId('start-btn'));
    });
    expect(screen.getByTestId('progress-overlay')).toBeInTheDocument();

    act(() => {
      fireEvent.click(screen.getByTestId('cancel-btn'));
    });

    // After cancel, dismiss button appears
    const dismissBtn = screen.getByTestId('progress-dismiss-btn');
    act(() => {
      fireEvent.click(dismissBtn);
    });

    expect(screen.queryByTestId('progress-overlay')).not.toBeInTheDocument();
  });
});
