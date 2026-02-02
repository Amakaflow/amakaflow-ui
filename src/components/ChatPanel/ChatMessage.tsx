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
import type { ChatMessage as ChatMessageType } from '../../types/chat';
import { cn } from '../ui/utils';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
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
                className="flex items-center gap-2 rounded bg-background/50 px-2 py-1 text-xs"
                data-testid="chat-tool-call"
              >
                <Wrench className="w-3 h-3 text-muted-foreground" />
                <span className="font-medium">{tc.name}</span>
                {tc.status === 'running' && (
                  <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" data-testid="chat-tool-spinner" />
                )}
                {tc.status === 'completed' && (
                  <CheckCircle2 className="w-3 h-3 text-green-500 ml-auto" data-testid="chat-tool-complete" />
                )}
              </div>
            ))}
          </div>
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
          <span className="inline-flex items-center gap-1">
            <span className="animate-pulse">●</span>
            <span className="animate-pulse delay-100">●</span>
            <span className="animate-pulse delay-200">●</span>
          </span>
        ) : null}

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
