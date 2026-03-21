/**
 * Standalone preview entry point for CoachChat.
 * Served at /coach-chat-preview.html during dev.
 *
 * AMA-1131: Renders coach chat in various states for Playwright screenshots.
 *
 * Modes (via ?mode= query param):
 * - empty: Empty state with suggested prompts
 * - conversation: Pre-populated conversation with coach responses
 * - rate-limit-high: Conversation with 8/10 messages used
 */
import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import './index.css';
import { CoachChat } from './components/CoachChat/CoachChat';
import { SuggestedPrompts } from './components/CoachChat/SuggestedPrompts';
import { RateLimitBanner } from './components/CoachChat/RateLimitBanner';
import { ChatMessage } from './components/CoachChat/ChatMessage';
import type { CoachMessage, SourceReference } from './components/CoachChat/hooks/useCoachChat';

// =============================================================================
// Demo data for static screenshots
// =============================================================================

const DEMO_MESSAGES: CoachMessage[] = [
  {
    id: 'demo-1',
    role: 'user',
    content: 'My legs are pretty tired after yesterday. Should I still do my tempo run today?',
    timestamp: Date.now() - 3600000,
  },
  {
    id: 'demo-2',
    role: 'coach',
    content:
      "I can see why you're feeling it! Your **Tempo Intervals** on March 19th was a solid session - 8km at an average HR of 165 with RPE 7. That's quality work.\n\nGiven your readiness score is sitting at 62 right now and you had that tough session just yesterday, I'd suggest modifying today's plan. Instead of the tempo run, let's swap it for an **easy recovery run** - keep it to 30-35 minutes at a conversational pace. Your heart rate should stay below 145.\n\nYou've got your **Hyrox Simulation** coming up on Saturday, and that's the session we really want you fresh for. Think of today as investing in Saturday's performance.\n\nYour body is in the **build phase** with London Hyrox just 4 weeks away - we need to be smart about when to push and when to back off.",
    timestamp: Date.now() - 3500000,
    sources: [
      { date: '2026-03-19', title: 'Tempo Intervals', type: 'run', detail: '8.0km, 50min, HR avg 165, RPE 7' },
      { date: '2026-03-22', title: 'Hyrox Simulation', type: 'hyrox', detail: 'Planned - 75min target' },
    ],
  },
  {
    id: 'demo-3',
    role: 'user',
    content: 'That makes sense. How was my training load this week overall?',
    timestamp: Date.now() - 3000000,
  },
  {
    id: 'demo-4',
    role: 'coach',
    content:
      "Let's break down your week so far:\n\n**Monday (Mar 17):** Easy Recovery Run - 5.2km in 35min, HR 142, RPE 3. You noted your legs felt heavy from the Sunday long run, which is totally normal.\n\n**Tuesday (Mar 18):** Upper Body Strength - 45min, RPE 6. Good call having this after a run day.\n\n**Wednesday (Mar 19):** Tempo Intervals - 8km in 50min, HR 165, RPE 7. This was your key session and you nailed it.\n\n**Thursday (Mar 20):** Rest Day. Smart placement after the tempo.\n\nOverall, the load distribution looks **well-balanced**. You're getting the right mix of easy and hard days. The one thing I'd flag is that your Monday run noted heavy legs - make sure you're getting enough sleep and keeping hydration up, especially as we increase intensity heading into race month.",
    timestamp: Date.now() - 2900000,
    sources: [
      { date: '2026-03-17', title: 'Easy Recovery Run', type: 'run', detail: '5.2km, 35min, HR avg 142, RPE 3' },
      { date: '2026-03-18', title: 'Upper Body Strength', type: 'strength', detail: '45min, RPE 6' },
      { date: '2026-03-19', title: 'Tempo Intervals', type: 'run', detail: '8.0km, 50min, HR avg 165, RPE 7' },
      { date: '2026-03-20', title: 'Rest Day', type: 'rest' },
    ],
  },
];

// =============================================================================
// Preview modes
// =============================================================================

function EmptyStatePreview() {
  return (
    <div data-testid="preview-empty" className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border/40 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-bold">A</div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Coach Amaka</h2>
          <p className="text-xs text-muted-foreground">AI Training Coach</p>
        </div>
      </div>
      <SuggestedPrompts onSelect={() => {}} />
      <RateLimitBanner info={{ used: 0, limit: 10 }} />
      <div className="border-t border-border/40 p-3">
        <div className="flex items-end gap-2">
          <textarea className="flex-1 resize-none rounded-xl border border-border/50 bg-muted/20 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground" placeholder="Ask your coach..." rows={1} />
          <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/30 text-muted-foreground cursor-not-allowed">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function ConversationPreview() {
  return (
    <div data-testid="preview-conversation" className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border/40 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-bold">A</div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Coach Amaka</h2>
          <p className="text-xs text-muted-foreground">AI Training Coach</p>
        </div>
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          {DEMO_MESSAGES.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
        </div>
      </div>
      <RateLimitBanner info={{ used: 2, limit: 10 }} />
      <div className="border-t border-border/40 p-3">
        <div className="flex items-end gap-2">
          <textarea className="flex-1 resize-none rounded-xl border border-border/50 bg-muted/20 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground" placeholder="Ask your coach..." rows={1} />
          <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/30 text-muted-foreground cursor-not-allowed">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function SourceChipsPreview() {
  // Same as conversation but with sources auto-expanded
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Auto-expand source chips after render
    const timer = setTimeout(() => {
      document.querySelectorAll('[data-testid="source-chips-toggle"]').forEach((btn) => {
        (btn as HTMLButtonElement).click();
      });
      setReady(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div data-testid="preview-sources" className="flex flex-col h-screen bg-background">
      <div className="flex items-center gap-2.5 border-b border-border/40 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-bold">A</div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Coach Amaka</h2>
          <p className="text-xs text-muted-foreground">AI Training Coach</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          {DEMO_MESSAGES.slice(0, 2).map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RateLimitPreview() {
  return (
    <div data-testid="preview-rate-limit" className="flex flex-col h-screen bg-background">
      <div className="flex items-center gap-2.5 border-b border-border/40 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-bold">A</div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Coach Amaka</h2>
          <p className="text-xs text-muted-foreground">AI Training Coach</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          {DEMO_MESSAGES.slice(0, 2).map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
        </div>
      </div>
      <RateLimitBanner info={{ used: 8, limit: 10 }} />
      <div className="border-t border-border/40 p-3">
        <div className="flex items-end gap-2">
          <textarea className="flex-1 resize-none rounded-xl border border-border/50 bg-muted/20 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground" placeholder="Ask your coach..." rows={1} />
          <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/30 text-muted-foreground cursor-not-allowed">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main
// =============================================================================

function CoachChatPreview() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') || 'conversation';

  switch (mode) {
    case 'empty':
      return <EmptyStatePreview />;
    case 'sources':
      return <SourceChipsPreview />;
    case 'rate-limit':
      return <RateLimitPreview />;
    case 'full':
      return <CoachChat />;
    case 'conversation':
    default:
      return <ConversationPreview />;
  }
}

const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <div className="dark bg-background text-foreground">
      <CoachChatPreview />
    </div>,
  );
}
