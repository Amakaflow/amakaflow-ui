/**
 * Integration tests for useChatStream hook.
 * Mocks streamChat from chat-api.ts to verify dispatch orchestration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ChatState, ChatAction, SSEEventData } from '../../types/chat';
import type { StreamChatOptions } from '../../lib/chat-api';

// Mock streamChat
vi.mock('../../lib/chat-api', () => ({
  streamChat: vi.fn(),
}));

import { streamChat } from '../../lib/chat-api';
import { useChatStream } from '../useChatStream';

const mockStreamChat = streamChat as ReturnType<typeof vi.fn>;

// ── Helpers ──────────────────────────────────────────────────────────

function baseState(overrides?: Partial<ChatState>): ChatState {
  return {
    isOpen: true,
    sessionId: null,
    messages: [],
    isStreaming: false,
    error: null,
    rateLimitInfo: null,
    pendingImports: [],
    currentStage: null,
    completedStages: [],
    workoutData: null,
    searchResults: null,
    ...overrides,
  };
}

function captureStreamCall(): StreamChatOptions {
  const call = mockStreamChat.mock.calls[mockStreamChat.mock.calls.length - 1][0];
  return call as StreamChatOptions;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('useChatStream', () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let uuidCounter = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    dispatch = vi.fn();
    uuidCounter = 0;
    // Mock crypto.randomUUID for deterministic IDs
    vi.stubGlobal('crypto', {
      ...globalThis.crypto,
      randomUUID: () => `test-uuid-${++uuidCounter}`,
    });
    // Default: streamChat resolves immediately (no events)
    mockStreamChat.mockImplementation(() => Promise.resolve());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Happy path ───────────────────────────────────────────────────

  it('sendMessage dispatches ADD_USER_MESSAGE, START_ASSISTANT_MESSAGE, SET_STREAMING', () => {
    const { result } = renderHook(() => useChatStream({ state: baseState(), dispatch }));

    act(() => result.current.sendMessage('hello'));

    const types = dispatch.mock.calls.map((c: unknown[]) => (c[0] as ChatAction).type);
    expect(types).toContain('ADD_USER_MESSAGE');
    expect(types).toContain('START_ASSISTANT_MESSAGE');
    expect(types).toContain('SET_STREAMING');
    expect(types).toContain('SET_ERROR'); // clears error
  });

  it('sendMessage calls streamChat with correct message and sessionId', () => {
    const state = baseState({ sessionId: 'sess-1' });
    const { result } = renderHook(() => useChatStream({ state, dispatch }));

    act(() => result.current.sendMessage('test'));

    expect(mockStreamChat).toHaveBeenCalledTimes(1);
    const opts = captureStreamCall();
    expect(opts.message).toBe('test');
    expect(opts.sessionId).toBe('sess-1');
  });

  it('SSE message_start event dispatches SET_SESSION_ID', () => {
    mockStreamChat.mockImplementation((opts: StreamChatOptions) => {
      opts.onEvent({ event: 'message_start', data: { session_id: 'new-sess' } });
      return Promise.resolve();
    });

    const { result } = renderHook(() => useChatStream({ state: baseState(), dispatch }));
    act(() => result.current.sendMessage('hi'));

    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_SESSION_ID', sessionId: 'new-sess' });
  });

  it('SSE content_delta events dispatch APPEND_CONTENT_DELTA', () => {
    mockStreamChat.mockImplementation((opts: StreamChatOptions) => {
      opts.onEvent({ event: 'content_delta', data: { text: 'Hello' } });
      opts.onEvent({ event: 'content_delta', data: { text: ' world' } });
      return Promise.resolve();
    });

    const { result } = renderHook(() => useChatStream({ state: baseState(), dispatch }));
    act(() => result.current.sendMessage('hi'));

    const deltaDispatches = dispatch.mock.calls
      .filter((c: unknown[]) => (c[0] as ChatAction).type === 'APPEND_CONTENT_DELTA');
    expect(deltaDispatches).toHaveLength(2);
  });

  it('SSE message_end dispatches FINALIZE_ASSISTANT_MESSAGE (which sets isStreaming: false via reducer)', () => {
    mockStreamChat.mockImplementation((opts: StreamChatOptions) => {
      opts.onEvent({ event: 'message_end', data: { session_id: 's1', tokens_used: 50, latency_ms: 300 } });
      return Promise.resolve();
    });

    const { result } = renderHook(() => useChatStream({ state: baseState(), dispatch }));
    act(() => result.current.sendMessage('hi'));

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FINALIZE_ASSISTANT_MESSAGE',
        tokens_used: 50,
        latency_ms: 300,
      }),
    );
  });

  // ── Tool calls ───────────────────────────────────────────────────

  it('SSE function_call event dispatches ADD_FUNCTION_CALL with status=running', () => {
    mockStreamChat.mockImplementation((opts: StreamChatOptions) => {
      opts.onEvent({ event: 'function_call', data: { id: 'fc1', name: 'search' } });
      return Promise.resolve();
    });

    const { result } = renderHook(() => useChatStream({ state: baseState(), dispatch }));
    act(() => result.current.sendMessage('hi'));

    expect(dispatch).toHaveBeenCalledWith({
      type: 'ADD_FUNCTION_CALL',
      toolCall: { id: 'fc1', name: 'search', status: 'running' },
    });
  });

  it('SSE function_result event dispatches UPDATE_FUNCTION_RESULT', () => {
    mockStreamChat.mockImplementation((opts: StreamChatOptions) => {
      opts.onEvent({ event: 'function_result', data: { tool_use_id: 'fc1', name: 'search', result: 'found' } });
      return Promise.resolve();
    });

    const { result } = renderHook(() => useChatStream({ state: baseState(), dispatch }));
    act(() => result.current.sendMessage('hi'));

    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_FUNCTION_RESULT',
      toolUseId: 'fc1',
      result: 'found',
    });
  });

  // ── Structured workout data parsing ─────────────────────────────

  it('function_result with workout_generated JSON dispatches SET_WORKOUT_DATA', () => {
    const workoutPayload = JSON.stringify({
      type: 'workout_generated',
      workout: {
        name: 'Push Day',
        exercises: [{ name: 'Bench Press', sets: 3, reps: '8-10' }],
        duration_minutes: 45,
        difficulty: 'intermediate',
      },
    });

    mockStreamChat.mockImplementation((opts: StreamChatOptions) => {
      opts.onEvent({
        event: 'function_result',
        data: { tool_use_id: 'fc1', name: 'generate_workout', result: workoutPayload },
      });
      return Promise.resolve();
    });

    const { result } = renderHook(() => useChatStream({ state: baseState(), dispatch }));
    act(() => result.current.sendMessage('hi'));

    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_WORKOUT_DATA',
      data: {
        type: 'workout_generated',
        workout: {
          name: 'Push Day',
          exercises: [{ name: 'Bench Press', sets: 3, reps: '8-10' }],
          duration_minutes: 45,
          difficulty: 'intermediate',
        },
      },
    });
  });

  it('function_result with search_results JSON dispatches SET_SEARCH_RESULTS', () => {
    const searchPayload = JSON.stringify({
      type: 'search_results',
      workouts: [
        { workout_id: 'w1', title: 'PPL Day A', exercise_count: 6, duration_minutes: 60, difficulty: 'advanced' },
        { workout_id: 'w2', title: 'Full Body', exercise_count: 8 },
      ],
    });

    mockStreamChat.mockImplementation((opts: StreamChatOptions) => {
      opts.onEvent({
        event: 'function_result',
        data: { tool_use_id: 'fc2', name: 'search_workouts', result: searchPayload },
      });
      return Promise.resolve();
    });

    const { result } = renderHook(() => useChatStream({ state: baseState(), dispatch }));
    act(() => result.current.sendMessage('hi'));

    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_SEARCH_RESULTS',
      data: {
        type: 'search_results',
        workouts: [
          { workout_id: 'w1', title: 'PPL Day A', exercise_count: 6, duration_minutes: 60, difficulty: 'advanced' },
          { workout_id: 'w2', title: 'Full Body', exercise_count: 8 },
        ],
      },
    });
  });

  it('function_result with non-JSON string does not dispatch SET_WORKOUT_DATA', () => {
    mockStreamChat.mockImplementation((opts: StreamChatOptions) => {
      opts.onEvent({
        event: 'function_result',
        data: { tool_use_id: 'fc3', name: 'search', result: 'plain text result' },
      });
      return Promise.resolve();
    });

    const { result } = renderHook(() => useChatStream({ state: baseState(), dispatch }));
    act(() => result.current.sendMessage('hi'));

    // Should still dispatch UPDATE_FUNCTION_RESULT
    expect(dispatch).toHaveBeenCalledWith({
      type: 'UPDATE_FUNCTION_RESULT',
      toolUseId: 'fc3',
      result: 'plain text result',
    });

    // Should NOT dispatch SET_WORKOUT_DATA or SET_SEARCH_RESULTS
    const workoutDispatches = dispatch.mock.calls.filter(
      (c: unknown[]) => {
        const action = c[0] as ChatAction;
        return action.type === 'SET_WORKOUT_DATA' || action.type === 'SET_SEARCH_RESULTS';
      }
    );
    expect(workoutDispatches).toHaveLength(0);
  });

  it('heartbeat event does not crash or dispatch unexpected actions', () => {
    mockStreamChat.mockImplementation((opts: StreamChatOptions) => {
      opts.onEvent({
        event: 'heartbeat',
        data: { status: 'processing', tool_name: 'generate_workout', elapsed_seconds: 5 },
      } as SSEEventData);
      return Promise.resolve();
    });

    const { result } = renderHook(() => useChatStream({ state: baseState(), dispatch }));
    act(() => result.current.sendMessage('hi'));

    // Heartbeat should not cause any unexpected dispatches beyond the standard
    // sendMessage ones (ADD_USER_MESSAGE, START_ASSISTANT_MESSAGE, SET_STREAMING, SET_ERROR)
    const actionTypes = dispatch.mock.calls.map((c: unknown[]) => (c[0] as ChatAction).type);
    expect(actionTypes).not.toContain('SET_WORKOUT_DATA');
    expect(actionTypes).not.toContain('SET_SEARCH_RESULTS');
    // Should not throw or produce error dispatches from heartbeat
    const errorDispatches = dispatch.mock.calls.filter(
      (c: unknown[]) => (c[0] as ChatAction).type === 'SET_ERROR' && (c[0] as { error: string | null }).error !== null
    );
    expect(errorDispatches).toHaveLength(0);
  });

  // ── Error handling ───────────────────────────────────────────────

  it('SSE error event dispatches SET_ERROR and SET_STREAMING(false)', () => {
    mockStreamChat.mockImplementation((opts: StreamChatOptions) => {
      opts.onEvent({ event: 'error', data: { type: 'internal', message: 'bad' } });
      return Promise.resolve();
    });

    const { result } = renderHook(() => useChatStream({ state: baseState(), dispatch }));
    act(() => result.current.sendMessage('hi'));

    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_ERROR', error: 'bad' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_STREAMING', isStreaming: false });
  });

  it('SSE error event with usage/limit dispatches SET_RATE_LIMIT', () => {
    mockStreamChat.mockImplementation((opts: StreamChatOptions) => {
      opts.onEvent({
        event: 'error',
        data: { type: 'rate_limit', message: 'limit reached', usage: 50, limit: 50 },
      });
      return Promise.resolve();
    });

    const { result } = renderHook(() => useChatStream({ state: baseState(), dispatch }));
    act(() => result.current.sendMessage('hi'));

    expect(dispatch).toHaveBeenCalledWith({
      type: 'SET_RATE_LIMIT',
      info: { usage: 50, limit: 50 },
    });
  });

  it('network failure triggers retry when no content received yet', async () => {
    let callCount = 0;
    mockStreamChat.mockImplementation((opts: StreamChatOptions) => {
      callCount++;
      if (callCount === 1) {
        opts.onError?.(new Error('Network error'));
      } else {
        opts.onComplete?.();
      }
      return Promise.resolve();
    });

    const { result } = renderHook(() => useChatStream({ state: baseState(), dispatch }));
    act(() => result.current.sendMessage('hi'));

    // First call should have been made
    expect(callCount).toBe(1);

    // Advance past first retry delay (1000ms)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(callCount).toBe(2);
  });

  it('network failure does NOT retry if content_delta was already received', () => {
    mockStreamChat.mockImplementation((opts: StreamChatOptions) => {
      // Simulate partial content received, then failure
      opts.onEvent({ event: 'content_delta', data: { text: 'partial' } });
      opts.onError?.(new Error('Network error'));
      return Promise.resolve();
    });

    const { result } = renderHook(() => useChatStream({ state: baseState(), dispatch }));
    act(() => result.current.sendMessage('hi'));

    // Should dispatch SET_ERROR immediately instead of retrying
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_ERROR', error: 'Network error' });
    // streamChat should only have been called once (no retry)
    expect(mockStreamChat).toHaveBeenCalledTimes(1);
  });

  it('after 3 retries, dispatches SET_ERROR', async () => {
    mockStreamChat.mockImplementation((opts: StreamChatOptions) => {
      opts.onError?.(new Error('Network error'));
      return Promise.resolve();
    });

    const { result } = renderHook(() => useChatStream({ state: baseState(), dispatch }));
    act(() => result.current.sendMessage('hi'));

    // Advance past all retry delays: 1000 + 2000 + 4000
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    // After 4 total attempts (1 initial + 3 retries), error should be dispatched
    const errorDispatches = dispatch.mock.calls.filter(
      (c: unknown[]) => (c[0] as ChatAction).type === 'SET_ERROR' && (c[0] as { error: string }).error === 'Network error'
    );
    expect(errorDispatches.length).toBeGreaterThanOrEqual(1);
  });

  // ── Cancellation ─────────────────────────────────────────────────

  it('cancelStream dispatches SET_STREAMING(false)', () => {
    const { result } = renderHook(() => useChatStream({ state: baseState(), dispatch }));
    act(() => result.current.cancelStream());
    expect(dispatch).toHaveBeenCalledWith({ type: 'SET_STREAMING', isStreaming: false });
  });

  it('sendMessage while streaming is a no-op', () => {
    const state = baseState({ isStreaming: true });
    const { result } = renderHook(() => useChatStream({ state, dispatch }));

    act(() => result.current.sendMessage('hi'));

    // Should not have dispatched any messages (guard prevents it)
    expect(dispatch).not.toHaveBeenCalled();
    expect(mockStreamChat).not.toHaveBeenCalled();
  });

  it('AbortError is silently ignored (no SET_ERROR dispatch)', () => {
    mockStreamChat.mockImplementation((opts: StreamChatOptions) => {
      const abortError = new DOMException('aborted', 'AbortError');
      opts.onError?.(abortError);
      return Promise.resolve();
    });

    const { result } = renderHook(() => useChatStream({ state: baseState(), dispatch }));
    act(() => result.current.sendMessage('hi'));

    const errorDispatches = dispatch.mock.calls.filter(
      (c: unknown[]) => (c[0] as ChatAction).type === 'SET_ERROR' && (c[0] as { error: string | null }).error !== null
    );
    expect(errorDispatches).toHaveLength(0);
  });

  it('onComplete dispatches SET_STREAMING(false)', () => {
    mockStreamChat.mockImplementation((opts: StreamChatOptions) => {
      opts.onComplete?.();
      return Promise.resolve();
    });

    const { result } = renderHook(() => useChatStream({ state: baseState(), dispatch }));
    act(() => result.current.sendMessage('hi'));

    const streamingFalse = dispatch.mock.calls.filter(
      (c: unknown[]) => (c[0] as ChatAction).type === 'SET_STREAMING' && (c[0] as { isStreaming: boolean }).isStreaming === false
    );
    expect(streamingFalse.length).toBeGreaterThanOrEqual(1);
  });
});
