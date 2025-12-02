/**
 * Calendar API Client
 * Interfaces with the calendar-api backend service
 */

import { CalendarEvent } from '../types/calendar';

const CALENDAR_API_BASE_URL = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CALENDAR_API_URL) || 
  'http://localhost:8003';

// API timeout in milliseconds
const API_TIMEOUT = 30000;

/**
 * Generic API call helper with timeout and error handling
 */
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
  userId: string
): Promise<T> {
  const url = `${CALENDAR_API_BASE_URL}${endpoint}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId,
        ...options.headers,
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: response.statusText,
      }));
      throw new Error(error.detail || `API error: ${response.status}`);
    }

    return response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

/**
 * Get calendar events within a date range
 */
export async function getCalendarEvents(
  userId: string,
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  return apiCall<CalendarEvent[]>(
    `/calendar?start=${startDate}&end=${endDate}`,
    { method: 'GET' },
    userId
  );
}

/**
 * Create a new calendar event
 */
export async function createCalendarEvent(
  userId: string,
  event: Omit<CalendarEvent, 'id' | 'user_id' | 'created_at' | 'updated_at'>
): Promise<CalendarEvent> {
  return apiCall<CalendarEvent>(
    '/calendar',
    {
      method: 'POST',
      body: JSON.stringify(event),
    },
    userId
  );
}

/**
 * Update an existing calendar event
 */
export async function updateCalendarEvent(
  userId: string,
  eventId: string,
  updates: Partial<CalendarEvent>
): Promise<CalendarEvent> {
  return apiCall<CalendarEvent>(
    `/calendar/${eventId}`,
    {
      method: 'PUT',
      body: JSON.stringify(updates),
    },
    userId
  );
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(
  userId: string,
  eventId: string
): Promise<{ success: boolean }> {
  return apiCall<{ success: boolean }>(
    `/calendar/${eventId}`,
    { method: 'DELETE' },
    userId
  );
}

/**
 * Check if calendar API is available
 */
export async function checkCalendarApiHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${CALENDAR_API_BASE_URL}/health`, {
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Bulk create calendar events (for Smart Planner)
 */
export async function bulkCreateCalendarEvents(
  userId: string,
  events: Array<Omit<CalendarEvent, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<CalendarEvent[]> {
  const results: CalendarEvent[] = [];
  
  for (const event of events) {
    try {
      const created = await createCalendarEvent(userId, event);
      results.push(created);
    } catch (error) {
      console.error('Failed to create event:', event.title, error);
    }
  }
  
  return results;
}
