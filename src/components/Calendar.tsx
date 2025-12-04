import { useState, useEffect, useMemo } from 'react';
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
  Dumbbell,
  Link as LinkIcon,
  Settings
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
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { useCalendarEvents, useConnectedCalendars } from '../hooks/useCalendarApi';
import { toast } from 'sonner';

type ViewMode = 'week' | 'month' | 'list';

// Base workout source filters (non-connected calendars)
const BASE_WORKOUT_FILTERS = [
  { id: 'amaka', label: 'AmakaFlow', color: 'bg-purple-500', sources: ['amaka'], subscribed: false },
  { id: 'class', label: 'Fitness Classes (Gym)', color: 'bg-green-500', sources: ['gym_class', 'gym_manual_sync'], subscribed: false },
  { id: 'garmin', label: 'Garmin', color: 'bg-orange-500', sources: ['garmin'], subscribed: false },
  { id: 'instagram', label: 'Social Media', color: 'bg-pink-500', sources: ['instagram', 'tiktok'], subscribed: false },
];

interface CalendarProps {
  userId: string;
}

export function Calendar({ userId }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventDialogData, setEventDialogData] = useState<{ date?: string; startTime?: string; source?: WorkoutSource } | null>(null);
  const [showEventDrawer, setShowEventDrawer] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showMiniCalendar, setShowMiniCalendar] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSmartPlanner, setShowSmartPlanner] = useState(false);
  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const [showConnectedCalendars, setShowConnectedCalendars] = useState(false);

  // Calculate week range
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });

  // Use calendar API hooks
  const { 
    events, 
    isLoading: loading, 
    error,
    refetch: fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent 
  } = useCalendarEvents({
    start: format(weekStart, 'yyyy-MM-dd'),
    end: format(weekEnd, 'yyyy-MM-dd'),
    userId,
    enabled: !!userId,
  });

  const { 
    calendars: connectedCalendars,
    createCalendar,
    deleteCalendar 
  } = useConnectedCalendars({ userId });

  // Build dynamic workout filters from base filters + connected calendars
  const connectedCalendarFilters = useMemo(() => 
    (connectedCalendars || [])
      .filter(cal => cal.is_workout_calendar)
      .map(cal => ({
        id: `connected-${cal.id}`,
        label: cal.name,
        color: cal.type === 'runna' ? 'bg-blue-500' : cal.type === 'apple' ? 'bg-gray-500' : 'bg-indigo-500',
        sources: ['connected_calendar'],
        connectedCalendarId: cal.id,
        subscribed: true,
        isConnectedCalendar: true
      })),
    [connectedCalendars]
  );

  const WORKOUT_FILTERS = useMemo(() => 
    [...BASE_WORKOUT_FILTERS, ...connectedCalendarFilters],
    [connectedCalendarFilters]
  );

  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Initialize active filters when WORKOUT_FILTERS changes
  useEffect(() => {
    setActiveFilters(WORKOUT_FILTERS.map(f => f.id));
  }, [WORKOUT_FILTERS]);

  // Force close dropdown when dialog opens
  useEffect(() => {
    if (showEventDialog) {
      setNewDropdownOpen(false);
    }
  }, [showEventDialog]);

  const handlePreviousWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
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
      if (selectedEvent) {
        await updateEvent(selectedEvent.id, eventData);
        toast.success('Event updated successfully');
      } else {
        await createEvent({
          title: eventData.title || 'Untitled',
          date: eventData.date || format(new Date(), 'yyyy-MM-dd'),
          source: eventData.source || 'manual',
          type: eventData.type,
          start_time: eventData.start_time,
          end_time: eventData.end_time,
          status: eventData.status || 'planned',
          is_anchor: eventData.is_anchor || false,
          primary_muscle: eventData.primary_muscle,
          intensity: eventData.intensity,
          json_payload: eventData.json_payload,
        });
        toast.success('Event created successfully');
      }
      
      setShowEventDialog(false);
      setSelectedEvent(null);
      setEventDialogData(null);
    } catch (error) {
      console.error('Error saving event:', error);
      toast.error('Failed to save event');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteEvent(eventId);
      setShowEventDrawer(false);
      setSelectedEvent(null);
      toast.success('Event deleted successfully');
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    }
  };

  const handleSaveSmartPlannerWorkouts = async (workouts: any[]) => {
    try {
      for (const workout of workouts) {
        await createEvent({
          title: workout.title,
          date: workout.date,
          start_time: workout.startTime,
          end_time: workout.endTime,
          type: mapWorkoutTypeToCalendarType(workout.type),
          source: 'smart_planner',
          status: 'planned',
          json_payload: {
            smartPlanner: true,
            reason: workout.reason,
          }
        });
      }
      
      toast.success(`${workouts.length} workout${workouts.length > 1 ? 's' : ''} added to calendar`);
    } catch (error) {
      console.error('Error saving Smart Planner workouts:', error);
      toast.error('Failed to save workouts');
    }
  };

  const mapWorkoutTypeToCalendarType = (type: string): WorkoutType => {
    const typeMap: Record<string, WorkoutType> = {
      'run': 'run',
      'strength-lower': 'strength',
      'strength-upper': 'strength',
      'strength': 'strength',
      'hyrox': 'hyrox',
      'ride': 'recovery',
      'core': 'strength',
      'mobility': 'mobility',
      'optional': 'recovery'
    };
    return typeMap[type] || 'strength';
  };

  // Cast events to CalendarEvent type for compatibility
  const typedEvents = events as unknown as CalendarEvent[];

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Sidebar */}
      <div className={`border-r border-border bg-[#f8f9fa] flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-64'}`}>
        {!sidebarCollapsed && (
          <>
            {showMiniCalendar && (
              <div className="p-4 pb-2">
                <MiniCalendar
                  selectedDate={selectedDate}
                  onSelectDate={handleDateSelect}
                  events={typedEvents}
                />
                <div className="text-xs text-muted-foreground mt-2 text-center">
                  {events.length} workouts scheduled
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-1 text-xs" onClick={() => setShowMiniCalendar(false)}>
                  <ChevronUp className="w-3 h-3 mr-1" />
                  Hide Calendar
                </Button>
              </div>
            )}

            {!showMiniCalendar && (
              <div className="p-4 pb-2">
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowMiniCalendar(true)}>
                  <CalendarIcon className="w-3 h-3 mr-1" />
                  Show Calendar
                </Button>
              </div>
            )}

            <div className="px-4 pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search workouts" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
            </div>

            <div className="border-t" />

            <ScrollArea className="flex-1">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">Workout Sources</h3>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  {WORKOUT_FILTERS.map(filter => {
                    const isActive = activeFilters.includes(filter.id);
                    const filterEvents = typedEvents.filter(e => {
                      if ((filter as any).isConnectedCalendar) {
                        return e.source === 'connected_calendar' && e.connected_calendar_id === (filter as any).connectedCalendarId;
                      }
                      return filter.sources.includes(e.source);
                    });
                    
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
                          <span className="flex items-center gap-1">
                            {filter.label}
                            {filter.subscribed && <LinkIcon className="w-3 h-3 text-blue-600" />}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">{filterEvents.length}</span>
                        </label>
                        {(filter as any).isConnectedCalendar && (
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowConnectedCalendars(true)}>
                            <Settings className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          </>
        )}
      </div>

      {/* Main Calendar View */}
      <div className="flex-1 flex flex-col">
        <div className="border-b bg-card p-4 flex items-center justify-between sticky top-0 z-40 flex-shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
              <Menu className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday}>Today</Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handlePreviousWeek}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={handleNextWeek}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-md">
              <Button variant={viewMode === 'week' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('week')} className="rounded-r-none">Week</Button>
              <Button variant={viewMode === 'month' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('month')} className="rounded-none border-x">Month</Button>
              <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="rounded-l-none">List</Button>
            </div>

            <Button variant="ghost" size="sm" onClick={() => setShowSmartPlanner(true)} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Smart Plan Week
            </Button>

            <DropdownMenu open={newDropdownOpen} onOpenChange={setNewDropdownOpen} modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="sm">
                  <Plus className="w-4 h-4 mr-2" />New<ChevronDown className="w-4 h-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => { setEventDialogData({ date: format(selectedDate, 'yyyy-MM-dd') }); setShowEventDialog(true); setNewDropdownOpen(false); }}>
                  <Plus className="w-4 h-4 mr-2" />Create Manual Event
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setEventDialogData({ date: format(selectedDate, 'yyyy-MM-dd'), source: 'gym_manual_sync' }); setShowEventDialog(true); setNewDropdownOpen(false); }}>
                  <Dumbbell className="w-4 h-4 mr-2" />Add from Gym
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setShowConnectedCalendars(true); setNewDropdownOpen(false); }}>
                  <CalendarIcon className="w-4 h-4 mr-2" />Add from Connected Calendar…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {viewMode === 'week' && (
            <WeekView weekStart={weekStart} events={typedEvents} selectedDate={selectedDate} onEventClick={handleEventClick} onTimeSlotClick={handleCreateEvent} loading={loading} />
          )}
          {viewMode === 'month' && (
            <MonthView currentDate={currentDate} events={typedEvents} onEventClick={handleEventClick} onDateClick={handleDateSelect} onCreateEvent={handleCreateEvent} />
          )}
          {viewMode === 'list' && (
            <ListView events={typedEvents} onEventClick={handleEventClick} />
          )}
        </div>
      </div>

      <EventDialogEnhanced open={showEventDialog} event={selectedEvent} defaultData={eventDialogData} onSave={handleSaveEvent} onClose={() => { setShowEventDialog(false); setSelectedEvent(null); setEventDialogData(null); }} />
      <EventDrawer open={showEventDrawer} event={selectedEvent} onEdit={handleEditEvent} onDelete={handleDeleteEvent} onClose={() => { setShowEventDrawer(false); setSelectedEvent(null); }} />
      <SmartPlannerDrawer open={showSmartPlanner} onClose={() => setShowSmartPlanner(false)} weekStart={weekStart} weekEnd={weekEnd} calendarEvents={typedEvents} onSaveWorkouts={handleSaveSmartPlannerWorkouts} userId={userId} />
      <ConnectedCalendarsModal open={showConnectedCalendars} onClose={() => setShowConnectedCalendars(false)} />
    </div>
  );
}

// Month View Component
function MonthView({ currentDate, events, onEventClick, onDateClick, onCreateEvent }: { 
  currentDate: Date; events: CalendarEvent[]; onEventClick: (event: CalendarEvent) => void; onDateClick: (date: Date) => void; onCreateEvent: (data?: { date?: string }) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = [];
  let day = startDate;
  while (day <= endDate) { days.push(day); day = new Date(day.getTime() + 24 * 60 * 60 * 1000); }

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-7 border-b">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="p-2 text-center text-sm text-muted-foreground border-r last:border-r-0">{d}</div>
        ))}
      </div>
      <div className="flex-1 grid grid-cols-7 overflow-auto">
        {days.map((day, idx) => {
          const dayEvents = events.filter(e => e.date === format(day, 'yyyy-MM-dd'));
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isToday = isSameDay(day, new Date());

          return (
            <div key={idx} className={`border-r border-b p-2 cursor-pointer hover:bg-accent transition-colors min-h-[100px] relative group ${!isCurrentMonth ? 'bg-muted/30' : ''}`}>
              <div className={`text-sm mb-1 ${isToday ? 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center' : ''}`}>
                {format(day, 'd')}
              </div>
              <button onClick={(e) => { e.stopPropagation(); onCreateEvent({ date: format(day, 'yyyy-MM-dd') }); }} className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-primary-foreground rounded-full p-1">
                <Plus className="w-3 h-3" />
              </button>
              <div className="space-y-1" onClick={() => onDateClick(day)}>
                {dayEvents.slice(0, 3).map(event => (
                  <div key={event.id} onClick={(e) => { e.stopPropagation(); onEventClick(event); }} className={`text-xs p-1 rounded truncate ${getEventColorClass(event.type)}`}>
                    {event.is_anchor && <span className="text-[10px]">🔒</span>}
                    {event.start_time && `${event.start_time.substring(0, 5)} `}{event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && <div className="text-xs text-muted-foreground">+{dayEvents.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// List View Component  
function ListView({ events, onEventClick }: { events: CalendarEvent[]; onEventClick: (event: CalendarEvent) => void }) {
  const groupedEvents = events.reduce((acc, event) => {
    if (!acc[event.date]) acc[event.date] = [];
    acc[event.date].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {Object.entries(groupedEvents).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No events scheduled</p>
          </div>
        ) : (
          Object.entries(groupedEvents).sort(([a], [b]) => a.localeCompare(b)).map(([date, dateEvents]) => (
            <div key={date} className="space-y-3">
              <div className="flex items-baseline gap-2">
                <h3 className="text-lg font-medium">{format(parseISO(date), 'EEEE, MMMM d, yyyy')}</h3>
                <Badge variant="secondary">{dateEvents.length} events</Badge>
              </div>
              <div className="space-y-2">
                {dateEvents.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')).map(event => (
                  <Card key={event.id} className="p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onEventClick(event)}>
                    <div className="flex items-start gap-4">
                      {event.start_time && <div className="text-sm text-muted-foreground min-w-[60px]">{event.start_time.substring(0, 5)}</div>}
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-2">{event.title}{event.is_anchor && <span>🔒</span>}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs capitalize">{event.type?.replace('_', ' ') || 'workout'}</Badge>
                          <Badge variant="outline" className="text-xs capitalize">{event.source?.replace('_', ' ') || 'manual'}</Badge>
                          {event.status === 'completed' && <Badge className="text-xs bg-green-600"><Check className="w-3 h-3 mr-1" />Completed</Badge>}
                        </div>
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

function getEventColorClass(type?: WorkoutType): string {
  if (!type) return 'bg-gray-100 border-gray-300 text-gray-900';
  const colors: Record<WorkoutType, string> = {
    run: 'bg-blue-100 border-blue-300 text-blue-900',
    strength: 'bg-purple-100 border-purple-300 text-purple-900',
    hyrox: 'bg-red-100 border-red-300 text-red-900',
    class: 'bg-green-100 border-green-300 text-green-900',
    home_workout: 'bg-yellow-100 border-yellow-300 text-yellow-900',
    mobility: 'bg-indigo-100 border-indigo-300 text-indigo-900',
    recovery: 'bg-gray-100 border-gray-300 text-gray-900',
  };
  return colors[type] || colors.recovery;
}
