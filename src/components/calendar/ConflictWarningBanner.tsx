import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import type { ConflictWarning } from './types';

interface ConflictWarningBannerProps {
  conflicts: ConflictWarning[];
  onDismiss: (index: number) => void;
}

export function ConflictWarningBanner({ conflicts, onDismiss }: ConflictWarningBannerProps) {
  if (conflicts.length === 0) return null;

  return (
    <div data-testid="conflict-warning-banner" className="space-y-2">
      {conflicts.map((conflict, i) => (
        <div
          key={i}
          data-testid={`conflict-warning-${i}`}
          className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm animate-in fade-in slide-in-from-top-2"
        >
          <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-yellow-200 font-medium">{conflict.message}</p>
            {conflict.suggestion && (
              <p className="text-yellow-300/70 mt-1 flex items-center gap-1.5">
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                {conflict.suggestion}
              </p>
            )}
          </div>
          <button
            onClick={() => onDismiss(i)}
            className="text-yellow-400 hover:text-yellow-300 shrink-0"
            aria-label="Dismiss conflict warning"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
