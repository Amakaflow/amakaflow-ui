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
  // If profileId provided, try to fetch from API
  if (profileId) {
    try {
      const savedWorkouts = await getWorkoutsFromAPI({
        profile_id: profileId,
        limit: 100,
      });
      
      // Convert SavedWorkout to WorkoutHistoryItem format
      const apiHistory: WorkoutHistoryItem[] = savedWorkouts
        .filter((workout) => workout.workout_data != null) // Filter out workouts with missing data
        .map((workout) => ({
          id: workout.id,
          workout: workout.workout_data || { title: 'Untitled Workout', blocks: [] }, // Ensure workout_data exists
          sources: workout.sources || [],
          device: workout.device as DeviceId,
          exports: workout.exports,
          validation: workout.validation, // Include validation data
          createdAt: workout.created_at,
          updatedAt: workout.updated_at,
          syncedToStrava: workout.synced_to_strava,
          stravaActivityId: workout.strava_activity_id,
          // Add export status (not in original type, but useful)
          isExported: workout.is_exported,
          exportedAt: workout.exported_at,
          exportedToDevice: workout.exported_to_device,
        } as WorkoutHistoryItem & { isExported?: boolean; exportedAt?: string; exportedToDevice?: string }));
      
      // Also get localStorage history for backward compatibility
      const localHistory = getWorkoutHistoryFromLocalStorage();
      
      // Merge: prefer API data, but include unique localStorage items
      const apiIds = new Set(apiHistory.map(item => item.id));
      const uniqueLocal = localHistory.filter(item => !apiIds.has(item.id));
      
      // Combine API and localStorage history
      const combined = [...apiHistory, ...uniqueLocal];
      
      // Deduplicate by title + date + device (same workout saved multiple times)
      const deduplicated = combined.reduce((acc, item) => {
        // Create a unique key based on title, date (within same day), and device
        const date = new Date(item.createdAt);
        const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
        const title = item.workout?.title || 'Untitled Workout';
        const key = `${title.toLowerCase().trim()}:${dateKey}:${item.device}`;
        
        // Check if we already have a workout with this key
        const existingIndex = acc.findIndex((existing) => {
          const existingDate = new Date(existing.createdAt);
          const existingDateKey = `${existingDate.getFullYear()}-${existingDate.getMonth()}-${existingDate.getDate()}`;
          const existingTitle = existing.workout?.title || 'Untitled Workout';
          const existingKey = `${existingTitle.toLowerCase().trim()}:${existingDateKey}:${existing.device}`;
          return existingKey === key;
        });
        
        if (existingIndex === -1) {
          // New unique workout
          acc.push(item);
        } else {
          // Duplicate found - keep the one with exports or newer timestamp
          const existing = acc[existingIndex];
          const existingHasExports = !!(existing.exports);
          const itemHasExports = !!(item.exports);
          
          if (itemHasExports && !existingHasExports) {
            // Replace with the one that has exports
            acc[existingIndex] = item;
          } else if (!itemHasExports && !existingHasExports) {
            // Both don't have exports, keep the newer one
            const existingDate = new Date(existing.createdAt).getTime();
            const itemDate = new Date(item.createdAt).getTime();
            if (itemDate > existingDate) {
              acc[existingIndex] = item;
            }
          }
        }
        
        return acc;
      }, [] as WorkoutHistoryItem[]);
      
      return deduplicated.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // Newest first
      });
    } catch (error) {
      console.error('Failed to load workout history from API:', error);
      // Fallback to localStorage
      return getWorkoutHistoryFromLocalStorage();
    }
  }
  
  // No profileId, use localStorage only
  return getWorkoutHistoryFromLocalStorage();
}

/**
 * Get workout history from localStorage only (for backward compatibility)
 */
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
export async function deleteWorkoutFromHistory(id: string, profileId?: string): Promise<boolean> {
  // Try to delete from API first if profileId is provided
  if (profileId) {
    try {
      const { deleteWorkoutFromAPI } = await import('./workout-api');
      const deleted = await deleteWorkoutFromAPI(id, profileId);
      if (deleted) {
        console.log(`Workout ${id} deleted from API`);
      }
    } catch (error) {
      console.error('Failed to delete workout from API:', error);
      // Continue to delete from localStorage anyway
    }
  }
  
  // Delete from localStorage
  try {
    const history = getWorkoutHistoryFromLocalStorage();
    const filtered = history.filter(item => item.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Failed to delete workout from localStorage:', error);
    return false;
  }
}

export function clearWorkoutHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.error('Failed to clear workout history:', error);
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