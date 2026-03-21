import { Battery, ArrowDownCircle, X } from 'lucide-react';
import type { DayState } from './types';

interface ReadinessDowngradePromptProps {
  day: DayState;
  onAcceptDowngrade: () => void;
  onDismiss: () => void;
}

/** Shown when a day's readiness score is below 40 and it has hard sessions */
export function ReadinessDowngradePrompt({
  day,
  onAcceptDowngrade,
  onDismiss,
}: ReadinessDowngradePromptProps) {
  const hardSessions = day.sessions.filter(s => s.intensity === 'hard');
  if (hardSessions.length === 0 || day.readinessScore >= 40) return null;

  return (
    <div
      data-testid="readiness-downgrade-prompt"
      className="flex items-start gap-3 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm animate-in fade-in slide-in-from-top-2"
    >
      <Battery className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-orange-200 font-medium">
          Low readiness on {day.dayLabel} ({day.readinessScore}/100)
        </p>
        <p className="text-orange-300/70 mt-0.5">
          Your readiness is low. Consider downgrading{' '}
          {hardSessions.map(s => s.title).join(' and ')} to moderate intensity.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={onAcceptDowngrade}
            data-testid="accept-downgrade"
            className="inline-flex items-center gap-1.5 rounded-md bg-orange-500/20 px-3 py-1.5 text-xs font-medium text-orange-300 hover:bg-orange-500/30 transition-colors"
          >
            <ArrowDownCircle className="h-3.5 w-3.5" />
            Downgrade to moderate
          </button>
          <button
            onClick={onDismiss}
            data-testid="dismiss-downgrade"
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground/5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-foreground/10 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Keep as planned
          </button>
        </div>
      </div>
    </div>
  );
}
