/**
 * Workout API Client
 * 
 * Client for communicating with the mapper-api for workout storage and retrieval.
 * Uses Supabase through the mapper API (not directly from UI).
 */

const MAPPER_API_BASE_URL = import.meta.env.VITE_MAPPER_API_URL || 'http://localhost:8001';

export interface SavedWorkout {
  id: string;
  profile_id: string;
  workout_data: any; // WorkoutStructure
  sources: string[];
  device: string;
  exports?: any; // ExportFormats
  validation?: any; // ValidationResponse
  title?: string;
  description?: string;
  is_exported: boolean;
  exported_at?: string;
  exported_to_device?: string;
  synced_to_strava?: boolean;
  strava_activity_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SaveWorkoutRequest {
  profile_id: string;
  workout_data: any;
  sources: string[];
  device: string;
  exports?: any;
  validation?: any;
  title?: string;
  description?: string;
}

export interface GetWorkoutsParams {
  profile_id: string;
  device?: string;
  is_exported?: boolean;
  limit?: number;
}

async function workoutApiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${MAPPER_API_BASE_URL}${endpoint}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    // FastAPI validation errors include 'detail' field with specific validation messages
    const errorMessage = error.detail 
      ? (Array.isArray(error.detail) 
          ? error.detail.map((e: any) => `${e.loc?.join('.')}: ${e.msg}`).join(', ')
          : error.detail)
      : (error.message || `Workout API error: ${response.status} ${response.statusText}`);
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Save a workout to Supabase via mapper API
 */
export async function saveWorkoutToAPI(request: SaveWorkoutRequest): Promise<SavedWorkout> {
  const response = await workoutApiCall<{ success: boolean; workout_id: string; message: string }>(
    '/workouts/save',
    {
      method: 'POST',
      body: JSON.stringify(request),
    }
  );

  if (!response.success) {
    throw new Error(response.message || 'Failed to save workout');
  }

  // Fetch the saved workout to return full data
  const workout = await getWorkoutFromAPI(response.workout_id, request.profile_id);
  if (!workout) {
    throw new Error('Workout saved but could not retrieve it');
  }

  return workout;
}

/**
 * Get workouts for a user
 */
export async function getWorkoutsFromAPI(params: GetWorkoutsParams): Promise<SavedWorkout[]> {
  const queryParams = new URLSearchParams({
    profile_id: params.profile_id,
  });

  if (params.device) {
    queryParams.append('device', params.device);
  }
  if (params.is_exported !== undefined) {
    queryParams.append('is_exported', params.is_exported.toString());
  }
  if (params.limit) {
    queryParams.append('limit', params.limit.toString());
  }

  const response = await workoutApiCall<{ success: boolean; workouts: SavedWorkout[]; count: number }>(
    `/workouts?${queryParams.toString()}`
  );

  return response.workouts || [];
}

/**
 * Get a single workout by ID
 */
export async function getWorkoutFromAPI(workoutId: string, profileId: string): Promise<SavedWorkout | null> {
  const queryParams = new URLSearchParams({
    profile_id: profileId,
  });

  const response = await workoutApiCall<{ success: boolean; workout?: SavedWorkout; message?: string }>(
    `/workouts/${workoutId}?${queryParams.toString()}`
  );

  if (!response.success || !response.workout) {
    return null;
  }

  return response.workout;
}

/**
 * Update workout export status
 */
export async function updateWorkoutExportStatus(
  workoutId: string,
  profileId: string,
  isExported: boolean = true,
  exportedToDevice?: string
): Promise<boolean> {
  const response = await workoutApiCall<{ success: boolean; message: string }>(
    `/workouts/${workoutId}/export-status`,
    {
      method: 'PUT',
      body: JSON.stringify({
        profile_id: profileId,
        is_exported: isExported,
        exported_to_device: exportedToDevice,
      }),
    }
  );

  return response.success;
}

/**
 * Delete a workout
 */
export async function deleteWorkoutFromAPI(workoutId: string, profileId: string): Promise<boolean> {
  const queryParams = new URLSearchParams({
    profile_id: profileId,
  });

  const response = await workoutApiCall<{ success: boolean; message: string }>(
    `/workouts/${workoutId}?${queryParams.toString()}`,
    {
      method: 'DELETE',
    }
  );

  return response.success;
}

