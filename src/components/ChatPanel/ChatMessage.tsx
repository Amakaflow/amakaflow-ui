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
      className={cn('flex gap-2 mb-3', isUser ? 'justify-end' : 'justify-start')}
      data-testid={`chat-message-${message.role}`}
      data-message-id={message.id}
    >
      <div
        className={cn(
          'rounded-lg px-3 py-2 max-w-[85%] text-sm',
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
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]}
              components={{
                p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
                code: ({ children, className }) => {
                  const isBlock = className?.includes('language-');
                  return isBlock ? (
                    <code className="block bg-background/50 rounded p-2 overflow-x-auto text-xs my-2">
                      {children}
                    </code>
                  ) : (
                    <code className="bg-background/50 rounded px-1 py-0.5 text-xs">
                      {children}
                    </code>
                  );
                },
                ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                li: ({ children }) => <li className="mb-0.5">{children}</li>,
              }}
            >
              {message.content}
            </ReactMarkdown>

            {/* Streaming indicator */}
            {isStreaming && !message.content && (
              <span className="inline-flex gap-1" data-testid="chat-streaming-indicator">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            )}
          </div>
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
