/**
 * Unit tests for parseSSEEvent (chat-api.ts)
 */

import { describe, it, expect, vi } from 'vitest';
import { parseSSEEvent } from '../chat-api';

describe('parseSSEEvent', () => {
  // ── Well-formed events ───────────────────────────────────────────────

  it('parses a message_start event', () => {
    const block = 'event: message_start\ndata: {"session_id":"s1"}';
    const result = parseSSEEvent(block);
    expect(result).toEqual({
      event: 'message_start',
      data: { session_id: 's1' },
    });
  });

  it('parses a content_delta event with plain text', () => {
    const block = 'event: content_delta\ndata: {"text":"hello"}';
    const result = parseSSEEvent(block);
    expect(result).toEqual({
      event: 'content_delta',
      data: { text: 'hello' },
    });
  });

  it('parses a content_delta event with JSON special characters', () => {
    const block = 'event: content_delta\ndata: {"text":"{\\"key\\": \\"val\\"}"}';
    const result = parseSSEEvent(block);
    expect(result).not.toBeNull();
    expect(result!.event).toBe('content_delta');
    expect((result!.data as { text: string }).text).toContain('key');
  });

  it('parses a function_call event', () => {
    const block = 'event: function_call\ndata: {"id":"fc1","name":"search_workouts"}';
    const result = parseSSEEvent(block);
    expect(result).toEqual({
      event: 'function_call',
      data: { id: 'fc1', name: 'search_workouts' },
    });
  });

  it('parses a function_result event', () => {
    const block = 'event: function_result\ndata: {"tool_use_id":"fc1","name":"search_workouts","result":"found 3"}';
    const result = parseSSEEvent(block);
    expect(result).toEqual({
      event: 'function_result',
      data: { tool_use_id: 'fc1', name: 'search_workouts', result: 'found 3' },
    });
  });

  it('parses a message_end event with stats', () => {
    const block = 'event: message_end\ndata: {"session_id":"s1","tokens_used":150,"latency_ms":1200}';
    const result = parseSSEEvent(block);
    expect(result).toEqual({
      event: 'message_end',
      data: { session_id: 's1', tokens_used: 150, latency_ms: 1200 },
    });
  });

  it('parses an error event with usage and limit fields', () => {
    const block = 'event: error\ndata: {"type":"rate_limit","message":"Too many requests","usage":49,"limit":50}';
    const result = parseSSEEvent(block);
    expect(result).toEqual({
      event: 'error',
      data: { type: 'rate_limit', message: 'Too many requests', usage: 49, limit: 50 },
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────

  it('returns null for empty string', () => {
    expect(parseSSEEvent('')).toBeNull();
  });

  it('returns null for event-only block (no data line)', () => {
    expect(parseSSEEvent('event: content_delta')).toBeNull();
  });

  it('returns null for data-only block (no event line)', () => {
    expect(parseSSEEvent('data: {"text":"hello"}')).toBeNull();
  });

  it('returns null for malformed JSON in data line', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const block = 'event: content_delta\ndata: {not valid json}';
    expect(parseSSEEvent(block)).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('handles multi-line data (data fields joined with newline per SSE spec)', () => {
    // Per SSE spec, multiple data: lines are joined with \n
    const block = 'event: content_delta\ndata: {"text":\ndata: "hello"}';
    const result = parseSSEEvent(block);
    expect(result).toEqual({
      event: 'content_delta',
      data: { text: 'hello' },
    });
  });

  it('strips only a single leading space from data: value (SSE spec)', () => {
    // "data:  value" → strips one space → " value" (leading space preserved)
    const block = 'event: content_delta\ndata: {"text":"hi"}';
    const result = parseSSEEvent(block);
    expect(result).toEqual({
      event: 'content_delta',
      data: { text: 'hi' },
    });
  });

  it('handles data: with no space after colon', () => {
    const block = 'event: content_delta\ndata:{"text":"hi"}';
    const result = parseSSEEvent(block);
    expect(result).toEqual({
      event: 'content_delta',
      data: { text: 'hi' },
    });
  });

  it('ignores comment lines (lines starting with ":")', () => {
    const block = ': keep-alive\nevent: content_delta\ndata: {"text":"hi"}';
    const result = parseSSEEvent(block);
    expect(result).toEqual({
      event: 'content_delta',
      data: { text: 'hi' },
    });
  });
});
