/**
 * useChatStream — React hook that manages SSE streaming for the chat panel.
 *
 * Handles sending messages, parsing SSE events, accumulating content deltas,
 * tracking tool calls, and managing errors/rate limits.
 */

import { useCallback, useRef } from 'react';
import { streamChat } from '../lib/chat-api';
import type {
  ChatMessage,
  ChatAction,
  ChatState,
  SSEEventData,
  RateLimitInfo,
} from '../types/chat';

interface UseChatStreamOptions {
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
}

interface UseChatStreamReturn {
  sendMessage: (text: string) => void;
  cancelStream: () => void;
}

function nextMessageId(): string {
  return `msg_${crypto.randomUUID()}`;
}

export function useChatStream({ state, dispatch }: UseChatStreamOptions): UseChatStreamReturn {
  const abortRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef(0);
  const receivedContentRef = useRef(false);
  const sessionIdRef = useRef(state.sessionId);
  const maxRetries = 3;

  // Keep sessionIdRef in sync with state
  sessionIdRef.current = state.sessionId;

  const cancelStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    dispatch({ type: 'SET_STREAMING', isStreaming: false });
  }, [dispatch]);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || state.isStreaming) return;

      // Cancel any existing stream
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      // Add user message
      const userMessage: ChatMessage = {
        id: nextMessageId(),
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      };
      dispatch({ type: 'ADD_USER_MESSAGE', message: userMessage });

      // Create placeholder assistant message
      const assistantMessage: ChatMessage = {
        id: nextMessageId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };
      dispatch({ type: 'START_ASSISTANT_MESSAGE', message: assistantMessage });
      dispatch({ type: 'SET_STREAMING', isStreaming: true });
      dispatch({ type: 'SET_ERROR', error: null });

      retryCountRef.current = 0;
      receivedContentRef.current = false;

      const executeStream = () => {
        streamChat({
          message: trimmed,
          sessionId: sessionIdRef.current,
          signal: controller.signal,
          onEvent: (event: SSEEventData) => {
            switch (event.event) {
              case 'message_start':
                dispatch({ type: 'SET_SESSION_ID', sessionId: event.data.session_id });
                break;

              case 'content_delta':
                receivedContentRef.current = true;
                dispatch({ type: 'APPEND_CONTENT_DELTA', text: event.data.text });
                break;

              case 'function_call':
                dispatch({
                  type: 'ADD_FUNCTION_CALL',
                  toolCall: {
                    id: event.data.id,
                    name: event.data.name,
                    status: 'running',
                  },
                });
                break;

              case 'function_result':
                dispatch({
                  type: 'UPDATE_FUNCTION_RESULT',
                  toolUseId: event.data.tool_use_id,
                  result: event.data.result,
                });
                break;

              case 'message_end':
                dispatch({
                  type: 'FINALIZE_ASSISTANT_MESSAGE',
                  tokens_used: event.data.tokens_used,
                  latency_ms: event.data.latency_ms,
                });
                // FINALIZE_ASSISTANT_MESSAGE already sets isStreaming: false
                abortRef.current = null;
                break;

              case 'error': {
                const { data } = event;
                dispatch({ type: 'SET_ERROR', error: data.message });
                dispatch({ type: 'SET_STREAMING', isStreaming: false });
                if (data.usage !== undefined && data.limit !== undefined) {
                  const info: RateLimitInfo = { usage: data.usage, limit: data.limit };
                  dispatch({ type: 'SET_RATE_LIMIT', info });
                }
                abortRef.current = null;
                break;
              }
            }
          },
          onError: (error: Error) => {
            if (error.name === 'AbortError') return;

            // Only retry if no content has been received yet (avoids duplicated content)
            if (retryCountRef.current < maxRetries && !receivedContentRef.current) {
              retryCountRef.current++;
              const delay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 8000);
              setTimeout(executeStream, delay);
              return;
            }

            dispatch({ type: 'SET_ERROR', error: error.message });
            dispatch({ type: 'SET_STREAMING', isStreaming: false });
            abortRef.current = null;
          },
          onComplete: () => {
            // Only finalize if message_end didn't already handle it
            if (abortRef.current) {
              dispatch({ type: 'SET_STREAMING', isStreaming: false });
              abortRef.current = null;
            }
          },
        });
      };

      executeStream();
    },
    [state.isStreaming, dispatch],
  );

  return { sendMessage, cancelStream };
}
