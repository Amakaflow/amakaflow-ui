/**
 * ChatMessage — renders a single chat message bubble.
 *
 * - User messages: right-aligned, primary background
 * - Assistant messages: left-aligned, muted background, markdown rendered
 * - Streaming indicator: animated dots during content_delta reception
 * - Function call visualization: inline card showing tool name + spinner
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Loader2, CheckCircle2, Wrench } from 'lucide-react';
import { StageIndicator } from './StageIndicator';
import { WorkoutStreamPreview } from './WorkoutStreamPreview';
import { TimelineRail } from '../assistant/TimelineRail';
import { StepCounter } from '../assistant/StepCounter';
import type { ChatMessage as ChatMessageType, StageEvent, WorkoutStage, GeneratedWorkout, WorkoutSearchResults, TimelineStep } from '../../types/chat';
import type { TimelineStepData } from '../assistant/TimelineRail';
import type { StepStatus } from '../assistant/TimelineStep';
import { cn } from '../ui/utils';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  /** Only passed to the last assistant message during streaming */
  currentStage?: StageEvent | null;
  completedStages?: WorkoutStage[];
  workoutData?: GeneratedWorkout | null;
  searchResults?: WorkoutSearchResults | null;
  isGenerating?: boolean;
  /** Timeline steps from assistant visualization state */
  timeline?: TimelineStep[];
}

const STATUS_MAP: Record<TimelineStep['status'], StepStatus> = {
  completed: 'done',
  running: 'active',
  pending: 'pending',
  error: 'error',
};

function toTimelineStepData(steps: TimelineStep[]): TimelineStepData[] {
  return steps.map((s) => ({
    label: s.label,
    result: s.result,
    status: STATUS_MAP[s.status],
  }));
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const TOOL_LABELS: Record<string, string> = {
  lookup_user_profile: 'Checking your profile',
  search_workouts: 'Searching exercises',
  get_workout_history: 'Reviewing your history',
  create_workout_plan: 'Building workout plan',
};

export function ChatMessage({ message, isStreaming, currentStage, completedStages, workoutData, searchResults, isGenerating, timeline }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={cn('flex gap-2 mb-3 min-w-0', isUser ? 'justify-end' : 'justify-start')}
      data-testid={`chat-message-${message.role}`}
      data-message-id={message.id}
    >
      <div
        className={cn(
          'rounded-lg px-3 py-2 max-w-[85%] min-w-0 text-sm overflow-hidden',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground',
        )}
      >
        {/* Tool calls */}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <div className="mb-2 space-y-1">
            {message.tool_calls.map((tc) => (
              <div
                key={tc.id}
                className="flex items-center gap-2 rounded-md bg-background/50 border border-border/50 px-2.5 py-1.5 text-xs"
                data-testid="chat-tool-call"
              >
                <Wrench className="w-3 h-3 text-muted-foreground" />
                <span className="font-medium">{TOOL_LABELS[tc.name] || tc.name}</span>
                {tc.status === 'running' && (
                  <Loader2 className="w-3 h-3 animate-spin text-primary ml-auto" data-testid="chat-tool-spinner" />
                )}
                {tc.status === 'completed' && (
                  <CheckCircle2 className="w-3 h-3 text-green-500 ml-auto" data-testid="chat-tool-complete" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Stage indicator (Perplexity-style progress) */}
        {!isUser && isStreaming && (currentStage || (completedStages && completedStages.length > 0)) && (
          <StageIndicator
            currentStage={currentStage ?? null}
            completedStages={completedStages ?? []}
          />
        )}

        {/* Message content */}
        {message.content ? (
          isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none break-words">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )
        ) : isStreaming ? (
          <span className="inline-flex items-center gap-1" data-testid="chat-streaming-indicator">
            <span className="animate-pulse">●</span>
            <span className="animate-pulse delay-100">●</span>
            <span className="animate-pulse delay-200">●</span>
          </span>
        ) : null}

        {/* Progressive workout preview */}
        {!isUser && (workoutData || searchResults || isGenerating) && (
          <WorkoutStreamPreview
            workoutData={workoutData}
            searchResults={searchResults}
            isGenerating={isGenerating}
          />
        )}

        {/* Timeline: live rail during streaming, collapsed StepCounter after */}
        {!isUser && timeline && timeline.length > 0 && (
          isStreaming ? (
            <TimelineRail steps={toTimelineStepData(timeline)} className="mt-2" />
          ) : (
            <StepCounter
              count={timeline.filter((s) => s.status === 'completed').length}
              errorCount={timeline.filter((s) => s.status === 'error').length}
              contentId={`step-counter-${message.id}`}
              className="mt-2"
            >
              <TimelineRail steps={toTimelineStepData(timeline)} />
            </StepCounter>
          )
        )}

        {/* Timestamp */}
        <p
          className={cn(
            'text-[10px] mt-1',
            isUser ? 'text-primary-foreground/60' : 'text-muted-foreground',
          )}
          data-testid="chat-message-timestamp"
        >
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
}
