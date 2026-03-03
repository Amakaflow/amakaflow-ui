// @migration: Use src/api/clients/calendar.ts for new call sites.
/**
 * Calendar API client
 * Connects to the calendar-api backend for workout events
 */

import { API_URLS } from './config';
import * as calendarClient from '../api/clients/calendar';

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

  // ==========================================
  // WORKOUT EVENTS
  // ==========================================

  // Helper to validate date string is in YYYY-MM-DD format
  private isValidDateString(dateStr: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
  }

  // Helper to parse date string to Date object with validation
  private parseDate(dateStr: string): Date {
    const date = new Date(dateStr + 'T00:00:00');
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${dateStr}`);
    }
    return date;
  }

  async getEvents(start: string, end: string): Promise<WorkoutEvent[]> {
    if (!this.isValidDateString(start) || !this.isValidDateString(end)) {
      throw new Error('Invalid date parameters: start and end must be valid YYYY-MM-DD format date strings');
    }
    return calendarClient.getEvents(start, end);
  }

  async getEvent(eventId: string): Promise<WorkoutEvent> {
    return calendarClient.getEvent(eventId);
  }

  async createEvent(event: CreateWorkoutEvent): Promise<WorkoutEvent> {
    return calendarClient.createEvent(event);
  }

  async updateEvent(eventId: string, event: UpdateWorkoutEvent): Promise<WorkoutEvent> {
    return calendarClient.updateEvent(eventId, event);
  }

  async deleteEvent(eventId: string): Promise<void> {
    return calendarClient.deleteEvent(eventId);
  }

  // ==========================================
  // CONNECTED CALENDARS
  // ==========================================

  async getConnectedCalendars(): Promise<ConnectedCalendar[]> {
    return calendarClient.getConnectedCalendars();
  }

  async createConnectedCalendar(calendar: CreateConnectedCalendar): Promise<ConnectedCalendar> {
    return calendarClient.createConnectedCalendar(calendar);
  }

  async deleteConnectedCalendar(calendarId: string): Promise<void> {
    return calendarClient.deleteConnectedCalendar(calendarId);
  }

  async syncConnectedCalendar(calendarId: string) {
    return calendarClient.syncConnectedCalendar(calendarId);
  }
}

// Export singleton instance
export const calendarApi = new CalendarApiClient();

// Export class for testing
export { CalendarApiClient };
