/**
 * React hooks for calendar API
 * Provides data fetching, caching, and mutations for calendar events
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  calendarApi, 
  WorkoutEvent, 
  CreateWorkoutEvent, 
  UpdateWorkoutEvent,
  ConnectedCalendar,
  CreateConnectedCalendar 
} from '../lib/calendar-api';

// ==========================================
// CALENDAR EVENTS HOOK
// ==========================================

interface UseCalendarEventsOptions {
  start: string;
  end: string;
  userId: string;
  enabled?: boolean;
}

interface UseCalendarEventsResult {
  events: WorkoutEvent[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createEvent: (event: CreateWorkoutEvent) => Promise<WorkoutEvent>;
  updateEvent: (eventId: string, event: UpdateWorkoutEvent) => Promise<WorkoutEvent>;
  deleteEvent: (eventId: string) => Promise<void>;
}

export function useCalendarEvents({ 
  start, 
  end, 
  userId,
  enabled = true 
}: UseCalendarEventsOptions): UseCalendarEventsResult {
  const [events, setEvents] = useState<WorkoutEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Set user ID when available
  useEffect(() => {
    if (userId) {
      calendarApi.setUserId(userId);
    }
  }, [userId]);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    if (!userId || !enabled) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await calendarApi.getEvents(start, end);
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch events'));
      console.error('Failed to fetch calendar events:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, start, end, enabled]);

  // Initial fetch and refetch on date range change
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Create event
  const createEvent = useCallback(async (event: CreateWorkoutEvent): Promise<WorkoutEvent> => {
    const newEvent = await calendarApi.createEvent(event);
    setEvents(prev => [...prev, newEvent].sort((a, b) => 
      a.date.localeCompare(b.date) || (a.start_time || '').localeCompare(b.start_time || '')
    ));
    return newEvent;
  }, []);

  // Update event
  const updateEvent = useCallback(async (eventId: string, event: UpdateWorkoutEvent): Promise<WorkoutEvent> => {
    const updated = await calendarApi.updateEvent(eventId, event);
    setEvents(prev => prev.map(e => e.id === eventId ? updated : e));
    return updated;
  }, []);

  // Delete event
  const deleteEvent = useCallback(async (eventId: string): Promise<void> => {
    await calendarApi.deleteEvent(eventId);
    setEvents(prev => prev.filter(e => e.id !== eventId));
  }, []);

  return {
    events,
    isLoading,
    error,
    refetch: fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}

// ==========================================
// CONNECTED CALENDARS HOOK
// ==========================================

interface UseConnectedCalendarsOptions {
  userId: string;
}

interface UseConnectedCalendarsResult {
  calendars: ConnectedCalendar[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createCalendar: (calendar: CreateConnectedCalendar) => Promise<ConnectedCalendar>;
  deleteCalendar: (calendarId: string) => Promise<void>;
}

export function useConnectedCalendars({ userId }: UseConnectedCalendarsOptions): UseConnectedCalendarsResult {
  const [calendars, setCalendars] = useState<ConnectedCalendar[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Set user ID when available
  useEffect(() => {
    if (userId) {
      calendarApi.setUserId(userId);
    }
  }, [userId]);

  // Fetch calendars
  const fetchCalendars = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await calendarApi.getConnectedCalendars();
      setCalendars(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch calendars'));
      console.error('Failed to fetch connected calendars:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Initial fetch
  useEffect(() => {
    fetchCalendars();
  }, [fetchCalendars]);

  // Create calendar
  const createCalendar = useCallback(async (calendar: CreateConnectedCalendar): Promise<ConnectedCalendar> => {
    const newCalendar = await calendarApi.createConnectedCalendar(calendar);
    setCalendars(prev => [...prev, newCalendar]);
    return newCalendar;
  }, []);

  // Delete calendar
  const deleteCalendar = useCallback(async (calendarId: string): Promise<void> => {
    await calendarApi.deleteConnectedCalendar(calendarId);
    setCalendars(prev => prev.filter(c => c.id !== calendarId));
  }, []);

  return {
    calendars,
    isLoading,
    error,
    refetch: fetchCalendars,
    createCalendar,
    deleteCalendar,
  };
}
