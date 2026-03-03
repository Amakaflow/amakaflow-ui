// @generated — do not edit manually. Run: npm run generate:types:strava
// Hand-maintained until generate script runs against live backend.

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

export interface OAuthInitiateResponse {
  url: string;
}
