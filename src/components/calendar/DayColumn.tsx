import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AlertTriangle } from 'lucide-react';
import type { DayState, ViewLayer } from './types';
import { ReadinessPill } from './ReadinessPill';
import { SessionCard } from './SessionCard';

interface DayColumnProps {
  day: DayState;
  dayIndex: number;
  expandedSessionId: string | null;
  onToggleExpand: (id: string) => void;
  viewLayer: ViewLayer;
  isToday: boolean;
  isDropTarget: boolean;
}

export function DayColumn({
  day,
  dayIndex,
  expandedSessionId,
  onToggleExpand,
  viewLayer,
  isToday,
  isDropTarget,
}: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dayIndex}`,
    data: { dayIndex },
  });

  const sessionsToShow =
    viewLayer === 'actuals'
      ? day.sessions.filter(s => s.status === 'completed' || s.actual)
      : day.sessions;

  const sessionIds = sessionsToShow.map(s => s.id);

  return (
    <div
      ref={setNodeRef}
      data-testid={`day-column-${dayIndex}`}
      className={`
        flex flex-col rounded-xl border min-w-[160px] flex-1
        transition-colors duration-150
        ${isToday ? 'border-primary/50 bg-primary/5' : 'border-border bg-card/50'}
        ${isOver || isDropTarget ? 'ring-2 ring-primary/40 bg-primary/10' : ''}
      `}
    >
      {/* Day header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
        <div className="flex flex-col">
          <span className={`text-xs font-medium uppercase tracking-wider ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
            {day.dayLabel}
          </span>
          <span className={`text-lg font-semibold leading-tight ${isToday ? 'text-primary' : 'text-foreground'}`}>
            {day.dateLabel}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {day.hasConflict && (
            <AlertTriangle className="h-4 w-4 text-yellow-400" data-testid="conflict-badge" />
          )}
          <ReadinessPill score={day.readinessScore} tier={day.readinessTier} />
        </div>
      </div>

      {/* Sessions */}
      <div className="flex-1 px-2 pb-2 space-y-2 min-h-[80px]">
        <SortableContext items={sessionIds} strategy={verticalListSortingStrategy}>
          {sessionsToShow.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground/60 italic py-6">
              {viewLayer === 'actuals' ? 'No actuals' : 'Rest day'}
            </div>
          ) : (
            sessionsToShow.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                dayIndex={dayIndex}
                expanded={expandedSessionId === session.id}
                onToggleExpand={() => onToggleExpand(session.id)}
                viewLayer={viewLayer}
              />
            ))
          )}
        </SortableContext>
      </div>

      {/* Drop zone indicator when dragging over */}
      {isOver && (
        <div className="mx-2 mb-2 rounded-md border-2 border-dashed border-primary/30 py-3 text-center text-xs text-primary/60">
          Drop here
        </div>
      )}
    </div>
  );
}
