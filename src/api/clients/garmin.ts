/**
 * Garmin API client — typed, validated, MSW-interceptable.
 * No isDemoMode branches here. Demo mode is handled by MSW handlers.
 *
 * IMPORTANT: This is the UNOFFICIAL Garmin sync — test/dev only.
 * The backend enforces GARMIN_UNOFFICIAL_SYNC_ENABLED=true to activate.
 */
import { authenticatedFetch } from '../../lib/authenticated-fetch';
import { API_URLS } from '../../lib/config';
import {
  GarminGetWorkoutsResponseSchema,
  GarminGetWorkoutResponseSchema,
  GarminImportResponseSchema,
  GarminScheduleResponseSchema,
  GarminCreateWorkoutResponseSchema,
  GarminHealthResponseSchema,
} from '../schemas/garmin';
import type {
  GarminWorkout,
  GarminGetWorkoutsRequest,
  GarminImportRequest,
  GarminScheduleRequest,
  GarminCreateWorkoutRequest,
  GarminImportResponse,
  GarminScheduleResponse,
  GarminCreateWorkoutResponse,
  GarminHealthResponse,
} from '../generated/garmin';

const BASE = API_URLS.GARMIN;

async function call<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE}${endpoint}`;
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...options.headers };
  const response = await authenticatedFetch(url, { ...options, headers });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || `Garmin API error: ${response.status}`);
  }
  return response.json();
}

export async function getGarminWorkouts(
  credentials: GarminGetWorkoutsRequest
): Promise<GarminWorkout[]> {
  const result = await call<unknown>('/workouts', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  const parsed = GarminGetWorkoutsResponseSchema.parse(result);
  return parsed.workouts;
}

export async function getGarminWorkout(
  workoutId: string,
  email: string,
  password: string
): Promise<GarminWorkout> {
  const url = `${BASE}/workouts/${workoutId}?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  const response = await authenticatedFetch(url);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || `Garmin API error: ${response.status}`);
  }
  const result = await response.json();
  const parsed = GarminGetWorkoutResponseSchema.parse(result);
  return parsed.workout;
}

export async function importGarminWorkouts(
  request: GarminImportRequest
): Promise<GarminImportResponse> {
  const result = await call<unknown>('/workouts/import', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return GarminImportResponseSchema.parse(result);
}

export async function scheduleGarminWorkouts(
  request: GarminScheduleRequest
): Promise<GarminScheduleResponse> {
  const result = await call<unknown>('/workouts/schedule', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return GarminScheduleResponseSchema.parse(result);
}

export async function createGarminWorkout(
  request: GarminCreateWorkoutRequest
): Promise<GarminCreateWorkoutResponse> {
  const result = await call<unknown>('/workouts/create', {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return GarminCreateWorkoutResponseSchema.parse(result);
}

export async function checkGarminApiHealth(): Promise<GarminHealthResponse> {
  const result = await call<unknown>('/health');
  return GarminHealthResponseSchema.parse(result);
}
