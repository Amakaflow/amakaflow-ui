import { useState } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Calendar,
  TrendingDown,
  Check,
} from 'lucide-react';
import type { SchedulingConflict, SuggestedFix, ConflictType } from './types';

interface ConflictDetailPanelProps {
  conflicts: SchedulingConflict[];
  onApplyFix?: (conflict: SchedulingConflict, fix: SuggestedFix) => void;
}

const CONFLICT_LABELS: Record<ConflictType, string> = {
  pre_fatigue: 'Pre-fatigue Risk',
  consecutive_hard: 'Consecutive Hard Days',
  same_muscle_group: 'Same Muscle Group',
  overload: 'Volume Overload',
  no_recovery: 'No Recovery Day',
};

const CONFLICT_ICONS: Record<ConflictType, typeof AlertTriangle> = {
  pre_fatigue: ShieldAlert,
  consecutive_hard: AlertTriangle,
  same_muscle_group: AlertTriangle,
  overload: TrendingDown,
  no_recovery: Calendar,
};

function FixButton({
  fix,
  onClick,
}: {
  fix: SuggestedFix;
  onClick: () => void;
}) {
  const iconMap: Record<string, typeof ArrowRight> = {
    move: ArrowRight,
    downgrade: TrendingDown,
    keep: Check,
  };
  const Icon = iconMap[fix.action] || Check;

  const styleMap: Record<string, string> = {
    move: 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border-blue-500/30',
    downgrade: 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 border-yellow-500/30',
    keep: 'bg-zinc-500/20 text-zinc-300 hover:bg-zinc-500/30 border-zinc-500/30',
  };

  return (
    <button
      data-testid={`fix-btn-${fix.action}`}
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5
        text-xs font-medium transition-colors
        ${styleMap[fix.action] || styleMap.keep}
      `}
    >
      <Icon className="h-3 w-3" />
      {fix.label}
    </button>
  );
}

function ConflictCard({
  conflict,
  onApplyFix,
}: {
  conflict: SchedulingConflict;
  onApplyFix?: (fix: SuggestedFix) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isCritical = conflict.severity === 'critical';
  const Icon = CONFLICT_ICONS[conflict.type] || AlertTriangle;

  return (
    <div
      data-testid={`conflict-card-${conflict.type}`}
      className={`
        rounded-lg border transition-all
        ${isCritical
          ? 'border-red-500/30 bg-red-500/5'
          : 'border-yellow-500/30 bg-yellow-500/5'
        }
      `}
    >
      {/* Header — always visible */}
      <button
        data-testid={`conflict-toggle-${conflict.type}`}
        onClick={() => setExpanded(prev => !prev)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <Icon
          className={`h-5 w-5 shrink-0 mt-0.5 ${
            isCritical ? 'text-red-400' : 'text-yellow-400'
          }`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              data-testid="conflict-type-label"
              className={`text-xs font-semibold uppercase tracking-wider ${
                isCritical ? 'text-red-400' : 'text-yellow-400'
              }`}
            >
              {CONFLICT_LABELS[conflict.type]}
            </span>
            <span
              data-testid="conflict-severity-badge"
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                isCritical
                  ? 'bg-red-500/20 text-red-300'
                  : 'bg-yellow-500/20 text-yellow-300'
              }`}
            >
              {conflict.severity}
            </span>
          </div>
          <p
            data-testid="conflict-message"
            className="mt-1 text-sm text-foreground/80 line-clamp-2"
          >
            {conflict.message}
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div
          data-testid="conflict-detail-expanded"
          className="border-t border-border/50 px-4 py-3 space-y-3 animate-in fade-in slide-in-from-top-1"
        >
          {/* Affected dates */}
          {conflict.affectedDates.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Affected dates:</span>
              {conflict.affectedDates.map(d => (
                <span
                  key={d}
                  className="rounded bg-muted px-1.5 py-0.5 font-mono"
                >
                  {d}
                </span>
              ))}
            </div>
          )}

          {/* Suggested fixes */}
          {conflict.suggestedFixes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Suggested fixes:
              </p>
              <div className="flex flex-wrap gap-2">
                {conflict.suggestedFixes.map((fix, i) => (
                  <FixButton
                    key={i}
                    fix={fix}
                    onClick={() => onApplyFix?.(fix)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * AMA-1118: Expandable panel showing detailed conflict information.
 *
 * Shows each conflict with:
 * - Type label and severity badge
 * - Human-readable description
 * - Affected dates
 * - One-tap fix actions
 */
export function ConflictDetailPanel({
  conflicts,
  onApplyFix,
}: ConflictDetailPanelProps) {
  if (conflicts.length === 0) return null;

  const criticalCount = conflicts.filter(c => c.severity === 'critical').length;
  const warningCount = conflicts.filter(c => c.severity === 'warning').length;

  return (
    <div data-testid="conflict-detail-panel" className="space-y-3">
      {/* Summary header */}
      <div className="flex items-center gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 text-yellow-400" />
        <span className="font-medium text-foreground">
          {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} detected
        </span>
        {criticalCount > 0 && (
          <span
            data-testid="critical-count"
            className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-bold text-red-300"
          >
            {criticalCount} critical
          </span>
        )}
        {warningCount > 0 && (
          <span
            data-testid="warning-count"
            className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-bold text-yellow-300"
          >
            {warningCount} warning{warningCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Conflict cards */}
      <div className="space-y-2">
        {conflicts.map((conflict, i) => (
          <ConflictCard
            key={`${conflict.type}-${i}`}
            conflict={conflict}
            onApplyFix={fix => onApplyFix?.(conflict, fix)}
          />
        ))}
      </div>
    </div>
  );
}
