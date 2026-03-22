/**
 * Tests for useProgressStream hook (AMA-1154).
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useProgressStream } from '../hooks/useProgressStream';

describe('useProgressStream', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const steps = [
    { id: 'a', label: 'Step A' },
    { id: 'b', label: 'Step B' },
    { id: 'c', label: 'Step C' },
  ];

  it('starts with null operation', () => {
    const { result } = renderHook(() => useProgressStream({ demo: true }));
    expect(result.current.operation).toBeNull();
    expect(result.current.isActive).toBe(false);
    expect(result.current.isComplete).toBe(false);
  });

  it('starts operation with first step active', () => {
    const { result } = renderHook(() => useProgressStream({ demo: true }));

    act(() => {
      result.current.start('op-1', 'Test', steps);
    });

    expect(result.current.operation).not.toBeNull();
    expect(result.current.operation!.steps[0].status).toBe('active');
    expect(result.current.operation!.steps[1].status).toBe('pending');
    expect(result.current.operation!.steps[2].status).toBe('pending');
    expect(result.current.isActive).toBe(true);
  });

  it('progresses through steps over time', () => {
    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useProgressStream({ demo: true, demoStepDelayMs: 1000, onComplete }),
    );

    act(() => {
      result.current.start('op-1', 'Test', steps);
    });

    // After first step delay (1000 + 300 for idx 0 variation)
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(result.current.operation!.steps[0].status).toBe('completed');
    expect(result.current.operation!.steps[1].status).toBe('active');

    // After second step delay (1000 - 200 for idx 1 variation = 800 more)
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(result.current.operation!.steps[1].status).toBe('completed');
    expect(result.current.operation!.steps[2].status).toBe('active');

    // After third step delay (1000 + 300 for idx 2 = 1300 more)
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    expect(result.current.operation!.steps[2].status).toBe('completed');
    expect(result.current.isComplete).toBe(true);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('cancels operation', () => {
    const onCancel = vi.fn();
    const { result } = renderHook(() =>
      useProgressStream({ demo: true, onCancel }),
    );

    act(() => {
      result.current.start('op-1', 'Test', steps);
    });

    act(() => {
      result.current.cancel();
    });

    expect(result.current.operation!.cancelled).toBe(true);
    expect(result.current.isActive).toBe(false);
    expect(onCancel).toHaveBeenCalledWith('op-1');
  });
});
