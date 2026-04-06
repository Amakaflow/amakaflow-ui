import { http, HttpResponse } from 'msw';
import { API_URLS } from '../../../lib/config';

const BASE = API_URLS.CHAT;

// Minimal SSE helper — encodes a single SSE event block
function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// Context-aware demo responses based on user message keywords
function getCoachResponse(message: string): string[] {
  const lower = message.toLowerCase();

  if (lower.includes('workout') && (lower.includes('recommend') || lower.includes('suggest') || lower.includes('what should'))) {
    return [
      "Based on your recent training, ",
      "I'd suggest a **moderate intensity upper body session** today. ",
      "You've done 3 lower body workouts this week already, ",
      "so an upper body push focus would balance things out.\n\n",
      "Here's what I'd recommend:\n",
      "- **Bench Press** — 4×8 @ RPE 7\n",
      "- **Overhead Press** — 3×10\n",
      "- **Incline DB Press** — 3×12\n",
      "- **Lateral Raises** — 3×15\n",
      "- **Tricep Pushdowns** — 3×12\n\n",
      "This keeps your weekly volume balanced across muscle groups. ",
      "Want me to structure this as a full workout you can export to your Garmin?",
    ];
  }

  if (lower.includes('tired') || lower.includes('fatigue') || lower.includes('sore') || lower.includes('recovery')) {
    return [
      "I can see you've had a heavy training week — ",
      "your acute:chronic workload ratio is at **1.3**, which is on the higher end. ",
      "I'd recommend backing off today.\n\n",
      "**Recovery options:**\n",
      "1. 🧘 **Active recovery** — 30min easy walk or light yoga\n",
      "2. 🏊 **Pool session** — 20min easy swim, focus on mobility\n",
      "3. 😴 **Full rest day** — sleep, hydration, nutrition\n\n",
      "Your body adapts during rest, not during training. ",
      "Taking a day off now means you'll come back stronger for Thursday's session.",
    ];
  }

  if (lower.includes('nutrition') || lower.includes('eat') || lower.includes('diet') || lower.includes('protein') || lower.includes('calories')) {
    return [
      "Great question on nutrition! ",
      "For your current training volume (**4-5 sessions/week**), here are my recommendations:\n\n",
      "**Daily targets:**\n",
      "- 🥩 **Protein:** 160-180g (2g/kg bodyweight)\n",
      "- 🍚 **Carbs:** 250-300g (fuel your training)\n",
      "- 🥑 **Fats:** 65-75g (hormone health)\n",
      "- 💧 **Water:** 3-4L minimum\n\n",
      "**Timing tip:** Get 30-40g protein within 2 hours of your workout, ",
      "and front-load carbs around training sessions for best performance. ",
      "Want me to break this down for specific training days vs rest days?",
    ];
  }

  if (lower.includes('progress') || lower.includes('how am i') || lower.includes('stats') || lower.includes('improve')) {
    return [
      "Here's your progress snapshot 📊\n\n",
      "**This week:** 5 workouts completed\n",
      "**Streak:** 12 days consecutive\n",
      "**Volume trend:** ↑ 8% vs last week\n\n",
      "**Key lifts (last 30 days):**\n",
      "- Bench Press: 165 → **185 lbs** (+12%)\n",
      "- Squat: 205 → **225 lbs** (+10%)\n",
      "- Deadlift: 255 → **275 lbs** (+8%)\n\n",
      "You're making solid progress across all compounds. ",
      "Your squat has the most room for growth — ",
      "consider adding an extra squat variation day if recovery allows.",
    ];
  }

  if (lower.includes('plan') || lower.includes('week') || lower.includes('schedule')) {
    return [
      "Here's my suggested plan for your week:\n\n",
      "| Day | Session | Focus |\n",
      "|-----|---------|-------|\n",
      "| Mon | Upper Push | Bench, OHP, accessories |\n",
      "| Tue | Easy Run | 5km @ conversational pace |\n",
      "| Wed | Lower Body | Squat, RDL, lunges |\n",
      "| Thu | Tempo Run | 3×2km @ threshold |\n",
      "| Fri | Upper Pull | Rows, pullups, biceps |\n",
      "| Sat | Long Run | 15km easy |\n",
      "| Sun | Rest/Mobility | Yoga or foam rolling |\n\n",
      "This balances your strength and running goals. ",
      "Want me to generate any of these as exportable workouts?",
    ];
  }

  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('sup')) {
    return [
      "Hey! 👋 Welcome back to AmakaFlow.\n\n",
      "I can help you with:\n",
      "- 🏋️ **Workout recommendations** based on your history\n",
      "- 📊 **Progress tracking** and analytics\n",
      "- 📅 **Weekly planning** and scheduling\n",
      "- 🍎 **Nutrition guidance** for your goals\n",
      "- 💤 **Recovery advice** when you're feeling fatigued\n\n",
      "What would you like to work on today?",
    ];
  }

  // Default response
  return [
    "That's a great question! ",
    "Based on your training data, here's what I think:\n\n",
    `You mentioned: *"${message.slice(0, 80)}${message.length > 80 ? '...' : ''}"*\n\n`,
    "I can see from your workout history that you've been consistent with **4-5 sessions per week**. ",
    "Your strength is progressing well and your running pace is improving.\n\n",
    "Would you like me to:\n",
    "1. Create a workout based on this?\n",
    "2. Adjust your weekly plan?\n",
    "3. Show detailed analytics?\n\n",
    "Just let me know how I can help!",
  ];
}

export const chatHandlers = [
  http.post(`${BASE}/chat/stream`, async ({ request }) => {
    const body = await request.json() as any;
    const sessionId = body.session_id || `demo-session-${Date.now()}`;
    const message: string = body.message || '';
    const responseChunks = getCoachResponse(message);

    const chunks = [
      sseEvent('message_start', { session_id: sessionId }),
      ...responseChunks.map(text => sseEvent('content_delta', { text })),
      sseEvent('message_end', {
        session_id: sessionId,
        tokens_used: responseChunks.join('').length,
        latency_ms: 350,
        pending_imports: [],
      }),
    ];

    const body_stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      },
    });

    return new HttpResponse(body_stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }),

  http.get(`${BASE}/health`, () => {
    return HttpResponse.json({ status: 'ok', service: 'chat-api' });
  }),
];
