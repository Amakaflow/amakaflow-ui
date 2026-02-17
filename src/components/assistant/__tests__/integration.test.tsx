/**
 * Integration test — full assistant visualization reducer flow.
 *
 * Exercises: SET_ASSISTANT_WORKING → ADD_TIMELINE_STEP → UPDATE_TIMELINE_STEP
 *            → FINALIZE_ASSISTANT_MESSAGE → CLEAR_TIMELINE
 *
 * Tests the reducer directly (no React rendering) to verify state transitions.
 */

import { describe, it, expect } from 'vitest';
import { chatReducer, initialChatState } from '../../../context/ChatContext';
import type { ChatState, TimelineStep, ActionVisualization } from '../../../types/chat';

// ── Helpers ──────────────────────────────────────────────────────────

function stateWithAssistantMessage(): ChatState {
  const msg = { id: 'a1', role: 'assistant' as const, content: '', timestamp: Date.now() };
  return chatReducer(initialChatState, { type: 'START_ASSISTANT_MESSAGE', message: msg });
}

function makeStep(id: string, label: string, status: TimelineStep['status'] = 'running'): TimelineStep {
  return { id, toolName: `tool_${id}`, label, status };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Assistant visualization — full reducer flow', () => {
  it('START_ASSISTANT_MESSAGE resets visualization state and sets assistantWorking', () => {
    const state = stateWithAssistantMessage();

    expect(state.assistantWorking).toBe(true);
    expect(state.timeline).toEqual([]);
    expect(state.activeVisualization).toBeNull();
    expect(state.currentStepLabel).toBeNull();
    expect(state.stepCount).toEqual({ current: 0, total: 0 });
  });

  it('SET_ASSISTANT_WORKING toggles the working flag', () => {
    let state = stateWithAssistantMessage();
    expect(state.assistantWorking).toBe(true);

    state = chatReducer(state, { type: 'SET_ASSISTANT_WORKING', isWorking: false });
    expect(state.assistantWorking).toBe(false);

    state = chatReducer(state, { type: 'SET_ASSISTANT_WORKING', isWorking: true });
    expect(state.assistantWorking).toBe(true);
  });

  it('ADD_TIMELINE_STEP appends step and updates stepCount + currentStepLabel', () => {
    let state = stateWithAssistantMessage();

    state = chatReducer(state, { type: 'ADD_TIMELINE_STEP', step: makeStep('s1', 'Analyzing request') });
    expect(state.timeline).toHaveLength(1);
    expect(state.timeline[0].label).toBe('Analyzing request');
    expect(state.timeline[0].status).toBe('running');
    expect(state.currentStepLabel).toBe('Analyzing request');
    expect(state.stepCount).toEqual({ current: 0, total: 1 });

    state = chatReducer(state, { type: 'ADD_TIMELINE_STEP', step: makeStep('s2', 'Generating workout') });
    expect(state.timeline).toHaveLength(2);
    expect(state.currentStepLabel).toBe('Generating workout');
    expect(state.stepCount).toEqual({ current: 0, total: 2 });
  });

  it('UPDATE_TIMELINE_STEP marks step completed and updates counts', () => {
    let state = stateWithAssistantMessage();
    state = chatReducer(state, { type: 'ADD_TIMELINE_STEP', step: makeStep('s1', 'Analyzing') });
    state = chatReducer(state, { type: 'ADD_TIMELINE_STEP', step: makeStep('s2', 'Generating') });

    // Complete the first step
    state = chatReducer(state, { type: 'UPDATE_TIMELINE_STEP', id: 's1', status: 'completed', result: 'Found 3 exercises' });
    expect(state.timeline[0].status).toBe('completed');
    expect(state.timeline[0].result).toBe('Found 3 exercises');
    expect(state.timeline[1].status).toBe('running');
    expect(state.stepCount).toEqual({ current: 1, total: 2 });
    // currentStepLabel should be the still-running step
    expect(state.currentStepLabel).toBe('Generating');
  });

  it('UPDATE_TIMELINE_STEP with error status', () => {
    let state = stateWithAssistantMessage();
    state = chatReducer(state, { type: 'ADD_TIMELINE_STEP', step: makeStep('s1', 'Searching') });

    state = chatReducer(state, { type: 'UPDATE_TIMELINE_STEP', id: 's1', status: 'error', result: 'API timeout' });
    expect(state.timeline[0].status).toBe('error');
    expect(state.timeline[0].result).toBe('API timeout');
    expect(state.stepCount).toEqual({ current: 0, total: 1 });
  });

  it('SET_ACTIVE_VISUALIZATION sets and clears visualization', () => {
    let state = stateWithAssistantMessage();

    const viz: ActionVisualization = {
      target: '[data-assistant-target="library-section"]',
      type: 'outline-pulse',
      label: 'Updating library',
    };
    state = chatReducer(state, { type: 'SET_ACTIVE_VISUALIZATION', visualization: viz });
    expect(state.activeVisualization).toEqual(viz);

    state = chatReducer(state, { type: 'SET_ACTIVE_VISUALIZATION', visualization: null });
    expect(state.activeVisualization).toBeNull();
  });

  it('FINALIZE_ASSISTANT_MESSAGE stops working but keeps timeline', () => {
    let state = stateWithAssistantMessage();
    state = chatReducer(state, { type: 'SET_STREAMING', isStreaming: true });
    state = chatReducer(state, { type: 'ADD_TIMELINE_STEP', step: makeStep('s1', 'Step 1') });
    state = chatReducer(state, { type: 'UPDATE_TIMELINE_STEP', id: 's1', status: 'completed' });

    state = chatReducer(state, { type: 'FINALIZE_ASSISTANT_MESSAGE', tokens_used: 100, latency_ms: 500 });

    expect(state.assistantWorking).toBe(false);
    expect(state.isStreaming).toBe(false);
    expect(state.activeVisualization).toBeNull();
    expect(state.currentStepLabel).toBeNull();
    // Timeline should persist so user can view completed steps
    expect(state.timeline).toHaveLength(1);
    expect(state.timeline[0].status).toBe('completed');
  });

  it('CLEAR_TIMELINE resets all visualization state', () => {
    let state = stateWithAssistantMessage();
    state = chatReducer(state, { type: 'ADD_TIMELINE_STEP', step: makeStep('s1', 'Step 1') });
    state = chatReducer(state, {
      type: 'SET_ACTIVE_VISUALIZATION',
      visualization: { target: 'x', type: 'outline-pulse', label: 'y' },
    });

    state = chatReducer(state, { type: 'CLEAR_TIMELINE' });
    expect(state.timeline).toEqual([]);
    expect(state.currentStepLabel).toBeNull();
    expect(state.stepCount).toEqual({ current: 0, total: 0 });
    expect(state.activeVisualization).toBeNull();
    expect(state.assistantWorking).toBe(false);
  });

  it('full flow: start → function_call → function_result → finalize', () => {
    // 1. Start assistant message
    let state = stateWithAssistantMessage();
    state = chatReducer(state, { type: 'SET_STREAMING', isStreaming: true });
    expect(state.assistantWorking).toBe(true);
    expect(state.timeline).toEqual([]);

    // 2. First function call arrives
    state = chatReducer(state, {
      type: 'ADD_TIMELINE_STEP',
      step: makeStep('fc1', 'Looking up your profile'),
    });
    state = chatReducer(state, {
      type: 'SET_ACTIVE_VISUALIZATION',
      visualization: { target: '[data-assistant-target="nav-library"]', type: 'outline-pulse', label: 'Looking up profile' },
    });
    expect(state.timeline).toHaveLength(1);
    expect(state.currentStepLabel).toBe('Looking up your profile');
    expect(state.activeVisualization).not.toBeNull();

    // 3. First function result
    state = chatReducer(state, { type: 'UPDATE_TIMELINE_STEP', id: 'fc1', status: 'completed', result: 'Profile loaded' });
    state = chatReducer(state, { type: 'SET_ACTIVE_VISUALIZATION', visualization: null });
    expect(state.timeline[0].status).toBe('completed');
    expect(state.stepCount).toEqual({ current: 1, total: 1 });

    // 4. Second function call
    state = chatReducer(state, {
      type: 'ADD_TIMELINE_STEP',
      step: makeStep('fc2', 'Generating workout'),
    });
    expect(state.timeline).toHaveLength(2);
    expect(state.currentStepLabel).toBe('Generating workout');
    expect(state.stepCount).toEqual({ current: 1, total: 2 });

    // 5. Second function result
    state = chatReducer(state, { type: 'UPDATE_TIMELINE_STEP', id: 'fc2', status: 'completed', result: '30-min HIIT created' });
    expect(state.stepCount).toEqual({ current: 2, total: 2 });

    // 6. Finalize
    state = chatReducer(state, { type: 'FINALIZE_ASSISTANT_MESSAGE', tokens_used: 250, latency_ms: 1200 });
    expect(state.assistantWorking).toBe(false);
    expect(state.isStreaming).toBe(false);
    // Timeline persists for post-stream viewing
    expect(state.timeline).toHaveLength(2);
    expect(state.timeline.every(s => s.status === 'completed')).toBe(true);

    // 7. Next message clears timeline
    const msg2 = { id: 'a2', role: 'assistant' as const, content: '', timestamp: Date.now() };
    state = chatReducer(state, { type: 'START_ASSISTANT_MESSAGE', message: msg2 });
    expect(state.timeline).toEqual([]);
    expect(state.stepCount).toEqual({ current: 0, total: 0 });
  });

  it('CLEAR_SESSION resets all visualization state', () => {
    let state = stateWithAssistantMessage();
    state = chatReducer(state, { type: 'ADD_TIMELINE_STEP', step: makeStep('s1', 'Working') });
    state = chatReducer(state, { type: 'SET_ACTIVE_VISUALIZATION', visualization: { target: 'x', type: 'typing', label: 'y' } });

    state = chatReducer(state, { type: 'CLEAR_SESSION' });
    expect(state.assistantWorking).toBe(false);
    expect(state.timeline).toEqual([]);
    expect(state.activeVisualization).toBeNull();
    expect(state.currentStepLabel).toBeNull();
    expect(state.stepCount).toEqual({ current: 0, total: 0 });
    expect(state.messages).toEqual([]);
  });
});
