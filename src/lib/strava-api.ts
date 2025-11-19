/**
 * Strava API Client
 * 
 * Client for communicating with the strava-sync-api service
 */

const STRAVA_API_BASE_URL = import.meta.env.VITE_STRAVA_API_URL || 'http://localhost:8000';

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

async function stravaApiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${STRAVA_API_BASE_URL}${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Strava API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch user's recent activities from Strava
 */
export async function getStravaActivities(
  userId: string,
  limit: number = 5
): Promise<StravaActivity[]> {
  return stravaApiCall<StravaActivity[]>(
    `/strava/activities?userId=${encodeURIComponent(userId)}&limit=${limit}`
  );
}

/**
 * Update a Strava activity with MyAmaka data
 */
export async function updateStravaActivity(
  userId: string,
  activityId: number,
  payload: UpdateActivityRequest
): Promise<UpdateActivityResponse> {
  return stravaApiCall<UpdateActivityResponse>(
    `/strava/activities/${activityId}?userId=${encodeURIComponent(userId)}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Initiate OAuth flow with Strava
 */
export async function initiateStravaOAuth(userId: string): Promise<string> {
  const response = await fetch(
    `${STRAVA_API_BASE_URL}/strava/oauth/initiate?userId=${encodeURIComponent(userId)}`,
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
 */
export async function getStravaAthlete(userId: string): Promise<AthleteResponse> {
  return stravaApiCall<AthleteResponse>(
    `/strava/athlete?userId=${encodeURIComponent(userId)}`
  );
}

/**
 * Check if Strava API is available
 */
export async function checkStravaApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${STRAVA_API_BASE_URL}/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

