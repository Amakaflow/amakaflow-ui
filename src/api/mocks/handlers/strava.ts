import { http, HttpResponse } from 'msw';
import { API_URLS } from '../../../lib/config';
import type { StravaActivity, AthleteResponse } from '../../generated/strava';

const BASE = API_URLS.STRAVA;

const mockAthleteResponse: AthleteResponse = {
  id: 12345678,
  username: 'demo_athlete',
  firstname: 'Demo',
  lastname: 'Athlete',
  profile_medium: '',
  profile: '',
};

const mockActivities: StravaActivity[] = [
  {
    id: 1001,
    name: 'Morning Run',
    start_date: new Date(Date.now() - 86400000).toISOString(),
    distance: 5000,
    elapsed_time: 1800,
    moving_time: 1750,
    type: 'Run',
    description: 'Easy morning run',
  },
];

export const stravaHandlers = [
  http.get(`${BASE}/strava/activities`, ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '5', 10);
    return HttpResponse.json(mockActivities.slice(0, limit));
  }),

  http.put(`${BASE}/strava/activities/:id`, async ({ request, params }) => {
    const body = await request.json() as any;
    const activity = mockActivities.find(a => a.id === Number(params.id)) || mockActivities[0];
    return HttpResponse.json({
      id: activity?.id || Number(params.id),
      name: body.newTitle || activity?.name || 'Demo Activity',
      description: body.description || activity?.description || '',
      updated_at: new Date().toISOString(),
    });
  }),

  http.post(`${BASE}/strava/activities`, async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      id: Date.now(),
      name: body.name,
      type: body.activity_type || 'Workout',
      start_date: body.start_date || new Date().toISOString(),
      elapsed_time: body.elapsed_time || 0,
      distance: body.distance || 0,
      description: body.description || '',
    });
  }),

  http.get(`${BASE}/strava/athlete`, () => {
    return HttpResponse.json(mockAthleteResponse);
  }),

  http.post(`${BASE}/strava/oauth/initiate`, () => {
    return HttpResponse.json({ url: 'https://www.strava.com/oauth/authorize?demo=true' });
  }),

  http.get(`${BASE}/health`, () => {
    return HttpResponse.json({ status: 'ok', service: 'strava-sync-api' });
  }),
];
