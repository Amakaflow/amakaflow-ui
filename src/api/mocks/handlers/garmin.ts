import { http, HttpResponse } from 'msw';
import { API_URLS } from '../../../lib/config';

const BASE = API_URLS.GARMIN;

const mockWorkout = {
  workoutId: 'demo-garmin-workout-1',
  workoutName: 'Demo Strength Workout',
  sportType: { sportTypeId: 5, sportTypeKey: 'strength_training' },
  estimatedDurationInSecs: 3600,
};

export const garminHandlers = [
  http.get(`${BASE}/health`, () => {
    return HttpResponse.json({
      status: 'healthy',
      service: 'garmin-sync',
      note: 'UNOFFICIAL – TEST ONLY',
      enabled: true,
    });
  }),

  http.get(`${BASE}/`, () => {
    return HttpResponse.json({ service: 'Garmin Sync API', version: '0.1.0' });
  }),

  // GET all workouts (POST body with credentials)
  http.post(`${BASE}/workouts`, () => {
    return HttpResponse.json({ workouts: [mockWorkout] });
  }),

  // GET specific workout
  http.get(`${BASE}/workouts/:id`, ({ params }) => {
    return HttpResponse.json({
      workout: { ...mockWorkout, workoutId: params.id },
    });
  }),

  // Import workouts to Garmin Connect
  http.post(`${BASE}/workouts/import`, () => {
    return HttpResponse.json({
      status: 'success',
      message: 'Workouts imported successfully (demo)',
    });
  }),

  // Schedule workouts
  http.post(`${BASE}/workouts/schedule`, () => {
    return HttpResponse.json({
      status: 'success',
      message: 'Workouts scheduled successfully (demo)',
    });
  }),

  // Create workout JSON
  http.post(`${BASE}/workouts/create`, async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({
      workout: {
        workoutId: `demo-created-${Date.now()}`,
        workoutName: body.name || 'Demo Workout',
        sportType: { sportTypeKey: (body.sport || 'strength_training').toLowerCase() },
        steps: body.steps || [],
      },
    });
  }),
];
