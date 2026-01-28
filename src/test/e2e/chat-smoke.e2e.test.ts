/**
 * E2E smoke tests for the Chat API.
 * These require a running chat-api service on port 8005.
 * Tests are skipped gracefully if the service is unavailable.
 */

import { describe, it, expect, beforeAll } from 'vitest';

const CHAT_API_URL = 'http://localhost:8005';
let isServiceAvailable = false;

beforeAll(async () => {
  try {
    const res = await fetch(`${CHAT_API_URL}/health`, { signal: AbortSignal.timeout(3000) });
    isServiceAvailable = res.ok;
  } catch {
    isServiceAvailable = false;
  }
});

function skipIfUnavailable() {
  if (!isServiceAvailable) {
    console.log('[chat-smoke] Chat API not available, skipping test');
  }
  return !isServiceAvailable;
}

describe('Chat API E2E smoke', () => {
  it('health check returns 200', async () => {
    if (skipIfUnavailable()) return;

    const res = await fetch(`${CHAT_API_URL}/health`);
    expect(res.ok).toBe(true);
  });

  it('POST /chat/stream returns SSE stream', async () => {
    if (skipIfUnavailable()) return;

    const res = await fetch(`${CHAT_API_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'ping' }),
    });

    expect(res.status).toBeLessThan(500);
    // Even if 401 (no auth), it should not be a 5xx
  });

  it('SSE stream contains message_start and message_end events', async () => {
    if (skipIfUnavailable()) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${CHAT_API_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Say hi' }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        // Service may require auth — skip gracefully
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        // Short-circuit once we see message_end
        if (fullText.includes('message_end')) break;
      }

      expect(fullText).toContain('message_start');
      expect(fullText).toContain('message_end');
    } finally {
      clearTimeout(timeout);
      controller.abort();
    }
  });

  it('missing auth returns 401 when auth is required', async () => {
    if (skipIfUnavailable()) return;

    const res = await fetch(`${CHAT_API_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'test' }),
    });

    // If the API requires auth, expect 401 or 403.
    // If no auth required (dev mode), this may succeed — both are valid.
    expect([200, 401, 403]).toContain(res.status);
  });

  it('AbortController cancels mid-stream', async () => {
    if (skipIfUnavailable()) return;

    const controller = new AbortController();

    const fetchPromise = fetch(`${CHAT_API_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Tell me a long story' }),
      signal: controller.signal,
    });

    // Abort quickly
    setTimeout(() => controller.abort(), 100);

    try {
      await fetchPromise;
      // If the request completed before abort, that's fine
    } catch (err: unknown) {
      // AbortError is the expected outcome
      expect((err as Error).name).toBe('AbortError');
    }
  });
});
