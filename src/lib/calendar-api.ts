/**
 * Calendar API client
 * Connects to the calendar-api backend for workout events
 */

import { authenticatedFetch } from './authenticated-fetch';
import { API_URLS } from './config';
import { isDemoMode } from './demo-mode';
import { sampleCalendarEvents, mockConnectedCalendars } from './calendar-mock-data';

// Rebase demo events to the current week so the calendar shows populated data
function rebaseDemoEvents(events: typeof sampleCalendarEvents): typeof sampleCalendarEvents {
  if (events.length === 0) return events;
  // Find the earliest date in the sample data
  const dates = events.map((e) => e.date).sort();
  const originDate = new Date(dates[0] + 'T00:00:00');
  // Anchor to the most recent Sunday (start of current week)
  const today = new Date();
  const daysSinceSunday = today.getDay(); // 0 = Sunday
  const currentWeekSunday = new Date(today);
  currentWeekSunday.setDate(today.getDate() - daysSinceSunday);
  currentWeekSunday.setHours(0, 0, 0, 0);
  const offsetMs = currentWeekSunday.getTime() - originDate.getTime();
  const offsetDays = Math.round(offsetMs / (1000 * 60 * 60 * 24));
  return events.map((e) => {
    const d = new Date(e.date + 'T00:00:00');
    d.setDate(d.getDate() + offsetDays);
    const rebased = d.toISOString().slice(0, 10);
    return { ...e, date: rebased };
  });
}

const DEMO_CALENDAR_EVENTS = rebaseDemoEvents(sampleCalendarEvents);

// Use centralized API config
const API_BASE_URL = API_URLS.CALENDAR;

// Types matching the API schemas
export interface WorkoutEvent {
  id: string;
  user_id: string;
  title: string;
  date: string; // YYYY-MM-DD
  source: string;
  type?: string;
  start_time?: string;
  end_time?: string;
  status: 'planned' | 'completed';
  is_anchor: boolean;
  primary_muscle?: string;
  intensity?: number;
  connected_calendar_id?: string;
  connected_calendar_type?: string;
  external_event_url?: string;
  recurrence_rule?: string;
  json_payload?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface CreateWorkoutEvent {
  title: string;
  date: string;
  source?: string;
  type?: string;
  start_time?: string;
  end_time?: string;
  status?: 'planned' | 'completed';
  is_anchor?: boolean;
  primary_muscle?: string;
  intensity?: number;
  connected_calendar_id?: string;
  connected_calendar_type?: string;
  external_event_url?: string;
  recurrence_rule?: string;
  json_payload?: Record<string, any>;
}

export interface UpdateWorkoutEvent {
  title?: string;
  date?: string;
  source?: string;
  type?: string;
  start_time?: string;
  end_time?: string;
  status?: 'planned' | 'completed';
  is_anchor?: boolean;
  primary_muscle?: string;
  intensity?: number;
  connected_calendar_id?: string;
  connected_calendar_type?: string;
  external_event_url?: string;
  recurrence_rule?: string;
  json_payload?: Record<string, any>;
}

export interface ConnectedCalendar {
  id: string;
  user_id: string;
  name: string;
  type: 'runna' | 'apple' | 'google' | 'outlook' | 'ics_custom';
  integration_type: 'ics_url' | 'oauth' | 'os_integration';
  is_workout_calendar: boolean;
  ics_url?: string;
  last_sync?: string;
  sync_status: 'active' | 'error' | 'paused';
  sync_error_message?: string;
  color?: string;
  workouts_this_week: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateConnectedCalendar {
  name: string;
  type: 'runna' | 'apple' | 'google' | 'outlook' | 'ics_custom';
  integration_type: 'ics_url' | 'oauth' | 'os_integration';
  is_workout_calendar?: boolean;
  ics_url?: string;
  color?: string;
}

class CalendarApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * @deprecated setUserId is no longer needed - user is identified via JWT
   */
  setUserId(_userId: string) {
    // No-op: user ID is now extracted from JWT on the backend
  }

  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `API error: ${response.status}`);
    }
    return response.json();
  }

  // ==========================================
  // WORKOUT EVENTS
  // ==========================================

  async getEvents(start: string, end: string): Promise<WorkoutEvent[]> {
    if (isDemoMode) return DEMO_CALENDAR_EVENTS as any;
    const response = await authenticatedFetch(
      `${this.baseUrl}/calendar?start=${start}&end=${end}`,
      { headers: this.getHeaders() }
    );
    return this.handleResponse<WorkoutEvent[]>(response);
  }

  async getEvent(eventId: string): Promise<WorkoutEvent> {
    const response = await authenticatedFetch(
      `${this.baseUrl}/calendar/${eventId}`,
      { headers: this.getHeaders() }
    );
    return this.handleResponse<WorkoutEvent>(response);
  }

  async createEvent(event: CreateWorkoutEvent): Promise<WorkoutEvent> {
    if (isDemoMode) { console.log('[demo] calendar write skipped'); return null as any; }
    const response = await authenticatedFetch(`${this.baseUrl}/calendar`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(event),
    });
    return this.handleResponse<WorkoutEvent>(response);
  }

  async updateEvent(eventId: string, event: UpdateWorkoutEvent): Promise<WorkoutEvent> {
    if (isDemoMode) { console.log('[demo] calendar write skipped'); return null as any; }
    const response = await authenticatedFetch(`${this.baseUrl}/calendar/${eventId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(event),
    });
    return this.handleResponse<WorkoutEvent>(response);
  }

  async deleteEvent(eventId: string): Promise<void> {
    if (isDemoMode) { console.log('[demo] calendar write skipped'); return; }
    const response = await authenticatedFetch(`${this.baseUrl}/calendar/${eventId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `API error: ${response.status}`);
    }
  }

  // ==========================================
  // CONNECTED CALENDARS
  // ==========================================

  async getConnectedCalendars(): Promise<ConnectedCalendar[]> {
    if (isDemoMode) return mockConnectedCalendars as any;
    const response = await authenticatedFetch(
      `${this.baseUrl}/calendar/connected-calendars`,
      { headers: this.getHeaders() }
    );
    return this.handleResponse<ConnectedCalendar[]>(response);
  }

  async createConnectedCalendar(calendar: CreateConnectedCalendar): Promise<ConnectedCalendar> {
    if (isDemoMode) { console.log('[demo] calendar write skipped'); return null as any; }
    const response = await authenticatedFetch(`${this.baseUrl}/calendar/connected-calendars`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(calendar),
    });
    return this.handleResponse<ConnectedCalendar>(response);
  }

  async deleteConnectedCalendar(calendarId: string): Promise<void> {
    if (isDemoMode) { console.log('[demo] calendar write skipped'); return; }
    const response = await authenticatedFetch(`${this.baseUrl}/calendar/connected-calendars/${calendarId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `API error: ${response.status}`);
    }
  }

  async syncConnectedCalendar(calendarId: string): Promise<{
    success: boolean;
    events_created: number;
    events_updated: number;
    total_events: number;
  }> {
    if (isDemoMode) { console.log('[demo] calendar write skipped'); return null as any; }
    const response = await authenticatedFetch(
      `${this.baseUrl}/calendar/connected-calendars/${calendarId}/sync`,
      {
        method: 'POST',
        headers: this.getHeaders(),
      }
    );
    return this.handleResponse<{
      success: boolean;
      events_created: number;
      events_updated: number;
      total_events: number;
    }>(response);
  }
}

// Export singleton instance
export const calendarApi = new CalendarApiClient();

// Export class for testing
export { CalendarApiClient };
