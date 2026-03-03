/**
 * Strava API client — typed, validated, MSW-interceptable.
 * No isDemoMode branches here. Demo mode is handled by MSW handlers.
 */
import { authenticatedFetch } from '../../lib/authenticated-fetch';
import { API_URLS } from '../../lib/config';
import { StravaActivitySchema, AthleteResponseSchema, UpdateActivityResponseSchema, CreateActivityResponseSchema } from '../schemas/strava';
import type {
  StravaActivity, UpdateActivityRequest, UpdateActivityResponse,
  AthleteResponse, CreateActivityRequest, CreateActivityResponse,
} from '../generated/strava';

export { StravaTokenExpiredError, StravaUnauthorizedError } from '../../lib/strava-api';

const BASE = API_URLS.STRAVA;

async function call<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE}${endpoint}`;
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...options.headers };
  const response = await authenticatedFetch(url, { ...options, headers });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    const msg = err.detail || `Strava API error: ${response.status} ${response.statusText}`;

    if (response.status === 401) {
      const { StravaTokenExpiredError, StravaUnauthorizedError } = await import('../../lib/strava-api');
      if (
        msg.includes('No tokens found') ||
        msg.includes('Authentication failed') ||
        msg.includes('token expired') ||
        msg.includes('refresh token')
      ) {
        throw new StravaTokenExpiredError(msg);
      }
      throw new StravaUnauthorizedError(msg);
    }

    throw new Error(msg);
  }

  return response.json();
}

export async function getStravaActivities(limit: number = 5): Promise<StravaActivity[]> {
  const activities = await call<StravaActivity[]>(`/strava/activities?limit=${limit}`);
  return activities.map(a => StravaActivitySchema.parse(a));
}

export async function updateStravaActivity(
  activityId: number,
  payload: UpdateActivityRequest
): Promise<UpdateActivityResponse> {
  const result = await call<UpdateActivityResponse>(`/strava/activities/${activityId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return UpdateActivityResponseSchema.parse(result);
}

export async function createStravaActivity(
  payload: CreateActivityRequest
): Promise<CreateActivityResponse> {
  const result = await call<CreateActivityResponse>(`/strava/activities`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return CreateActivityResponseSchema.parse(result);
}

export async function getStravaAthlete(): Promise<AthleteResponse> {
  const result = await call<AthleteResponse>(`/strava/athlete`);
  return AthleteResponseSchema.parse(result);
}

export async function initiateStravaOAuth(): Promise<string> {
  const response = await authenticatedFetch(`${BASE}/strava/oauth/initiate`, { method: 'POST' });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || `Failed to initiate OAuth: ${response.status}`);
  }
  const data = await response.json();
  return data.url;
}

export async function checkStravaApiHealth(): Promise<boolean> {
  try {
    const response = await authenticatedFetch(`${BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
