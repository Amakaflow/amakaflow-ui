/**
 * Strava API Client
 *
 * Client for communicating with the strava-sync-api service
 */

import { authenticatedFetch } from './authenticated-fetch';
import { API_URLS } from './config';

// Use centralized API config
const STRAVA_API_BASE_URL = API_URLS.STRAVA;

export interface StravaActivity {
  id: number;
  name: string;
  start_date: string;
  distance: number;
  elapsed_time: number;
  moving_time: number;
  type: string;
  description?: string;
  photos?: { count: number };
}

export interface UpdateActivityRequest {
  overwriteTitle?: boolean;
  newTitle?: string;
  overwriteDescription?: boolean;
  description?: string;
}

export interface UpdateActivityResponse {
  id: number;
  name: string;
  description: string;
  updated_at: string;
}

export interface AthleteResponse {
  id: number;
  username?: string;
  firstname?: string;
  lastname?: string;
  profile_medium?: string;
  profile?: string;
}

export interface CreateActivityRequest {
  name: string;
  activity_type?: string;
  start_date?: string;
  elapsed_time?: number;
  description?: string;
  distance?: number;
}

export interface CreateActivityResponse {
  id: number;
  name: string;
  type: string;
  start_date: string;
  elapsed_time: number;
  distance: number;
  description: string;
}

export class StravaTokenExpiredError extends Error {
  constructor(message: string = 'Strava token expired. Reauthorization required.') {
    super(message);
    this.name = 'StravaTokenExpiredError';
  }
}

export class StravaUnauthorizedError extends Error {
  constructor(message: string = 'Strava authorization required.') {
    super(message);
    this.name = 'StravaUnauthorizedError';
  }
}

async function stravaApiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${STRAVA_API_BASE_URL}${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await authenticatedFetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    const errorMessage = error.detail || `Strava API error: ${response.status} ${response.statusText}`;
    
    // Detect token expiration errors
    if (response.status === 401) {
      // Check if it's a token expiration that requires reauthorization
      if (errorMessage.includes('No tokens found') || 
          errorMessage.includes('Authentication failed') ||
          errorMessage.includes('token expired') ||
          errorMessage.includes('refresh token')) {
        throw new StravaTokenExpiredError(errorMessage);
      }
      throw new StravaUnauthorizedError(errorMessage);
    }
    
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Fetch user's recent activities from Strava
 * @deprecated userId parameter is no longer used - user is identified via JWT
 */
export async function getStravaActivities(
  _userId?: string,
  limit: number = 5
): Promise<StravaActivity[]> {
  return stravaApiCall<StravaActivity[]>(
    `/strava/activities?limit=${limit}`
  );
}

/**
 * Update a Strava activity with AmakaFlow data
 * @deprecated userId parameter is no longer used - user is identified via JWT
 */
export async function updateStravaActivity(
  _userId: string | undefined,
  activityId: number,
  payload: UpdateActivityRequest
): Promise<UpdateActivityResponse> {
  return stravaApiCall<UpdateActivityResponse>(
    `/strava/activities/${activityId}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Initiate OAuth flow with Strava
 * @deprecated userId parameter is no longer used - user is identified via JWT
 */
export async function initiateStravaOAuth(_userId?: string): Promise<string> {
  const response = await authenticatedFetch(
    `${STRAVA_API_BASE_URL}/strava/oauth/initiate`,
    {
      method: 'POST',
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to initiate OAuth: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.url; // OAuth redirect URL
}

/**
 * Get authenticated Strava athlete information
 * @deprecated userId parameter is no longer used - user is identified via JWT
 */
export async function getStravaAthlete(_userId?: string): Promise<AthleteResponse> {
  return stravaApiCall<AthleteResponse>(
    `/strava/athlete`
  );
}

/**
 * Check if Strava API is available
 */
export async function checkStravaApiHealth(): Promise<boolean> {
  try {
    const response = await authenticatedFetch(`${STRAVA_API_BASE_URL}/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Check if Strava token is valid and refresh if needed
 * Returns true if token is valid, false if reauthorization is needed
 */
export async function checkAndRefreshStravaToken(userId: string): Promise<boolean> {
  try {
    // Try to get athlete info - this will auto-refresh token if needed
    await getStravaAthlete(userId);
    return true;
  } catch (error: any) {
    if (error instanceof StravaTokenExpiredError || error instanceof StravaUnauthorizedError) {
      return false; // Reauthorization needed
    }
    // For other errors, assume token might be valid but there's another issue
    // Return true to allow the calling code to handle the error
    return true;
  }
}

/**
 * Create a manual activity on Strava
 * @deprecated userId parameter is no longer used - user is identified via JWT
 */
export async function createStravaActivity(
  _userId?: string,
  payload?: CreateActivityRequest
): Promise<CreateActivityResponse> {
  return stravaApiCall<CreateActivityResponse>(
    `/strava/activities`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

