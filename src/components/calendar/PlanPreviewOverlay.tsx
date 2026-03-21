/**
 * PlanPreviewOverlay — semi-transparent overlay on the calendar (AMA-1128).
 *
 * Shows proposed sessions per day column, plus summary + action bar at the bottom.
 * User reviews the plan, can adjust individual sessions, then apply or cancel.
 */
import { Sparkles, Check, SlidersHorizontal, X } from 'lucide-react';
import type { PlanPreviewState, ProposedSession, Intensity } from './types';
import { ProposedSessionCard } from './ProposedSessionCard';
import { PlanSummary } from './PlanSummary';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface PlanPreviewOverlayProps {
  preview: PlanPreviewState;
  onApply: () => void;
  onCancel: () => void;
  onAdjust: () => void;
  onDurationChange?: (id: string, newDuration: number) => void;
  onIntensityChange?: (id: string, newIntensity: Intensity) => void;
}

export function PlanPreviewOverlay({
  preview,
  onApply,
  onCancel,
  onAdjust,
  onDurationChange,
  onIntensityChange,
}: PlanPreviewOverlayProps) {
  if (!preview.active) return null;

  // Group proposals by target day
  const byDay: Record<number, ProposedSession[]> = {};
  for (const p of preview.proposals) {
    if (!byDay[p.toDayIndex]) byDay[p.toDayIndex] = [];
    byDay[p.toDayIndex].push(p);
  }

  return (
    <div
      data-testid="plan-preview-overlay"
      className="absolute inset-0 z-40 flex flex-col rounded-xl bg-background/80 backdrop-blur-sm border-2 border-primary/30"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-primary/20">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">
          Review Proposed Plan
        </span>
      </div>

      {/* Day columns with proposals */}
      <div className="flex-1 flex gap-2 overflow-x-auto px-3 py-3 min-h-0">
        {DAYS.map((dayLabel, dayIndex) => {
          const dayProposals = byDay[dayIndex] || [];
          return (
            <div
              key={dayIndex}
              data-testid={`preview-day-${dayIndex}`}
              className="flex-1 min-w-[140px] flex flex-col rounded-lg border border-border/50 bg-card/30"
            >
              <div className="px-2 pt-2 pb-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  {dayLabel}
                </span>
              </div>
              <div className="flex-1 px-1.5 pb-1.5 space-y-1.5 overflow-y-auto">
                {dayProposals.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-[11px] text-muted-foreground/40 italic py-4">
                    No changes
                  </div>
                ) : (
                  dayProposals.map((p) => (
                    <ProposedSessionCard
                      key={p.id}
                      proposal={p}
                      onDurationChange={onDurationChange}
                      onIntensityChange={onIntensityChange}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="px-4 pb-2">
        <PlanSummary summary={preview.summary} />
      </div>

      {/* Bottom action bar */}
      <div
        data-testid="plan-preview-actions"
        className="flex items-center gap-3 px-4 py-3 border-t border-primary/20"
      >
        <button
          data-testid="apply-plan-btn"
          onClick={onApply}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all"
        >
          <Check className="h-4 w-4" />
          Apply Plan
        </button>
        <button
          data-testid="adjust-plan-btn"
          onClick={onAdjust}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-all"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Adjust
        </button>
        <button
          data-testid="cancel-plan-btn"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent transition-all"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}
