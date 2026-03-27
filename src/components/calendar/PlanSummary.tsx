/**
 * PlanSummary — shows a summary panel for the proposed weekly plan (AMA-1128).
 *
 * Displays:
 *  - "3 sessions added, 1 moved, 0 removed"
 *  - Total weekly volume
 *  - Hard days used / cap
 *  - Warnings list
 */
import { AlertTriangle, Clock, Flame, Plus, ArrowRight, X } from 'lucide-react';
import type { PlanSummaryData } from './types';

interface PlanSummaryProps {
  summary: PlanSummaryData;
}

export function PlanSummary({ summary }: PlanSummaryProps) {
  const { added, moved, removed, totalWeeklyVolume, hardDaysUsed, hardDaysCap, warnings } = summary;

  return (
    <div data-testid="plan-summary" className="rounded-xl border border-border bg-card/80 p-4 space-y-3">
      {/* Title */}
      <h3 className="text-sm font-semibold text-foreground">Plan Summary</h3>

      {/* Change counts */}
      <div className="flex flex-wrap gap-3 text-[12px]">
        <span className="inline-flex items-center gap-1 text-green-400">
          <Plus className="h-3 w-3" />
          {added} added
        </span>
        <span className="inline-flex items-center gap-1 text-blue-400">
          <ArrowRight className="h-3 w-3" />
          {moved} moved
        </span>
        <span className="inline-flex items-center gap-1 text-red-400">
          <X className="h-3 w-3" />
          {removed} removed
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-[12px]">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>Total volume:</span>
          <span className="font-semibold text-foreground">{totalWeeklyVolume}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Flame className="h-3.5 w-3.5" />
          <span>Hard days:</span>
          <span
            className={`font-semibold ${
              hardDaysUsed >= hardDaysCap ? 'text-red-400' : 'text-foreground'
            }`}
          >
            {hardDaysUsed} of {hardDaysCap} cap
          </span>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-1.5" data-testid="plan-warnings">
          {warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 rounded-md bg-yellow-500/10 px-2 py-1.5 text-[11px] text-yellow-300"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-yellow-400" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
