import { http, HttpResponse } from 'msw';
import { API_URLS } from '../../../lib/config';

const BASE = API_URLS.CHAT;

// Minimal SSE helper — encodes a single SSE event block
function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export const chatHandlers = [
  http.post(`${BASE}/chat/stream`, async ({ request }) => {
    const body = await request.json() as any;
    const sessionId = body.session_id || `demo-session-${Date.now()}`;
    const message: string = body.message || '';

    const chunks = [
      sseEvent('message_start', { session_id: sessionId }),
      sseEvent('content_delta', { text: 'This is a demo response. ' }),
      sseEvent('content_delta', { text: `You said: "${message}"` }),
      sseEvent('message_end', {
        session_id: sessionId,
        tokens_used: 42,
        latency_ms: 100,
        pending_imports: [],
      }),
    ];

    const body_stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      },
    });

    return new HttpResponse(body_stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }),

  http.get(`${BASE}/health`, () => {
    return HttpResponse.json({ status: 'ok', service: 'chat-api' });
  }),
];
