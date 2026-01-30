/**
 * ChatAwareLayout - Wrapper that adjusts content when chat panel is open.
 *
 * On desktop (md+), adds right padding to prevent content from being
 * obscured by the chat side panel.
 */

import { useChat } from '../context/ChatContext';

interface ChatAwareLayoutProps {
  children: React.ReactNode;
}

export function ChatAwareLayout({ children }: ChatAwareLayoutProps) {
  const { state } = useChat();

  return (
    <div
      className={`min-h-screen bg-background transition-all duration-300 overflow-x-hidden ${
        state.isOpen ? 'md:pr-[380px]' : ''
      }`}
      style={{ scrollbarGutter: 'stable' }}
    >
      {children}
    </div>
  );
}
