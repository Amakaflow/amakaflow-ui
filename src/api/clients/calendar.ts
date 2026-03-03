/**
 * Calendar API client — typed, validated, MSW-interceptable.
 * No isDemoMode branches here. Demo mode is handled by MSW handlers.
 */
import { authenticatedFetch } from '../../lib/authenticated-fetch';
import { API_URLS } from '../../lib/config';
import { WorkoutEventSchema, ConnectedCalendarSchema } from '../schemas/calendar';
import type {
  WorkoutEvent, ConnectedCalendar,
  CreateWorkoutEvent, UpdateWorkoutEvent,
  CreateConnectedCalendar, SyncResult,
} from '../generated/calendar';

const BASE = API_URLS.CALENDAR;

async function call<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...options.headers };
  const r = await authenticatedFetch(url, { ...options, headers });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `Calendar API error: ${r.status}`);
  }
  return r.json();
}

async function callVoid(url: string, options: RequestInit = {}): Promise<void> {
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...options.headers };
  const r = await authenticatedFetch(url, { ...options, headers });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `Calendar API error: ${r.status}`);
  }
}

export async function getEvents(start: string, end: string): Promise<WorkoutEvent[]> {
  const events = await call<WorkoutEvent[]>(`${BASE}/calendar?start=${start}&end=${end}`);
  return events.map(e => WorkoutEventSchema.parse(e));
}

export async function getEvent(eventId: string): Promise<WorkoutEvent> {
  const event = await call<WorkoutEvent>(`${BASE}/calendar/${eventId}`);
  return WorkoutEventSchema.parse(event);
}

export async function createEvent(event: CreateWorkoutEvent): Promise<WorkoutEvent> {
  const result = await call<WorkoutEvent>(`${BASE}/calendar`, {
    method: 'POST',
    body: JSON.stringify(event),
  });
  return WorkoutEventSchema.parse(result);
}

export async function updateEvent(eventId: string, event: UpdateWorkoutEvent): Promise<WorkoutEvent> {
  const result = await call<WorkoutEvent>(`${BASE}/calendar/${eventId}`, {
    method: 'PUT',
    body: JSON.stringify(event),
  });
  return WorkoutEventSchema.parse(result);
}

export async function deleteEvent(eventId: string): Promise<void> {
  return callVoid(`${BASE}/calendar/${eventId}`, { method: 'DELETE' });
}

export async function getConnectedCalendars(): Promise<ConnectedCalendar[]> {
  const calendars = await call<ConnectedCalendar[]>(`${BASE}/calendar/connected-calendars`);
  return calendars.map(c => ConnectedCalendarSchema.parse(c));
}

export async function createConnectedCalendar(calendar: CreateConnectedCalendar): Promise<ConnectedCalendar> {
  const result = await call<ConnectedCalendar>(`${BASE}/calendar/connected-calendars`, {
    method: 'POST',
    body: JSON.stringify(calendar),
  });
  return ConnectedCalendarSchema.parse(result);
}

export async function deleteConnectedCalendar(calendarId: string): Promise<void> {
  return callVoid(`${BASE}/calendar/connected-calendars/${calendarId}`, { method: 'DELETE' });
}

export async function syncConnectedCalendar(calendarId: string): Promise<SyncResult> {
  return call<SyncResult>(
    `${BASE}/calendar/connected-calendars/${calendarId}/sync`,
    { method: 'POST' }
  );
}
