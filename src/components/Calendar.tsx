import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
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
import { GymEventModal } from './calendar/GymEventModal';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { useCalendarEvents, useConnectedCalendars } from '../hooks/useCalendarApi';
import { useWorkoutSources } from '../hooks/useWorkoutSources';
import { TrainingWeekView } from './calendar/TrainingWeekView';
import { isDemoMode } from '../lib/demo-mode';
import { toast } from 'sonner';

type ViewMode = 'week' | 'month' | 'list' | 'training';


interface CalendarProps {
  userId: string;
  userLocation?: {
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

export function Calendar({ userId, userLocation }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(isDemoMode ? 'training' : 'week');
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [eventDialogData, setEventDialogData] = useState<{ date?: string; startTime?: string; source?: WorkoutSource } | null>(null);
  const [showEventDrawer, setShowEventDrawer] = useState(false);
  // Collapse sidebar by default on tablet and below (screen narrower than 1024px)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    typeof window !== 'undefined' && window.innerWidth < 1024
  );
  const [showMiniCalendar, setShowMiniCalendar] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSmartPlanner, setShowSmartPlanner] = useState(false);
  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const [showConnectedCalendars, setShowConnectedCalendars] = useState(false);
  const [showGymEventModal, setShowGymEventModal] = useState(false);

  // Calculate date range based on view mode
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);

  // Use the appropriate range based on view mode
  // List view shows 4 weeks ahead for an "upcoming" experience
  const listEnd = endOfWeek(addWeeks(currentDate, 3), { weekStartsOn: 0 });
  const rangeStart = viewMode === 'month' ? monthStart : weekStart;
  const rangeEnd = viewMode === 'month' ? monthEnd : viewMode === 'list' ? listEnd : weekEnd;

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
    start: format(rangeStart, 'yyyy-MM-dd'),
    end: format(rangeEnd, 'yyyy-MM-dd'),
    userId,
    enabled: !!userId,
  });

  const {
    calendars: connectedCalendars,
    createCalendar,
    deleteCalendar,
    syncCalendar
  } = useConnectedCalendars({ userId });

  const { sources: workoutSources, ready: sourcesReady } = useWorkoutSources({ userId });

  const initialisedRef = useRef(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Seed all sources as active once, but only after async data (connected calendars) has loaded
  useEffect(() => {
    if (initialisedRef.current) return;
    if (!sourcesReady) return;
    initialisedRef.current = true;
    setActiveFilters(workoutSources.map(s => s.connectionId ?? s.id));
  }, [workoutSources, sourcesReady]);

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
    // Open GymEventModal for gym events, regular dialog for others
    if (event.source === 'gym_manual_sync') {
      setShowEventDrawer(false); // Close the drawer first
      setShowGymEventModal(true);
    } else {
      setShowEventDialog(true);
    }
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
          recurrence_rule: eventData.recurrence_rule,
          json_payload: eventData.json_payload,
        });
        toast.success('Event created successfully');
      }

      setShowEventDialog(false);
      setShowGymEventModal(false);
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

  // Compute source event counts — only show sources with actual events
  const sourcesWithCounts = workoutSources
    .map(source => {
      const filterId = source.connectionId ?? source.id;
      const eventCount = typedEvents.filter(e => {
        if (source.connectionId) {
          return e.source === 'connected_calendar' && e.connected_calendar_id === source.connectionId;
        }
        return source.matchesSources.includes(e.source);
      }).length;
      return { source, filterId, eventCount };
    })
    .filter(({ eventCount }) => eventCount > 0);

  const filteredEvents = typedEvents.filter(event => {
    if (activeFilters.length === 0) return true;
    return workoutSources
      .filter(s => activeFilters.includes(s.connectionId ?? s.id))
      .some(s => {
        if (s.connectionId) {
          return event.source === 'connected_calendar' && event.connected_calendar_id === s.connectionId;
        }
        return s.matchesSources.includes(event.source);
      });
  });

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* Sidebar */}
      <div className={`border-r border-border bg-muted/50 flex-col transition-all duration-300 hidden md:flex ${sidebarCollapsed ? 'md:w-0 md:overflow-hidden' : 'w-52 lg:w-64'}`}>
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
                <Input placeholder="Search workouts" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 min-h-[44px]" />
              </div>
            </div>

            <div className="border-t" />

            <ScrollArea className="flex-1">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">Sources</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => setShowConnectedCalendars(true)}
                  >
                    <Settings className="w-3 h-3 mr-1" />
                    Manage
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sourcesWithCounts.map(({ source, filterId, eventCount }) => {
                    const isActive = activeFilters.includes(filterId);
                    return (
                      <button
                        key={filterId}
                        onClick={() => {
                          if (isActive) setActiveFilters(activeFilters.filter(f => f !== filterId));
                          else setActiveFilters([...activeFilters, filterId]);
                        }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all min-h-[32px] border ${
                          isActive
                            ? 'bg-primary/10 border-primary/30 text-foreground'
                            : 'bg-muted/30 border-transparent text-muted-foreground opacity-50'
                        }`}
                      >
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${source.color}`} />
                        {source.label}
                        <span className="text-[10px] opacity-70">{eventCount}</span>
                      </button>
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
        <div className="border-b bg-card p-2 sm:p-4 flex flex-wrap items-center gap-2 sticky top-0 z-40 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="min-h-[44px] min-w-[44px] hidden md:flex" aria-label="Toggle sidebar">
              <Menu className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday} className="min-h-[44px]">Today</Button>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={handlePreviousWeek} className="min-h-[44px] min-w-[44px]" aria-label="Previous"><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={handleNextWeek} className="min-h-[44px] min-w-[44px]" aria-label="Next"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <div className="flex items-center border rounded-md overflow-hidden">
              <Button variant={viewMode === 'training' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('training')} className="rounded-r-none text-xs px-2 min-h-[44px] sm:min-h-0">Training</Button>
              <Button variant={viewMode === 'week' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('week')} className="rounded-none border-x text-xs px-2 min-h-[44px] sm:min-h-0">Week</Button>
              <Button variant={viewMode === 'month' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('month')} className="rounded-none border-x text-xs px-2 min-h-[44px] sm:min-h-0">Month</Button>
              <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="rounded-l-none text-xs px-2 min-h-[44px] sm:min-h-0">Upcoming</Button>
            </div>

            <Button variant="ghost" size="sm" onClick={() => setShowSmartPlanner(true)} className="gap-1 text-xs min-h-[44px] sm:min-h-0 hidden sm:flex">
              <Sparkles className="w-4 h-4" />
              Smart Plan Week
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowSmartPlanner(true)} className="sm:hidden min-h-[44px] min-w-[44px]" aria-label="Smart Planner">
              <Sparkles className="w-4 h-4" />
            </Button>

            <DropdownMenu open={newDropdownOpen} onOpenChange={setNewDropdownOpen} modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="sm" className="min-h-[44px] sm:min-h-0" aria-label="New event menu">
                  <Plus className="w-4 h-4 mr-1 sm:mr-2" /><span className="hidden sm:inline">New</span><ChevronDown className="w-4 h-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => { setEventDialogData({ date: format(selectedDate, 'yyyy-MM-dd') }); setShowEventDialog(true); setNewDropdownOpen(false); }}>
                  <Plus className="w-4 h-4 mr-2" />Create Manual Event
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setEventDialogData({ date: format(selectedDate, 'yyyy-MM-dd') }); setShowGymEventModal(true); setNewDropdownOpen(false); }}>
                  <Dumbbell className="w-4 h-4 mr-2" />Add Gym Event (Manual)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setShowConnectedCalendars(true); setNewDropdownOpen(false); }}>
                  <CalendarIcon className="w-4 h-4 mr-2" />Add from Connected Calendar…
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Filter chips bar — visible on mobile where sidebar is hidden */}
        {sourcesWithCounts.length > 0 && viewMode !== 'training' && (
          <div className="border-b bg-card/50 px-2 sm:px-4 py-2 flex items-center gap-2 overflow-x-auto md:hidden">
            <span className="text-xs text-muted-foreground flex-shrink-0">Filter:</span>
            {sourcesWithCounts.map(({ source, filterId, eventCount }) => {
              const isActive = activeFilters.includes(filterId);
              return (
                <button
                  key={filterId}
                  onClick={() => {
                    if (isActive) setActiveFilters(activeFilters.filter(f => f !== filterId));
                    else setActiveFilters([...activeFilters, filterId]);
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all flex-shrink-0 border ${
                    isActive
                      ? 'bg-primary/10 border-primary/30 text-foreground'
                      : 'bg-muted/30 border-transparent text-muted-foreground opacity-50'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${source.color}`} />
                  {source.label}
                  <span className="text-[10px] opacity-70">{eventCount}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          {viewMode === 'training' && (
            <TrainingWeekView />
          )}
          {viewMode === 'week' && (
            <WeekView weekStart={weekStart} events={filteredEvents} selectedDate={selectedDate} onEventClick={handleEventClick} onTimeSlotClick={handleCreateEvent} loading={loading} />
          )}
          {viewMode === 'month' && (
            <MonthView currentDate={currentDate} events={filteredEvents} onEventClick={handleEventClick} onDateClick={handleDateSelect} onCreateEvent={handleCreateEvent} />
          )}
          {viewMode === 'list' && (
            <ListView events={filteredEvents} onEventClick={handleEventClick} />
          )}
        </div>
      </div>

      <EventDialogEnhanced open={showEventDialog} event={selectedEvent} defaultData={eventDialogData} onSave={handleSaveEvent} onClose={() => { setShowEventDialog(false); setSelectedEvent(null); setEventDialogData(null); }} />
      <EventDrawer open={showEventDrawer} event={selectedEvent} onEdit={handleEditEvent} onDelete={handleDeleteEvent} onClose={() => { setShowEventDrawer(false); setSelectedEvent(null); }} />
      <SmartPlannerDrawer open={showSmartPlanner} onClose={() => setShowSmartPlanner(false)} weekStart={weekStart} weekEnd={weekEnd} calendarEvents={typedEvents} onSaveWorkouts={handleSaveSmartPlannerWorkouts} userId={userId} />
      <GymEventModal
        open={showGymEventModal}
        event={selectedEvent}
        defaultData={eventDialogData}
        onSave={handleSaveEvent}
        onClose={() => { setShowGymEventModal(false); setSelectedEvent(null); setEventDialogData(null); }}
        userLocation={userLocation}
      />
      <ConnectedCalendarsModal
        open={showConnectedCalendars}
        onClose={() => setShowConnectedCalendars(false)}
        calendars={connectedCalendars || []}
        onCreateCalendar={createCalendar}
        onDeleteCalendar={deleteCalendar}
        onSyncCalendar={async (calendarId: string) => {
          const result = await syncCalendar(calendarId);
          // Refetch events to show newly synced workouts
          await fetchEvents();
          return result;
        }}
      />
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

// Upcoming List View — shows events across 4 weeks
function ListView({ events, onEventClick }: { events: CalendarEvent[]; onEventClick: (event: CalendarEvent) => void }) {
  const today = format(new Date(), 'yyyy-MM-dd');

  // Group events by date, then sort
  const groupedEvents = events.reduce((acc, event) => {
    if (!acc[event.date]) acc[event.date] = [];
    acc[event.date].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  const sortedDates = Object.keys(groupedEvents).sort();

  // Group dates by week for section headers
  const weekGroups: { weekLabel: string; dates: string[] }[] = [];
  let currentWeekLabel = '';
  for (const date of sortedDates) {
    const d = parseISO(date);
    const ws = startOfWeek(d, { weekStartsOn: 0 });
    const we = endOfWeek(d, { weekStartsOn: 0 });
    const label = `${format(ws, 'MMM d')} – ${format(we, 'MMM d')}`;
    if (label !== currentWeekLabel) {
      weekGroups.push({ weekLabel: label, dates: [] });
      currentWeekLabel = label;
    }
    weekGroups[weekGroups.length - 1].dates.push(date);
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-lg font-semibold">Upcoming</h2>
          <Badge variant="secondary">{events.length} events</Badge>
        </div>

        {sortedDates.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CalendarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No upcoming events</p>
            <p className="text-sm mt-1">Add workouts to see them here</p>
          </div>
        ) : (
          weekGroups.map(({ weekLabel, dates }) => (
            <div key={weekLabel} className="space-y-3">
              <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm py-1">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{weekLabel}</h3>
              </div>
              {dates.map(date => {
                const dateEvents = groupedEvents[date];
                const isToday = date === today;
                const isPast = date < today;
                return (
                  <div key={date} className="space-y-1.5">
                    <div className={`flex items-center gap-2 ${isToday ? 'text-primary font-semibold' : isPast ? 'text-muted-foreground' : ''}`}>
                      <span className={`text-sm ${isToday ? 'bg-primary text-primary-foreground rounded-full px-2 py-0.5' : ''}`}>
                        {format(parseISO(date), 'EEE, MMM d')}
                      </span>
                      {isToday && <span className="text-xs text-primary">Today</span>}
                    </div>
                    {dateEvents.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')).map(event => (
                      <Card key={event.id} className={`p-3 cursor-pointer hover:shadow-md transition-shadow ${isPast && event.status !== 'completed' ? 'opacity-60' : ''}`} onClick={() => onEventClick(event)}>
                        <div className="flex items-center gap-3">
                          <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${getEventBarColor(event.type)}`} />
                          {event.start_time && <div className="text-sm text-muted-foreground min-w-[45px] font-mono">{event.start_time.substring(0, 5)}</div>}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm flex items-center gap-1.5 truncate">
                              {event.title}
                              {event.is_anchor && <span className="text-[10px]">📌</span>}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getEventChipStyle(event.type)}`}>
                                {event.type?.replace('_', ' ') || 'workout'}
                              </span>
                              <span className="text-[10px] text-muted-foreground">{event.source?.replace('_', ' ')}</span>
                            </div>
                          </div>
                          {event.status === 'completed' && (
                            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}

function getEventColorClass(type?: WorkoutType): string {
  if (!type) return 'bg-gray-100 border-gray-300 text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100';
  const colors: Record<WorkoutType, string> = {
    run: 'bg-blue-100 border-blue-300 text-blue-900 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-200',
    strength: 'bg-purple-100 border-purple-300 text-purple-900 dark:bg-purple-900/40 dark:border-purple-700 dark:text-purple-200',
    hyrox: 'bg-red-100 border-red-300 text-red-900 dark:bg-red-900/40 dark:border-red-700 dark:text-red-200',
    class: 'bg-green-100 border-green-300 text-green-900 dark:bg-green-900/40 dark:border-green-700 dark:text-green-200',
    home_workout: 'bg-yellow-100 border-yellow-300 text-yellow-900 dark:bg-yellow-900/40 dark:border-yellow-700 dark:text-yellow-200',
    mobility: 'bg-indigo-100 border-indigo-300 text-indigo-900 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-200',
    recovery: 'bg-gray-100 border-gray-300 text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100',
  };
  return colors[type] || colors.recovery;
}

function getEventBarColor(type?: WorkoutType): string {
  const colors: Record<string, string> = {
    run: 'bg-blue-500',
    strength: 'bg-purple-500',
    hyrox: 'bg-red-500',
    class: 'bg-green-500',
    home_workout: 'bg-yellow-500',
    mobility: 'bg-indigo-500',
    recovery: 'bg-gray-400',
  };
  return colors[type || ''] || 'bg-gray-400';
}

function getEventChipStyle(type?: WorkoutType): string {
  const styles: Record<string, string> = {
    run: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    strength: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
    hyrox: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    class: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
    home_workout: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
    mobility: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300',
    recovery: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  };
  return styles[type || ''] || styles.recovery;
}
