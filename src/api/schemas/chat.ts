import { z } from 'zod';
import type { ChatStreamRequest, ChatContext } from '../generated/chat';

// TODO: refine when endpoints finalized — shapes reflect current chat-api SSE contract

export const PendingImportSchema = z.object({
  source_url: z.string(),
  title: z.string().optional(),
  exercise_count: z.number().optional(),
});

export const ChatContextSchema = z.object({
  current_page: z.string().optional(),
  selected_workout_id: z.string().optional(),
  selected_date: z.string().optional(),
  pending_imports: z.array(PendingImportSchema).optional(),
});

export const ChatStreamRequestSchema = z.object({
  message: z.string(),
  session_id: z.string().optional(),
  context: ChatContextSchema.optional(),
});

// SSE event: generic envelope — concrete event shapes are in src/types/chat.ts
export const ChatSSEEventSchema = z.object({
  event: z.string(),
  data: z.record(z.unknown()),
});

// Compile-time verification
type _VerifyChatStreamRequest = z.infer<typeof ChatStreamRequestSchema> extends ChatStreamRequest ? true : never;
type _VerifyChatContext = z.infer<typeof ChatContextSchema> extends ChatContext ? true : never;
