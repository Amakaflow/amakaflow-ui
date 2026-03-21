import { useState, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, CalendarDays, Sparkles, Loader2 } from 'lucide-react';
import { Switch } from '../ui/switch';
import { DayColumn } from './DayColumn';
import { AdherenceSummary } from './AdherenceSummary';
import { ConflictWarningBanner } from './ConflictWarningBanner';
import { MissedSessionPrompt } from './MissedSessionPrompt';
import { ReadinessDowngradePrompt } from './ReadinessDowngradePrompt';
import { PlanPreviewOverlay } from './PlanPreviewOverlay';
import { useWeekState } from './hooks/useWeekState';
import type { TrainingSession, ConflictWarning } from './types';

export function TrainingWeekView() {
  const {
    weekState,
    viewLayer,
    expandedSessionId,
    isGenerating,
    moveSession,
    toggleExpand,
    toggleViewLayer,
    generateWeek,
    dismissMissedSession,
    planPreview,
    applyPlan,
    cancelPlan,
    adjustPlan,
    updateProposalDuration,
    updateProposalIntensity,
  } = useWeekState();

  const [activeSession, setActiveSession] = useState<{
    session: TrainingSession;
    dayIndex: number;
  } | null>(null);

  const [dropWarning, setDropWarning] = useState<string | null>(null);
  const [visibleConflicts, setVisibleConflicts] = useState<ConflictWarning[]>([]);
  const [dismissedDowngrade, setDismissedDowngrade] = useState(false);

  // Sync conflicts when weekState changes (e.g. after generate)
  useEffect(() => {
    if (weekState.conflicts.length > 0) {
      setVisibleConflicts(weekState.conflicts);
    }
  }, [weekState.conflicts]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { session, dayIndex } = event.active.data.current as {
      session: TrainingSession;
      dayIndex: number;
    };
    setActiveSession({ session, dayIndex });
    setDropWarning(null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { over } = event;
      if (!activeSession || !over) {
        setActiveSession(null);
        setDropWarning(null);
        return;
      }

      // Extract target day index from droppable id
      const targetDayIndex = over.data.current?.dayIndex as number | undefined;
      if (targetDayIndex === undefined || targetDayIndex === activeSession.dayIndex) {
        setActiveSession(null);
        setDropWarning(null);
        return;
      }

      // Check for locked session warning
      if (activeSession.session.locked) {
        setDropWarning(
          `"${activeSession.session.title}" is synced from an external source. Moving it here won't update the original schedule.`,
        );
      }

      // Check for conflict at target
      const targetDay = weekState.days[targetDayIndex];
      if (targetDay.sessions.length > 0) {
        setDropWarning(prev =>
          prev
            ? prev
            : `Heads up: ${targetDay.dayLabel} already has ${targetDay.sessions.length} session(s).`,
        );
      }

      moveSession(activeSession.session.id, activeSession.dayIndex, targetDayIndex);
      setActiveSession(null);

      // Auto-dismiss warning
      if (dropWarning || activeSession.session.locked || targetDay.sessions.length > 0) {
        setTimeout(() => setDropWarning(null), 4000);
      }
    },
    [activeSession, moveSession, weekState.days, dropWarning],
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Collect missed sessions across all days
  const missedSessions = weekState.days.flatMap(d =>
    d.sessions.filter(s => s.status === 'missed'),
  );

  // Find days with low readiness that have hard sessions
  const lowReadinessDays = weekState.days.filter(
    d => d.readinessScore < 40 && d.sessions.some(s => s.intensity === 'hard'),
  );

  const handleDismissConflict = useCallback((index: number) => {
    setVisibleConflicts(prev => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div data-testid="training-week-view" className="flex flex-col gap-4 p-4 md:p-6 h-full">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground">Training Week</h2>
          <div className="flex items-center gap-1">
            <button className="rounded-md p-1 hover:bg-accent transition-colors">
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="text-sm font-medium text-muted-foreground px-1">
              {weekState.weekLabel}
            </span>
            <button className="rounded-md p-1 hover:bg-accent transition-colors">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Generate my week button -- AMA-1115 */}
          <button
            data-testid="generate-week-btn"
            onClick={generateWeek}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isGenerating ? 'Generating...' : 'Generate my week'}
          </button>

          {/* Plan vs Actual toggle */}
          <div className="flex items-center gap-2" data-testid="plan-actual-toggle">
            <span className={`text-sm font-medium ${viewLayer === 'planned' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Plan
            </span>
            <Switch
              checked={viewLayer === 'actuals'}
              onCheckedChange={toggleViewLayer}
            />
            <span className={`text-sm font-medium ${viewLayer === 'actuals' ? 'text-foreground' : 'text-muted-foreground'}`}>
              Actuals
            </span>
          </div>
        </div>
      </div>

      {/* Adherence bar */}
      <AdherenceSummary
        completed={weekState.completedCount}
        total={weekState.totalPlanned}
      />

      {/* Conflict warnings -- AMA-1115 */}
      <ConflictWarningBanner
        conflicts={visibleConflicts}
        onDismiss={handleDismissConflict}
      />

      {/* Missed session prompts -- AMA-1115 */}
      {missedSessions.map(session => (
        <MissedSessionPrompt
          key={session.id}
          session={session}
          onReschedule={(id) => {
            // In production this would call POST /planning/rebalance
            dismissMissedSession(id);
          }}
          onSkip={(id) => dismissMissedSession(id)}
        />
      ))}

      {/* Readiness-based downgrade prompt -- AMA-1115 */}
      {!dismissedDowngrade && lowReadinessDays.length > 0 && (
        <ReadinessDowngradePrompt
          day={lowReadinessDays[0]}
          onAcceptDowngrade={() => setDismissedDowngrade(true)}
          onDismiss={() => setDismissedDowngrade(true)}
        />
      )}

      {/* Drop warning toast */}
      {dropWarning && (
        <div
          data-testid="drop-warning"
          className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-sm text-yellow-300 animate-in fade-in slide-in-from-top-2"
        >
          <span className="text-yellow-400 font-medium">Warning:</span>
          {dropWarning}
          <button
            onClick={() => setDropWarning(null)}
            className="ml-auto text-yellow-400 hover:text-yellow-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Week grid */}
      <div className="relative flex-1 min-h-0">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-2 overflow-x-auto pb-2 h-full">
            {weekState.days.map((day, i) => {
              const dayDate = new Date(day.date);
              dayDate.setHours(0, 0, 0, 0);
              const isToday = dayDate.getTime() === today.getTime();

              return (
                <DayColumn
                  key={i}
                  day={day}
                  dayIndex={i}
                  expandedSessionId={expandedSessionId}
                  onToggleExpand={toggleExpand}
                  viewLayer={viewLayer}
                  isToday={isToday}
                  isDropTarget={false}
                />
              );
            })}
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeSession ? (
              <div className="rounded-lg border-l-4 border-l-primary bg-card p-3 shadow-xl opacity-90 max-w-[200px]">
                <span className="text-sm font-medium">{activeSession.session.title}</span>
                <div className="text-xs text-muted-foreground mt-1">
                  {activeSession.session.duration}min - {activeSession.session.source}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Plan preview overlay (AMA-1128) */}
        <PlanPreviewOverlay
          preview={planPreview}
          onApply={applyPlan}
          onCancel={cancelPlan}
          onAdjust={adjustPlan}
          onDurationChange={updateProposalDuration}
          onIntensityChange={updateProposalIntensity}
        />
      </div>

      {/* Source legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border">
        <span className="font-medium text-foreground/70">Sources:</span>
        <LegendDot color="bg-blue-500" label="Stryd" />
        <LegendDot color="bg-green-500" label="AmakaFlow" />
        <LegendDot color="bg-purple-500" label="Class" />
        <LegendDot color="bg-gray-500" label="Manual" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
