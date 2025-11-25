import { WorkoutStructure, ExportFormats } from '../types/workout';
import { DeviceId } from './devices';
import { getWorkoutsFromAPI, SavedWorkout, updateWorkoutExportStatus } from './workout-api';

export type WorkoutHistoryItem = {
  id: string;
  workout: WorkoutStructure;
  sources: string[];
  device: DeviceId;
  exports?: ExportFormats;
  validation?: any; // ValidationResponse
  createdAt: string;
  updatedAt: string;
  syncedToStrava?: boolean;
  stravaActivityId?: string;
};

const HISTORY_KEY = 'amakaflow_workout_history';
const MAX_HISTORY_ITEMS = 50;

/**
 * Save workout to history (localStorage only - for backward compatibility)
 */
function saveWorkoutToHistoryLocalStorage(data: {
  workout: WorkoutStructure;
  sources: string[];
  device: DeviceId;
  exports?: ExportFormats;
}): WorkoutHistoryItem {
  // Use localStorage version to get synchronous array
  const history = getWorkoutHistoryFromLocalStorage();
  
  const item: WorkoutHistoryItem = {
    id: `workout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    workout: data.workout,
    sources: data.sources,
    device: data.device,
    exports: data.exports,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Add to beginning of array
  history.unshift(item);
  
  // Keep only the latest MAX_HISTORY_ITEMS
  const trimmedHistory = history.slice(0, MAX_HISTORY_ITEMS);
  
  // Save to localStorage
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmedHistory));
  } catch (error) {
    console.error('Failed to save workout history:', error);
  }
  
  return item;
}

/**
 * Save workout to history
 * Supports two calling patterns:
 * 1. saveWorkoutToHistory(profileId, workout, device, exports?, sources?)
 * 2. saveWorkoutToHistory({ workout, sources, device, exports })
 */
export async function saveWorkoutToHistory(
  profileIdOrData: string | {
    workout: WorkoutStructure;
    sources: string[];
    device: DeviceId;
    exports?: ExportFormats;
  },
  workout?: WorkoutStructure,
  device?: DeviceId,
  exports?: ExportFormats,
  sources?: string[],
  validation?: any
): Promise<WorkoutHistoryItem> {
  // Check if first parameter is a string (profileId) or an object (data)
  if (typeof profileIdOrData === 'string') {
    // API save mode - profileId provided
    const profileId = profileIdOrData;
    if (!workout || !device) {
      throw new Error('Workout and device are required when providing profileId');
    }
    
    // Try to save to API first
    try {
      const { saveWorkoutToAPI } = await import('./workout-api');
      const savedWorkout = await saveWorkoutToAPI({
        profile_id: profileId,
        workout_data: workout,
        sources: sources || [],
        device: device,
        exports: exports,
        validation: validation,
        title: workout.title || `Workout ${new Date().toLocaleDateString()}`,
      });
      
      // Convert SavedWorkout to WorkoutHistoryItem
      return {
        id: savedWorkout.id,
        workout: savedWorkout.workout_data,
        sources: savedWorkout.sources,
        device: savedWorkout.device as DeviceId,
        exports: savedWorkout.exports,
        validation: savedWorkout.validation, // Include validation data
        createdAt: savedWorkout.created_at,
        updatedAt: savedWorkout.updated_at,
        syncedToStrava: savedWorkout.synced_to_strava,
        stravaActivityId: savedWorkout.strava_activity_id,
      };
    } catch (error) {
      console.error('Failed to save workout to API, falling back to localStorage:', error);
      // Fallback to localStorage if API save fails
      return saveWorkoutToHistoryLocalStorage({
        workout,
        sources: sources || [],
        device,
        exports,
      });
    }
  } else {
    // localStorage mode - data object provided
    return saveWorkoutToHistoryLocalStorage(profileIdOrData);
  }
}

/**
 * Get workout history from API (Supabase) with localStorage fallback
 */
export async function getWorkoutHistory(profileId?: string): Promise<WorkoutHistoryItem[]> {
  const localHistory = getWorkoutHistoryFromLocalStorage();

  // No profileId → anonymous / local-only mode.
  if (!profileId) {
    return localHistory;
  }

  let apiHistory: WorkoutHistoryItem[] = [];

  try {
    const apiRaw = await getWorkoutsFromAPI({
      profile_id: profileId,
      limit: 100,
    });

    apiHistory = apiRaw.map((item: any) => normalizeApiWorkoutItem(item));
  } catch (err) {
    console.error('[getWorkoutHistory] Failed to fetch API history, falling back to local only:', err);
    return localHistory;
  }

  // Use a Map keyed by our dedupe key. API wins over local for same key.
  const byKey = new Map<string, WorkoutHistoryItem>();

  // 1) Insert API items first (source of truth).
  for (const item of apiHistory) {
    const key = getHistoryDedupKey(item);
    if (!key) continue;
    byKey.set(key, item);
  }

  // 2) Add local items only if that key does not exist yet.
  for (const item of localHistory) {
    const key = getHistoryDedupKey(item);
    if (!key) continue;
    if (!byKey.has(key)) {
      byKey.set(key, item);
    }
  }

  const merged = Array.from(byKey.values());

  // Optional: sort newest first.
  merged.sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  return merged;
}

/**
 * Get workout history from localStorage only (for backward compatibility)
 */

/**
 * Helper: normalize API items to the same shape as local history
 * Cursor: adjust this to your actual API shape.
 * The goal: always return an object that has:
 *   - id: string
 *   - workout?: { title?: string }
 *   - createdAt?: string
 *   - device?: string
 */
function normalizeApiWorkoutItem(item: SavedWorkout): WorkoutHistoryItem {
  // Example mapping — update according to your API response
  return {
    id: String(item.id), // make sure this matches what delete_workout() uses
    workout: item.workout_data || { title: 'Untitled workout', blocks: [] },
    sources: item.sources || [],
    device: item.device as DeviceId,
    exports: item.exports,
    validation: item.validation,
    createdAt: item.created_at ?? new Date().toISOString(),
    updatedAt: item.updated_at ?? new Date().toISOString(),
    syncedToStrava: item.synced_to_strava,
    stravaActivityId: item.strava_activity_id,
    // spread any other fields you need:
  } as WorkoutHistoryItem & { isExported?: boolean; exportedAt?: string; exportedToDevice?: string };
}

export function getWorkoutHistoryFromLocalStorage(): WorkoutHistoryItem[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    
    const history = JSON.parse(stored);
    if (!Array.isArray(history)) return [];
    
    // Filter out items with missing workout data
    return history.filter((item: WorkoutHistoryItem) => {
      if (!item.workout) {
        console.warn('Filtering out workout history item with missing workout data:', item);
        return false;
      }
      return true;
    });
  } catch (error) {
    console.error('Failed to load workout history from localStorage:', error);
    return [];
  }
}

/**
 * Delete a workout from both API and localStorage
 */

// ======================
// Helper: dedupe key
// ======================

/**
 * Build a stable key used to detect duplicates between API + localStorage.
 * Two items with the same (title, createdAt, device) are treated as the
 * same logical workout in the history UI.
 */
function getHistoryDedupKey(item: WorkoutHistoryItem): string {
  const title = item?.workout?.title ?? '';
  const createdAt = item?.createdAt ?? '';
  const device = item?.device ?? '';
  return `${title}::${createdAt}::${device}`;
}

// ======================
// deleteWorkoutFromHistory
// ======================

export async function deleteWorkoutFromHistory(id: string, profileId?: string): Promise<boolean> {
  try {
    // 1) If we have a profile, delete from API first.
    if (profileId) {
      const { deleteWorkoutFromAPI } = await import('./workout-api');
      const apiDeleted = await deleteWorkoutFromAPI(id, profileId);
      if (!apiDeleted) {
        console.error('[deleteWorkoutFromHistory] API delete failed for id:', id);
        return false;
      }
    }

    // 2) Delete from localStorage.
    const history = getWorkoutHistoryFromLocalStorage();

    // Find the item in local history to derive its dedupe key
    const itemToDelete = history.find((h) => h.id === id);

    let filtered: WorkoutHistoryItem[];

    if (itemToDelete) {
      // Use dedupe key so ALL local entries that would show as the same row
      // in the UI are removed.
      const targetKey = getHistoryDedupKey(itemToDelete);
      filtered = history.filter((h) => getHistoryDedupKey(h) !== targetKey);
    } else {
      // Fallback: no matching item found in local history, just filter by id.
      filtered = history.filter((h) => h.id !== id);
    }

    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
    console.log('[deleteWorkoutFromHistory] Deleted from localStorage, id:', id);

    return true;
  } catch (err) {
    console.error('[deleteWorkoutFromHistory] Error deleting workout:', err);
    return false;
  }
}

export async function clearWorkoutHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.error('Failed to clear workout history:', error);
  }
}
export async function clearAllWorkoutHistory(profileId?: string): Promise<boolean> {
  try {
    // 1) Delete all from API if profileId is provided
    if (profileId) {
      try {
        const { getWorkoutsFromAPI, deleteWorkoutFromAPI } = await import('./workout-api');
        const workouts = await getWorkoutsFromAPI({ profile_id: profileId, limit: 1000 });
        
        console.log(`[clearAllWorkoutHistory] Found ${workouts.length} workouts in API, deleting...`);
        
        // Delete each workout
        let deletedCount = 0;
        for (const workout of workouts) {
          const deleted = await deleteWorkoutFromAPI(workout.id, profileId);
          if (deleted) {
            deletedCount++;
          }
        }
        
        console.log(`[clearAllWorkoutHistory] Deleted ${deletedCount} workouts from API`);
      } catch (err) {
        console.error('[clearAllWorkoutHistory] Error deleting from API:', err);
        // Continue to clear localStorage even if API deletion fails
      }
    }

    // 2) Clear localStorage
    try {
      localStorage.removeItem(HISTORY_KEY);
      console.log('[clearAllWorkoutHistory] Cleared localStorage');
    } catch (err) {
      console.error('[clearAllWorkoutHistory] Error clearing localStorage:', err);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[clearAllWorkoutHistory] Error clearing workout history:', err);
    return false;
  }
}

export function updateStravaSyncStatus(workoutId: string, stravaActivityId: string): void {
  const history = getWorkoutHistory();
  const updated = history.map(item => 
    item.id === workoutId 
      ? { ...item, syncedToStrava: true, stravaActivityId, updatedAt: new Date().toISOString() }
      : item
  );
  
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to update Strava sync status:', error);
  }
}

export function getWorkoutStats(historyParam?: WorkoutHistoryItem[]) {
  // Only use localStorage sync version if no history provided
  const history = historyParam || getWorkoutHistoryFromLocalStorage();
  
  // Safety check: ensure history is an array
  if (!Array.isArray(history)) {
    return {
      totalWorkouts: 0,
      thisWeek: 0,
      deviceCounts: {},
      avgExercisesPerWorkout: 0
    };
  }
  
  const totalWorkouts = history.length;
  const thisWeek = history.filter(item => {
    if (!item || !item.createdAt) return false;
    try {
      const date = new Date(item.createdAt);
      if (isNaN(date.getTime())) return false;
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= weekAgo;
    } catch {
      return false;
    }
  }).length;
  
  const deviceCounts = history.reduce((acc, item) => {
    if (!item || !item.device) return acc;
    acc[item.device] = (acc[item.device] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const avgExercisesPerWorkout = history.length > 0
    ? history.reduce((sum, item) => {
        // Safety check: ensure workout and blocks exist
        if (!item || !item.workout || !Array.isArray(item.workout.blocks)) {
          return sum;
        }
        
        const count = item.workout.blocks.reduce((blockSum, block) => {
          if (!block) return blockSum;
          // Handle both old format (exercises directly on block) and new format (exercises in supersets)
          if (block.supersets && Array.isArray(block.supersets) && block.supersets.length > 0) {
            return blockSum + block.supersets.reduce((ssSum, ss) => {
              if (!ss || !Array.isArray(ss.exercises)) return ssSum;
              return ssSum + (ss.exercises.length || 0);
            }, 0);
          } else if (Array.isArray(block.exercises)) {
            return blockSum + (block.exercises.length || 0);
          }
          return blockSum;
        }, 0);
        return sum + count;
      }, 0) / history.length
    : 0;
  
  return {
    totalWorkouts,
    thisWeek,
    deviceCounts: {
      garmin: deviceCounts.garmin || 0,
      apple: deviceCounts.apple || 0,
      zwift: deviceCounts.zwift || 0,
    },
    avgExercisesPerWorkout: Math.round(avgExercisesPerWorkout)
  };
}