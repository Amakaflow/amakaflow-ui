// @generated — do not edit manually. Run: npm run generate:types:garmin
// Hand-maintained until generate script runs against live backend.
//
// IMPORTANT: This is the UNOFFICIAL Garmin sync API — test/dev only.
// Enabled only when GARMIN_UNOFFICIAL_SYNC_ENABLED=true on the backend.

// TODO: refine when endpoints finalized — shapes reflect garmin-sync-api v0.1.0

export interface GarminWorkoutStep {
  [key: string]: unknown;
}

export interface GarminWorkout {
  [key: string]: unknown;
}

export interface GarminGetWorkoutsRequest {
  email: string;
  password: string;
}

export interface GarminGetWorkoutsResponse {
  workouts: GarminWorkout[];
}

export interface GarminGetWorkoutResponse {
  workout: GarminWorkout;
}

export interface GarminImportRequest {
  email: string;
  password: string;
  workouts: Record<string, unknown>;
  delete_same_name?: boolean;
}

export interface GarminImportResponse {
  status: string;
  message: string;
}

export interface GarminScheduleRequest {
  email: string;
  password: string;
  start_from: string; // YYYY-MM-DD
  workouts: string[];
}

export interface GarminScheduleResponse {
  status: string;
  message: string;
}

export interface GarminCreateWorkoutRequest {
  name: string;
  steps: unknown[];
  sport?: string;
}

export interface GarminCreateWorkoutResponse {
  workout: GarminWorkout;
}

export interface GarminHealthResponse {
  status: string;
  service: string;
  note: string;
  enabled: boolean;
}
