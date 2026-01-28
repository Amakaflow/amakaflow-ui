/**
 * Chat type definitions for the ChatPanel SSE streaming feature.
 * Matches the backend SSE contract from chat-api.
 */

// ============================================================================
// Message Types
// ============================================================================

export interface ChatToolCall {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: ChatToolCall[];
  timestamp: number;
  /** Stats populated after message_end */
  tokens_used?: number;
  latency_ms?: number;
}

export interface ChatSession {
  id: string;
  title?: string;
  messages: ChatMessage[];
  created_at: number;
  updated_at: number;
}

// ============================================================================
// SSE Event Types (from backend)
// ============================================================================

export interface MessageStartEvent {
  session_id: string;
}

export interface ContentDeltaEvent {
  text: string;
}

export interface FunctionCallEvent {
  id: string;
  name: string;
}

export interface FunctionResultEvent {
  tool_use_id: string;
  name: string;
  result: string;
}

export interface MessageEndEvent {
  session_id: string;
  tokens_used: number;
  latency_ms: number;
}

export interface ErrorEvent {
  type: string;
  message: string;
  usage?: number;
  limit?: number;
}

export type SSEEventData =
  | { event: 'message_start'; data: MessageStartEvent }
  | { event: 'content_delta'; data: ContentDeltaEvent }
  | { event: 'function_call'; data: FunctionCallEvent }
  | { event: 'function_result'; data: FunctionResultEvent }
  | { event: 'message_end'; data: MessageEndEvent }
  | { event: 'error'; data: ErrorEvent };

// ============================================================================
// Chat State
// ============================================================================

export interface RateLimitInfo {
  usage: number;
  limit: number;
}

export interface ChatState {
  isOpen: boolean;
  sessionId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  rateLimitInfo: RateLimitInfo | null;
}

// ============================================================================
// Chat Actions (for useReducer)
// ============================================================================

export type ChatAction =
  | { type: 'TOGGLE_PANEL' }
  | { type: 'OPEN_PANEL' }
  | { type: 'CLOSE_PANEL' }
  | { type: 'SET_SESSION_ID'; sessionId: string }
  | { type: 'ADD_USER_MESSAGE'; message: ChatMessage }
  | { type: 'START_ASSISTANT_MESSAGE'; message: ChatMessage }
  | { type: 'APPEND_CONTENT_DELTA'; text: string }
  | { type: 'ADD_FUNCTION_CALL'; toolCall: ChatToolCall }
  | { type: 'UPDATE_FUNCTION_RESULT'; toolUseId: string; result: string }
  | { type: 'FINALIZE_ASSISTANT_MESSAGE'; tokens_used: number; latency_ms: number }
  | { type: 'SET_STREAMING'; isStreaming: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_RATE_LIMIT'; info: RateLimitInfo }
  | { type: 'CLEAR_SESSION' }
  | { type: 'LOAD_SESSION'; sessionId: string; messages: ChatMessage[] };
