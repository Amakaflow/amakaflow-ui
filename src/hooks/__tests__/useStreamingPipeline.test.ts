/**
 * Tests for useStreamingPipeline hook.
 * Mocks streamPipeline to verify state management and event handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { StreamPipelineOptions } from '../../lib/pipeline-api';
import type { PipelineSSEEvent } from '../../types/pipeline';

// Mock streamPipeline
vi.mock('../../lib/pipeline-api', () => ({
  streamPipeline: vi.fn(),
}));

import { streamPipeline } from '../../lib/pipeline-api';
import { useStreamingPipeline } from '../useStreamingPipeline';

const mockStreamPipeline = streamPipeline as ReturnType<typeof vi.fn>;

function captureStreamCall(): StreamPipelineOptions {
  return mockStreamPipeline.mock.calls[mockStreamPipeline.mock.calls.length - 1][0];
}

describe('useStreamingPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with idle state', () => {
    const { result } = renderHook(() => useStreamingPipeline());

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.currentStage).toBeNull();
    expect(result.current.completedStages).toEqual([]);
    expect(result.current.content).toBe('');
    expect(result.current.preview).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('sets isStreaming=true on start', () => {
    const { result } = renderHook(() => useStreamingPipeline());

    act(() => {
      result.current.start('/api/workouts/import/stream', { url: 'https://youtube.com/watch?v=abc' });
    });

    expect(result.current.isStreaming).toBe(true);
    expect(mockStreamPipeline).toHaveBeenCalledOnce();

    const opts = captureStreamCall();
    expect(opts.endpoint).toBe('/api/workouts/import/stream');
    expect(opts.body).toEqual({ url: 'https://youtube.com/watch?v=abc' });
  });

  it('tracks stage transitions', () => {
    const { result } = renderHook(() => useStreamingPipeline());

    act(() => {
      result.current.start('/api/test', {});
    });

    const opts = captureStreamCall();

    // First stage
    act(() => {
      opts.onEvent({ event: 'stage', data: { stage: 'fetching', message: 'Fetching...' } } as PipelineSSEEvent);
    });

    expect(result.current.currentStage).toEqual({ stage: 'fetching', message: 'Fetching...' });
    expect(result.current.completedStages).toEqual([]);

    // Transition to second stage
    act(() => {
      opts.onEvent({ event: 'stage', data: { stage: 'extracting', message: 'Extracting...' } } as PipelineSSEEvent);
    });

    expect(result.current.currentStage).toEqual({ stage: 'extracting', message: 'Extracting...' });
    expect(result.current.completedStages).toContain('fetching');
  });

  it('handles preview events', () => {
    const { result } = renderHook(() => useStreamingPipeline());

    act(() => {
      result.current.start('/api/test', {});
    });

    const opts = captureStreamCall();
    const previewData = {
      preview_id: 'p-1',
      workout: {
        name: 'Test Workout',
        exercises: [{ name: 'Burpees', sets: 3, reps: 10 }],
      },
      source_url: 'https://youtube.com/watch?v=abc',
      platform: 'youtube',
    };

    act(() => {
      opts.onEvent({ event: 'preview', data: previewData } as PipelineSSEEvent);
    });

    expect(result.current.preview).toEqual(previewData);
  });

  it('handles error events', () => {
    const { result } = renderHook(() => useStreamingPipeline());

    act(() => {
      result.current.start('/api/test', {});
    });

    const opts = captureStreamCall();

    act(() => {
      opts.onEvent({
        event: 'error',
        data: { message: 'Unsupported URL', stage: 'fetching', recoverable: false },
      } as PipelineSSEEvent);
    });

    expect(result.current.error).toBe('Unsupported URL');
    expect(result.current.isStreaming).toBe(false);
  });

  it('handles onError callback', () => {
    const { result } = renderHook(() => useStreamingPipeline());

    act(() => {
      result.current.start('/api/test', {});
    });

    const opts = captureStreamCall();

    act(() => {
      opts.onError?.(new Error('Network failure'));
    });

    expect(result.current.error).toBe('Network failure');
    expect(result.current.isStreaming).toBe(false);
  });

  it('ignores AbortError in onError', () => {
    const { result } = renderHook(() => useStreamingPipeline());

    act(() => {
      result.current.start('/api/test', {});
    });

    const opts = captureStreamCall();
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';

    act(() => {
      opts.onError?.(abortError);
    });

    // Should not set error for AbortError
    expect(result.current.error).toBeNull();
    expect(result.current.isStreaming).toBe(true);
  });

  it('sets isStreaming=false on complete', () => {
    const { result } = renderHook(() => useStreamingPipeline());

    act(() => {
      result.current.start('/api/test', {});
    });

    expect(result.current.isStreaming).toBe(true);

    const opts = captureStreamCall();

    act(() => {
      opts.onComplete?.();
    });

    expect(result.current.isStreaming).toBe(false);
  });

  it('resets state on new start', () => {
    const { result } = renderHook(() => useStreamingPipeline());

    // First stream with error
    act(() => {
      result.current.start('/api/test', {});
    });

    const opts1 = captureStreamCall();
    act(() => {
      opts1.onEvent({
        event: 'error',
        data: { message: 'Something broke' },
      } as PipelineSSEEvent);
    });

    expect(result.current.error).toBe('Something broke');

    // Start new stream - should reset
    act(() => {
      result.current.start('/api/test', {});
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isStreaming).toBe(true);
    expect(result.current.currentStage).toBeNull();
    expect(result.current.completedStages).toEqual([]);
    expect(result.current.preview).toBeNull();
  });

  it('cancel sets isStreaming=false', () => {
    const { result } = renderHook(() => useStreamingPipeline());

    act(() => {
      result.current.start('/api/test', {});
    });

    expect(result.current.isStreaming).toBe(true);

    act(() => {
      result.current.cancel();
    });

    expect(result.current.isStreaming).toBe(false);
  });
});
