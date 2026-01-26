/**
 * Training Program API Client
 *
 * Client for communicating with the calendar-api for training program management.
 * Handles fetching, updating, and deleting AI-generated training programs.
 */

import { authenticatedFetch } from './authenticated-fetch';
import { API_URLS } from './config';
import type { TrainingProgram, ProgramStatus, ProgramWorkout } from '../types/training-program';

const CALENDAR_API_BASE_URL = API_URLS.CALENDAR;

async function trainingProgramApiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${CALENDAR_API_BASE_URL}${endpoint}`;
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
    const errorMessage = error.detail
      ? (Array.isArray(error.detail)
        ? error.detail.map((e: any) => `${e.loc?.join('.')}: ${e.msg}`).join(', ')
        : error.detail)
      : (error.message || `Training Program API error: ${response.status} ${response.statusText}`);
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Get a training program by ID with all weeks and workouts
 * @throws Error if the API call fails (network error, server error, etc.)
 * @returns TrainingProgram if found, null if not found
 */
export async function getTrainingProgram(
  programId: string,
  userId: string
): Promise<TrainingProgram | null> {
  const queryParams = new URLSearchParams({ user_id: userId });
  const response = await trainingProgramApiCall<{
    success: boolean;
    program?: TrainingProgram;
    message?: string;
  }>(`/training-programs/${programId}?${queryParams.toString()}`);

  return response.success ? response.program || null : null;
}

/**
 * Get all training programs for a user
 * @throws Error if the API call fails (network error, server error, etc.)
 */
export async function getTrainingPrograms(
  userId: string,
  includeArchived: boolean = false
): Promise<TrainingProgram[]> {
  const queryParams = new URLSearchParams({
    user_id: userId,
    include_archived: includeArchived.toString(),
  });

  const response = await trainingProgramApiCall<{
    success: boolean;
    programs: TrainingProgram[];
    count: number;
  }>(`/training-programs?${queryParams.toString()}`);

  return response.programs || [];
}

/**
 * Update program status (activate, pause, archive, etc.)
 * @throws Error if the API call fails (network error, server error, etc.)
 */
export async function updateProgramStatus(
  programId: string,
  userId: string,
  status: ProgramStatus
): Promise<boolean> {
  const response = await trainingProgramApiCall<{
    success: boolean;
    message: string;
  }>(`/training-programs/${programId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ user_id: userId, status }),
  });

  return response.success;
}

/**
 * Update current week progress
 * @throws Error if the API call fails (network error, server error, etc.)
 */
export async function updateProgramProgress(
  programId: string,
  userId: string,
  currentWeek: number
): Promise<boolean> {
  const response = await trainingProgramApiCall<{
    success: boolean;
    message: string;
  }>(`/training-programs/${programId}/progress`, {
    method: 'PATCH',
    body: JSON.stringify({ user_id: userId, current_week: currentWeek }),
  });

  return response.success;
}

/**
 * Delete a training program
 * @throws Error if the API call fails (network error, server error, etc.)
 */
export async function deleteTrainingProgram(
  programId: string,
  userId: string
): Promise<boolean> {
  const response = await trainingProgramApiCall<{
    success: boolean;
    message: string;
  }>(`/training-programs/${programId}`, {
    method: 'DELETE',
    body: JSON.stringify({ user_id: userId }),
  });

  return response.success;
}

/**
 * Mark a workout as complete
 * @throws Error if the API call fails (network error, server error, etc.)
 */
export async function markWorkoutComplete(
  workoutId: string,
  userId: string,
  isCompleted: boolean = true
): Promise<boolean> {
  const response = await trainingProgramApiCall<{
    success: boolean;
    message: string;
  }>(`/training-programs/workouts/${workoutId}/complete`, {
    method: 'PATCH',
    body: JSON.stringify({ user_id: userId, is_completed: isCompleted }),
  });

  return response.success;
}

/**
 * Get a single workout by ID
 * @throws Error if the API call fails (network error, server error, etc.)
 * @returns ProgramWorkout if found, null if not found
 */
export async function getProgramWorkout(
  workoutId: string,
  userId: string
): Promise<ProgramWorkout | null> {
  const queryParams = new URLSearchParams({ user_id: userId });
  const response = await trainingProgramApiCall<{
    success: boolean;
    workout?: ProgramWorkout;
    message?: string;
  }>(`/training-programs/workouts/${workoutId}?${queryParams.toString()}`);

  return response.success ? response.workout || null : null;
}

/**
 * Check if the training program API is available
 */
export async function checkTrainingProgramApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${CALENDAR_API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
