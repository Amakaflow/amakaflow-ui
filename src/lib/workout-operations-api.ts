/**
 * API client for workout edit and mix endpoints.
 * Connects to workout-ingestor-api (port 8004).
 */

import { authenticatedFetch } from './authenticated-fetch';
import { API_URLS } from './config';
import {
  WorkoutOperation,
  ApplyOperationsResponse,
  MixSource,
  MixWorkoutsResponse,
} from '../types/workout-operations';

const BASE = API_URLS.INGESTOR;

async function ingestorPost<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await authenticatedFetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const detail = typeof error.detail === 'string'
      ? error.detail
      : JSON.stringify(error.detail ?? error);
    throw Object.assign(new Error(detail || `${response.status} ${response.statusText}`), {
      status: response.status,
      body: error,
    });
  }

  return response.json() as Promise<T>;
}

/**
 * POST /workouts/{id}/operations
 * Applies a list of operations to a saved workout.
 * Throws with status=409 on optimistic lock conflict.
 * Throws with status=422 on invalid operation.
 */
export async function applyWorkoutOperations(
  workoutId: string,
  operations: WorkoutOperation[],
  expectedUpdatedAt: string
): Promise<ApplyOperationsResponse> {
  return ingestorPost<ApplyOperationsResponse>(`/workouts/${workoutId}/operations`, {
    operations,
    expected_updated_at: expectedUpdatedAt,
  });
}

/**
 * POST /workouts/mix
 * Merges selected blocks from multiple saved workouts into a preview.
 * Throws with status=404 if a source workout is not found.
 * Throws with status=422 if a block index is out of range.
 */
export async function mixWorkouts(
  sources: MixSource[],
  title: string
): Promise<MixWorkoutsResponse> {
  return ingestorPost<MixWorkoutsResponse>('/workouts/mix', { sources, title });
}
