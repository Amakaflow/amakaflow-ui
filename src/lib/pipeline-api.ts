/**
 * Pipeline API client for SSE streaming.
 *
 * Uses the same fetch+ReadableStream pattern as chat-api.ts but for
 * standalone pipeline endpoints (e.g., workout generation).
 */

import { API_URLS } from './config';
import { authenticatedFetch } from './authenticated-fetch';
import { parseSSEEvent } from './chat-api';
import type { PipelineSSEEvent } from '../types/pipeline';

const PIPELINE_EVENT_TYPES = new Set(['stage', 'content_delta', 'preview', 'error', 'complete']);

export interface StreamPipelineOptions {
  endpoint: string;
  body: Record<string, unknown>;
  signal?: AbortSignal;
  onEvent: (event: PipelineSSEEvent) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

/**
 * Stream a pipeline endpoint via SSE.
 * Makes an authenticated POST and reads the response body as a stream,
 * parsing SSE events line by line.
 */
export async function streamPipeline({
  endpoint,
  body,
  signal,
  onEvent,
  onError,
  onComplete,
}: StreamPipelineOptions): Promise<void> {
  const url = `${API_URLS.CHAT}${endpoint}`;

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
    onError?.(new Error(`Pipeline API error: ${response.status} — ${errorText}`));
    return;
  }

  if (!response.body) {
    onError?.(new Error('Pipeline API returned no body'));
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
      buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const event = parseSSEEvent(trimmed);
        if (event && PIPELINE_EVENT_TYPES.has(event.event)) {
          onEvent(event as PipelineSSEEvent);
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const event = parseSSEEvent(buffer.trim());
      if (event && PIPELINE_EVENT_TYPES.has(event.event)) {
        onEvent(event as PipelineSSEEvent);
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
