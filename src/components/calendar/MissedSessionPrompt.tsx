import { Clock, CalendarPlus, SkipForward } from 'lucide-react';
import type { TrainingSession } from './types';

interface MissedSessionPromptProps {
  session: TrainingSession;
  onReschedule: (sessionId: string) => void;
  onSkip: (sessionId: string) => void;
}

export function MissedSessionPrompt({ session, onReschedule, onSkip }: MissedSessionPromptProps) {
  return (
    <div
      data-testid={`missed-session-prompt-${session.id}`}
      className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm animate-in fade-in slide-in-from-top-2"
    >
      <Clock className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-red-200 font-medium">
          Missed: {session.title}
        </p>
        <p className="text-red-300/70 mt-0.5">
          {session.duration}min {session.intensity} {session.type} from {session.source} was not completed.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => onReschedule(session.id)}
            data-testid={`reschedule-${session.id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/30 transition-colors"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            Reschedule
          </button>
          <button
            onClick={() => onSkip(session.id)}
            data-testid={`skip-${session.id}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground/5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-foreground/10 transition-colors"
          >
            <SkipForward className="h-3.5 w-3.5" />
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
