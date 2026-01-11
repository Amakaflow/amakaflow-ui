/**
 * Account management API functions (AMA-200)
 *
 * Communicates with mapper-api for account operations.
 */

import { authenticatedFetch } from './authenticated-fetch';
import { API_URLS } from './config';

// Types
export interface DeletionPreview {
  workouts: number;
  workout_completions: number;
  programs: number;
  tags: number;
  follow_along_workouts: number;
  paired_devices: number;
  voice_settings: boolean;
  voice_corrections: number;
  strava_connection: boolean;
  garmin_connection: boolean;
  total_items: number;
  has_ios_devices: boolean;
  has_external_connections: boolean;
}

/**
 * Get a preview of all user data that will be deleted when account is deleted.
 */
export async function getDeletionPreview(): Promise<DeletionPreview> {
  const response = await authenticatedFetch(`${API_URLS.MAPPER}/account/deletion-preview`);

  if (!response.ok) {
    throw new Error(`Failed to fetch deletion preview: ${response.statusText}`);
  }

  return response.json();
}

export interface DeletionResult {
  success: boolean;
  deleted?: Record<string, number>;
  error?: string;
}

/**
 * Delete user account and all associated data from the database.
 * Note: This does NOT delete the Clerk user - that should be done separately.
 */
export async function deleteAccountData(): Promise<DeletionResult> {
  const response = await authenticatedFetch(`${API_URLS.MAPPER}/account`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to delete account: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get data summary counts for clear data preview (AMA-306).
 * Uses the same endpoint as deletion preview since it returns the same counts.
 */
export async function getDataSummary(): Promise<DeletionPreview> {
  return getDeletionPreview();
}

/**
 * Clear all user data without deleting the account (AMA-306).
 * Uses JWT authentication - no additional secret required.
 * Only available in dev/staging environments.
 */
export async function clearUserData(): Promise<DeletionResult> {
  const response = await authenticatedFetch(`${API_URLS.MAPPER}/testing/reset-user-data`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(error.detail || `Failed to clear user data: ${response.statusText}`);
  }

  return response.json();
}
