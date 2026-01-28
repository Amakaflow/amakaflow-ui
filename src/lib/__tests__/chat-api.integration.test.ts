/**
 * Integration tests for streamChat — verifies the full fetch→ReadableStream→SSE
 * pipeline with mocked authenticatedFetch.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SSEEventData } from '../../types/chat';

// Mock authenticatedFetch at the module level
vi.mock('../authenticated-fetch', () => ({
  authenticatedFetch: vi.fn(),
}));

import { authenticatedFetch } from '../authenticated-fetch';
import { streamChat } from '../chat-api';

const mockFetch = authenticatedFetch as ReturnType<typeof vi.fn>;

// ── Helpers ──────────────────────────────────────────────────────────

function createMockSSEStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

function mockOkResponse(chunks: string[]): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    body: createMockSSEStream(chunks),
    text: () => Promise.resolve(''),
  } as unknown as Response;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('streamChat integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('processes a full SSE stream (start → deltas → end)', async () => {
    const chunks = [
      'event: message_start\ndata: {"session_id":"s1"}\n\n',
      'event: content_delta\ndata: {"text":"Hello"}\n\nevent: content_delta\ndata: {"text":" world"}\n\n',
      'event: message_end\ndata: {"session_id":"s1","tokens_used":10,"latency_ms":200}\n\n',
    ];

    mockFetch.mockResolvedValue(mockOkResponse(chunks));

    const events: SSEEventData[] = [];
    let completed = false;

    await streamChat({
      message: 'hi',
      onEvent: (e) => events.push(e),
      onComplete: () => { completed = true; },
    });

    expect(events).toHaveLength(4);
    expect(events[0].event).toBe('message_start');
    expect(events[1].event).toBe('content_delta');
    expect((events[1].data as { text: string }).text).toBe('Hello');
    expect(events[2].event).toBe('content_delta');
    expect((events[2].data as { text: string }).text).toBe(' world');
    expect(events[3].event).toBe('message_end');
    expect(completed).toBe(true);
  });

  it('handles partial chunk boundaries (event split across two chunks)', async () => {
    // Split "event: content_delta\ndata: {\"text\":\"hello\"}\n\n" across two chunks
    const chunks = [
      'event: content_delta\nda',
      'ta: {"text":"hello"}\n\n',
    ];

    mockFetch.mockResolvedValue(mockOkResponse(chunks));

    const events: SSEEventData[] = [];
    await streamChat({ message: 'hi', onEvent: (e) => events.push(e) });

    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('content_delta');
    expect((events[0].data as { text: string }).text).toBe('hello');
  });

  it('handles multiple events in a single chunk', async () => {
    const chunk =
      'event: content_delta\ndata: {"text":"a"}\n\n' +
      'event: content_delta\ndata: {"text":"b"}\n\n' +
      'event: content_delta\ndata: {"text":"c"}\n\n';

    mockFetch.mockResolvedValue(mockOkResponse([chunk]));

    const events: SSEEventData[] = [];
    await streamChat({ message: 'hi', onEvent: (e) => events.push(e) });

    expect(events).toHaveLength(3);
    expect((events[0].data as { text: string }).text).toBe('a');
    expect((events[1].data as { text: string }).text).toBe('b');
    expect((events[2].data as { text: string }).text).toBe('c');
  });

  it('processes remaining buffer after stream ends', async () => {
    // No trailing \n\n — event is in the buffer at stream close
    const chunks = ['event: content_delta\ndata: {"text":"tail"}'];
    mockFetch.mockResolvedValue(mockOkResponse(chunks));

    const events: SSEEventData[] = [];
    await streamChat({ message: 'hi', onEvent: (e) => events.push(e) });

    expect(events).toHaveLength(1);
    expect((events[0].data as { text: string }).text).toBe('tail');
  });

  // ── Error paths ────────────────────────────────────────────────────

  it('calls onError for non-200 HTTP status', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: () => Promise.resolve('server broke'),
    } as unknown as Response);

    const errors: Error[] = [];
    await streamChat({ message: 'hi', onEvent: () => {}, onError: (e) => errors.push(e) });

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('500');
    expect(errors[0].message).toContain('server broke');
  });

  it('calls onError when response.body is null', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: null,
    } as unknown as Response);

    const errors: Error[] = [];
    await streamChat({ message: 'hi', onEvent: () => {}, onError: (e) => errors.push(e) });

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('no body');
  });

  it('silently returns on AbortError (no onError call)', async () => {
    // Create an error with name = 'AbortError' to simulate fetch abort
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValue(abortError);

    const errors: Error[] = [];
    await streamChat({ message: 'hi', onEvent: () => {}, onError: (e) => errors.push(e) });

    expect(errors).toHaveLength(0);
  });

  it('calls onError for mid-stream read failure', async () => {
    const failStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: content_delta\ndata: {"text":"ok"}\n\n'));
      },
      pull() {
        throw new Error('read failure');
      },
    });

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body: failStream,
    } as unknown as Response);

    const events: SSEEventData[] = [];
    const errors: Error[] = [];
    await streamChat({
      message: 'hi',
      onEvent: (e) => events.push(e),
      onError: (e) => errors.push(e),
    });

    // Should have processed the first event before the error
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('read failure');
  });
});
