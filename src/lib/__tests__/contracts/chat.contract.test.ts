import { describe, it, expect } from 'vitest';
import { ChatStreamRequestSchema } from '../../../api/schemas/chat';
import { API_URLS } from '../../config';

const BASE = API_URLS.CHAT;

async function isApiAvailable(): Promise<boolean> {
  try {
    const r = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

describe('chat-api contract', () => {
  it('ChatStreamRequestSchema validates a valid request body', () => {
    const valid = { message: 'Hello', session_id: 'abc-123' };
    expect(() => ChatStreamRequestSchema.parse(valid)).not.toThrow();
  });

  it('ChatStreamRequestSchema validates minimal request (message only)', () => {
    expect(() => ChatStreamRequestSchema.parse({ message: 'hi' })).not.toThrow();
  });

  it('POST /chat/stream returns SSE stream when API is available', async () => {
    if (!await isApiAvailable()) return;
    const r = await fetch(`${BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': 'contract-test-user' },
      body: JSON.stringify({ message: 'Hello from contract test' }),
    });
    expect(r.ok).toBe(true);
    expect(r.headers.get('content-type')).toContain('text/event-stream');
  });
});
