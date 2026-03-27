// @generated — do not edit manually. Run: npm run generate:types:chat
// Hand-maintained until generate script runs against live backend.
// Chat API uses SSE streaming — primary types are in src/types/chat.ts.
// This file captures REST envelope types for the chat endpoint.

export interface ChatStreamRequest {
  message: string;
  session_id?: string;
  context?: ChatContext;
}

export interface ChatContext {
  current_page?: string;
  selected_workout_id?: string;
  selected_date?: string;
  pending_imports?: PendingImport[];
}

export interface PendingImport {
  source_url: string;
  title?: string;
  exercise_count?: number;
}

// SSE event envelope — actual data shapes are in src/types/chat.ts (SSEEventData)
export interface ChatSSEEvent {
  event: string;
  data: Record<string, unknown>;
}
