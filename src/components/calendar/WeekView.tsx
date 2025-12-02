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
  run: { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-900' },
  strength: { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-900' },
  hyrox: { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-900' },
  class: { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-900' },
  home_workout: { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-900' },
  mobility: { bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-900' },
  recovery: { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-900' },
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

  const getEventStyle = (event: CalendarEvent) => {
    if (!event.start_time) return null;
    const [startHour, startMin] = event.start_time.split(':').map(Number);
    let endHour = startHour + 1;
    let endMin = startMin || 0;
    if (event.end_time) {
      [endHour, endMin] = event.end_time.split(':').map(Number);
    }
    const topMinutes = (startHour - START_HOUR) * 60 + (startMin || 0);
    const top = (topMinutes / 60) * HOUR_HEIGHT;
    const durationMinutes = (endHour * 60 + (endMin || 0)) - (startHour * 60 + (startMin || 0));
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
      <div className="flex border-b flex-shrink-0">
        {/* Time column spacer */}
        <div className="w-16 flex-shrink-0 h-16 flex items-center justify-center border-r">
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

      {/* Scrollable Grid */}
      <div className="flex-1 overflow-auto">
        <div className="flex min-h-full">
          {/* Time column */}
          <div className="w-16 flex-shrink-0 border-r">
            {hours.map((hour) => (
              <div
                key={hour}
                className="flex items-start justify-end pr-3 border-b"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="text-xs text-muted-foreground -mt-2">
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
                className={`flex-1 relative border-l ${isSelected ? 'bg-sky-50' : ''}`}
              >
                {/* Hour cells */}
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-b hover:bg-sky-100 transition-colors cursor-pointer"
                    style={{ height: HOUR_HEIGHT }}
                    onClick={() => handleCellClick(day, hour)}
                  />
                ))}

                {/* Events overlay */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {dayEvents.map((event) => {
                    const style = getEventStyle(event);
                    if (!style) return null;
                    const colors = typeColors[event.type] || typeColors.recovery;

                    return (
                      <div
                        key={event.id}
                        className={`
                          absolute left-1 right-1 rounded border overflow-hidden
                          pointer-events-auto cursor-pointer hover:shadow-md transition-shadow
                          ${colors.bg} ${colors.border} ${colors.text}
                        `}
                        style={{ top: style.top, height: style.height }}
                        onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                        title={event.title}
                      >
                        <div className="p-1 h-full">
                          <div className="flex items-center gap-1">
                            {event.is_anchor && <Lock className="w-3 h-3 flex-shrink-0" />}
                            <span className="text-xs font-medium truncate">{event.title}</span>
                          </div>
                          {style.height >= 36 && (
                            <span className="text-[10px] opacity-70">
                              {event.start_time?.substring(0, 5)}
                              {event.end_time && ` - ${event.end_time.substring(0, 5)}`}
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
