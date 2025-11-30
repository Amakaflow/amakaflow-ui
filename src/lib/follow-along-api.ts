import { ENABLE_GARMIN_DEBUG } from './env';
import type {
  FollowAlongWorkout,
  IngestFollowAlongRequest,
  IngestFollowAlongResponse,
  ListFollowAlongResponse,
  GetFollowAlongResponse,
  PushToGarminResponse,
  PushToAppleWatchResponse,
  PushToIOSCompanionResponse,
  VideoPlatform,
} from "../types/follow-along";

const MAPPER_API_BASE_URL = import.meta.env.VITE_MAPPER_API_URL || "http://localhost:8001";

/**
 * Ingest a follow-along workout from Instagram URL
 * Uses mapper-api endpoint
 */
export async function ingestFollowAlong(
  instagramUrl: string,
  userId: string
): Promise<IngestFollowAlongResponse> {
  
  const response = await fetch(`${MAPPER_API_BASE_URL}/follow-along/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instagramUrl,
      userId,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `Failed to ingest Instagram workout: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.message || "Failed to ingest workout");
  }

  return { followAlongWorkout: result.followAlongWorkout };
}

/**
 * List all follow-along workouts for the current user
 * Uses mapper-api endpoint
 */
export async function listFollowAlong(userId: string): Promise<ListFollowAlongResponse> {
  
  const response = await fetch(`${MAPPER_API_BASE_URL}/follow-along?userId=${userId}`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `Failed to list workouts: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.message || "Failed to list workouts");
  }

  // Transform database format to TypeScript types
  const items: FollowAlongWorkout[] = (result.items || []).map((w: any) => ({
    id: w.id,
    userId: w.user_id,
    source: w.source as VideoPlatform,
    sourceUrl: w.source_url,
    title: w.title,
    description: w.description,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
    videoDurationSec: w.video_duration_sec,
    thumbnailUrl: w.thumbnail_url,
    videoProxyUrl: w.video_proxy_url,
    steps: (w.steps || [])
      .sort((a: any, b: any) => a.order - b.order)
      .map((s: any) => ({
        id: s.id,
        order: s.order,
        label: s.label,
        canonicalExerciseId: s.canonical_exercise_id,
        startTimeSec: s.start_time_sec,
        endTimeSec: s.end_time_sec,
        durationSec: s.duration_sec,
        targetReps: s.target_reps,
        targetDurationSec: s.target_duration_sec,
        intensityHint: s.intensity_hint as "easy" | "moderate" | "hard" | undefined,
        notes: s.notes,
      })),
    garminWorkoutId: w.garmin_workout_id,
    garminLastSyncAt: w.garmin_last_sync_at,
    appleWatchWorkoutId: w.apple_watch_workout_id,
    appleWatchLastSyncAt: w.apple_watch_last_sync_at,
  }));

  return { items };
}

/**
 * Get a single follow-along workout by ID
 * Uses mapper-api endpoint
 */
export async function getFollowAlong(id: string, userId: string): Promise<GetFollowAlongResponse> {
  
  const response = await fetch(`${MAPPER_API_BASE_URL}/follow-along/${id}?userId=${userId}`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `Failed to get workout: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.message || "Workout not found");
  }

  // Transform database format to TypeScript types
  const w = result.followAlongWorkout;
  const followAlongWorkout: FollowAlongWorkout = {
    id: w.id,
    userId: w.user_id,
    source: w.source as VideoPlatform,
    sourceUrl: w.source_url,
    title: w.title,
    description: w.description,
    createdAt: w.created_at,
    updatedAt: w.updated_at,
    videoDurationSec: w.video_duration_sec,
    thumbnailUrl: w.thumbnail_url,
    videoProxyUrl: w.video_proxy_url,
    steps: (w.steps || [])
      .sort((a: any, b: any) => a.order - b.order)
      .map((s: any) => ({
        id: s.id,
        order: s.order,
        label: s.label,
        canonicalExerciseId: s.canonical_exercise_id,
        startTimeSec: s.start_time_sec,
        endTimeSec: s.end_time_sec,
        durationSec: s.duration_sec,
        targetReps: s.target_reps,
        targetDurationSec: s.target_duration_sec,
        intensityHint: s.intensity_hint as "easy" | "moderate" | "hard" | undefined,
        notes: s.notes,
      })),
    garminWorkoutId: w.garmin_workout_id,
    garminLastSyncAt: w.garmin_last_sync_at,
    appleWatchWorkoutId: w.apple_watch_workout_id,
    appleWatchLastSyncAt: w.apple_watch_last_sync_at,
  };

  return { followAlongWorkout };
}

/**
 * Push follow-along workout to Garmin
 * Uses mapper-api endpoint
 */
export async function pushToGarmin(id: string, userId: string, scheduleDate?: string): Promise<PushToGarminResponse> {
  // Guard: Check if unofficial Garmin sync is enabled
  if (import.meta.env.VITE_GARMIN_UNOFFICIAL_SYNC_ENABLED !== "true") {
    console.warn("Garmin Sync disabled — feature flag not enabled.");
    return {
      status: "error",
      message: "Garmin Sync (Unofficial API) is currently disabled. Enable GARMIN_UNOFFICIAL_SYNC_ENABLED for personal testing.",
    };
  }
  
  const body = { userId, scheduleDate: scheduleDate || null };
  
  if (ENABLE_GARMIN_DEBUG) {
    console.log("=== FRONTEND_FOLLOW_ALONG_REQUEST ===", body);
  }
  
  const response = await fetch(`${MAPPER_API_BASE_URL}/follow-along/${id}/push/garmin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    return {
      status: "error",
      message: error.message || `Failed to sync to Garmin: ${response.statusText}`,
    };
  }

  const result = await response.json();
  
  if (ENABLE_GARMIN_DEBUG) {
    console.log("=== FRONTEND_FOLLOW_ALONG_RESPONSE ===", result);
  }
  
  if (result.status === "already_synced") {
    return {
      alreadySynced: true,
      status: "already_synced",
      garminWorkoutId: result.garminWorkoutId,
    };
  }
  
  if (!result.success) {
    return {
      status: "error",
      message: result.message || "Failed to sync to Garmin",
    };
  }

  return {
    status: result.status,
    garminWorkoutId: result.garminWorkoutId,
  };
}

/**
 * Push follow-along workout to Apple Watch
 * Returns payload that can be sent via WatchConnectivity
 * Uses mapper-api endpoint
 */
export async function pushToAppleWatch(
  id: string,
  userId: string
): Promise<PushToAppleWatchResponse> {
  
  const response = await fetch(`${MAPPER_API_BASE_URL}/follow-along/${id}/push/apple-watch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    return {
      status: "error",
      message: error.message || `Failed to sync to Apple Watch: ${response.statusText}`,
    };
  }

  const result = await response.json();
  
  if (!result.success) {
    return {
      status: "error",
      message: result.message || "Failed to sync to Apple Watch",
    };
  }

  return {
    status: result.status,
    appleWatchWorkoutId: result.appleWatchWorkoutId,
    payload: result.payload,
  };
}

/**
 * Push follow-along workout to iOS Companion App
 * Returns payload formatted for the iOS app's WorkoutFlowView
 * Includes full video URLs for follow-along experience
 */
export async function pushToIOSCompanion(
  id: string,
  userId: string
): Promise<PushToIOSCompanionResponse> {
  
  const response = await fetch(`${MAPPER_API_BASE_URL}/follow-along/${id}/push/ios-companion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    return {
      status: "error",
      message: error.message || `Failed to sync to iOS Companion: ${response.statusText}`,
    };
  }

  const result = await response.json();
  
  if (!result.success) {
    return {
      status: "error",
      message: result.message || "Failed to sync to iOS Companion",
    };
  }

  return {
    status: result.status,
    iosCompanionWorkoutId: result.iosCompanionWorkoutId,
    payload: result.payload,
  };
}

/**
 * Detect video platform from URL
 */
export function detectVideoPlatform(url: string): VideoPlatform {
  if (!url) return 'other';
  
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('instagram.com')) return 'instagram';
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
  if (lowerUrl.includes('tiktok.com')) return 'tiktok';
  if (lowerUrl.includes('vimeo.com')) return 'vimeo';
  
  return 'other';
}

/**
 * Validate if a URL is a supported video platform
 */
export function isValidVideoUrl(url: string): boolean {
  if (!url) return false;
  
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Delete a follow-along workout
 * Uses mapper-api endpoint
 */
export async function deleteFollowAlong(id: string, userId: string): Promise<{ success: boolean; message?: string }> {
  
  const response = await fetch(`${MAPPER_API_BASE_URL}/follow-along/${id}?userId=${userId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    return {
      success: false,
      message: error.message || `Failed to delete workout: ${response.statusText}`,
    };
  }

  const result = await response.json();
  return {
    success: result.success,
    message: result.message,
  };
}
