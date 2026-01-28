/**
 * ChatPanel — floating chat overlay (bottom-right).
 *
 * - Trigger button: fixed bottom-right, circular with MessageSquare icon
 * - Panel: fixed position, ~400px wide, ~600px tall
 * - Header: "AI Assistant" title + clear/close buttons
 * - Message list: ScrollArea for messages with auto-scroll
 * - Input area: ChatInput component
 * - Mobile: full-screen mode via media query
 * - Feature flags: Respects beta rollout configuration (AMA-437)
 */

import { useRef, useEffect } from 'react';
import { MessageSquare, X, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { useChat } from '../../context/ChatContext';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ComingSoonBadge } from './ComingSoonBadge';
import { BetaFeedbackWidget } from './BetaFeedbackWidget';
import { useChatFeatureFlags, isChatAccessible } from '../../hooks/useChatFeatureFlags';
import { CHAT_BETA_PERIOD } from '../../lib/env';

export function ChatPanel() {
  const { state, togglePanel, closePanel, sendMessage, clearSession, cancelStream } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const { flags, isLoading: flagsLoading } = useChatFeatureFlags();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages, state.isStreaming]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      cancelStream();
    };
  }, [cancelStream]);

  // Chat completely disabled via kill switch
  if (!flagsLoading && !flags.chat_enabled) {
    return null;
  }

  // Beta period active but user lacks access - show "Coming Soon" badge
  if (!flagsLoading && !isChatAccessible(flags)) {
    return <ComingSoonBadge />;
  }

  // Determine if user is a beta tester (for showing feedback widget)
  const isBetaTester = CHAT_BETA_PERIOD && flags.chat_beta_access;

  return (
    <>
      {/* Trigger button */}
      {!state.isOpen && (
        <button
          onClick={togglePanel}
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
          aria-label="Open chat"
          data-testid="chat-trigger-button"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      )}

      {/* Chat panel */}
      {state.isOpen && (
        <div
          className="fixed bottom-0 right-0 z-50 flex flex-col bg-card border shadow-xl
          w-full h-full
          md:bottom-6 md:right-6 md:w-[400px] md:h-[600px] md:rounded-lg md:max-h-[calc(100vh-48px)]"
          data-testid="chat-panel"
          role="dialog"
          aria-label="Chat with AI Assistant"
          aria-modal="false"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3 shrink-0" data-testid="chat-header">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">AI Assistant</h3>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={clearSession}
                title="Clear conversation"
                aria-label="Clear conversation"
                data-testid="chat-clear-button"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={closePanel}
                title="Close"
                aria-label="Close"
                data-testid="chat-close-button"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Messages area */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4" data-testid="chat-messages-area">
              {state.messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="chat-empty-state">
                  <MessageSquare className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Ask me anything about your workouts, training plans, or AmakaFlow features.
                  </p>
                </div>
              )}

              {state.messages.map((msg, idx) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  isStreaming={
                    state.isStreaming &&
                    msg.role === 'assistant' &&
                    idx === state.messages.length - 1
                  }
                />
              ))}

              {/* Error display */}
              {state.error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive mb-3" data-testid="chat-error-banner">
                  {state.error}
                </div>
              )}

              {/* Scroll anchor */}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Beta feedback widget for testers */}
          {isBetaTester && (
            <BetaFeedbackWidget
              sessionId={state.sessionId ?? undefined}
              messageId={state.messages.length > 0 ? state.messages[state.messages.length - 1].id : undefined}
            />
          )}

          {/* Input */}
          <ChatInput
            onSend={sendMessage}
            isStreaming={state.isStreaming}
            rateLimitInfo={state.rateLimitInfo}
            autoFocus={state.isOpen}
          />
        </div>
      )}
    </>
  );
}
