import { http, HttpResponse } from 'msw';
import { API_URLS } from '../../../lib/config';
import { sampleCalendarEvents, mockConnectedCalendars } from '../../../lib/calendar-mock-data';

const BASE = API_URLS.CALENDAR;

function rebaseEventsToWeek(events: any[], start: string, end: string): any[] {
  if (!events.length) return [];
  const validEvents = events.filter(e => e?.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date));
  if (!validEvents.length) return [];

  const requestedStart = new Date(start + 'T00:00:00');
  const originDate = new Date(validEvents.map(e => e.date).sort()[0] + 'T00:00:00');
  const offsetDays = Math.round((requestedStart.getTime() - originDate.getTime()) / 86400000);

  return validEvents.map(e => {
    const d = new Date(e.date + 'T00:00:00');
    d.setDate(d.getDate() + offsetDays);
    return { ...e, date: d.toISOString().slice(0, 10) };
  });
}

// Augment mockConnectedCalendars with required API fields missing from the local type
const connectedCalendarsWithApiFields = mockConnectedCalendars.map(c => ({
  user_id: 'demo-user-1',
  workouts_this_week: 0,
  sync_status: 'active' as const,
  ...c,
}));

export const calendarHandlers = [
  http.get(`${BASE}/calendar`, ({ request }) => {
    const url = new URL(request.url);
    const start = url.searchParams.get('start') || '';
    const end = url.searchParams.get('end') || '';
    const rebased = rebaseEventsToWeek(sampleCalendarEvents as any[], start, end);
    const filtered = rebased.filter(e => e.date >= start && e.date <= end);
    return HttpResponse.json(filtered);
  }),

  http.get(`${BASE}/calendar/:id`, ({ params }) => {
    const event = (sampleCalendarEvents as any[]).find(e => e.id === params.id);
    if (!event) return HttpResponse.json({ detail: 'Not found' }, { status: 404 });
    return HttpResponse.json(event);
  }),

  http.post(`${BASE}/calendar`, async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      ...body,
      id: `demo-event-${Date.now()}`,
      user_id: 'demo-user-1',
      status: body.status || 'planned',
      is_anchor: body.is_anchor ?? false,
      source: body.source || 'manual',
    });
  }),

  http.put(`${BASE}/calendar/:id`, async ({ request, params }) => {
    const body = await request.json() as any;
    const existing = (sampleCalendarEvents as any[]).find(e => e.id === params.id);
    return HttpResponse.json({
      ...(existing || {}),
      ...body,
      id: params.id,
      user_id: 'demo-user-1',
    });
  }),

  http.delete(`${BASE}/calendar/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(`${BASE}/calendar/connected-calendars`, () => {
    return HttpResponse.json(connectedCalendarsWithApiFields);
  }),

  http.post(`${BASE}/calendar/connected-calendars`, async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      ...body,
      id: `demo-cal-${Date.now()}`,
      user_id: 'demo-user-1',
      sync_status: 'active',
      workouts_this_week: 0,
    });
  }),

  http.delete(`${BASE}/calendar/connected-calendars/:id`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${BASE}/calendar/connected-calendars/:id/sync`, () => {
    return HttpResponse.json({
      success: true,
      events_created: 0,
      events_updated: 0,
      total_events: 0,
    });
  }),
];
