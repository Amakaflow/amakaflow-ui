/**
 * ChatInput — text input with auto-resize, send button, and rate limit indicator.
 *
 * - Controlled textarea with auto-resize
 * - Send button (disabled when empty or streaming)
 * - Mic icon button (placeholder for AMA-435 voice input)
 * - Enter to send, Shift+Enter for newline
 * - Rate limit indicator (X/50 messages)
 */

import { useState, useRef, useCallback, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { Send, Mic } from 'lucide-react';
import { Button } from '../ui/button';
import type { RateLimitInfo } from '../../types/chat';

interface ChatInputProps {
  onSend: (text: string) => void;
  isStreaming: boolean;
  rateLimitInfo: RateLimitInfo | null;
  autoFocus?: boolean;
}

export function ChatInput({ onSend, isStreaming, rateLimitInfo, autoFocus }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus when requested (e.g., panel opens)
  useEffect(() => {
    if (autoFocus) {
      textareaRef.current?.focus();
    }
  }, [autoFocus]);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    onSend(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [text, onSend, isStreaming]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const isEmpty = text.trim().length === 0;

  return (
    <div className="border-t p-3">
      {/* Rate limit indicator */}
      {rateLimitInfo && (
        <div className="text-[10px] text-muted-foreground mb-1 text-right" data-testid="chat-rate-limit">
          {rateLimitInfo.usage}/{rateLimitInfo.limit} messages
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          disabled={isStreaming}
          data-testid="chat-input-textarea"
        />

        {/* Mic placeholder (AMA-435) */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled
          title="Voice input coming soon"
          aria-label="Voice input"
          data-testid="chat-mic-button"
        >
          <Mic className="w-4 h-4" />
        </Button>

        {/* Send button */}
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleSend}
          disabled={isStreaming || isEmpty}
          aria-label="Send message"
          data-testid="chat-send-button"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
