/**
 * ChatMessage — individual coach chat message bubble.
 *
 * - User messages: right-aligned, blue/primary
 * - Coach messages: left-aligned, with avatar, gray/white background
 * - Source chips: "Based on your last N runs..." (expandable)
 */

import { useState } from 'react';
import DOMPurify from 'dompurify';
import { ChevronDown, ChevronUp, Dumbbell, Timer, Footprints } from 'lucide-react';
import { cn } from '../ui/utils';
import type { CoachMessage as CoachMessageType, SourceReference } from './hooks/useCoachChat';

interface ChatMessageProps {
  message: CoachMessageType;
}

const TYPE_ICONS: Record<string, typeof Dumbbell> = {
  run: Footprints,
  strength: Dumbbell,
  hyrox: Timer,
  rest: Timer,
};

function SourceChip({ source }: { source: SourceReference }) {
  const Icon = TYPE_ICONS[source.type] || Timer;
  return (
    <div
      data-testid="source-chip-detail"
      className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-1.5 text-xs"
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <div>
        <span className="font-medium text-foreground">{source.title}</span>
        <span className="text-muted-foreground"> - {source.date}</span>
        {source.detail && (
          <span className="text-muted-foreground"> ({source.detail})</span>
        )}
      </div>
    </div>
  );
}

function SourceChips({ sources }: { sources: SourceReference[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!sources.length) return null;

  return (
    <div className="mt-2">
      <button
        data-testid="source-chips-toggle"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
        Based on {sources.length} workout{sources.length !== 1 ? 's' : ''}
      </button>
      {expanded && (
        <div className="mt-1.5 flex flex-col gap-1" data-testid="source-chips-expanded">
          {sources.map((source, i) => (
            <SourceChip key={`${source.date}-${i}`} source={source} />
          ))}
        </div>
      )}
    </div>
  );
}

function CoachAvatar() {
  return (
    <div
      data-testid="coach-avatar"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-bold shadow-md"
    >
      A
    </div>
  );
}

function formatMarkdown(text: string): string {
  // Simple markdown to HTML: bold and newlines
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br/>');
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      data-testid={`chat-message-${message.role}`}
      className={cn(
        'flex gap-2.5 max-w-[85%]',
        isUser ? 'ml-auto flex-row-reverse' : 'mr-auto',
      )}
    >
      {/* Avatar (coach only) */}
      {!isUser && <CoachAvatar />}

      {/* Message bubble */}
      <div className="flex flex-col">
        {/* Coach name label */}
        {!isUser && (
          <span className="text-xs text-muted-foreground mb-1 ml-1 font-medium">Amaka</span>
        )}

        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-md'
              : 'bg-muted/50 border border-border/40 text-foreground rounded-tl-md',
          )}
        >
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div
              className="prose prose-sm prose-invert max-w-none [&_p]:my-0 [&_strong]:text-foreground"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(`<p>${formatMarkdown(message.content)}</p>`) }}
            />
          )}

          {/* Streaming indicator */}
          {message.isStreaming && (
            <span className="inline-flex gap-0.5 ml-1">
              <span className="animate-bounce h-1 w-1 rounded-full bg-muted-foreground" style={{ animationDelay: '0ms' }} />
              <span className="animate-bounce h-1 w-1 rounded-full bg-muted-foreground" style={{ animationDelay: '150ms' }} />
              <span className="animate-bounce h-1 w-1 rounded-full bg-muted-foreground" style={{ animationDelay: '300ms' }} />
            </span>
          )}
        </div>

        {/* Source chips */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourceChips sources={message.sources} />
        )}
      </div>
    </div>
  );
}
