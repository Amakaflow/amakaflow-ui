import { http, HttpResponse } from 'msw';
import { API_URLS } from '../../../lib/config';
import { MOCK_WORKOUT_HISTORY } from '../../../lib/mock-data';
import type { SavedWorkout, WorkoutProgram, UserTag } from '../../generated/mapper';

const BASE = API_URLS.MAPPER;

function mockHistoryToSaved(): SavedWorkout[] {
  return (MOCK_WORKOUT_HISTORY || []).map((item: any, i: number) => ({
    id: item.id || `demo-${i}`,
    profile_id: 'demo-user-1',
    workout_data: item.workout as Record<string, unknown>,
    sources: item.sources || [],
    device: item.device || 'garmin',
    title: item.workout?.title,
    is_exported: false,
    created_at: item.createdAt || new Date().toISOString(),
    updated_at: item.updatedAt || new Date().toISOString(),
  }));
}

export const mapperHandlers = [
  http.post(`${BASE}/workouts/save`, async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      success: true,
      workout_id: body.workout_id || `demo-${Date.now()}`,
      message: 'Workout saved (demo)',
    });
  }),

  http.get(`${BASE}/workouts`, () => {
    const workouts = mockHistoryToSaved();
    return HttpResponse.json({ success: true, workouts, count: workouts.length });
  }),

  http.get(`${BASE}/workouts/:id`, ({ params }) => {
    const all = mockHistoryToSaved();
    const workout = all.find(w => w.id === params.id) || all[0] || null;
    if (!workout) return HttpResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    return HttpResponse.json({ success: true, workout });
  }),

  http.delete(`${BASE}/workouts/:id`, () => {
    return HttpResponse.json({ success: true, message: 'Deleted (demo)' });
  }),

  http.put(`${BASE}/workouts/:id/export-status`, () => {
    return HttpResponse.json({ success: true });
  }),

  http.patch(`${BASE}/workouts/:id/favorite`, async ({ request, params }) => {
    const body = await request.json() as any;
    const all = mockHistoryToSaved();
    const workout = all.find(w => w.id === params.id) || null;
    return HttpResponse.json({ success: true, workout: workout ? { ...workout, is_favorite: body.is_favorite } : null, message: 'Updated (demo)' });
  }),

  http.patch(`${BASE}/workouts/:id/used`, ({ params }) => {
    const all = mockHistoryToSaved();
    const workout = all.find(w => w.id === params.id) || null;
    return HttpResponse.json({ success: true, workout, message: 'Updated (demo)' });
  }),

  http.patch(`${BASE}/workouts/:id/tags`, async ({ request, params }) => {
    const body = await request.json() as any;
    const all = mockHistoryToSaved();
    const base = all.find(w => w.id === params.id) || (all[0] ?? null);
    const workout = base ? { ...base, id: params.id as string } : null;
    return HttpResponse.json({ success: true, workout, message: 'Updated (demo)' });
  }),

  http.get(`${BASE}/programs`, () => {
    return HttpResponse.json({ success: true, programs: [] as WorkoutProgram[], count: 0 });
  }),

  http.post(`${BASE}/programs`, async ({ request }) => {
    const body = await request.json() as any;
    const program: WorkoutProgram = {
      id: `demo-program-${Date.now()}`,
      profile_id: 'demo-user-1',
      name: body.name,
      description: body.description,
      color: body.color,
      icon: body.icon,
      current_day_index: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return HttpResponse.json({ success: true, program, message: 'Created (demo)' });
  }),

  http.patch(`${BASE}/programs/:id`, async ({ request, params }) => {
    const body = await request.json() as any;
    const program: WorkoutProgram = {
      id: params.id as string,
      profile_id: 'demo-user-1',
      name: body.name || 'Demo Program',
      description: body.description,
      color: body.color,
      icon: body.icon,
      current_day_index: body.current_day_index ?? 0,
      is_active: body.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      members: body.members,
    };
    return HttpResponse.json({ success: true, program, message: 'Updated (demo)' });
  }),

  http.delete(`${BASE}/programs/:id`, () => {
    return HttpResponse.json({ success: true, message: 'Deleted (demo)' });
  }),

  http.get(`${BASE}/tags`, () => {
    return HttpResponse.json({ success: true, tags: [] as UserTag[], count: 0 });
  }),

  http.post(`${BASE}/tags`, async ({ request }) => {
    const body = await request.json() as any;
    const tag: UserTag = {
      id: `demo-tag-${Date.now()}`,
      profile_id: 'demo-user-1',
      name: body.name,
      color: body.color,
      created_at: new Date().toISOString(),
    };
    return HttpResponse.json({ success: true, tag, message: 'Created (demo)' });
  }),

  http.delete(`${BASE}/tags/:id`, () => {
    return HttpResponse.json({ success: true, message: 'Deleted (demo)' });
  }),
];
