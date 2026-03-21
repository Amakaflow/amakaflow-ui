/**
 * ProposedSessionCard — variant of SessionCard for plan-preview overlay (AMA-1128).
 *
 * Visual differences from SessionCard:
 *  - Dashed green border for NEW sessions
 *  - Dashed blue border + arrow indicator for MOVED sessions
 *  - Strikethrough + red dashed border for REMOVED sessions
 *  - Badge: "NEW", "MOVED", or "REMOVED"
 *  - Rationale tooltip on hover
 *  - Inline time/intensity editor (editable before applying)
 */
import { useState } from 'react';
import {
  Timer,
  Zap,
  Activity,
  Heart,
  ArrowRight,
  Info,
  Minus,
  Plus,
} from 'lucide-react';
import type {
  ProposedSession,
  ProposedChangeKind,
  SessionType,
  Intensity,
} from './types';

// --- Badge config per kind ---
const kindConfig: Record<
  ProposedChangeKind,
  { badge: string; border: string; bg: string; textDecoration: string }
> = {
  new: {
    badge: 'NEW',
    border: 'border-green-500/70',
    bg: 'bg-green-500/10',
    textDecoration: '',
  },
  moved: {
    badge: 'MOVED',
    border: 'border-blue-500/70',
    bg: 'bg-blue-500/10',
    textDecoration: '',
  },
  removed: {
    badge: 'REMOVED',
    border: 'border-red-500/70',
    bg: 'bg-red-500/10',
    textDecoration: 'line-through opacity-60',
  },
};

const badgeColors: Record<ProposedChangeKind, string> = {
  new: 'bg-green-500/20 text-green-400',
  moved: 'bg-blue-500/20 text-blue-400',
  removed: 'bg-red-500/20 text-red-400',
};

const intensityOrder: Intensity[] = ['easy', 'moderate', 'hard'];
const intensityBadge: Record<Intensity, { bg: string; text: string }> = {
  easy: { bg: 'bg-green-500/20', text: 'text-green-400' },
  moderate: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  hard: { bg: 'bg-red-500/20', text: 'text-red-400' },
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function TypeIcon({ type }: { type: SessionType }) {
  const cls = 'h-4 w-4 shrink-0';
  switch (type) {
    case 'run':
      return <Activity className={cls} />;
    case 'strength':
      return <Zap className={cls} />;
    case 'class':
    case 'yoga':
      return <Heart className={cls} />;
    default:
      return <Timer className={cls} />;
  }
}

// --- Props ---
export interface ProposedSessionCardProps {
  proposal: ProposedSession;
  /** Called when user edits duration */
  onDurationChange?: (id: string, newDuration: number) => void;
  /** Called when user edits intensity */
  onIntensityChange?: (id: string, newIntensity: Intensity) => void;
}

export function ProposedSessionCard({
  proposal,
  onDurationChange,
  onIntensityChange,
}: ProposedSessionCardProps) {
  const [showRationale, setShowRationale] = useState(false);
  const { session, kind, rationale, fromDayIndex } = proposal;
  const config = kindConfig[kind];
  const intBadge = intensityBadge[session.intensity];

  const cycleIntensity = () => {
    if (kind === 'removed' || !onIntensityChange) return;
    const idx = intensityOrder.indexOf(session.intensity);
    const next = intensityOrder[(idx + 1) % intensityOrder.length];
    onIntensityChange(proposal.id, next);
  };

  const adjustDuration = (delta: number) => {
    if (kind === 'removed' || !onDurationChange) return;
    const newDur = Math.max(15, session.duration + delta);
    onDurationChange(proposal.id, newDur);
  };

  return (
    <div
      data-testid={`proposed-session-${proposal.id}`}
      className={`
        relative rounded-lg border-2 border-dashed ${config.border} ${config.bg}
        p-2.5 transition-shadow hover:shadow-md
        ${config.textDecoration}
      `}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <TypeIcon type={session.type} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground truncate">
              {session.title}
            </span>
            {/* Kind badge */}
            <span
              className={`rounded-full px-1.5 py-px text-[10px] font-bold uppercase ${badgeColors[kind]}`}
              data-testid={`badge-${kind}`}
            >
              {kindConfig[kind].badge}
            </span>
          </div>

          {/* Moved arrow */}
          {kind === 'moved' && fromDayIndex !== undefined && (
            <div className="mt-1 flex items-center gap-1 text-[11px] text-blue-400">
              <span>{DAYS[fromDayIndex]}</span>
              <ArrowRight className="h-3 w-3" />
              <span>{DAYS[proposal.toDayIndex]}</span>
            </div>
          )}

          {/* Meta row */}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {/* Editable duration */}
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              {kind !== 'removed' && onDurationChange && (
                <button
                  onClick={() => adjustDuration(-15)}
                  className="rounded p-0.5 hover:bg-foreground/10 transition-colors"
                  aria-label="Decrease duration"
                  data-testid="duration-decrease"
                >
                  <Minus className="h-2.5 w-2.5" />
                </button>
              )}
              <Timer className="h-3 w-3" />
              {session.duration}m
              {kind !== 'removed' && onDurationChange && (
                <button
                  onClick={() => adjustDuration(15)}
                  className="rounded p-0.5 hover:bg-foreground/10 transition-colors"
                  aria-label="Increase duration"
                  data-testid="duration-increase"
                >
                  <Plus className="h-2.5 w-2.5" />
                </button>
              )}
            </span>

            {/* Editable intensity */}
            <button
              onClick={cycleIntensity}
              disabled={kind === 'removed'}
              className={`rounded-full px-1.5 py-px text-[10px] font-semibold capitalize ${intBadge.bg} ${intBadge.text} ${
                kind !== 'removed' ? 'cursor-pointer hover:ring-1 hover:ring-foreground/20' : 'cursor-default'
              }`}
              data-testid="intensity-toggle"
            >
              {session.intensity}
            </button>
          </div>
        </div>

        {/* Rationale toggle */}
        <button
          onClick={() => setShowRationale(!showRationale)}
          className="shrink-0 rounded p-1 hover:bg-foreground/10 transition-colors"
          aria-label="Show rationale"
          data-testid="rationale-toggle"
        >
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Rationale tooltip */}
      {showRationale && (
        <div
          className="mt-2 rounded-md bg-primary/5 px-2 py-1.5 text-[11px]"
          data-testid="rationale-panel"
        >
          <div className="font-medium text-foreground/80 mb-0.5">
            Why?
          </div>
          <div className="text-muted-foreground">{rationale}</div>
        </div>
      )}
    </div>
  );
}
