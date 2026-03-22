import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Timer,
  Lock,
  Check,
  X,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Zap,
  Activity,
  Heart,
  Brain,
} from 'lucide-react';
import type { TrainingSession, SessionSource, Intensity, ViewLayer } from './types';
import { ReasoningPanel, type ReasoningData } from './ReasoningPanel';

// --- Source colors ---
const sourceColors: Record<SessionSource, { bg: string; border: string; label: string }> = {
  stryd: { bg: 'bg-blue-500/15', border: 'border-l-blue-500', label: 'Stryd' },
  amakaflow: { bg: 'bg-green-500/15', border: 'border-l-green-500', label: 'AmakaFlow' },
  class: { bg: 'bg-purple-500/15', border: 'border-l-purple-500', label: 'Class' },
  manual: { bg: 'bg-gray-500/15', border: 'border-l-gray-500', label: 'Manual' },
};

// --- Intensity badge ---
const intensityBadge: Record<Intensity, { bg: string; text: string }> = {
  easy: { bg: 'bg-green-500/20', text: 'text-green-400' },
  moderate: { bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  hard: { bg: 'bg-red-500/20', text: 'text-red-400' },
};

// --- Type icon ---
function TypeIcon({ type }: { type: TrainingSession['type'] }) {
  const cls = 'h-4 w-4 shrink-0';
  switch (type) {
    case 'run':
      return <Activity className={cls} />;
    case 'strength':
      return <Zap className={cls} />;
    case 'class':
      return <Heart className={cls} />;
    case 'yoga':
      return <Heart className={cls} />;
    default:
      return <Timer className={cls} />;
  }
}

interface SessionCardProps {
  session: TrainingSession;
  dayIndex: number;
  expanded: boolean;
  onToggleExpand: () => void;
  viewLayer: ViewLayer;
  /** AMA-1153: optional reasoning data for "Why this workout?" panel */
  reasoning?: ReasoningData;
  /** AMA-1153: callback to request reasoning for this session */
  onRequestReasoning?: (sessionId: string) => void;
}

export function SessionCard({
  session,
  dayIndex,
  expanded,
  onToggleExpand,
  viewLayer,
  reasoning,
  onRequestReasoning,
}: SessionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: session.id,
    data: { session, dayIndex },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const src = sourceColors[session.source];
  const intBadge = intensityBadge[session.intensity];
  const showActual = viewLayer === 'actuals' && session.actual;
  const adherent = session.actual?.completed;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-testid={`session-card-${session.id}`}
      className={`
        relative rounded-lg border-l-4 ${src.border} ${src.bg}
        p-2.5 cursor-grab active:cursor-grabbing
        transition-shadow hover:shadow-md
        ${isDragging ? 'shadow-lg ring-2 ring-primary/40 z-50' : ''}
        ${session.hasConflict ? 'ring-1 ring-yellow-500/40' : ''}
      `}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <TypeIcon type={session.type} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground truncate">{session.title}</span>
            {session.locked && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Timer className="h-3 w-3" />
              {session.duration}m
            </span>
            <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${src.bg} text-foreground/80`}>
              {src.label}
            </span>
            <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold capitalize ${intBadge.bg} ${intBadge.text}`}>
              {session.intensity}
            </span>
          </div>
        </div>

        {/* Adherence indicator */}
        {session.status === 'completed' && (
          <div className="shrink-0">
            {adherent ? (
              <Check className="h-4 w-4 text-green-400" />
            ) : (
              <X className="h-4 w-4 text-red-400" />
            )}
          </div>
        )}

        {/* Conflict badge */}
        {session.hasConflict && (
          <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />
        )}
      </div>

      {/* Actual data strip */}
      {showActual && session.actual && (
        <div className="mt-2 rounded-md bg-foreground/5 px-2 py-1.5 text-[11px] text-muted-foreground space-y-0.5">
          <div className="font-medium text-foreground/90">Actual</div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {session.actual.avgPace && <span>Pace: {session.actual.avgPace}</span>}
            {session.actual.avgPower && <span>Power: {session.actual.avgPower}W</span>}
            {session.actual.avgHR && <span>HR: {session.actual.avgHR}bpm</span>}
            {session.actual.distance && <span>{session.actual.distance}km</span>}
            <span>{session.actual.duration}min</span>
          </div>
        </div>
      )}

      {/* Expand toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? 'Less' : 'Details'}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="mt-2 space-y-2 border-t border-foreground/10 pt-2 text-[11px]" data-testid="session-expanded">
          {session.steps && session.steps.length > 0 && (
            <div>
              <div className="font-medium text-foreground/80 mb-1">Structured Steps</div>
              <ol className="space-y-1 pl-3 list-decimal list-outside text-muted-foreground">
                {session.steps.map((step, i) => (
                  <li key={i}>
                    <span className="font-medium text-foreground/70">{step.label}</span>{' '}
                    <span className="text-muted-foreground">({step.duration})</span>
                    <div className="text-muted-foreground/80">{step.description}</div>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {/* AMA-1153: Structured reasoning panel (replaces simple rationale) */}
          {reasoning ? (
            <ReasoningPanel reasoning={reasoning} />
          ) : session.rationale ? (
            <div className="rounded-md bg-primary/5 px-2 py-1.5">
              <div className="flex items-center justify-between">
                <div className="font-medium text-foreground/80 mb-0.5">Why here?</div>
                {onRequestReasoning && (
                  <button
                    data-testid={`why-btn-${session.id}`}
                    onClick={(e) => { e.stopPropagation(); onRequestReasoning(session.id); }}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    <Brain className="h-3 w-3" />
                    Show sources
                  </button>
                )}
              </div>
              <div className="text-muted-foreground">{session.rationale}</div>
            </div>
          ) : onRequestReasoning ? (
            <button
              data-testid={`why-btn-${session.id}`}
              onClick={(e) => { e.stopPropagation(); onRequestReasoning(session.id); }}
              onPointerDown={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-md bg-primary/5 px-2 py-1.5 text-[11px] text-primary hover:bg-primary/10 font-medium transition-colors"
            >
              <Brain className="h-3.5 w-3.5" />
              Why this workout?
            </button>
          ) : null}
          {session.syncStatus && (
            <div className="text-muted-foreground/70 italic">{session.syncStatus}</div>
          )}
        </div>
      )}
    </div>
  );
}
