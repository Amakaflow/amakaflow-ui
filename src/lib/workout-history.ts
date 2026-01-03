// ui/src/lib/workout-history.ts
import { WorkoutStructure, ExportFormats } from '../types/workout';
import { DeviceId } from './devices';
import { getWorkoutsFromAPI, SavedWorkout } from './workout-api';

export type WorkoutHistoryItem = {
  id: string;
  workout: WorkoutStructure;
  sources: string[];
  device: DeviceId;
  exports?: ExportFormats;
  validation?: any;
  createdAt: string;
  updatedAt: string;
  syncedToStrava?: boolean;
  stravaActivityId?: string;
};

const LEGACY_HISTORY_KEY = 'amakaflow_workout_history';
const HISTORY_KEY_PREFIX = 'amakaflow_workout_history_';
const MAX_HISTORY_ITEMS = 50;

// Current user's profile ID for scoped localStorage (set by setCurrentProfileId)
let currentProfileId: string | null = null;

/**
 * Set the current profile ID for scoped localStorage operations.
 * Must be called when user logs in.
 */
export function setCurrentProfileId(profileId: string | null) {
  currentProfileId = profileId;
}

/**
 * Get the localStorage key for the current user.
 * Falls back to legacy key if no profile ID is set.
 */
function getHistoryKey(): string {
  if (currentProfileId) {
    return `${HISTORY_KEY_PREFIX}${currentProfileId}`;
  }
  return LEGACY_HISTORY_KEY;
}

// -----------------------------------------------------------------------------
// LocalStorage helpers
// -----------------------------------------------------------------------------

function readHistoryFromLocalStorage(): WorkoutHistoryItem[] {
  try {
    const stored = localStorage.getItem(getHistoryKey());
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    // Filter out bad entries (missing workout, etc.)
    return parsed.filter((item: any) => item && item.workout) as WorkoutHistoryItem[];
  } catch (err) {
    console.error('Failed to load workout history from localStorage:', err);
    return [];
  }
}

function writeHistoryToLocalStorage(history: WorkoutHistoryItem[]) {
  try {
    localStorage.setItem(getHistoryKey(), JSON.stringify(history));
  } catch (err) {
    console.error('Failed to save workout history to localStorage:', err);
  }
}

/**
 * Local-only save (used when no profileId is provided)
 */
function saveWorkoutToHistoryLocal(data: {
  workout: WorkoutStructure;
  sources: string[];
  device: DeviceId;
  exports?: ExportFormats;
}): WorkoutHistoryItem {
  const history = readHistoryFromLocalStorage();

  const item: WorkoutHistoryItem = {
    id: `workout_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    workout: data.workout,
    sources: data.sources,
    device: data.device,
    exports: data.exports,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  history.unshift(item);
  const trimmed = history.slice(0, MAX_HISTORY_ITEMS);
  writeHistoryToLocalStorage(trimmed);

  return item;
}

/**
 * Check if a string is a valid UUID format.
 * Database workouts have UUIDs, localStorage-only workouts have custom IDs like "workout_123456_abc".
 */
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Build a stable key used to detect duplicates between API + localStorage.
 * Uses title + device (without timestamp) for more stable deduplication.
 * Timestamps can vary between saves, causing duplicates to not be detected.
 */
function getHistoryDedupKey(item: WorkoutHistoryItem): string {
  const title = item?.workout?.title ?? '';
  const device = item?.device ?? '';
  // Don't include createdAt - it can vary between saves causing duplicate detection to fail
  return `${title}::${device}`;
}

/**
 * Normalize API item to WorkoutHistoryItem shape.
 */
function normalizeApiWorkoutItem(item: SavedWorkout): WorkoutHistoryItem {
  return {
    id: String(item.id),
    workout: item.workout_data || { title: 'Untitled workout', blocks: [] },
    sources: item.sources || [],
    device: item.device as DeviceId,
    exports: item.exports,
    validation: item.validation,
    createdAt: item.created_at ?? new Date().toISOString(),
    updatedAt: item.updated_at ?? new Date().toISOString(),
    syncedToStrava: item.synced_to_strava,
    stravaActivityId: item.strava_activity_id,
  };
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Save workout to history
 *
 * Two calling patterns:
 * 1) saveWorkoutToHistory(profileId, workout, device, exports?, sources?, validation?, workoutId?)
 * 2) saveWorkoutToHistory({ workout, sources, device, exports })
 */
export async function saveWorkoutToHistory(
  profileIdOrData:
    | string
    | {
        workout: WorkoutStructure;
        sources: string[];
        device: DeviceId;
        exports?: ExportFormats;
      },
  workout?: WorkoutStructure,
  device?: DeviceId,
  exports?: ExportFormats,
  sources?: string[],
  validation?: any,
  workoutId?: string  // AMA-206: Pass workout ID for explicit updates
): Promise<WorkoutHistoryItem> {
  // Pattern 2: local-only save
  if (typeof profileIdOrData !== 'string') {
    return saveWorkoutToHistoryLocal(profileIdOrData);
  }

  // Pattern 1: save via API (with local fallback)
  const profileId = profileIdOrData;

  if (!workout || !device) {
    throw new Error('Workout and device are required when providing profileId');
  }

  // DEBUG: Log workout exercises to trace warmup_sets persistence (AMA-94)
  console.log('[saveWorkoutToHistory] Saving workout exercises:',
    workout.blocks?.map(b => b.exercises?.map(e => ({
      name: e?.name,
      warmup_sets: e?.warmup_sets,
      warmup_reps: e?.warmup_reps
    }))));

  // AMA-206: Log if updating existing workout
  if (workoutId) {
    console.log('[saveWorkoutToHistory] Updating existing workout:', workoutId);
  }

  try {
    const { saveWorkoutToAPI } = await import('./workout-api');
    const saved = await saveWorkoutToAPI({
      profile_id: profileId,
      workout_data: workout,
      sources: sources || [],
      device,
      exports,
      validation,
      title: workout.title || `Workout ${new Date().toLocaleDateString()}`,
      workout_id: workoutId,  // AMA-206: Pass workout ID for explicit updates
    });

    return normalizeApiWorkoutItem(saved);
  } catch (err) {
    console.error(
      '[saveWorkoutToHistory] Failed to save to API, falling back to localStorage:',
      err
    );
    return saveWorkoutToHistoryLocal({
      workout,
      sources: sources || [],
      device,
      exports,
    });
  }
}

/**
 * Get workout history (API + local merged, API wins on conflicts).
 * When no profileId is provided, returns localStorage-only history.
 */
export async function getWorkoutHistory(profileId?: string): Promise<WorkoutHistoryItem[]> {
  const localHistory = readHistoryFromLocalStorage();

  if (!profileId) {
    return localHistory;
  }

  let apiHistory: WorkoutHistoryItem[] = [];

  try {
    const apiRaw = await getWorkoutsFromAPI({
      profile_id: profileId,
      limit: 100,
    });
    apiHistory = apiRaw.map(normalizeApiWorkoutItem);
  } catch (err) {
    console.error(
      '[getWorkoutHistory] Failed to fetch API history, falling back to local only:',
      err
    );
    return localHistory;
  }

  // Use two-phase deduplication:
  // 1. First deduplicate API items by ID (primary key - most reliable)
  // 2. Then use dedup key (title::device) to merge localStorage items

  const byId = new Map<string, WorkoutHistoryItem>();
  const byDedupKey = new Map<string, WorkoutHistoryItem>();

  // API is source of truth - deduplicate by ID first
  for (const item of apiHistory) {
    // Skip if we already have this ID (shouldn't happen but safety check)
    if (byId.has(item.id)) {
      console.log('[getWorkoutHistory] Duplicate API item by ID:', item.id);
      continue;
    }
    byId.set(item.id, item);

    // Also track by dedup key to prevent localStorage duplicates
    const dedupKey = getHistoryDedupKey(item);
    if (dedupKey) {
      byDedupKey.set(dedupKey, item);
    }
  }

  // Add local items only if they don't collide with an API item
  // Check both by ID and by dedup key
  for (const item of localHistory) {
    // Skip if we already have this ID from API
    if (byId.has(item.id)) {
      continue;
    }

    // Skip if we have an API item with the same dedup key (same workout)
    const dedupKey = getHistoryDedupKey(item);
    if (dedupKey && byDedupKey.has(dedupKey)) {
      continue;
    }

    // This is a unique local-only item, add it
    byId.set(item.id, item);
    if (dedupKey) {
      byDedupKey.set(dedupKey, item);
    }
  }

  const merged = Array.from(byId.values());

  merged.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  return merged;
}

/**
 * Explicit local-storage-only getter (used in a few places & tests)
 */
export function getWorkoutHistoryFromLocalStorage(): WorkoutHistoryItem[] {
  return readHistoryFromLocalStorage();
}

/**
 * Delete a workout from both API (if profileId provided and ID is UUID) and localStorage.
 * LocalStorage-only workouts have non-UUID IDs like "workout_123456_abc" and don't exist in the database.
 */
export async function deleteWorkoutFromHistory(
  id: string,
  profileId?: string
): Promise<boolean> {
  try {
    // Only call API if profileId is provided AND the ID is a valid UUID
    // Non-UUID IDs are localStorage-only workouts that don't exist in the database
    if (profileId && isValidUUID(id)) {
      const { deleteWorkoutFromAPI } = await import('./workout-api');
      const ok = await deleteWorkoutFromAPI(id, profileId);
      if (!ok) {
        console.error('[deleteWorkoutFromHistory] API delete failed for id:', id);
        return false;
      }
    } else if (profileId && !isValidUUID(id)) {
      console.log('[deleteWorkoutFromHistory] Skipping API call for non-UUID id (localStorage only):', id);
    }

    // Delete from localStorage by ID only (not by dedup key)
    // This prevents accidentally deleting multiple workouts that share the same dedup key
    const history = readHistoryFromLocalStorage();
    const filtered = history.filter((h) => h.id !== id);

    if (filtered.length < history.length) {
      writeHistoryToLocalStorage(filtered);
      console.log('[deleteWorkoutFromHistory] Deleted from localStorage, id:', id);
    } else {
      console.log('[deleteWorkoutFromHistory] Item not found in localStorage, id:', id);
    }

    return true;
  } catch (err) {
    console.error('[deleteWorkoutFromHistory] Error deleting workout:', err);
    return false;
  }
}

/**
 * Clear local workout history (localStorage only).
 */
export async function clearWorkoutHistory(): Promise<void> {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (err) {
    console.error('Failed to clear workout history:', err);
  }
}

/**
 * Clear all history: API (if profileId) + localStorage.
 */
export async function clearAllWorkoutHistory(profileId?: string): Promise<boolean> {
  try {
    if (profileId) {
      try {
        const { getWorkoutsFromAPI, deleteWorkoutFromAPI } = await import('./workout-api');
        const workouts = await getWorkoutsFromAPI({
          profile_id: profileId,
          limit: 1000,
        });

        let deletedCount = 0;
        for (const w of workouts) {
          const deleted = await deleteWorkoutFromAPI(w.id, profileId);
          if (deleted) deletedCount++;
        }
        console.log(
          `[clearAllWorkoutHistory] Deleted ${deletedCount}/${workouts.length} workouts from API`
        );
      } catch (err) {
        console.error('[clearAllWorkoutHistory] Error deleting from API:', err);
      }
    }

    try {
      localStorage.removeItem(HISTORY_KEY);
      console.log('[clearAllWorkoutHistory] Cleared localStorage');
    } catch (err) {
      console.error('[clearAllWorkoutHistory] Error clearing localStorage:', err);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[clearAllWorkoutHistory] Error:', err);
    return false;
  }
}

/**
 * Update Strava sync status in local history.
 * (Tests exercise this using local-only mode.)
 */
export function updateStravaSyncStatus(
  workoutId: string,
  stravaActivityId: string
): void {
  const history = readHistoryFromLocalStorage();
  if (!Array.isArray(history) || history.length === 0) return;

  const idx = history.findIndex((item) => item.id === workoutId);
  const now = new Date().toISOString();

  let finalHistory: WorkoutHistoryItem[];

  if (idx >= 0) {
    // Update the matched workout and move it to the front
    const target = {
      ...history[idx],
      syncedToStrava: true,
      stravaActivityId,
      updatedAt: now,
    };

    const rest = history.filter((_, i) => i !== idx);
    finalHistory = [target, ...rest];
  } else {
    // Fallback: no matching id, update the most recent workout (index 0)
    const [latest, ...rest] = history;
    const updatedLatest: WorkoutHistoryItem = {
      ...latest,
      syncedToStrava: true,
      stravaActivityId,
      updatedAt: now,
    };
    finalHistory = [updatedLatest, ...rest];
  }

  writeHistoryToLocalStorage(finalHistory);
}

/**
 * Basic stats over workout history.
 * For tests, when history is empty, deviceCounts should be {}.
 */
export function getWorkoutStats(
  historyParam?: WorkoutHistoryItem[]
): {
  totalWorkouts: number;
  thisWeek: number;
  deviceCounts: Record<string, number>;
  avgExercisesPerWorkout: number;
} {
  const history = historyParam ?? readHistoryFromLocalStorage();

  if (!Array.isArray(history) || history.length === 0) {
    return {
      totalWorkouts: 0,
      thisWeek: 0,
      deviceCounts: {},
      avgExercisesPerWorkout: 0,
    };
  }

  const totalWorkouts = history.length;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const thisWeek = history.filter((item) => {
    if (!item?.createdAt) return false;
    const d = new Date(item.createdAt);
    if (Number.isNaN(d.getTime())) return false;
    return d >= weekAgo;
  }).length;

  const deviceCounts = history.reduce((acc, item) => {
    if (!item?.device) return acc;
    acc[item.device] = (acc[item.device] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalExercises = history.reduce((sum, item) => {
    const blocks = item?.workout?.blocks;
    if (!Array.isArray(blocks)) return sum;

    const count = blocks.reduce((blockSum, block: any) => {
      if (!block) return blockSum;

      // New format: blocks -> supersets -> exercises
      if (Array.isArray(block.supersets) && block.supersets.length > 0) {
        return (
          blockSum +
          block.supersets.reduce((ssSum: number, ss: any) => {
            if (!ss || !Array.isArray(ss.exercises)) return ssSum;
            return ssSum + ss.exercises.length;
          }, 0)
        );
      }

      // Old format: block.exercises[]
      if (Array.isArray(block.exercises)) {
        return blockSum + block.exercises.length;
      }

      return blockSum;
    }, 0);

    return sum + count;
  }, 0);

  const avgExercisesPerWorkout =
    totalWorkouts > 0 ? Math.round(totalExercises / totalWorkouts) : 0;

  return {
    totalWorkouts,
    thisWeek,
    deviceCounts,
    avgExercisesPerWorkout,
  };
}