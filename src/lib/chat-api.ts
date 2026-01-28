/**
 * Chat API client for SSE streaming.
 *
 * Uses fetch() + ReadableStream instead of EventSource because the
 * backend requires POST method and Authorization headers.
 */

import { API_URLS } from './config';
import { authenticatedFetch } from './authenticated-fetch';
import type { SSEEventData } from '../types/chat';

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

export interface StreamChatOptions {
  message: string;
  sessionId?: string | null;
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
  signal,
  onEvent,
  onError,
  onComplete,
}: StreamChatOptions): Promise<void> {
  const url = `${API_URLS.CHAT}/chat/stream`;

  const body: Record<string, unknown> = { message };
  if (sessionId) {
    body.session_id = sessionId;
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

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    onError?.(new Error(`Chat API error: ${response.status} — ${errorText}`));
    return;
  }

  if (!response.body) {
    onError?.(new Error('Chat API returned no body'));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines
      const parts = buffer.split('\n\n');
      // Keep the last part (may be incomplete)
      buffer = parts.pop() || '';

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const event = parseSSEEvent(trimmed);
        if (event) {
          onEvent(event);
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
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
