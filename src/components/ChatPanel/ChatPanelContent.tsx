/**
 * ChatPanelContent — Shared content component for both mobile and desktop chat layouts.
 *
 * Used by:
 * - DesktopChatSidebar (AMA-521)
 * - MobileChatDrawer (AMA-522)
 *
 * Contains:
 * - Header with title and action buttons
 * - Scrollable message list with auto-scroll
 * - Beta feedback widget (for testers)
 * - ChatInput for sending messages
 */

import { useRef, useEffect } from 'react';
import { MessageSquare, X, Trash2, ArrowLeft, Settings } from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { useChat } from '../../context/ChatContext';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { BetaFeedbackWidget } from './BetaFeedbackWidget';
import { useChatFeatureFlags } from '../../hooks/useChatFeatureFlags';
import { CHAT_BETA_PERIOD } from '../../lib/env';

interface ChatPanelContentProps {
  /** Mobile variant uses compact header with back arrow */
  variant?: 'desktop' | 'mobile';
  /** Optional callback for close action (used by mobile drawer) */
  onClose?: () => void;
}

export function ChatPanelContent({ variant = 'desktop', onClose }: ChatPanelContentProps) {
  const { state, closePanel, sendMessage, clearSession } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const { flags } = useChatFeatureFlags();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages, state.isStreaming]);

  // Determine if user is a beta tester (for showing feedback widget)
  const isBetaTester = CHAT_BETA_PERIOD && flags.chat_beta_access;

  const handleClose = onClose ?? closePanel;

  const isMobile = variant === 'mobile';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-4 py-3 shrink-0"
        data-testid="chat-header"
      >
        {isMobile ? (
          // Mobile header - compact with back arrow
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleClose}
              aria-label="Close chat"
              data-testid="chat-back-button"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <span className="font-semibold text-sm">AI Assistant</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={clearSession}
                title="Clear conversation"
                aria-label="Clear conversation"
                data-testid="chat-clear-button"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleClose}
                title="Close panel"
                aria-label="Close panel"
                data-testid="chat-close-button"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </>
        ) : (
          // Desktop header - with icon and title
          <>
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
                onClick={handleClose}
                title="Close panel"
                aria-label="Close panel"
                data-testid="chat-close-button"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Messages area */}
      <ScrollArea className="flex-1 min-h-0 w-full" type="always">
        <div className="p-4 w-full" data-testid="chat-messages-area">
          {state.messages.length === 0 && (
            <div
              className="flex flex-col items-center justify-center py-12 text-center"
              data-testid="chat-empty-state"
            >
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
            <div
              className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive mb-3"
              data-testid="chat-error-banner"
            >
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

      {/* Input - with safe area padding on mobile */}
      <div className={isMobile ? 'pb-[env(safe-area-inset-bottom)]' : ''}>
        <ChatInput
          onSend={sendMessage}
          isStreaming={state.isStreaming}
          rateLimitInfo={state.rateLimitInfo}
          autoFocus={state.isOpen}
        />
      </div>
    </div>
  );
}
