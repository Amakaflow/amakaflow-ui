/**
 * Chat API client — typed, MSW-interceptable.
 * No isDemoMode branches here. Demo mode is handled by MSW handlers.
 *
 * NOTE: The primary streaming function (streamChat) lives in src/lib/chat-api.ts
 * because it uses ReadableStream / SSE — not a standard JSON REST call.
 * This client wraps it with typed re-exports for consumers that want
 * to import from the api/clients layer.
 */
export {
  streamChat,
  parseSSEEvent,
} from '../../lib/chat-api';

export type {
  ChatContext,
  StreamChatOptions,
} from '../../lib/chat-api';
