/**
 * ChatPanel — Responsive chat interface (AMA-508, AMA-521, AMA-522)
 *
 * Desktop (>=768px): Right-side panel (380px wide) that slides in from the right.
 * Mobile (<768px): Full-screen bottom sheet using Vaul drawer.
 *
 * Features:
 * - Responsive FAB positioning (bottom-left desktop, bottom-right mobile)
 * - Smooth animations (slide-right desktop, slide-up mobile)
 * - Swipe-to-close on mobile
 * - Safe area support for iOS notch/home indicator
 * - Respects feature flag beta rollout (AMA-437)
 */

import { useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { cn } from '../ui/utils';
import { useChat } from '../../context/ChatContext';
import { useIsMobile } from '../ui/use-mobile';
import { ChatPanelContent } from './ChatPanelContent';
import { MobileChatDrawer } from './MobileChatDrawer';
import { ComingSoonBadge } from './ComingSoonBadge';
import { useChatFeatureFlags, isChatAccessible } from '../../hooks/useChatFeatureFlags';

export function ChatPanel() {
  const { state, togglePanel, cancelStream } = useChat();
  const { flags, isLoading: flagsLoading } = useChatFeatureFlags();
  const isMobile = useIsMobile();

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

  return (
    <>
      {/* Trigger button (FAB) */}
      {!state.isOpen && (
        <button
          onClick={togglePanel}
          className={cn(
            'fixed z-[60] flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95',
            // Mobile: bottom-right for right-thumb reach
            // Desktop: bottom-left to not conflict with panel
            isMobile ? 'bottom-4 right-4' : 'bottom-6 left-6'
          )}
          style={
            isMobile
              ? { marginBottom: 'env(safe-area-inset-bottom)' }
              : undefined
          }
          aria-label="Open chat"
          data-testid="chat-trigger-button"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      )}

      {/* Mobile: Full-screen bottom sheet */}
      {isMobile && <MobileChatDrawer />}

      {/* Desktop: Right-side panel (fixed 380px width) */}
      {!isMobile && state.isOpen && (
        <div
          className="fixed z-[60] flex flex-col overflow-hidden bg-card shadow-xl border-l animate-in slide-in-from-right duration-300"
          style={{
            top: 0,
            right: 0,
            bottom: 0,
            width: '380px',
            minWidth: '380px',
            maxWidth: '380px',
          }}
          data-testid="chat-panel"
          role="dialog"
          aria-label="Chat with AI Assistant"
          aria-modal="false"
        >
          <ChatPanelContent variant="desktop" />
        </div>
      )}
    </>
  );
}
