/**
 * SuggestedPrompts — empty state suggestions for the coach chat.
 *
 * Shows when there are no messages in the conversation yet.
 * Clicking a prompt sends it as a user message.
 */

import { MessageSquare, Zap, Calendar, BarChart3 } from 'lucide-react';

interface SuggestedPromptsProps {
  onSelect: (prompt: string) => void;
}

const SUGGESTIONS = [
  {
    text: 'My legs are tired after yesterday',
    icon: Zap,
    color: 'text-amber-400',
  },
  {
    text: 'What should I focus on this week?',
    icon: Calendar,
    color: 'text-blue-400',
  },
  {
    text: 'Am I ready for my hyrox on Saturday?',
    icon: BarChart3,
    color: 'text-green-400',
  },
  {
    text: 'How was my training load this week?',
    icon: MessageSquare,
    color: 'text-purple-400',
  },
];

export function SuggestedPrompts({ onSelect }: SuggestedPromptsProps) {
  return (
    <div data-testid="suggested-prompts" className="flex flex-col items-center justify-center flex-1 px-4 py-8">
      {/* Coach intro */}
      <div className="flex flex-col items-center mb-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white text-2xl font-bold shadow-lg mb-4">
          A
        </div>
        <h2 className="text-lg font-semibold text-foreground">Meet Amaka</h2>
        <p className="text-sm text-muted-foreground text-center mt-1 max-w-[280px]">
          Your AI coach who knows your training history and can help you make smarter decisions.
        </p>
      </div>

      {/* Suggestion cards */}
      <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
        {SUGGESTIONS.map((suggestion) => {
          const Icon = suggestion.icon;
          return (
            <button
              key={suggestion.text}
              data-testid="suggested-prompt"
              onClick={() => onSelect(suggestion.text)}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-left text-sm text-foreground hover:bg-muted/40 hover:border-border transition-all"
            >
              <Icon className={`h-4 w-4 shrink-0 ${suggestion.color}`} />
              <span>{suggestion.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
