/**
 * Mapper API client — typed, validated, MSW-interceptable.
 * No isDemoMode branches here. Demo mode is handled by MSW handlers.
 */
import { authenticatedFetch } from '../../lib/authenticated-fetch';
import { API_URLS } from '../../lib/config';
import { generateAutoTags } from '../../lib/auto-tags';
import { SavedWorkoutSchema, WorkoutProgramSchema, UserTagSchema } from '../schemas/mapper';
import type {
  SavedWorkout, WorkoutProgram, UserTag,
  SaveWorkoutsResponse, GetWorkoutsResponse, GetProgramsResponse, GetTagsResponse,
} from '../generated/mapper';
import type { WorkoutStructure } from '../../types/workout';

const BASE = API_URLS.MAPPER;

async function call<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE}${endpoint}`;
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...options.headers };
  const response = await authenticatedFetch(url, { ...options, headers });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    const msg = Array.isArray(err.detail)
      ? err.detail.map((e: any) => `${e.loc?.join('.')}: ${e.msg}`).join(', ')
      : err.detail || err.message || `Mapper API error: ${response.status}`;
    throw new Error(msg);
  }
  return response.json();
}

// ── Workouts ──────────────────────────────────────────────────────────────────

export interface SaveWorkoutRequest {
  profile_id: string;
  workout_data: WorkoutStructure;
  sources: string[];
  device?: string;
  exports?: Record<string, unknown>;
  validation?: Record<string, unknown>;
  title?: string;
  description?: string;
  workout_id?: string;
  tags?: string[];
}

export async function saveWorkout(request: SaveWorkoutRequest): Promise<SavedWorkout> {
  const autoTags = generateAutoTags(request.workout_data);
  const tags = Array.from(new Set([...autoTags, ...(request.tags || [])]));
  const body = { ...request, tags, device: request.device ?? 'web' };

  const result = await call<SaveWorkoutsResponse>('/workouts/save', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!result.success) throw new Error(result.message || 'Failed to save workout');

  const workout = await getWorkout(result.workout_id, request.profile_id);
  if (!workout) throw new Error('Workout saved but could not retrieve it');
  return workout;
}

export async function getWorkouts(params: {
  profile_id: string;
  device?: string;
  is_exported?: boolean;
  limit?: number;
}): Promise<SavedWorkout[]> {
  const q = new URLSearchParams({ profile_id: params.profile_id });
  if (params.device) q.append('device', params.device);
  if (params.is_exported !== undefined) q.append('is_exported', params.is_exported.toString());
  if (params.limit) q.append('limit', params.limit.toString());

  const result = await call<GetWorkoutsResponse>(`/workouts?${q}`);
  return (result.workouts || []).map(w => SavedWorkoutSchema.parse(w));
}

export async function getWorkout(workoutId: string, profileId: string): Promise<SavedWorkout | null> {
  const q = new URLSearchParams({ profile_id: profileId });
  const result = await call<{ success: boolean; workout?: SavedWorkout; message?: string }>(
    `/workouts/${workoutId}?${q}`
  );
  if (!result.success || !result.workout) return null;
  return SavedWorkoutSchema.parse(result.workout);
}

export async function deleteWorkout(workoutId: string, profileId: string): Promise<boolean> {
  const q = new URLSearchParams({ profile_id: profileId });
  const result = await call<{ success: boolean; message: string }>(
    `/workouts/${workoutId}?${q}`,
    { method: 'DELETE' }
  );
  return result.success;
}

export async function updateWorkoutExportStatus(
  workoutId: string, profileId: string, isExported = true, exportedToDevice?: string
): Promise<boolean> {
  const result = await call<{ success: boolean }>(
    `/workouts/${workoutId}/export-status`,
    { method: 'PUT', body: JSON.stringify({ profile_id: profileId, is_exported: isExported, exported_to_device: exportedToDevice }) }
  );
  return result.success;
}

export async function toggleWorkoutFavorite(workoutId: string, profileId: string, isFavorite: boolean): Promise<SavedWorkout | null> {
  const result = await call<{ success: boolean; workout?: SavedWorkout; message: string }>(
    `/workouts/${workoutId}/favorite`,
    { method: 'PATCH', body: JSON.stringify({ profile_id: profileId, is_favorite: isFavorite }) }
  );
  return result.success && result.workout ? SavedWorkoutSchema.parse(result.workout) : null;
}

export async function trackWorkoutUsage(workoutId: string, profileId: string): Promise<SavedWorkout | null> {
  const result = await call<{ success: boolean; workout?: SavedWorkout; message: string }>(
    `/workouts/${workoutId}/used`,
    { method: 'PATCH', body: JSON.stringify({ profile_id: profileId }) }
  );
  return result.success && result.workout ? SavedWorkoutSchema.parse(result.workout) : null;
}

export async function updateWorkoutTags(workoutId: string, profileId: string, tags: string[]): Promise<SavedWorkout | null> {
  const result = await call<{ success: boolean; workout?: SavedWorkout; message: string }>(
    `/workouts/${workoutId}/tags`,
    { method: 'PATCH', body: JSON.stringify({ profile_id: profileId, tags }) }
  );
  return result.success && result.workout ? SavedWorkoutSchema.parse(result.workout) : null;
}

// ── Programs ──────────────────────────────────────────────────────────────────

export async function getPrograms(profileId: string, includeInactive = false): Promise<WorkoutProgram[]> {
  const q = new URLSearchParams({ profile_id: profileId, include_inactive: includeInactive.toString() });
  const result = await call<GetProgramsResponse>(`/programs?${q}`);
  return (result.programs || []).map(p => WorkoutProgramSchema.parse(p));
}

export async function getProgram(programId: string, profileId: string): Promise<WorkoutProgram | null> {
  const q = new URLSearchParams({ profile_id: profileId });
  const result = await call<{ success: boolean; program?: WorkoutProgram; message?: string }>(`/programs/${programId}?${q}`);
  return result.success && result.program ? WorkoutProgramSchema.parse(result.program) : null;
}

export async function createProgram(request: { profile_id: string; name: string; description?: string; color?: string; icon?: string }): Promise<WorkoutProgram | null> {
  const result = await call<{ success: boolean; program?: WorkoutProgram; message: string }>(
    '/programs', { method: 'POST', body: JSON.stringify(request) }
  );
  return result.success && result.program ? WorkoutProgramSchema.parse(result.program) : null;
}

export async function updateProgram(programId: string, request: Record<string, unknown>): Promise<WorkoutProgram | null> {
  const result = await call<{ success: boolean; program?: WorkoutProgram; message: string }>(
    `/programs/${programId}`, { method: 'PATCH', body: JSON.stringify(request) }
  );
  return result.success && result.program ? WorkoutProgramSchema.parse(result.program) : null;
}

export async function deleteProgram(programId: string, profileId: string): Promise<boolean> {
  const q = new URLSearchParams({ profile_id: profileId });
  const result = await call<{ success: boolean; message: string }>(`/programs/${programId}?${q}`, { method: 'DELETE' });
  return result.success;
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export async function getUserTags(profileId: string): Promise<UserTag[]> {
  const q = new URLSearchParams({ profile_id: profileId });
  const result = await call<GetTagsResponse>(`/tags?${q}`);
  return (result.tags || []).map(t => UserTagSchema.parse(t));
}

export async function createUserTag(profileId: string, name: string, color?: string): Promise<UserTag | null> {
  const result = await call<{ success: boolean; tag?: UserTag; message: string }>(
    '/tags', { method: 'POST', body: JSON.stringify({ profile_id: profileId, name, color }) }
  );
  return result.success && result.tag ? UserTagSchema.parse(result.tag) : null;
}

export async function deleteUserTag(tagId: string, profileId: string): Promise<boolean> {
  const q = new URLSearchParams({ profile_id: profileId });
  const result = await call<{ success: boolean; message: string }>(`/tags/${tagId}?${q}`, { method: 'DELETE' });
  return result.success;
}
