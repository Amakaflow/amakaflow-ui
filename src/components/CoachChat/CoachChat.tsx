/**
 * CoachChat — main conversational AI coach interface (AMA-1131).
 *
 * Features:
 * - Message thread with user/coach bubbles
 * - Coach avatar ("Amaka") with name
 * - Text input + send button at bottom
 * - Streaming response display
 * - Suggested prompts in empty state
 * - Rate limit banner
 * - Source chips showing referenced workouts
 */

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react';
import { Send, Trash2, RotateCcw } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { SuggestedPrompts } from './SuggestedPrompts';
import { RateLimitBanner } from './RateLimitBanner';
import { useCoachChat } from './hooks/useCoachChat';
import { cn } from '../ui/utils';

export function CoachChat() {
  const {
    messages,
    isStreaming,
    rateLimitInfo,
    sendMessage,
    clearHistory,
    loadDemoConversation,
  } = useCoachChat({ demoMode: true });

  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || isStreaming) return;
    setInputText('');
    sendMessage(text);
  }, [inputText, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handlePromptSelect = useCallback(
    (prompt: string) => {
      sendMessage(prompt);
    },
    [sendMessage],
  );

  const isEmpty = messages.length === 0;

  return (
    <div
      data-testid="coach-chat"
      className="flex flex-col h-full bg-background"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-bold">
            A
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Coach Amaka</h2>
            <p className="text-xs text-muted-foreground">AI Training Coach</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <>
              <button
                data-testid="load-demo-btn"
                onClick={loadDemoConversation}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Load demo conversation"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                data-testid="clear-chat-btn"
                onClick={clearHistory}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <SuggestedPrompts onSelect={handlePromptSelect} />
        ) : (
          <div className="flex flex-col gap-4 p-4" data-testid="message-thread">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Rate limit banner */}
      {rateLimitInfo && <RateLimitBanner info={rateLimitInfo} />}

      {/* Input area */}
      <div className="border-t border-border/40 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            data-testid="coach-chat-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your coach..."
            rows={1}
            disabled={isStreaming}
            className={cn(
              'flex-1 resize-none rounded-xl border border-border/50 bg-muted/20 px-4 py-2.5',
              'text-sm text-foreground placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50',
              'disabled:opacity-50',
              'max-h-[120px]',
            )}
          />
          <button
            data-testid="coach-send-btn"
            onClick={handleSend}
            disabled={!inputText.trim() || isStreaming}
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              'transition-all',
              inputText.trim() && !isStreaming
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                : 'bg-muted/30 text-muted-foreground cursor-not-allowed',
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
