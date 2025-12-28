/**
 * Calendar API client
 * Connects to the calendar-api backend for workout events
 */

import { authenticatedFetch } from './authenticated-fetch';
import { API_URLS } from './config';

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
    const response = await authenticatedFetch(`${this.baseUrl}/calendar`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(event),
    });
    return this.handleResponse<WorkoutEvent>(response);
  }

  async updateEvent(eventId: string, event: UpdateWorkoutEvent): Promise<WorkoutEvent> {
    const response = await authenticatedFetch(`${this.baseUrl}/calendar/${eventId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(event),
    });
    return this.handleResponse<WorkoutEvent>(response);
  }

  async deleteEvent(eventId: string): Promise<void> {
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
    const response = await authenticatedFetch(
      `${this.baseUrl}/calendar/connected-calendars`,
      { headers: this.getHeaders() }
    );
    return this.handleResponse<ConnectedCalendar[]>(response);
  }

  async createConnectedCalendar(calendar: CreateConnectedCalendar): Promise<ConnectedCalendar> {
    const response = await authenticatedFetch(`${this.baseUrl}/calendar/connected-calendars`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(calendar),
    });
    return this.handleResponse<ConnectedCalendar>(response);
  }

  async deleteConnectedCalendar(calendarId: string): Promise<void> {
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
