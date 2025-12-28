/**
 * Workout API Client
 *
 * Client for communicating with the mapper-api for workout storage and retrieval.
 * Uses Supabase through the mapper API (not directly from UI).
 */

import { authenticatedFetch } from './authenticated-fetch';
import { API_URLS } from './config';

// Use centralized API config
const MAPPER_API_BASE_URL = API_URLS.MAPPER;

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
  workout_id?: string; // Optional: for explicit updates to existing workouts
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

  const response = await authenticatedFetch(url, {
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
 * Update a workout
 */
export async function updateWorkoutInAPI(
  workoutId: string,
  request: SaveWorkoutRequest
): Promise<SavedWorkout> {
  // Use the save endpoint with workout_id for explicit updates
  // The API will update the existing workout instead of creating a duplicate
  const response = await workoutApiCall<{ success: boolean; workout_id: string; message: string }>(
    `/workouts/save`,
    {
      method: 'POST',
      body: JSON.stringify({
        ...request,
        workout_id: workoutId, // Pass workout ID for explicit update
      }),
    }
  );

  if (!response.success) {
    throw new Error(response.message || 'Failed to update workout');
  }

  // Fetch the updated workout
  const workout = await getWorkoutFromAPI(response.workout_id, request.profile_id);
  if (!workout) {
    throw new Error('Workout updated but could not retrieve it');
  }

  return workout;
}

/**
 * Delete a workout
 */
export async function deleteWorkoutFromAPI(workoutId: string, profileId: string): Promise<boolean> {
  try {
    const queryParams = new URLSearchParams({
      profile_id: profileId,
    });

    const response = await workoutApiCall<{ success: boolean; message: string }>(
      `/workouts/${workoutId}?${queryParams.toString()}`,
      {
        method: 'DELETE',
      }
    );

    console.log('[deleteWorkoutFromAPI] Response for id:', workoutId, response);
    return response.success;
  } catch (err) {
    console.error('[deleteWorkoutFromAPI] Error deleting workout from API:', err);
    return false;
  }
}


// =============================================================================
// Favorites & Usage Tracking (AMA-122)
// =============================================================================

/**
 * Toggle favorite status for a workout
 */
export async function toggleWorkoutFavorite(
  workoutId: string,
  profileId: string,
  isFavorite: boolean
): Promise<SavedWorkout | null> {
  try {
    const response = await workoutApiCall<{ success: boolean; workout?: SavedWorkout; message: string }>(
      `/workouts/${workoutId}/favorite`,
      {
        method: 'PATCH',
        body: JSON.stringify({ profile_id: profileId, is_favorite: isFavorite }),
      }
    );

    return response.success ? response.workout || null : null;
  } catch (err) {
    console.error('[toggleWorkoutFavorite] Error:', err);
    return null;
  }
}

/**
 * Track workout usage (update last_used_at and increment times_completed)
 */
export async function trackWorkoutUsage(
  workoutId: string,
  profileId: string
): Promise<SavedWorkout | null> {
  try {
    const response = await workoutApiCall<{ success: boolean; workout?: SavedWorkout; message: string }>(
      `/workouts/${workoutId}/used`,
      {
        method: 'PATCH',
        body: JSON.stringify({ profile_id: profileId }),
      }
    );

    return response.success ? response.workout || null : null;
  } catch (err) {
    console.error('[trackWorkoutUsage] Error:', err);
    return null;
  }
}

/**
 * Update tags for a workout
 */
export async function updateWorkoutTags(
  workoutId: string,
  profileId: string,
  tags: string[]
): Promise<SavedWorkout | null> {
  try {
    const response = await workoutApiCall<{ success: boolean; workout?: SavedWorkout; message: string }>(
      `/workouts/${workoutId}/tags`,
      {
        method: 'PATCH',
        body: JSON.stringify({ profile_id: profileId, tags }),
      }
    );

    return response.success ? response.workout || null : null;
  } catch (err) {
    console.error('[updateWorkoutTags] Error:', err);
    return null;
  }
}


// =============================================================================
// Programs (AMA-122)
// =============================================================================

export interface WorkoutProgram {
  id: string;
  profile_id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  current_day_index: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  members?: ProgramMember[];
}

export interface ProgramMember {
  id: string;
  program_id: string;
  workout_id?: string;
  follow_along_id?: string;
  day_order: number;
  created_at: string;
}

export interface CreateProgramRequest {
  profile_id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateProgramRequest {
  profile_id: string;
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  is_active?: boolean;
  current_day_index?: number;
}

/**
 * Create a new workout program
 */
export async function createProgram(request: CreateProgramRequest): Promise<WorkoutProgram | null> {
  try {
    const response = await workoutApiCall<{ success: boolean; program?: WorkoutProgram; message: string }>(
      '/programs',
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );

    return response.success ? response.program || null : null;
  } catch (err) {
    console.error('[createProgram] Error:', err);
    return null;
  }
}

/**
 * Get all programs for a user
 */
export async function getPrograms(
  profileId: string,
  includeInactive: boolean = false
): Promise<WorkoutProgram[]> {
  try {
    const queryParams = new URLSearchParams({
      profile_id: profileId,
      include_inactive: includeInactive.toString(),
    });

    const response = await workoutApiCall<{ success: boolean; programs: WorkoutProgram[]; count: number }>(
      `/programs?${queryParams.toString()}`
    );

    return response.programs || [];
  } catch (err) {
    console.error('[getPrograms] Error:', err);
    return [];
  }
}

/**
 * Get a single program with its members
 */
export async function getProgram(programId: string, profileId: string): Promise<WorkoutProgram | null> {
  try {
    const queryParams = new URLSearchParams({
      profile_id: profileId,
    });

    const response = await workoutApiCall<{ success: boolean; program?: WorkoutProgram; message?: string }>(
      `/programs/${programId}?${queryParams.toString()}`
    );

    return response.success ? response.program || null : null;
  } catch (err) {
    console.error('[getProgram] Error:', err);
    return null;
  }
}

/**
 * Update a program
 */
export async function updateProgram(
  programId: string,
  request: UpdateProgramRequest
): Promise<WorkoutProgram | null> {
  try {
    const response = await workoutApiCall<{ success: boolean; program?: WorkoutProgram; message: string }>(
      `/programs/${programId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(request),
      }
    );

    return response.success ? response.program || null : null;
  } catch (err) {
    console.error('[updateProgram] Error:', err);
    return null;
  }
}

/**
 * Delete a program
 */
export async function deleteProgram(programId: string, profileId: string): Promise<boolean> {
  try {
    const queryParams = new URLSearchParams({
      profile_id: profileId,
    });

    const response = await workoutApiCall<{ success: boolean; message: string }>(
      `/programs/${programId}?${queryParams.toString()}`,
      {
        method: 'DELETE',
      }
    );

    return response.success;
  } catch (err) {
    console.error('[deleteProgram] Error:', err);
    return false;
  }
}

/**
 * Add a workout or follow-along to a program
 */
export async function addToProgram(
  programId: string,
  profileId: string,
  workoutId?: string,
  followAlongId?: string,
  dayOrder?: number
): Promise<ProgramMember | null> {
  try {
    const response = await workoutApiCall<{ success: boolean; member?: ProgramMember; message: string }>(
      `/programs/${programId}/members`,
      {
        method: 'POST',
        body: JSON.stringify({
          profile_id: profileId,
          workout_id: workoutId,
          follow_along_id: followAlongId,
          day_order: dayOrder,
        }),
      }
    );

    return response.success ? response.member || null : null;
  } catch (err) {
    console.error('[addToProgram] Error:', err);
    return null;
  }
}

/**
 * Remove a workout from a program
 */
export async function removeFromProgram(
  programId: string,
  memberId: string,
  profileId: string
): Promise<boolean> {
  try {
    const queryParams = new URLSearchParams({
      profile_id: profileId,
    });

    const response = await workoutApiCall<{ success: boolean; message: string }>(
      `/programs/${programId}/members/${memberId}?${queryParams.toString()}`,
      {
        method: 'DELETE',
      }
    );

    return response.success;
  } catch (err) {
    console.error('[removeFromProgram] Error:', err);
    return false;
  }
}


// =============================================================================
// User Tags (AMA-122)
// =============================================================================

export interface UserTag {
  id: string;
  profile_id: string;
  name: string;
  color?: string;
  created_at: string;
}

/**
 * Get all tags for a user
 */
export async function getUserTags(profileId: string): Promise<UserTag[]> {
  try {
    const queryParams = new URLSearchParams({
      profile_id: profileId,
    });

    const response = await workoutApiCall<{ success: boolean; tags: UserTag[]; count: number }>(
      `/tags?${queryParams.toString()}`
    );

    return response.tags || [];
  } catch (err) {
    console.error('[getUserTags] Error:', err);
    return [];
  }
}

/**
 * Create a new user tag
 */
export async function createUserTag(
  profileId: string,
  name: string,
  color?: string
): Promise<UserTag | null> {
  try {
    const response = await workoutApiCall<{ success: boolean; tag?: UserTag; message: string }>(
      '/tags',
      {
        method: 'POST',
        body: JSON.stringify({ profile_id: profileId, name, color }),
      }
    );

    return response.success ? response.tag || null : null;
  } catch (err) {
    console.error('[createUserTag] Error:', err);
    return null;
  }
}

/**
 * Delete a user tag
 */
export async function deleteUserTag(tagId: string, profileId: string): Promise<boolean> {
  try {
    const queryParams = new URLSearchParams({
      profile_id: profileId,
    });

    const response = await workoutApiCall<{ success: boolean; message: string }>(
      `/tags/${tagId}?${queryParams.toString()}`,
      {
        method: 'DELETE',
      }
    );

    return response.success;
  } catch (err) {
    console.error('[deleteUserTag] Error:', err);
    return false;
  }
}

