import { useMemo } from 'react';
import { CalendarEvent, WorkoutType } from '../../types/calendar';
import { addDays, format, isSameDay } from 'date-fns';
import { Badge } from '../ui/badge';
import { Lock } from 'lucide-react';

interface WeekViewProps {
  weekStart: Date;
  events: CalendarEvent[];
  selectedDate: Date;
  onEventClick: (event: CalendarEvent) => void;
  onTimeSlotClick: (data: { date: string; startTime: string }) => void;
  loading?: boolean;
}

const HOUR_HEIGHT = 56;
const START_HOUR = 6;
const END_HOUR = 19;
const TOTAL_HOURS = END_HOUR - START_HOUR;

const typeColors: Record<WorkoutType, { bg: string; border: string; text: string }> = {
  run: { bg: 'bg-blue-100 dark:bg-blue-900/40', border: 'border-l-blue-500 dark:border-l-blue-400', text: 'text-blue-900 dark:text-blue-200' },
  strength: { bg: 'bg-purple-100 dark:bg-purple-900/40', border: 'border-l-purple-500 dark:border-l-purple-400', text: 'text-purple-900 dark:text-purple-200' },
  hyrox: { bg: 'bg-red-100 dark:bg-red-900/40', border: 'border-l-red-500 dark:border-l-red-400', text: 'text-red-900 dark:text-red-200' },
  class: { bg: 'bg-green-100 dark:bg-green-900/40', border: 'border-l-green-500 dark:border-l-green-400', text: 'text-green-900 dark:text-green-200' },
  home_workout: { bg: 'bg-amber-100 dark:bg-amber-900/40', border: 'border-l-amber-500 dark:border-l-amber-400', text: 'text-amber-900 dark:text-amber-200' },
  mobility: { bg: 'bg-indigo-100 dark:bg-indigo-900/40', border: 'border-l-indigo-500 dark:border-l-indigo-400', text: 'text-indigo-900 dark:text-indigo-200' },
  recovery: { bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-l-slate-500 dark:border-l-slate-400', text: 'text-slate-900 dark:text-slate-200' },
};

export function WeekView({
  weekStart,
  events,
  selectedDate,
  onEventClick,
  onTimeSlotClick,
  loading,
}: WeekViewProps) {
  const hours = useMemo(() => Array.from({ length: TOTAL_HOURS }, (_, i) => i + START_HOUR), []);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = new Date();

  const eventsByDay = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};
    days.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      grouped[dateKey] = events.filter(event => event.date === dateKey);
    });
    return grouped;
  }, [days, events]);

  // Calculate event position and height
  const getEventStyle = (event: CalendarEvent) => {
    if (!event.start_time) return null;

    // Parse start time
    const [startHour, startMin = 0] = event.start_time.split(':').map(Number);
    
    // Parse end time or default to 1 hour duration
    let endHour = startHour + 1;
    let endMin = startMin;
    if (event.end_time) {
      [endHour, endMin = 0] = event.end_time.split(':').map(Number);
    }

    // Skip events outside visible range
    if (endHour < START_HOUR || startHour >= END_HOUR) {
      return null;
    }

    // Clamp to visible range
    const clampedStartHour = Math.max(startHour, START_HOUR);
    const clampedStartMin = startHour < START_HOUR ? 0 : startMin;
    const clampedEndHour = Math.min(endHour, END_HOUR);
    const clampedEndMin = endHour > END_HOUR ? 0 : endMin;

    // Calculate position from top of grid (START_HOUR = 0)
    const topMinutes = (clampedStartHour - START_HOUR) * 60 + clampedStartMin;
    const top = (topMinutes / 60) * HOUR_HEIGHT;

    // Calculate duration and height
    const durationMinutes = (clampedEndHour * 60 + clampedEndMin) - (clampedStartHour * 60 + clampedStartMin);
    const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 24);

    return { top, height };
  };

  const handleCellClick = (day: Date, hour: number) => {
    onTimeSlotClick({
      date: format(day, 'yyyy-MM-dd'),
      startTime: `${String(hour).padStart(2, '0')}:00:00`,
    });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header Row */}
      <div className="flex border-b flex-shrink-0 bg-background">
        {/* Time column spacer */}
        <div className="w-16 flex-shrink-0 h-16 flex items-center justify-center border-r bg-background">
          <span className="text-xs text-muted-foreground uppercase">Time</span>
        </div>

        {/* Day headers */}
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          const isSelected = isSameDay(day, selectedDate);

          return (
            <div
              key={day.toISOString()}
              className="flex-1 h-16 flex flex-col items-center justify-center border-l"
            >
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                {format(day, 'EEE')}
              </span>
              <div className="mt-1 flex items-center justify-center">
                {isToday ? (
                  <span className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-medium">
                    {format(day, 'd')}
                  </span>
                ) : (
                  <span className={`text-xl font-medium ${isSelected ? 'text-primary' : ''}`}>
                    {format(day, 'd')}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-Day Events Row */}
      <div className="flex border-b flex-shrink-0 bg-muted/30">
        {/* Label */}
        <div className="w-16 flex-shrink-0 flex items-start justify-end pr-2 pt-2 border-r">
          <span className="text-xs text-muted-foreground leading-none">All day</span>
        </div>

        {/* Day columns for all-day events */}
        {days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay[dateKey] || [];
          const allDayEvents = dayEvents.filter(e => !e.start_time);
          const isSelected = isSameDay(day, selectedDate);

          return (
            <div
              key={`all-day-${dateKey}`}
              className={`flex-1 border-l p-1 space-y-1 min-h-[60px] ${isSelected ? 'bg-primary/5' : ''}`}
            >
              {allDayEvents.map((event) => {
                const colors = typeColors[event.type] || typeColors.recovery;

                return (
                  <div
                    key={event.id}
                    className={`
                      px-2 py-1 rounded-md border-l-2 cursor-pointer hover:shadow-sm transition-shadow text-xs
                      ${colors.bg} ${colors.border} ${colors.text}
                    `}
                    onClick={() => onEventClick(event)}
                    title={event.title}
                  >
                    <div className="flex items-center gap-1">
                      {event.is_anchor && <Lock className="w-3 h-3 flex-shrink-0" />}
                      <span className="font-medium truncate">{event.title}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Scrollable Grid */}
      <div className="flex-1 overflow-auto">
        <div className="flex" style={{ minHeight: `${TOTAL_HOURS * HOUR_HEIGHT}px` }}>
          {/* Time column */}
          <div className="w-16 flex-shrink-0 border-r bg-background">
            {hours.map((hour) => (
              <div
                key={hour}
                className="flex items-start justify-end pr-2 pt-1 border-b"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                <span className="text-xs text-muted-foreground tabular-nums leading-none">
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDay[dateKey] || [];
            const isSelected = isSameDay(day, selectedDate);

            return (
              <div
                key={dateKey}
                className={`flex-1 relative border-l ${isSelected ? 'bg-primary/5' : ''}`}
              >
                {/* Hour cells */}
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-b hover:bg-accent/50 transition-colors cursor-pointer"
                    style={{ height: `${HOUR_HEIGHT}px` }}
                    onClick={() => handleCellClick(day, hour)}
                  />
                ))}

                {/* Events overlay - positioned absolutely from top of column */}
                <div className="absolute inset-0 pointer-events-none overflow-visible">
                  {dayEvents
                    .filter(e => e.start_time)
                    .map((event) => {
                      const style = getEventStyle(event);
                      if (!style) return null;
                      
                      const colors = typeColors[event.type] || typeColors.recovery;

                      return (
                        <div
                          key={event.id}
                          className={`
                            absolute left-1 right-1 rounded-md border-l-4 overflow-hidden shadow-sm
                            pointer-events-auto cursor-pointer hover:shadow-md hover:z-10 transition-shadow
                            ${colors.bg} ${colors.border} ${colors.text}
                          `}
                          style={{ 
                            top: `${style.top}px`, 
                            height: `${style.height}px`,
                            minHeight: '24px'
                          }}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            onEventClick(event); 
                          }}
                          title={`${event.title}${event.start_time ? ` (${event.start_time.substring(0, 5)}${event.end_time ? ` - ${event.end_time.substring(0, 5)}` : ''})` : ''}`}
                        >
                          <div className="px-2 py-1 h-full flex flex-col justify-start overflow-hidden">
                            <div className="flex items-center gap-1 min-h-0">
                              {event.is_anchor && <Lock className="w-3 h-3 flex-shrink-0" />}
                              <span className="text-xs font-medium truncate leading-tight">
                                {event.title}
                              </span>
                            </div>
                            {style.height >= 40 && event.start_time && (
                              <span className="text-[11px] opacity-75 leading-tight mt-0.5 truncate">
                                {event.start_time.substring(0, 5)}
                                {event.end_time && ` - ${event.end_time.substring(0, 5)}`}
                              </span>
                            )}
                            {style.height >= 64 && event.source && (
                              <span className="text-[10px] opacity-60 capitalize leading-tight mt-0.5 truncate">
                                {event.source.replace('_', ' ')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-30">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      )}
    </div>
  );
}