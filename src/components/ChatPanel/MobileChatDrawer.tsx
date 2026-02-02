/**
 * MobileChatDrawer — Full-screen bottom sheet for mobile chat (AMA-522)
 *
 * Uses Vaul for native-feeling swipe-to-close gesture.
 * Key features:
 * - Full viewport height (96vh) with rounded top corners
 * - Drag handle for swipe-to-close
 * - Safe area insets for iOS notch/home indicator
 * - Slides up from bottom with smooth animation
 */

import { Drawer } from 'vaul';
import { useChat } from '../../context/ChatContext';
import { ChatPanelContent } from './ChatPanelContent';

export function MobileChatDrawer() {
  const { state, closePanel } = useChat();

  return (
    <Drawer.Root
      open={state.isOpen}
      onOpenChange={(open) => !open && closePanel()}
      shouldScaleBackground={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Drawer.Content
          className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-card rounded-t-xl focus:outline-none overflow-hidden"
          style={{
            height: '96dvh',
            maxHeight: '96dvh',
            paddingTop: 'env(safe-area-inset-top)',
          }}
          aria-label="Chat with AI Assistant"
          data-testid="mobile-chat-drawer"
        >
          {/* Drag handle */}
          <div className="flex justify-center py-3 shrink-0">
            <div className="w-12 h-1.5 bg-muted rounded-full" />
          </div>

          {/* Chat content - flex-1 to fill remaining height */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ChatPanelContent variant="mobile" onClose={closePanel} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
