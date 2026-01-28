/**
 * ComingSoonBadge - Placeholder button shown when chat is in beta and user lacks access.
 *
 * Displays a disabled chat trigger button with a "Coming Soon" badge.
 * Part of AMA-437: Feature Flags & Beta Rollout Configuration
 */

import { MessageSquare, Sparkles } from 'lucide-react';

export function ComingSoonBadge() {
  return (
    <div className="fixed bottom-6 right-6 z-50 md:bottom-8 md:right-8">
      {/* Badge */}
      <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 px-2 py-0.5 text-[10px] font-medium text-white shadow-lg">
        <Sparkles className="h-3 w-3" />
        <span>Coming Soon</span>
      </div>

      {/* Disabled button */}
      <button
        disabled
        className="flex h-12 w-12 cursor-not-allowed items-center justify-center rounded-full bg-muted text-muted-foreground opacity-60 shadow-lg"
        aria-label="AI Chat - Coming Soon"
        data-testid="chat-coming-soon-badge"
      >
        <MessageSquare className="h-5 w-5" />
      </button>
    </div>
  );
}
