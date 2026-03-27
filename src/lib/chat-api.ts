/**
 * Chat API client for SSE streaming.
 *
 * Uses fetch() + ReadableStream instead of EventSource because the
 * backend requires POST method and Authorization headers.
 */

import { API_URLS } from './config';
import { authenticatedFetch } from './authenticated-fetch';
import type { SSEEventData, PendingImport } from '../types/chat';

/**
 * Parse a single SSE event block into structured data.
 * SSE format:
 *   event: <event_name>
 *   data: <json_string>
 */
export function parseSSEEvent(block: string): SSEEventData | null {
  let eventType = '';
  let dataStr = '';

  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      // Per SSE spec: strip single leading space after "data:" if present
      const value = line.slice(5);
      const payload = value.startsWith(' ') ? value.slice(1) : value;
      dataStr += (dataStr ? '\n' : '') + payload;
    }
  }

  if (!eventType || !dataStr) return null;

  try {
    const data = JSON.parse(dataStr);
    return { event: eventType, data } as SSEEventData;
  } catch {
    console.warn('[chat-api] Failed to parse SSE data:', dataStr);
    return null;
  }
}

export interface ChatContext {
  current_page?: string;
  selected_workout_id?: string;
  selected_date?: string;
  pending_imports?: PendingImport[];
}

export interface StreamChatOptions {
  message: string;
  sessionId?: string | null;
  context?: ChatContext;
  signal?: AbortSignal;
  onEvent: (event: SSEEventData) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

/**
 * Stream a chat message via SSE.
 * Makes an authenticated POST to /chat/stream and reads the response
 * body as a stream, parsing SSE events line by line.
 */
export async function streamChat({
  message,
  sessionId,
  context,
  signal,
  onEvent,
  onError,
  onComplete,
}: StreamChatOptions): Promise<void> {
  const url = `${API_URLS.CHAT}/chat/stream`;
  console.log('[chat-api] streamChat called, url:', url);

  const body: Record<string, unknown> = { message };
  if (sessionId) {
    body.session_id = sessionId;
  }
  if (context) {
    body.context = context;
  }

  let response: Response;
  try {
    response = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (error.name === 'AbortError') return;
    onError?.(error);
    return;
  }

  console.log('[chat-api] Response received, status:', response.status, 'ok:', response.ok);

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    console.log('[chat-api] Response not ok, error:', errorText);
    onError?.(new Error(`Chat API error: ${response.status} — ${errorText}`));
    return;
  }

  if (!response.body) {
    console.log('[chat-api] No response body');
    onError?.(new Error('Chat API returned no body'));
    return;
  }

  console.log('[chat-api] Starting to read stream...');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Normalize line endings: convert \r\n to \n, then \r to \n
      buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      // SSE events are separated by double newlines
      const parts = buffer.split('\n\n');
      // Keep the last part (may be incomplete)
      buffer = parts.pop() || '';

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        console.log('[chat-api] Parsing SSE block:', trimmed.substring(0, 100));
        const event = parseSSEEvent(trimmed);
        if (event) {
          console.log('[chat-api] Parsed event:', event.event);
          onEvent(event);
        } else {
          console.warn('[chat-api] Failed to parse SSE block');
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      // Normalize remaining buffer as well
      buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const event = parseSSEEvent(buffer.trim());
      if (event) {
        onEvent(event);
      }
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (error.name === 'AbortError') return;
    onError?.(error);
    return;
  }

  onComplete?.();
}
