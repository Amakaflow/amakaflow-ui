/**
 * Chat type definitions for the ChatPanel SSE streaming feature.
 * Matches the backend SSE contract from chat-api.
 */

// ============================================================================
// Message Types
// ============================================================================

export interface ChatToolCall {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: ChatToolCall[];
  timestamp: number;
  /** Stats populated after message_end */
  tokens_used?: number;
  latency_ms?: number;
}

export interface ChatSession {
  id: string;
  title?: string;
  messages: ChatMessage[];
  created_at: number;
  updated_at: number;
}

// ============================================================================
// SSE Event Types (from backend)
// ============================================================================

export interface MessageStartEvent {
  session_id: string;
}

export interface ContentDeltaEvent {
  text: string;
}

export interface FunctionCallEvent {
  id: string;
  name: string;
}

export interface FunctionResultEvent {
  tool_use_id: string;
  name: string;
  result: string;
}

export interface PendingImport {
  source_url: string;
  title?: string;
  exercise_count?: number;
}

export interface MessageEndEvent {
  session_id: string;
  tokens_used: number;
  latency_ms: number;
  pending_imports?: PendingImport[];
}

export interface ErrorEvent {
  type: string;
  message: string;
  usage?: number;
  limit?: number;
}

// Stage events for Perplexity-style progress indicator
export type WorkoutStage = 'analyzing' | 'researching' | 'searching' | 'creating' | 'complete';

export interface StageEvent {
  stage: WorkoutStage;
  message: string;
}

// Structured workout data from function_result events
export interface WorkoutExercise {
  name: string;
  sets?: number;
  reps?: string;
  muscle_group?: string;
  notes?: string;
}

export interface GeneratedWorkout {
  type: 'workout_generated';
  workout: {
    name: string;
    exercises: WorkoutExercise[];
    duration_minutes?: number;
    difficulty?: string;
  };
}

export interface SearchResultWorkout {
  workout_id: string;
  title: string;
  exercise_count?: number;
  duration_minutes?: number;
  difficulty?: string;
}

export interface WorkoutSearchResults {
  type: 'search_results';
  workouts: SearchResultWorkout[];
}

export type WorkoutToolResult = GeneratedWorkout | WorkoutSearchResults;

export type SSEEventData =
  | { event: 'message_start'; data: MessageStartEvent }
  | { event: 'content_delta'; data: ContentDeltaEvent }
  | { event: 'function_call'; data: FunctionCallEvent }
  | { event: 'function_result'; data: FunctionResultEvent }
  | { event: 'stage'; data: StageEvent }
  | { event: 'heartbeat'; data: { status: string; tool_name: string; elapsed_seconds: number } }
  | { event: 'message_end'; data: MessageEndEvent }
  | { event: 'error'; data: ErrorEvent };

// ============================================================================
// Chat State
// ============================================================================

export interface RateLimitInfo {
  usage: number;
  limit: number;
}

export interface ChatState {
  isOpen: boolean;
  sessionId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  rateLimitInfo: RateLimitInfo | null;
  /** Pending imports from last message - send back to API on next request */
  pendingImports: PendingImport[];
  /** Current stage for Perplexity-style progress (null when no active stage) */
  currentStage: StageEvent | null;
  /** History of stages for the current message */
  completedStages: WorkoutStage[];
  /** Structured workout data from tool results */
  workoutData: GeneratedWorkout | null;
  /** Search results from tool queries */
  searchResults: WorkoutSearchResults | null;
}

// ============================================================================
// Chat Actions (for useReducer)
// ============================================================================

export type ChatAction =
  | { type: 'TOGGLE_PANEL' }
  | { type: 'OPEN_PANEL' }
  | { type: 'CLOSE_PANEL' }
  | { type: 'SET_SESSION_ID'; sessionId: string }
  | { type: 'ADD_USER_MESSAGE'; message: ChatMessage }
  | { type: 'START_ASSISTANT_MESSAGE'; message: ChatMessage }
  | { type: 'APPEND_CONTENT_DELTA'; text: string }
  | { type: 'ADD_FUNCTION_CALL'; toolCall: ChatToolCall }
  | { type: 'UPDATE_FUNCTION_RESULT'; toolUseId: string; result: string }
  | { type: 'FINALIZE_ASSISTANT_MESSAGE'; tokens_used: number; latency_ms: number; pending_imports?: PendingImport[] }
  | { type: 'SET_STREAMING'; isStreaming: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_RATE_LIMIT'; info: RateLimitInfo }
  | { type: 'SET_STAGE'; stage: StageEvent }
  | { type: 'CLEAR_STAGES' }
  | { type: 'SET_WORKOUT_DATA'; data: GeneratedWorkout }
  | { type: 'SET_SEARCH_RESULTS'; data: WorkoutSearchResults }
  | { type: 'CLEAR_WORKOUT_DATA' }
  | { type: 'CLEAR_SESSION' }
  | { type: 'LOAD_SESSION'; sessionId: string; messages: ChatMessage[] };
