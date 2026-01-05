/**
 * Unified Workouts - Data Fetching and Normalization
 *
 * Fetches workouts from both WorkoutHistory and FollowAlong systems,
 * normalizes them into a unified format for display and filtering.
 */

import type {
  UnifiedWorkout,
  WorkoutCategory,
  WorkoutSourceType,
  DevicePlatform,
  VideoPlatform,
  SyncStatus,
} from '../types/unified-workout';
import type { WorkoutHistoryItem } from './workout-history';
import type { FollowAlongWorkout, FollowAlongStep } from '../types/follow-along';
import type { Block, Exercise, WorkoutStructure } from '../types/workout';
import type { DeviceId } from './devices';
import { getWorkoutHistory } from './workout-history';
import { listFollowAlong } from './follow-along-api';

// =============================================================================
// Category Detection
// =============================================================================

/**
 * Infer workout category from exercise types and names.
 * Uses a scoring system to determine the most appropriate category.
 */
function inferCategoryFromExercises(exercises: string[]): WorkoutCategory {
  if (exercises.length === 0) return 'other';

  const lowerExercises = exercises.map((e) => e.toLowerCase());
  const exerciseText = lowerExercises.join(' ');

  // Count exercises matching each category
  const scores: Record<WorkoutCategory, number> = {
    strength: 0,
    cardio: 0,
    hiit: 0,
    run: 0,
    cycling: 0,
    yoga: 0,
    mobility: 0,
    swimming: 0,
    walking: 0,
    other: 0,
  };

  // Strength exercises (most common in mixed workouts)
  const strengthPatterns = /squat|deadlift|press|curl|row|pull.?up|push.?up|lunge|bench|dumbbell|barbell|kettle|wall ball|sled|farmer|carry/i;
  // Running exercises
  const runPatterns = /\b(run|jog|sprint|tempo)\b/i;
  // Cardio machines and movements
  const cardioPatterns = /\b(ski|row|erg|bike|assault|echo|jump|box|rope|burpee|mountain climber)\b/i;
  // HIIT indicators
  const hiitPatterns = /hiit|tabata|emom|amrap|wod|crossfit/i;
  // Yoga/mobility
  const yogaPatterns = /yoga|pose|stretch|downward|warrior|pigeon/i;
  const mobilityPatterns = /mobility|foam roll|recovery|stretch/i;
  // Cycling
  const cyclingPatterns = /\b(cycle|bike|spin|cadence)\b/i;
  // Swimming
  const swimmingPatterns = /swim|freestyle|breaststroke|backstroke|butterfly/i;
  // Walking
  const walkingPatterns = /\b(walk|hike)\b/i;

  // Score each exercise
  for (const exercise of lowerExercises) {
    if (strengthPatterns.test(exercise)) scores.strength++;
    if (runPatterns.test(exercise)) scores.run++;
    if (cardioPatterns.test(exercise)) scores.cardio++;
    if (hiitPatterns.test(exercise)) scores.hiit++;
    if (yogaPatterns.test(exercise)) scores.yoga++;
    if (mobilityPatterns.test(exercise)) scores.mobility++;
    if (cyclingPatterns.test(exercise)) scores.cycling++;
    if (swimmingPatterns.test(exercise)) scores.swimming++;
    if (walkingPatterns.test(exercise)) scores.walking++;
  }

  // Check overall text for HIIT patterns (these override individual scores)
  if (hiitPatterns.test(exerciseText)) {
    return 'hiit';
  }

  // Mixed workouts with both strength and cardio exercises → HIIT
  if (scores.strength >= 2 && (scores.cardio >= 2 || scores.run >= 1)) {
    return 'hiit';
  }

  // Find highest scoring category
  let maxCategory: WorkoutCategory = 'strength';
  let maxScore = scores.strength;

  // Check each category (in priority order for ties)
  const priorities: WorkoutCategory[] = ['strength', 'hiit', 'cardio', 'run', 'yoga', 'mobility', 'cycling', 'swimming', 'walking'];
  for (const cat of priorities) {
    if (scores[cat] > maxScore) {
      maxScore = scores[cat];
      maxCategory = cat;
    }
  }

  // If no clear category from exercises, default to strength for workouts with exercises
  if (maxScore === 0 && exercises.length > 0) {
    return 'strength';
  }

  return maxCategory;
}

/**
 * Infer category from workout title
 */
function inferCategoryFromTitle(title: string): WorkoutCategory | null {
  const lower = title.toLowerCase();

  // Check specific workout types first (more specific patterns before general ones)
  if (lower.includes('hyrox') || lower.includes('crossfit') || lower.includes('wod')) return 'hiit';
  if (lower.includes('hiit') || lower.includes('tabata') || lower.includes('circuit') || lower.includes('emom') || lower.includes('amrap')) return 'hiit';
  if (lower.includes('strength') || lower.includes('lift') || lower.includes('weight') || lower.includes('leg day') || lower.includes('upper body') || lower.includes('lower body')) return 'strength';
  if (lower.includes('yoga')) return 'yoga';
  if (lower.includes('mobility') || lower.includes('stretch')) return 'mobility';
  if (lower.includes('cycle') || lower.includes('bike') || lower.includes('spin')) return 'cycling';
  if (lower.includes('swim')) return 'swimming';
  if (lower.includes('walk') || lower.includes('hike')) return 'walking';
  if (lower.includes('cardio')) return 'cardio';
  // Only categorize as "run" if it's clearly a running workout (not just contains "run")
  if (/\b(run|running|5k|10k|marathon|jog)\b/i.test(title) && !lower.includes('wall') && !lower.includes('ball')) return 'run';

  return null;
}

// =============================================================================
// Exercise Extraction
// =============================================================================

/**
 * Extract exercise names from WorkoutStructure blocks
 */
function extractExerciseNamesFromBlocks(blocks: Block[]): string[] {
  const names: string[] = [];

  for (const block of blocks) {
    // Get exercises directly in the block
    if (block.exercises) {
      for (const exercise of block.exercises) {
        if (exercise.name) {
          names.push(exercise.name);
        }
      }
    }

    // Get exercises from supersets
    if (block.supersets) {
      for (const superset of block.supersets) {
        if (superset.exercises) {
          for (const exercise of superset.exercises) {
            if (exercise.name) {
              names.push(exercise.name);
            }
          }
        }
      }
    }
  }

  return names;
}

/**
 * Extract exercise names from FollowAlong steps
 */
function extractExerciseNamesFromSteps(steps: FollowAlongStep[]): string[] {
  return steps.map((step) => step.label).filter(Boolean);
}

/**
 * Count exercises in WorkoutStructure blocks
 */
function countExercisesInBlocks(blocks: Block[]): number {
  let count = 0;

  for (const block of blocks) {
    // Count exercises directly in the block
    if (block.exercises) {
      count += block.exercises.length;
    }

    // Count exercises in supersets
    if (block.supersets) {
      for (const superset of block.supersets) {
        if (superset.exercises) {
          count += superset.exercises.length;
        }
      }
    }
  }

  return count;
}

/**
 * Estimate workout duration from blocks
 */
function estimateDurationFromBlocks(blocks: Block[]): number {
  let totalSec = 0;

  for (const block of blocks) {
    // Sum exercise durations
    const exercises = block.exercises || [];
    for (const exercise of exercises) {
      if (exercise.duration_sec) {
        totalSec += exercise.duration_sec;
      } else if (exercise.sets && exercise.reps) {
        // Estimate ~3 seconds per rep
        totalSec += exercise.sets * exercise.reps * 3;
      }
      if (exercise.rest_sec) {
        totalSec += exercise.rest_sec;
      }
    }

    // Sum superset durations
    if (block.supersets) {
      for (const superset of block.supersets) {
        for (const exercise of superset.exercises || []) {
          if (exercise.duration_sec) {
            totalSec += exercise.duration_sec;
          } else if (exercise.sets && exercise.reps) {
            totalSec += exercise.sets * exercise.reps * 3;
          }
        }
        if (superset.rest_between_sec) {
          totalSec += superset.rest_between_sec;
        }
      }
    }

    // Add block-level timing
    if (block.time_cap_sec) {
      totalSec = Math.max(totalSec, block.time_cap_sec);
    }
    if (block.rounds && block.rest_between_rounds_sec) {
      totalSec += (block.rounds - 1) * block.rest_between_rounds_sec;
    }
  }

  return totalSec;
}

// =============================================================================
// Device Platform Mapping
// =============================================================================

/**
 * Map DeviceId to DevicePlatform
 */
function mapDeviceIdToPlatform(deviceId: DeviceId): DevicePlatform {
  switch (deviceId) {
    case 'garmin':
    case 'garmin_usb':
      return 'garmin';
    case 'apple':
      return 'apple';
    case 'android-companion':
      return 'android-companion';
    case 'strava':
      return 'strava';
    case 'zwift':
      return 'zwift';
    default:
      return 'manual';
  }
}

// =============================================================================
// Searchable Text Builder
// =============================================================================

/**
 * Build searchable text from workout data
 */
function buildSearchableText(
  title: string,
  exerciseNames: string[],
  creator?: string,
  devicePlatform?: DevicePlatform,
  videoPlatform?: VideoPlatform,
  description?: string
): string {
  const parts: string[] = [
    title,
    ...exerciseNames,
    creator || '',
    devicePlatform || '',
    videoPlatform || '',
    description || '',
  ];

  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

// =============================================================================
// Normalization Functions
// =============================================================================

/**
 * Normalize WorkoutHistoryItem to UnifiedWorkout
 */
export function normalizeHistoryWorkout(item: WorkoutHistoryItem): UnifiedWorkout {
  const workout = item.workout;
  const blocks = workout?.blocks || [];
  const exerciseNames = extractExerciseNamesFromBlocks(blocks);
  const exerciseCount = countExercisesInBlocks(blocks);
  const durationSec = estimateDurationFromBlocks(blocks);
  const devicePlatform = mapDeviceIdToPlatform(item.device);

  // Determine source type
  let sourceType: WorkoutSourceType = 'manual';
  if (item.sources?.some((s) => s.includes('instagram') || s.includes('youtube') || s.includes('tiktok'))) {
    sourceType = 'video';
  } else if (item.sources?.some((s) => s.includes('ai') || s.includes('gpt'))) {
    sourceType = 'ai';
  } else if (devicePlatform !== 'manual') {
    sourceType = 'device';
  }

  // Infer category
  const titleCategory = inferCategoryFromTitle(workout?.title || '');
  const category = titleCategory || inferCategoryFromExercises(exerciseNames);

  // Build sync status
  const syncStatus: SyncStatus = {};
  if (item.syncedToStrava) {
    syncStatus.strava = {
      synced: true,
      id: item.stravaActivityId,
    };
  }

  const searchableText = buildSearchableText(
    workout?.title || 'Untitled',
    exerciseNames,
    undefined,
    devicePlatform,
    undefined,
    undefined
  );

  return {
    id: item.id,
    title: workout?.title || 'Untitled Workout',
    category,
    sourceType,
    devicePlatform,
    sourceUrl: item.sources?.[0],
    durationSec,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    exerciseCount,
    exerciseNames,
    syncStatus,
    _original: {
      type: 'history',
      data: item,
    },
    searchableText,
    // AMA-122: Favorites, usage tracking, tags, programs
    isFavorite: (item as any).isFavorite ?? false,
    favoriteOrder: (item as any).favoriteOrder,
    lastUsedAt: (item as any).lastUsedAt,
    timesCompleted: (item as any).timesCompleted ?? 0,
    tags: (item as any).tags ?? [],
    programId: (item as any).programId,
    programDayOrder: (item as any).programDayOrder,
  };
}

/**
 * Normalize FollowAlongWorkout to UnifiedWorkout
 */
export function normalizeFollowAlongWorkout(item: FollowAlongWorkout): UnifiedWorkout {
  const exerciseNames = extractExerciseNamesFromSteps(item.steps || []);
  const exerciseCount = item.steps?.length || 0;
  const durationSec = item.videoDurationSec || item.steps?.reduce((sum, s) => sum + (s.durationSec || 0), 0) || 0;

  // Infer category
  const titleCategory = inferCategoryFromTitle(item.title || '');
  const category = titleCategory || inferCategoryFromExercises(exerciseNames);

  // Build sync status
  const syncStatus: SyncStatus = {};
  if (item.garminWorkoutId) {
    syncStatus.garmin = {
      synced: true,
      id: item.garminWorkoutId,
      syncedAt: item.garminLastSyncAt || undefined,
    };
  }
  if (item.appleWatchWorkoutId) {
    syncStatus.apple = {
      synced: true,
      id: item.appleWatchWorkoutId,
      syncedAt: item.appleWatchLastSyncAt || undefined,
    };
  }
  if (item.iosCompanionSyncedAt) {
    syncStatus.ios = {
      synced: true,
      syncedAt: item.iosCompanionSyncedAt,
    };
  }

  const searchableText = buildSearchableText(
    item.title || 'Untitled',
    exerciseNames,
    undefined,
    undefined,
    item.source,
    item.description
  );

  return {
    id: item.id,
    title: item.title || 'Untitled Workout',
    category,
    sourceType: 'video',
    videoPlatform: item.source,
    sourceUrl: item.sourceUrl,
    thumbnailUrl: item.thumbnailUrl,
    description: item.description,
    durationSec,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    exerciseCount,
    exerciseNames,
    syncStatus,
    _original: {
      type: 'follow-along',
      data: item,
    },
    searchableText,
    // AMA-122: Favorites, usage tracking, tags, programs
    isFavorite: (item as any).isFavorite ?? false,
    favoriteOrder: (item as any).favoriteOrder,
    lastUsedAt: (item as any).lastUsedAt,
    timesCompleted: (item as any).timesCompleted ?? 0,
    tags: (item as any).tags ?? [],
    programId: (item as any).programId,
    programDayOrder: (item as any).programDayOrder,
  };
}

// =============================================================================
// Data Fetching
// =============================================================================

export interface FetchWorkoutsOptions {
  /** User profile ID for API calls */
  profileId: string;
  /** Include workout history items */
  includeHistory?: boolean;
  /** Include follow-along workouts */
  includeFollowAlong?: boolean;
}

export interface FetchWorkoutsResult {
  workouts: UnifiedWorkout[];
  historyCount: number;
  followAlongCount: number;
  errors: string[];
}

/**
 * Fetch and normalize all workouts from both sources
 */
export async function fetchAllWorkouts(options: FetchWorkoutsOptions): Promise<FetchWorkoutsResult> {
  const { profileId, includeHistory = true, includeFollowAlong = true } = options;

  const errors: string[] = [];
  const allWorkouts: UnifiedWorkout[] = [];
  let historyCount = 0;
  let followAlongCount = 0;

  // Fetch from both sources in parallel
  const [historyResult, followAlongResult] = await Promise.allSettled([
    includeHistory ? getWorkoutHistory(profileId) : Promise.resolve([]),
    includeFollowAlong ? listFollowAlong(profileId) : Promise.resolve({ items: [] }),
  ]);

  // Process history results
  if (historyResult.status === 'fulfilled') {
    const historyItems = historyResult.value;
    historyCount = historyItems.length;
    for (const item of historyItems) {
      try {
        allWorkouts.push(normalizeHistoryWorkout(item));
      } catch (err) {
        console.error('[fetchAllWorkouts] Error normalizing history item:', err);
        errors.push(`Failed to normalize history item ${item.id}`);
      }
    }
  } else {
    console.error('[fetchAllWorkouts] Error fetching history:', historyResult.reason);
    errors.push('Failed to fetch workout history');
  }

  // Process follow-along results
  if (followAlongResult.status === 'fulfilled') {
    const followAlongItems = followAlongResult.value.items || [];
    followAlongCount = followAlongItems.length;
    for (const item of followAlongItems) {
      try {
        allWorkouts.push(normalizeFollowAlongWorkout(item));
      } catch (err) {
        console.error('[fetchAllWorkouts] Error normalizing follow-along item:', err);
        errors.push(`Failed to normalize follow-along item ${item.id}`);
      }
    }
  } else {
    console.error('[fetchAllWorkouts] Error fetching follow-along:', followAlongResult.reason);
    errors.push('Failed to fetch follow-along workouts');
  }

  // Sort by creation date (newest first)
  allWorkouts.sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();
    return bTime - aTime;
  });

  return {
    workouts: allWorkouts,
    historyCount,
    followAlongCount,
    errors,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSec = seconds % 60;

  if (minutes < 60) {
    return remainingSec > 0 ? `${minutes}m ${remainingSec}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMin = minutes % 60;

  if (remainingMin > 0) {
    return `${hours}h ${remainingMin}m`;
  }
  return `${hours}h`;
}

/**
 * Get a relative time string (e.g., "2 hours ago", "yesterday")
 */
export function getRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return date.toLocaleDateString();
}
