/**
 * Unit tests for chatReducer (ChatContext.tsx)
 */

import { describe, it, expect } from 'vitest';
import { chatReducer, initialChatState } from '../ChatContext';
import type { ChatState, ChatAction, ChatMessage, ChatToolCall } from '../../types/chat';

// ── Helpers ──────────────────────────────────────────────────────────

function makeUserMsg(id = 'u1', content = 'hello'): ChatMessage {
  return { id, role: 'user', content, timestamp: 1000 };
}

function makeAssistantMsg(id = 'a1', content = ''): ChatMessage {
  return { id, role: 'assistant', content, timestamp: 2000 };
}

function stateWith(patch: Partial<ChatState>): ChatState {
  return { ...initialChatState, ...patch };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('chatReducer', () => {
  // Panel visibility
  describe('Panel visibility', () => {
    it('TOGGLE_PANEL flips isOpen false → true', () => {
      const s = chatReducer(stateWith({ isOpen: false }), { type: 'TOGGLE_PANEL' });
      expect(s.isOpen).toBe(true);
    });

    it('TOGGLE_PANEL flips isOpen true → false', () => {
      const s = chatReducer(stateWith({ isOpen: true }), { type: 'TOGGLE_PANEL' });
      expect(s.isOpen).toBe(false);
    });

    it('OPEN_PANEL sets isOpen to true (idempotent)', () => {
      const s = chatReducer(stateWith({ isOpen: true }), { type: 'OPEN_PANEL' });
      expect(s.isOpen).toBe(true);
    });

    it('CLOSE_PANEL sets isOpen to false (idempotent)', () => {
      const s = chatReducer(stateWith({ isOpen: false }), { type: 'CLOSE_PANEL' });
      expect(s.isOpen).toBe(false);
    });
  });

  // Session management
  describe('Session management', () => {
    it('SET_SESSION_ID stores sessionId', () => {
      const s = chatReducer(initialChatState, { type: 'SET_SESSION_ID', sessionId: 'abc' });
      expect(s.sessionId).toBe('abc');
    });

    it('CLEAR_SESSION resets sessionId, messages, error, rateLimitInfo', () => {
      const dirty = stateWith({
        sessionId: 'abc',
        messages: [makeUserMsg()],
        error: 'fail',
        rateLimitInfo: { usage: 10, limit: 50 },
        isOpen: true, // should remain
      });
      const s = chatReducer(dirty, { type: 'CLEAR_SESSION' });
      expect(s.sessionId).toBeNull();
      expect(s.messages).toEqual([]);
      expect(s.error).toBeNull();
      expect(s.rateLimitInfo).toBeNull();
      expect(s.isOpen).toBe(true); // preserved
    });

    it('LOAD_SESSION sets sessionId and messages', () => {
      const msgs: ChatMessage[] = [makeUserMsg(), makeAssistantMsg()];
      const s = chatReducer(initialChatState, { type: 'LOAD_SESSION', sessionId: 'xyz', messages: msgs });
      expect(s.sessionId).toBe('xyz');
      expect(s.messages).toEqual(msgs);
    });
  });

  // Message flow
  describe('Message flow', () => {
    it('ADD_USER_MESSAGE appends user message', () => {
      const msg = makeUserMsg();
      const s = chatReducer(initialChatState, { type: 'ADD_USER_MESSAGE', message: msg });
      expect(s.messages).toHaveLength(1);
      expect(s.messages[0]).toEqual(msg);
    });

    it('START_ASSISTANT_MESSAGE appends assistant message', () => {
      const msg = makeAssistantMsg();
      const s = chatReducer(initialChatState, { type: 'START_ASSISTANT_MESSAGE', message: msg });
      expect(s.messages).toHaveLength(1);
      expect(s.messages[0].role).toBe('assistant');
    });

    it('APPEND_CONTENT_DELTA concatenates text to last assistant message', () => {
      const state = stateWith({ messages: [makeAssistantMsg('a1', 'Hello')] });
      const s = chatReducer(state, { type: 'APPEND_CONTENT_DELTA', text: ' world' });
      expect(s.messages[0].content).toBe('Hello world');
    });

    it('APPEND_CONTENT_DELTA is a no-op if last message is user role', () => {
      const state = stateWith({ messages: [makeUserMsg()] });
      const s = chatReducer(state, { type: 'APPEND_CONTENT_DELTA', text: 'nope' });
      expect(s.messages[0].content).toBe('hello');
    });

    it('APPEND_CONTENT_DELTA accumulates across multiple dispatches', () => {
      let state = stateWith({ messages: [makeAssistantMsg('a1', '')] });
      state = chatReducer(state, { type: 'APPEND_CONTENT_DELTA', text: 'a' });
      state = chatReducer(state, { type: 'APPEND_CONTENT_DELTA', text: 'b' });
      state = chatReducer(state, { type: 'APPEND_CONTENT_DELTA', text: 'c' });
      expect(state.messages[0].content).toBe('abc');
    });

    it('FINALIZE_ASSISTANT_MESSAGE sets tokens_used and latency_ms', () => {
      const state = stateWith({ messages: [makeAssistantMsg()], isStreaming: true });
      const s = chatReducer(state, { type: 'FINALIZE_ASSISTANT_MESSAGE', tokens_used: 100, latency_ms: 500 });
      expect(s.messages[0].tokens_used).toBe(100);
      expect(s.messages[0].latency_ms).toBe(500);
    });

    it('FINALIZE_ASSISTANT_MESSAGE sets isStreaming to false', () => {
      const state = stateWith({ messages: [makeAssistantMsg()], isStreaming: true });
      const s = chatReducer(state, { type: 'FINALIZE_ASSISTANT_MESSAGE', tokens_used: 0, latency_ms: 0 });
      expect(s.isStreaming).toBe(false);
    });
  });

  // Tool calls
  describe('Tool calls', () => {
    const tc: ChatToolCall = { id: 'tc1', name: 'search', status: 'running' };

    it('ADD_FUNCTION_CALL adds tool call to last assistant message', () => {
      const state = stateWith({ messages: [makeAssistantMsg()] });
      const s = chatReducer(state, { type: 'ADD_FUNCTION_CALL', toolCall: tc });
      expect(s.messages[0].tool_calls).toEqual([tc]);
    });

    it('ADD_FUNCTION_CALL creates tool_calls array if none exists', () => {
      const msg = makeAssistantMsg();
      expect(msg.tool_calls).toBeUndefined();
      const state = stateWith({ messages: [msg] });
      const s = chatReducer(state, { type: 'ADD_FUNCTION_CALL', toolCall: tc });
      expect(s.messages[0].tool_calls).toHaveLength(1);
    });

    it('UPDATE_FUNCTION_RESULT sets status=completed and result on matching tool call', () => {
      const msg: ChatMessage = { ...makeAssistantMsg(), tool_calls: [tc] };
      const state = stateWith({ messages: [msg] });
      const s = chatReducer(state, { type: 'UPDATE_FUNCTION_RESULT', toolUseId: 'tc1', result: 'done' });
      expect(s.messages[0].tool_calls![0].status).toBe('completed');
      expect(s.messages[0].tool_calls![0].result).toBe('done');
    });

    it('UPDATE_FUNCTION_RESULT leaves non-matching tool calls unchanged', () => {
      const tc2: ChatToolCall = { id: 'tc2', name: 'other', status: 'running' };
      const msg: ChatMessage = { ...makeAssistantMsg(), tool_calls: [tc, tc2] };
      const state = stateWith({ messages: [msg] });
      const s = chatReducer(state, { type: 'UPDATE_FUNCTION_RESULT', toolUseId: 'tc1', result: 'done' });
      expect(s.messages[0].tool_calls![0].status).toBe('completed');
      expect(s.messages[0].tool_calls![1].status).toBe('running');
    });
  });

  // Streaming & errors
  describe('Streaming & errors', () => {
    it('SET_STREAMING updates isStreaming', () => {
      const s = chatReducer(initialChatState, { type: 'SET_STREAMING', isStreaming: true });
      expect(s.isStreaming).toBe(true);
    });

    it('SET_ERROR stores error string', () => {
      const s = chatReducer(initialChatState, { type: 'SET_ERROR', error: 'fail' });
      expect(s.error).toBe('fail');
    });

    it('SET_ERROR with null clears the error', () => {
      const state = stateWith({ error: 'fail' });
      const s = chatReducer(state, { type: 'SET_ERROR', error: null });
      expect(s.error).toBeNull();
    });

    it('SET_RATE_LIMIT stores usage/limit info', () => {
      const s = chatReducer(initialChatState, { type: 'SET_RATE_LIMIT', info: { usage: 45, limit: 50 } });
      expect(s.rateLimitInfo).toEqual({ usage: 45, limit: 50 });
    });
  });

  // Edge cases
  describe('Edge cases', () => {
    it('unknown action type returns state unchanged', () => {
      const state = stateWith({ isOpen: true });
      const s = chatReducer(state, { type: 'UNKNOWN_ACTION' } as unknown as ChatAction);
      expect(s).toBe(state);
    });

    it('APPEND_CONTENT_DELTA on empty messages array is safe', () => {
      const s = chatReducer(initialChatState, { type: 'APPEND_CONTENT_DELTA', text: 'x' });
      expect(s.messages).toHaveLength(0);
    });

    it('ADD_FUNCTION_CALL on empty messages array is safe', () => {
      const tc: ChatToolCall = { id: 'tc1', name: 'search', status: 'running' };
      const s = chatReducer(initialChatState, { type: 'ADD_FUNCTION_CALL', toolCall: tc });
      expect(s.messages).toHaveLength(0);
    });
  });
});
