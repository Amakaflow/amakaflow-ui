/**
 * ChatContext
 *
 * React Context for managing chat panel state.
 * Uses useReducer following the same pattern as BulkImportContext.
 * Persists sessionId to localStorage so returning users resume their chat.
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo } from 'react';
import type {
  ChatState,
  ChatAction,
  ChatToolCall,
} from '../types/chat';
import { useChatStream } from '../hooks/useChatStream';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'amakaflow_chat_session';

// ============================================================================
// Initial State
// ============================================================================

function loadPersistedSessionId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export const initialChatState: ChatState = {
  isOpen: false,
  sessionId: null,
  messages: [],
  isStreaming: false,
  error: null,
  rateLimitInfo: null,
};

function createInitialState(): ChatState {
  return {
    ...initialChatState,
    sessionId: loadPersistedSessionId(),
  };
}

// ============================================================================
// Reducer
// ============================================================================

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'TOGGLE_PANEL':
      return { ...state, isOpen: !state.isOpen };

    case 'OPEN_PANEL':
      return { ...state, isOpen: true };

    case 'CLOSE_PANEL':
      return { ...state, isOpen: false };

    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.sessionId };

    case 'ADD_USER_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };

    case 'START_ASSISTANT_MESSAGE':
      return { ...state, messages: [...state.messages, action.message] };

    case 'APPEND_CONTENT_DELTA': {
      const messages = [...state.messages];
      const lastIdx = messages.length - 1;
      if (lastIdx >= 0 && messages[lastIdx].role === 'assistant') {
        messages[lastIdx] = {
          ...messages[lastIdx],
          content: messages[lastIdx].content + action.text,
        };
      }
      return { ...state, messages };
    }

    case 'ADD_FUNCTION_CALL': {
      const messages = [...state.messages];
      const lastIdx = messages.length - 1;
      if (lastIdx >= 0 && messages[lastIdx].role === 'assistant') {
        const existing = messages[lastIdx].tool_calls || [];
        messages[lastIdx] = {
          ...messages[lastIdx],
          tool_calls: [...existing, action.toolCall],
        };
      }
      return { ...state, messages };
    }

    case 'UPDATE_FUNCTION_RESULT': {
      const messages = [...state.messages];
      const lastIdx = messages.length - 1;
      if (lastIdx >= 0 && messages[lastIdx].role === 'assistant' && messages[lastIdx].tool_calls) {
        const toolCalls: ChatToolCall[] = messages[lastIdx].tool_calls!.map((tc) =>
          tc.id === action.toolUseId
            ? { ...tc, status: 'completed' as const, result: action.result }
            : tc,
        );
        messages[lastIdx] = { ...messages[lastIdx], tool_calls: toolCalls };
      }
      return { ...state, messages };
    }

    case 'FINALIZE_ASSISTANT_MESSAGE': {
      const messages = [...state.messages];
      const lastIdx = messages.length - 1;
      if (lastIdx >= 0 && messages[lastIdx].role === 'assistant') {
        messages[lastIdx] = {
          ...messages[lastIdx],
          tokens_used: action.tokens_used,
          latency_ms: action.latency_ms,
        };
      }
      return { ...state, messages, isStreaming: false };
    }

    case 'SET_STREAMING':
      return { ...state, isStreaming: action.isStreaming };

    case 'SET_ERROR':
      return { ...state, error: action.error };

    case 'SET_RATE_LIMIT':
      return { ...state, rateLimitInfo: action.info };

    case 'CLEAR_SESSION':
      return {
        ...state,
        sessionId: null,
        messages: [],
        error: null,
        rateLimitInfo: null,
      };

    case 'LOAD_SESSION':
      return {
        ...state,
        sessionId: action.sessionId,
        messages: action.messages,
      };

    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

interface ChatContextValue {
  state: ChatState;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  sendMessage: (text: string) => void;
  cancelStream: () => void;
  clearSession: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, null, createInitialState);
  const { sendMessage, cancelStream } = useChatStream({ state, dispatch });

  // Persist sessionId to localStorage
  useEffect(() => {
    try {
      if (state.sessionId) {
        localStorage.setItem(STORAGE_KEY, state.sessionId);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // localStorage unavailable
    }
  }, [state.sessionId]);

  const togglePanel = useCallback(() => dispatch({ type: 'TOGGLE_PANEL' }), []);
  const openPanel = useCallback(() => dispatch({ type: 'OPEN_PANEL' }), []);
  const closePanel = useCallback(() => dispatch({ type: 'CLOSE_PANEL' }), []);

  const clearSession = useCallback(() => {
    cancelStream();
    dispatch({ type: 'CLEAR_SESSION' });
  }, [cancelStream]);

  const value = useMemo<ChatContextValue>(
    () => ({ state, togglePanel, openPanel, closePanel, sendMessage, cancelStream, clearSession }),
    [state, togglePanel, openPanel, closePanel, sendMessage, cancelStream, clearSession],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return ctx;
}
