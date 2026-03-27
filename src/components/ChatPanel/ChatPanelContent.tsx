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

import { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Trash2, ArrowLeft, Settings, Plus } from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { useChat } from '../../context/ChatContext';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { BetaFeedbackWidget } from './BetaFeedbackWidget';
import { useChatFeatureFlags } from '../../hooks/useChatFeatureFlags';
import { CHAT_BETA_PERIOD } from '../../lib/env';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface ChatPanelContentProps {
  /** Mobile variant uses compact header with back arrow */
  variant?: 'desktop' | 'mobile';
  /** Optional callback for close action (used by mobile drawer) */
  onClose?: () => void;
}

/** Suggested actions shown in empty state */
const SUGGESTED_ACTIONS = [
  { label: 'Create a workout', prompt: 'Create a new workout for me' },
  { label: 'Find workouts', prompt: 'Find workouts matching my goals' },
  { label: 'Import workout', prompt: 'Import a workout from URL' },
  { label: 'Explain features', prompt: 'What can you help me with?' },
];

export function ChatPanelContent({ variant = 'desktop', onClose }: ChatPanelContentProps) {
  const { state, closePanel, sendMessage, clearSession } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const { flags } = useChatFeatureFlags();
  const [showSettings, setShowSettings] = useState(false);

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
          // Desktop header - with icon, title, new chat dropdown, and settings
          <>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">AI Assistant</h3>
            </div>
            <div className="flex items-center gap-1">
              {/* New chat dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="New chat"
                    aria-label="New chat"
                    data-testid="chat-new-chat-button"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={clearSession}>
                    <Plus className="w-3.5 h-3.5 mr-2" />
                    New chat
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Clear conversation button */}
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
              {/* Settings button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowSettings(!showSettings)}
                title="Chat settings"
                aria-label="Chat settings"
                data-testid="chat-settings-button"
              >
                <Settings className="w-3.5 h-3.5" />
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
              <p className="text-sm text-muted-foreground mb-6">
                Ask me anything about your workouts, training plans, or AmakaFlow features.
              </p>
              <div className="flex flex-col gap-2 w-full max-w-[280px]">
                {SUGGESTED_ACTIONS.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-left h-auto py-2 px-3 whitespace-normal"
                    onClick={() => sendMessage(action.prompt)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {state.messages.map((msg, idx) => {
            const isLastAssistant =
              msg.role === 'assistant' &&
              idx === state.messages.length - 1 &&
              state.isStreaming;

            const isLastAssistantMsg =
              msg.role === 'assistant' && idx === state.messages.length - 1;
            const isCreatingStage = state.currentStage?.stage === 'creating';
            const hasRunningImport = msg.tool_calls?.some(
              tc => tc.status === 'running' && tc.name.startsWith('import_from_')
            );
            const isGenerating = isLastAssistant && !state.workoutData && (isCreatingStage || !!hasRunningImport);

            return (
              <ChatMessage
                key={msg.id}
                message={msg}
                isStreaming={isLastAssistant}
                currentStage={isLastAssistant ? state.currentStage : undefined}
                completedStages={isLastAssistant ? state.completedStages : undefined}
                workoutData={isLastAssistantMsg ? state.workoutData : undefined}
                searchResults={isLastAssistantMsg ? state.searchResults : undefined}
                isGenerating={isGenerating}
                timeline={isLastAssistantMsg ? state.timeline : undefined}
              />
            );
          })}

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

      {/* Settings panel */}
      {showSettings && !isMobile && (
        <div className="border-t p-4 bg-muted/30" data-testid="chat-settings-panel">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm">Chat Settings</h4>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowSettings(false)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Chat settings coming soon. You can clear your conversation history using the trash icon.
          </p>
        </div>
      )}

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
