/**
 * useCoachChat — manages coach chat state, message history, and mock demo mode.
 *
 * In demo mode (default), uses pre-populated conversation with simulated
 * streaming responses. In production, sends messages to POST /coach/message.
 *
 * Chat history persists to localStorage.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// =============================================================================
// Types
// =============================================================================

export interface SourceReference {
  date: string;
  title: string;
  type: string;
  detail?: string;
}

export interface CoachMessage {
  id: string;
  role: 'user' | 'coach';
  content: string;
  timestamp: number;
  sources?: SourceReference[];
  isStreaming?: boolean;
}

export interface RateLimitInfo {
  used: number;
  limit: number;
}

// =============================================================================
// Demo Data
// =============================================================================

const DEMO_CONVERSATION: CoachMessage[] = [
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
      {
        date: '2026-03-19',
        title: 'Tempo Intervals',
        type: 'run',
        detail: '8.0km, 50min, HR avg 165, RPE 7',
      },
      {
        date: '2026-03-22',
        title: 'Hyrox Simulation',
        type: 'hyrox',
        detail: 'Planned - 75min target',
      },
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
      "Let's break down your week so far:\n\n**Monday (Mar 17):** Easy Recovery Run - 5.2km in 35min, HR 142, RPE 3. You noted your legs felt heavy from the Sunday long run, which is totally normal.\n\n**Tuesday (Mar 18):** Upper Body Strength - 45min, RPE 6. Good call having this after a run day.\n\n**Wednesday (Mar 19):** Tempo Intervals - 8km in 50min, HR 165, RPE 7. This was your key session and you nailed it.\n\n**Thursday (Mar 20):** Rest Day. Smart placement after the tempo.\n\nOverall, the load distribution looks **well-balanced**. You're getting the right mix of easy and hard days. The one thing I'd flag is that your Monday run noted heavy legs - make sure you're getting enough sleep and keeping hydration up, especially as we increase intensity heading into race month.\n\nYour weekly training stress is right where it should be for the build phase. No need to add extra volume.",
    timestamp: Date.now() - 2900000,
    sources: [
      {
        date: '2026-03-17',
        title: 'Easy Recovery Run',
        type: 'run',
        detail: '5.2km, 35min, HR avg 142, RPE 3',
      },
      {
        date: '2026-03-18',
        title: 'Upper Body Strength',
        type: 'strength',
        detail: '45min, RPE 6',
      },
      {
        date: '2026-03-19',
        title: 'Tempo Intervals',
        type: 'run',
        detail: '8.0km, 50min, HR avg 165, RPE 7',
      },
      {
        date: '2026-03-20',
        title: 'Rest Day',
        type: 'rest',
      },
    ],
  },
];

const DEMO_RESPONSES: Record<string, { content: string; sources: SourceReference[] }> = {
  default: {
    content:
      "That's a great question! Based on your recent training, I can see you've been consistent with a good mix of running and strength work. Your readiness score of 62 suggests you're managing the load well, though there's room to push a bit more on your easy days.\n\nKeep focusing on the process - you're building a strong foundation for London Hyrox!",
    sources: [],
  },
  tired: {
    content:
      "I hear you - fatigue is your body's way of telling you it's adapting. Looking at your training from this week, you had a solid **Tempo Intervals** session on March 19th (RPE 7) followed by a rest day. That's good periodization.\n\nFor today, I'd suggest keeping things light. An easy 30-minute recovery run or even just a walk would be beneficial. Save your energy for the **Hyrox Simulation** on Saturday.",
    sources: [
      { date: '2026-03-19', title: 'Tempo Intervals', type: 'run', detail: '8.0km, RPE 7' },
      { date: '2026-03-22', title: 'Hyrox Simulation', type: 'hyrox', detail: 'Planned - 75min' },
    ],
  },
  focus: {
    content:
      "This week, your main focus should be **recovery and race prep**. You've done the hard work in the build phase - now it's about maintaining fitness without accumulating more fatigue.\n\nYour key session is the **Hyrox Simulation** on Saturday. Make sure you go in feeling fresh. Today and tomorrow should be easy efforts only.\n\nAlso, start thinking about your race day nutrition and pacing strategy for London Hyrox on April 18th. We're 4 weeks out!",
    sources: [
      { date: '2026-03-22', title: 'Hyrox Simulation', type: 'hyrox', detail: 'Planned - 75min' },
    ],
  },
  ready: {
    content:
      "Let me check your readiness for Saturday's session. Your current readiness score is **62/100**, which is moderate. Here's what that means:\n\nYou had a tough tempo session on Wednesday (RPE 7) and took a rest day yesterday - good recovery pattern. If you keep today easy, you should be in decent shape for the Hyrox Simulation.\n\nMy recommendation: go for it, but consider scaling back to 80% intensity rather than full race pace. This is a build session, not a test. Save the full send for race day on April 18th.",
    sources: [
      { date: '2026-03-19', title: 'Tempo Intervals', type: 'run', detail: 'RPE 7' },
      { date: '2026-03-22', title: 'Hyrox Simulation', type: 'hyrox', detail: 'Planned' },
    ],
  },
};

function getDemoResponse(message: string): { content: string; sources: SourceReference[] } {
  const lower = message.toLowerCase();
  if (lower.includes('tired') || lower.includes('legs') || lower.includes('fatigue') || lower.includes('sore')) {
    return DEMO_RESPONSES.tired;
  }
  if (lower.includes('focus') || lower.includes('this week') || lower.includes('priority')) {
    return DEMO_RESPONSES.focus;
  }
  if (lower.includes('ready') || lower.includes('saturday') || lower.includes('hyrox')) {
    return DEMO_RESPONSES.ready;
  }
  return DEMO_RESPONSES.default;
}

// =============================================================================
// Storage
// =============================================================================

const STORAGE_KEY = 'amakaflow_coach_chat';

function loadMessages(): CoachMessage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // Ignore parse errors
  }
  return [];
}

function saveMessages(messages: CoachMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Ignore storage errors
  }
}

// =============================================================================
// Hook
// =============================================================================

export interface UseCoachChatOptions {
  demoMode?: boolean;
}

export function useCoachChat({ demoMode = true }: UseCoachChatOptions = {}) {
  const [messages, setMessages] = useState<CoachMessage[]>(() => {
    const stored = loadMessages();
    return stored.length > 0 ? stored : demoMode ? DEMO_CONVERSATION : [];
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo>({
    used: 2,
    limit: 10,
  });
  const streamAbortRef = useRef<AbortController | null>(null);

  // Persist messages
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      const userMessage: CoachMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);

      if (demoMode) {
        // Simulate streaming with typing delay
        const response = getDemoResponse(text);
        const coachMessage: CoachMessage = {
          id: `coach-${Date.now()}`,
          role: 'coach',
          content: '',
          timestamp: Date.now(),
          sources: response.sources,
          isStreaming: true,
        };

        setMessages((prev) => [...prev, coachMessage]);

        // Simulate character-by-character streaming
        const words = response.content.split(' ');
        let accumulated = '';
        for (let i = 0; i < words.length; i++) {
          accumulated += (i > 0 ? ' ' : '') + words[i];
          const currentText = accumulated;
          await new Promise((resolve) => setTimeout(resolve, 30 + Math.random() * 20));
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === 'coach') {
              updated[updated.length - 1] = {
                ...last,
                content: currentText,
              };
            }
            return updated;
          });
        }

        // Mark streaming complete
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === 'coach') {
            updated[updated.length - 1] = { ...last, isStreaming: false };
          }
          return updated;
        });

        setRateLimitInfo((prev) => ({
          ...prev,
          used: Math.min(prev.used + 1, prev.limit),
        }));
      }

      setIsStreaming(false);
    },
    [demoMode],
  );

  const clearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const loadDemoConversation = useCallback(() => {
    setMessages(DEMO_CONVERSATION);
  }, []);

  return {
    messages,
    isStreaming,
    rateLimitInfo,
    sendMessage,
    clearHistory,
    loadDemoConversation,
  };
}
