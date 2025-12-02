import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Check,
  Menu,
  ChevronDown,
  ChevronUp,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { CalendarEvent, WorkoutType, WorkoutSource } from '../types/calendar';
import { MiniCalendar } from './calendar/MiniCalendar';
import { WeekView } from './calendar/WeekView';
import { EventDialogEnhanced } from './calendar/EventDialogEnhanced';
import { EventDrawer } from './calendar/EventDrawer';
import { SmartPlannerDrawer } from './calendar/SmartPlannerDrawer';
import { ConnectedCalendarsModal } from './calendar/ConnectedCalendarsModal';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, addMonths, subMonths, isSameDay, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { getEventsInRange, sampleCalendarEvents } from '../lib/calendar-mock-data';
import { toast } from 'sonner@2.0.3';

type ViewMode = 'week' | 'month' | 'list';

const CALENDAR_API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CALENDAR_API_BASE_URL) || 'http://localhost:8003';
const USE_MOCK_DATA = true;

const WORKOUT_FILTERS = [
  { id: 'amaka', label: 'AmakaFlow', color: 'bg-purple-500', sources: ['amaka'] },
  { id: 'class', label: 'Fitness Classes (Gym)', color: 'bg-green-500', sources: ['gym_class', 'gym_manual_sync'] },
  { id: 'garmin', label: 'Garmin', color: 'bg-orange-500', sources: ['garmin'] },
  { id: 'instagram', label: 'Social Media', color: 'bg-pink-500', sources: ['instagram', 'tiktok'] },
];

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventDialogData, setEventDialogData] = useState<{ date?: string; startTime?: string; source?: WorkoutSource } | null>(null);
  const [showEventDrawer, setShowEventDrawer] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMiniCalendar, setShowMiniCalendar] = useState(true);
  const [activeFilters, setActiveFilters] = useState<string[]>(WORKOUT_FILTERS.map(f => f.id));
  const [searchQuery, setSearchQuery] = useState('');
  const [showSmartPlanner, setShowSmartPlanner] = useState(false);
  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const [showConnectedCalendars, setShowConnectedCalendars] = useState(false);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });

  useEffect(() => {
    fetchEvents();
  }, [currentDate, viewMode]);

  useEffect(() => {
    if (showEventDialog) setNewDropdownOpen(false);
  }, [showEventDialog]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      let start: string, end: string;
      
      if (viewMode === 'month') {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        start = format(startOfWeek(monthStart, { weekStartsOn: 0 }), 'yyyy-MM-dd');
        end = format(endOfWeek(monthEnd, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      } else {
        start = format(weekStart, 'yyyy-MM-dd');
        end = format(weekEnd, 'yyyy-MM-dd');
      }

      if (USE_MOCK_DATA) {
        const mockEvents = getEventsInRange(start, end);
        setEvents(mockEvents);
      } else {
        const response = await fetch(
          `${CALENDAR_API_BASE_URL}/calendar?start=${start}&end=${end}`,
          { headers: { 'X-User-Id': 'demo-user-1' } }
        );
        if (response.ok) {
          const data = await response.json();
          setEvents(data.events || []);
        } else {
          setEvents([]);
        }
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevious = () => {
    if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setCurrentDate(date);
  };

  const handleCreateEvent = (data?: { date?: string; startTime?: string }) => {
    setEventDialogData(data || null);
    setSelectedEvent(null);
    setShowEventDialog(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setEventDialogData(null);
    setShowEventDialog(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowEventDrawer(true);
  };

  const handleSaveEvent = async (eventData: Partial<CalendarEvent>) => {
    try {
      const now = new Date().toISOString();
      if (selectedEvent) {
        setEvents(prev => prev.map(event => 
          event.id === selectedEvent.id ? { ...event, ...eventData, updated_at: now } as CalendarEvent : event
        ));
        toast.success('Event updated');
      } else {
        const newEvent: CalendarEvent = {
          id: `manual-${Date.now()}`,
          user_id: 'demo-user-1',
          status: 'planned',
          created_at: now,
          updated_at: now,
          ...eventData
        } as CalendarEvent;
        setEvents(prev => [...prev, newEvent]);
        toast.success('Event created');
      }
      setShowEventDialog(false);
      setSelectedEvent(null);
      setEventDialogData(null);
    } catch (error) {
      toast.error('Failed to save event');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    setEvents(prev => prev.filter(event => event.id !== eventId));
    setShowEventDrawer(false);
    setSelectedEvent(null);
    toast.success('Event deleted');
  };

  const handleSaveSmartPlannerWorkouts = async (workouts: any[]) => {
    const now = new Date().toISOString();
    const createdEvents: CalendarEvent[] = workouts.map((workout, index) => ({
      id: `smart-planner-${Date.now()}-${index}`,
      user_id: 'demo-user-1',
      title: workout.title,
      date: workout.date,
      start_time: workout.startTime,
      end_time: workout.endTime,
      type: workout.type === 'run' ? 'run' : 'strength',
      source: 'amaka',
      status: 'planned' as const,
      created_at: now,
      updated_at: now
    }));
    setEvents(prev => [...prev, ...createdEvents]);
    toast.success(`${workouts.length} workout${workouts.length > 1 ? 's' : ''} added`);
  };

  const getHeaderTitle = () => {
    if (viewMode === 'month') {
      return format(currentDate, 'MMMM yyyy');
    }
    return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className={`border-r border-gray-900 bg-[#f8f9fa] flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-64'}`}>
        {!sidebarCollapsed && (
          <>
            {showMiniCalendar && (
              <div className="p-4 pb-2">
                <MiniCalendar selectedDate={selectedDate} onSelectDate={handleDateSelect} events={events} />
                <div className="text-xs text-muted-foreground mt-2 text-center">{events.length} workouts scheduled</div>
                <Button variant="ghost" size="sm" className="w-full mt-1 text-xs" onClick={() => setShowMiniCalendar(false)}>
                  <ChevronUp className="w-3 h-3 mr-1" /> Hide Calendar
                </Button>
              </div>
            )}
            {!showMiniCalendar && (
              <div className="p-4 pb-2">
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowMiniCalendar(true)}>
                  <CalendarIcon className="w-3 h-3 mr-1" /> Show Calendar
                </Button>
              </div>
            )}
            <div className="px-4 pb-4">
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input 
                  type="text"
                  placeholder="Search workouts" 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="w-full ml-2 py-2 bg-transparent border-none outline-none text-sm placeholder:text-gray-400"
                />
              </div>
            </div>
            <hr className="border-t border-gray-900 w-full" />
            <ScrollArea className="flex-1">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">Workout Sources</h3>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  {WORKOUT_FILTERS.map(filter => {
                    const isActive = activeFilters.includes(filter.id);
                    const count = events.filter(e => filter.sources.includes(e.source)).length;
                    return (
                      <div key={filter.id} className="flex items-center gap-2">
                        <Checkbox
                          id={filter.id}
                          checked={isActive}
                          onCheckedChange={(checked) => {
                            if (checked) setActiveFilters([...activeFilters, filter.id]);
                            else setActiveFilters(activeFilters.filter(f => f !== filter.id));
                          }}
                        />
                        <label htmlFor={filter.id} className="flex items-center gap-2 cursor-pointer flex-1 text-sm">
                          <div className={`w-3 h-3 rounded-full ${filter.color}`} />
                          <span>{filter.label}</span>
                          <span className="text-xs text-muted-foreground ml-auto">{count}</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="border-b bg-card p-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
              <Menu className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday}>Today</Button>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={handlePrevious}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={handleNext}><ChevronRight className="w-4 h-4" /></Button>
            </div>
            <span className="text-sm font-medium">{getHeaderTitle()}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-md">
              <Button variant={viewMode === 'week' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('week')} className="rounded-r-none">Week</Button>
              <Button variant={viewMode === 'month' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('month')} className="rounded-none border-x">Month</Button>
              <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="rounded-l-none">List</Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowSmartPlanner(true)} className="gap-2">
              <Sparkles className="w-4 h-4" /> Smart Plan Week
            </Button>
            <DropdownMenu open={newDropdownOpen} onOpenChange={setNewDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="sm">
                  <Plus className="w-4 h-4 mr-2" /> New <ChevronDown className="w-4 h-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => { setEventDialogData({ date: format(selectedDate, 'yyyy-MM-dd') }); setShowEventDialog(true); setNewDropdownOpen(false); }}>
                  <Plus className="w-4 h-4 mr-2" /> Create Event
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setShowConnectedCalendars(true); setNewDropdownOpen(false); }}>
                  <CalendarIcon className="w-4 h-4 mr-2" /> Connected Calendars…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {viewMode === 'week' && (
            <WeekView weekStart={weekStart} events={events} selectedDate={selectedDate} onEventClick={handleEventClick} onTimeSlotClick={handleCreateEvent} loading={loading} />
          )}
          {viewMode === 'month' && (
            <MonthView currentDate={currentDate} selectedDate={selectedDate} events={events} onEventClick={handleEventClick} onDateClick={handleDateSelect} onCreateEvent={handleCreateEvent} />
          )}
          {viewMode === 'list' && (
            <ListView events={events} onEventClick={handleEventClick} />
          )}
        </div>
      </div>

      <EventDialogEnhanced open={showEventDialog} event={selectedEvent} defaultData={eventDialogData} onSave={handleSaveEvent} onClose={() => { setShowEventDialog(false); setSelectedEvent(null); setEventDialogData(null); }} />
      <EventDrawer open={showEventDrawer} event={selectedEvent} onEdit={handleEditEvent} onDelete={handleDeleteEvent} onClose={() => { setShowEventDrawer(false); setSelectedEvent(null); }} />
      <SmartPlannerDrawer open={showSmartPlanner} onClose={() => setShowSmartPlanner(false)} weekStart={weekStart} weekEnd={weekEnd} calendarEvents={events} onSaveWorkouts={handleSaveSmartPlannerWorkouts} />
      <ConnectedCalendarsModal open={showConnectedCalendars} onClose={() => setShowConnectedCalendars(false)} />
    </div>
  );
}

// ============================================================================
// MONTH VIEW - Using table for guaranteed grid layout
// ============================================================================
function MonthView({ 
  currentDate,
  selectedDate,
  events, 
  onEventClick,
  onDateClick,
  onCreateEvent
}: { 
  currentDate: Date;
  selectedDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
  onCreateEvent: (data: { date: string; startTime?: string }) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  // Build array of all days to display
  const allDays: Date[] = [];
  let currentDay = new Date(calendarStart);
  while (currentDay <= calendarEnd) {
    allDays.push(new Date(currentDay));
    currentDay.setDate(currentDay.getDate() + 1);
  }

  // Split into weeks
  const weeks: Date[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();

  const handleDayClick = (day: Date, e: React.MouseEvent) => {
    // If clicking on empty space, create new event
    const target = e.target as HTMLElement;
    if (target.tagName === 'TD' || target.closest('.day-content')) {
      onDateClick(day);
    }
  };

  const handleDoubleClick = (day: Date) => {
    onCreateEvent({ date: format(day, 'yyyy-MM-dd'), startTime: '09:00:00' });
  };

  return (
    <div className="h-full w-full flex flex-col">
      <table className="w-full flex-1 table-fixed border-collapse">
        <thead>
          <tr>
            {dayNames.map((name, idx) => (
              <th 
                key={name} 
                className={`py-3 text-center text-sm font-medium text-muted-foreground border-b ${idx > 0 ? 'border-l' : ''}`}
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, weekIdx) => (
            <tr key={weekIdx} style={{ height: `${100 / weeks.length}%` }}>
              {week.map((day, dayIdx) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayEvents = events.filter(e => e.date === dateStr);
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isToday = isSameDay(day, today);
                const isSelected = isSameDay(day, selectedDate);

                return (
                  <td
                    key={dateStr}
                    onClick={(e) => handleDayClick(day, e)}
                    onDoubleClick={() => handleDoubleClick(day)}
                    className={`
                      p-2 align-top cursor-pointer transition-colors border-b relative
                      ${dayIdx > 0 ? 'border-l' : ''}
                      ${!isCurrentMonth ? 'bg-gray-50/80' : 'bg-white'}
                      ${isSelected ? 'bg-sky-100' : ''}
                      hover:bg-sky-100
                    `}
                  >
                    <div className="day-content">
                      <div className="mb-1">
                        {isToday ? (
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                            {format(day, 'd')}
                          </span>
                        ) : (
                          <span className={`text-sm ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-900'}`}>
                            {format(day, 'd')}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 overflow-hidden">
                        {dayEvents.slice(0, 3).map(event => (
                          <div
                            key={event.id}
                            onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                            className={`text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${getEventColorClass(event.type)}`}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// LIST VIEW
// ============================================================================
function ListView({ events, onEventClick }: { events: CalendarEvent[]; onEventClick: (event: CalendarEvent) => void }) {
  const grouped = events.reduce((acc, event) => {
    if (!acc[event.date]) acc[event.date] = [];
    acc[event.date].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {Object.keys(grouped).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No events scheduled</p>
          </div>
        ) : (
          Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, dateEvents]) => (
              <div key={date} className="space-y-3">
                <h3 className="text-lg font-medium">{format(parseISO(date), 'EEEE, MMMM d, yyyy')}</h3>
                <div className="space-y-2">
                  {dateEvents.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')).map(event => (
                    <Card key={event.id} className="p-4 cursor-pointer hover:shadow-md" onClick={() => onEventClick(event)}>
                      <div className="flex items-start gap-4">
                        {event.start_time && <div className="text-sm text-muted-foreground min-w-[60px]">{event.start_time.substring(0, 5)}</div>}
                        <div className="flex-1">
                          <div className="font-medium">{event.title}</div>
                          <Badge variant="secondary" className="text-xs mt-1 capitalize">{event.type.replace('_', ' ')}</Badge>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))
        )}
      </div>
    </ScrollArea>
  );
}

function getEventColorClass(type: WorkoutType): string {
  const colors: Record<WorkoutType, string> = {
    run: 'bg-blue-100 text-blue-900',
    strength: 'bg-purple-100 text-purple-900',
    hyrox: 'bg-red-100 text-red-900',
    class: 'bg-green-100 text-green-900',
    home_workout: 'bg-yellow-100 text-yellow-900',
    mobility: 'bg-indigo-100 text-indigo-900',
    recovery: 'bg-gray-100 text-gray-900',
  };
  return colors[type] || colors.recovery;
}
