/**
 * Unit tests for chatReducer (ChatContext.tsx)
 */

import { describe, it, expect } from 'vitest';
import { chatReducer, initialChatState } from '../ChatContext';
import type { ChatState, ChatAction, ChatMessage, ChatToolCall, TimelineStep, ActionVisualization } from '../../types/chat';

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

  // Visualization state (AMA-631)
  describe('Visualization state (AMA-631)', () => {
    const step1: TimelineStep = { id: 's1', toolName: 'search', label: 'Searching...', status: 'pending' };
    const step2: TimelineStep = { id: 's2', toolName: 'generate', label: 'Generating...', status: 'pending' };
    const viz: ActionVisualization = { target: '#input', type: 'cursor-click', label: 'Clicking input' };

    // -- SET_ASSISTANT_WORKING --
    describe('SET_ASSISTANT_WORKING', () => {
      it('sets assistantWorking to true', () => {
        const s = chatReducer(initialChatState, { type: 'SET_ASSISTANT_WORKING', isWorking: true });
        expect(s.assistantWorking).toBe(true);
      });

      it('sets assistantWorking to false', () => {
        const s = chatReducer(stateWith({ assistantWorking: true }), { type: 'SET_ASSISTANT_WORKING', isWorking: false });
        expect(s.assistantWorking).toBe(false);
      });
    });

    // -- ADD_TIMELINE_STEP --
    describe('ADD_TIMELINE_STEP', () => {
      it('appends step to empty timeline', () => {
        const s = chatReducer(initialChatState, { type: 'ADD_TIMELINE_STEP', step: step1 });
        expect(s.timeline).toHaveLength(1);
        expect(s.timeline[0]).toEqual(step1);
      });

      it('sets currentStepLabel to the new step label', () => {
        const s = chatReducer(initialChatState, { type: 'ADD_TIMELINE_STEP', step: step1 });
        expect(s.currentStepLabel).toBe('Searching...');
      });

      it('increments total in stepCount', () => {
        const s = chatReducer(initialChatState, { type: 'ADD_TIMELINE_STEP', step: step1 });
        expect(s.stepCount).toEqual({ current: 0, total: 1 });
      });

      it('appends multiple steps sequentially', () => {
        let s = chatReducer(initialChatState, { type: 'ADD_TIMELINE_STEP', step: step1 });
        s = chatReducer(s, { type: 'ADD_TIMELINE_STEP', step: step2 });
        expect(s.timeline).toHaveLength(2);
        expect(s.currentStepLabel).toBe('Generating...');
        expect(s.stepCount).toEqual({ current: 0, total: 2 });
      });

      it('counts already-completed steps in current when adding a new step', () => {
        const completedStep: TimelineStep = { ...step1, status: 'completed' };
        const state = stateWith({ timeline: [completedStep], stepCount: { current: 1, total: 1 } });
        const s = chatReducer(state, { type: 'ADD_TIMELINE_STEP', step: step2 });
        expect(s.stepCount).toEqual({ current: 1, total: 2 });
      });
    });

    // -- UPDATE_TIMELINE_STEP --
    describe('UPDATE_TIMELINE_STEP', () => {
      it('updates status of matching step by id', () => {
        const state = stateWith({ timeline: [step1] });
        const s = chatReducer(state, { type: 'UPDATE_TIMELINE_STEP', id: 's1', status: 'running' });
        expect(s.timeline[0].status).toBe('running');
      });

      it('sets result on matching step', () => {
        const state = stateWith({ timeline: [step1] });
        const s = chatReducer(state, { type: 'UPDATE_TIMELINE_STEP', id: 's1', status: 'completed', result: 'Found 3 results' });
        expect(s.timeline[0].result).toBe('Found 3 results');
      });

      it('updates stepCount.current when step completes', () => {
        const running: TimelineStep = { ...step1, status: 'running' };
        const state = stateWith({ timeline: [running, step2], stepCount: { current: 0, total: 2 } });
        const s = chatReducer(state, { type: 'UPDATE_TIMELINE_STEP', id: 's1', status: 'completed' });
        expect(s.stepCount).toEqual({ current: 1, total: 2 });
      });

      it('sets currentStepLabel to the running step label', () => {
        const state = stateWith({ timeline: [step1, step2] });
        const s = chatReducer(state, { type: 'UPDATE_TIMELINE_STEP', id: 's2', status: 'running' });
        expect(s.currentStepLabel).toBe('Generating...');
      });

      it('sets currentStepLabel to null when no step is running', () => {
        const running: TimelineStep = { ...step1, status: 'running' };
        const state = stateWith({ timeline: [running], currentStepLabel: 'Searching...' });
        const s = chatReducer(state, { type: 'UPDATE_TIMELINE_STEP', id: 's1', status: 'completed' });
        expect(s.currentStepLabel).toBeNull();
      });

      it('leaves non-matching steps unchanged', () => {
        const state = stateWith({ timeline: [step1, step2] });
        const s = chatReducer(state, { type: 'UPDATE_TIMELINE_STEP', id: 's1', status: 'completed' });
        expect(s.timeline[1]).toEqual(step2);
      });

      it('handles update for non-existent id gracefully (no crash)', () => {
        const state = stateWith({ timeline: [step1] });
        const s = chatReducer(state, { type: 'UPDATE_TIMELINE_STEP', id: 'nonexistent', status: 'completed' });
        expect(s.timeline).toHaveLength(1);
        expect(s.timeline[0].status).toBe('pending'); // unchanged
      });

      it('handles error status', () => {
        const state = stateWith({ timeline: [step1] });
        const s = chatReducer(state, { type: 'UPDATE_TIMELINE_STEP', id: 's1', status: 'error', result: 'Timeout' });
        expect(s.timeline[0].status).toBe('error');
        expect(s.timeline[0].result).toBe('Timeout');
      });
    });

    // -- SET_ACTIVE_VISUALIZATION --
    describe('SET_ACTIVE_VISUALIZATION', () => {
      it('sets activeVisualization', () => {
        const s = chatReducer(initialChatState, { type: 'SET_ACTIVE_VISUALIZATION', visualization: viz });
        expect(s.activeVisualization).toEqual(viz);
      });

      it('clears activeVisualization with null', () => {
        const state = stateWith({ activeVisualization: viz });
        const s = chatReducer(state, { type: 'SET_ACTIVE_VISUALIZATION', visualization: null });
        expect(s.activeVisualization).toBeNull();
      });
    });

    // -- CLEAR_TIMELINE --
    describe('CLEAR_TIMELINE', () => {
      it('resets timeline, stepCount, currentStepLabel, activeVisualization, and assistantWorking', () => {
        const state = stateWith({
          timeline: [step1, step2],
          stepCount: { current: 1, total: 2 },
          currentStepLabel: 'Generating...',
          activeVisualization: viz,
          assistantWorking: true,
        });
        const s = chatReducer(state, { type: 'CLEAR_TIMELINE' });
        expect(s.timeline).toEqual([]);
        expect(s.stepCount).toEqual({ current: 0, total: 0 });
        expect(s.currentStepLabel).toBeNull();
        expect(s.activeVisualization).toBeNull();
        expect(s.assistantWorking).toBe(false);
      });

      it('is idempotent on already-clear state', () => {
        const s = chatReducer(initialChatState, { type: 'CLEAR_TIMELINE' });
        expect(s.timeline).toEqual([]);
        expect(s.assistantWorking).toBe(false);
      });
    });

    // -- Side effects on existing actions --
    describe('START_ASSISTANT_MESSAGE resets visualization state', () => {
      it('clears timeline and sets assistantWorking=true', () => {
        const state = stateWith({
          timeline: [step1],
          assistantWorking: false,
          activeVisualization: viz,
          currentStepLabel: 'old label',
          stepCount: { current: 1, total: 1 },
        });
        const s = chatReducer(state, { type: 'START_ASSISTANT_MESSAGE', message: makeAssistantMsg() });
        expect(s.timeline).toEqual([]);
        expect(s.assistantWorking).toBe(true);
        expect(s.activeVisualization).toBeNull();
        expect(s.currentStepLabel).toBeNull();
        expect(s.stepCount).toEqual({ current: 0, total: 0 });
      });
    });

    describe('FINALIZE_ASSISTANT_MESSAGE clears visualization working state', () => {
      it('sets assistantWorking=false and clears activeVisualization but keeps timeline', () => {
        const state = stateWith({
          messages: [makeAssistantMsg()],
          isStreaming: true,
          assistantWorking: true,
          timeline: [{ ...step1, status: 'completed' }],
          activeVisualization: viz,
          currentStepLabel: 'Searching...',
        });
        const s = chatReducer(state, { type: 'FINALIZE_ASSISTANT_MESSAGE', tokens_used: 50, latency_ms: 200 });
        expect(s.assistantWorking).toBe(false);
        expect(s.activeVisualization).toBeNull();
        expect(s.currentStepLabel).toBeNull();
        // timeline is preserved so user can see completed steps
        expect(s.timeline).toHaveLength(1);
      });
    });

    describe('CLEAR_SESSION resets all visualization state', () => {
      it('resets visualization fields alongside session fields', () => {
        const state = stateWith({
          sessionId: 'abc',
          messages: [makeUserMsg()],
          assistantWorking: true,
          timeline: [step1],
          activeVisualization: viz,
          currentStepLabel: 'Searching...',
          stepCount: { current: 0, total: 1 },
        });
        const s = chatReducer(state, { type: 'CLEAR_SESSION' });
        expect(s.assistantWorking).toBe(false);
        expect(s.timeline).toEqual([]);
        expect(s.activeVisualization).toBeNull();
        expect(s.currentStepLabel).toBeNull();
        expect(s.stepCount).toEqual({ current: 0, total: 0 });
      });
    });

    // -- Full lifecycle sequence --
    describe('Full lifecycle: ADD -> UPDATE -> FINALIZE', () => {
      it('tracks stepCount through a realistic multi-step flow', () => {
        let s = chatReducer(initialChatState, { type: 'START_ASSISTANT_MESSAGE', message: makeAssistantMsg() });
        expect(s.assistantWorking).toBe(true);

        // Add step 1 (pending)
        s = chatReducer(s, { type: 'ADD_TIMELINE_STEP', step: { ...step1, status: 'pending' } });
        expect(s.stepCount).toEqual({ current: 0, total: 1 });

        // Step 1 starts running
        s = chatReducer(s, { type: 'UPDATE_TIMELINE_STEP', id: 's1', status: 'running' });
        expect(s.currentStepLabel).toBe('Searching...');

        // Add step 2 while step 1 is running
        s = chatReducer(s, { type: 'ADD_TIMELINE_STEP', step: { ...step2, status: 'pending' } });
        expect(s.stepCount).toEqual({ current: 0, total: 2 });

        // Step 1 completes
        s = chatReducer(s, { type: 'UPDATE_TIMELINE_STEP', id: 's1', status: 'completed', result: 'done' });
        expect(s.stepCount).toEqual({ current: 1, total: 2 });

        // Step 2 starts running
        s = chatReducer(s, { type: 'UPDATE_TIMELINE_STEP', id: 's2', status: 'running' });
        expect(s.currentStepLabel).toBe('Generating...');

        // Step 2 completes
        s = chatReducer(s, { type: 'UPDATE_TIMELINE_STEP', id: 's2', status: 'completed' });
        expect(s.stepCount).toEqual({ current: 2, total: 2 });
        expect(s.currentStepLabel).toBeNull();

        // Finalize keeps timeline
        s = chatReducer(s, { type: 'FINALIZE_ASSISTANT_MESSAGE', tokens_used: 100, latency_ms: 500 });
        expect(s.assistantWorking).toBe(false);
        expect(s.timeline).toHaveLength(2);
      });
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
