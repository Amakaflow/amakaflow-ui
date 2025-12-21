/**
 * Workout Filters - Filter State and Logic
 *
 * Provides filter state management and filtering/grouping logic
 * for the unified workouts page.
 */

import type {
  UnifiedWorkout,
  WorkoutCategory,
  WorkoutSourceType,
  DevicePlatform,
  VideoPlatform,
} from '../types/unified-workout';

// =============================================================================
// Filter Types
// =============================================================================

export type DateRangePreset = 'today' | 'week' | 'month' | '30days' | 'all' | 'custom';
export type SyncStatusFilter = 'all' | 'synced' | 'not-synced';

export interface WorkoutFilters {
  /** Search text (matches title, exercises, creator, etc.) */
  search: string;

  /** Filter by source type (device, video, manual, ai) */
  sourceTypes: WorkoutSourceType[];

  /** Filter by device platform (only applies when device source selected) */
  devicePlatforms: DevicePlatform[];

  /** Filter by video platform (only applies when video source selected) */
  videoPlatforms: VideoPlatform[];

  /** Filter by workout category */
  categories: WorkoutCategory[];

  /** Date range preset */
  dateRange: DateRangePreset;

  /** Custom date range start (ISO string) */
  customDateStart?: string;

  /** Custom date range end (ISO string) */
  customDateEnd?: string;

  /** Sync status filter */
  syncStatus: SyncStatusFilter;
}

export const DEFAULT_FILTERS: WorkoutFilters = {
  search: '',
  sourceTypes: [],
  devicePlatforms: [],
  videoPlatforms: [],
  categories: [],
  dateRange: 'all',
  syncStatus: 'all',
};

// =============================================================================
// Date Range Helpers
// =============================================================================

/**
 * Get start date for a date range preset
 */
function getDateRangeStart(preset: DateRangePreset, customStart?: string): Date | null {
  const now = new Date();

  switch (preset) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case 'week': {
      const start = new Date(now);
      const dayOfWeek = start.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = start of week
      start.setDate(start.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return start;
    }
    case '30days': {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return start;
    }
    case 'custom': {
      return customStart ? new Date(customStart) : null;
    }
    case 'all':
    default:
      return null;
  }
}

/**
 * Get end date for a date range preset
 */
function getDateRangeEnd(preset: DateRangePreset, customEnd?: string): Date | null {
  if (preset === 'custom' && customEnd) {
    const end = new Date(customEnd);
    end.setHours(23, 59, 59, 999);
    return end;
  }
  return null; // No end date means "up to now"
}

// =============================================================================
// Filter Functions
// =============================================================================

/**
 * Check if workout matches search text
 */
function matchesSearch(workout: UnifiedWorkout, search: string): boolean {
  if (!search.trim()) return true;

  const searchLower = search.toLowerCase().trim();
  return workout.searchableText.includes(searchLower);
}

/**
 * Check if workout matches source type filter
 */
function matchesSourceType(workout: UnifiedWorkout, sourceTypes: WorkoutSourceType[]): boolean {
  if (sourceTypes.length === 0) return true;
  return sourceTypes.includes(workout.sourceType);
}

/**
 * Check if workout matches device platform filter
 */
function matchesDevicePlatform(workout: UnifiedWorkout, devicePlatforms: DevicePlatform[]): boolean {
  if (devicePlatforms.length === 0) return true;
  if (!workout.devicePlatform) return false;
  return devicePlatforms.includes(workout.devicePlatform);
}

/**
 * Check if workout matches video platform filter
 */
function matchesVideoPlatform(workout: UnifiedWorkout, videoPlatforms: VideoPlatform[]): boolean {
  if (videoPlatforms.length === 0) return true;
  if (!workout.videoPlatform) return false;
  return videoPlatforms.includes(workout.videoPlatform);
}

/**
 * Check if workout matches category filter
 */
function matchesCategory(workout: UnifiedWorkout, categories: WorkoutCategory[]): boolean {
  if (categories.length === 0) return true;
  return categories.includes(workout.category);
}

/**
 * Check if workout matches date range filter
 */
function matchesDateRange(
  workout: UnifiedWorkout,
  dateRange: DateRangePreset,
  customStart?: string,
  customEnd?: string
): boolean {
  if (dateRange === 'all') return true;

  const workoutDate = new Date(workout.createdAt);
  const rangeStart = getDateRangeStart(dateRange, customStart);
  const rangeEnd = getDateRangeEnd(dateRange, customEnd);

  if (rangeStart && workoutDate < rangeStart) return false;
  if (rangeEnd && workoutDate > rangeEnd) return false;

  return true;
}

/**
 * Check if workout matches sync status filter
 */
function matchesSyncStatus(workout: UnifiedWorkout, syncStatus: SyncStatusFilter): boolean {
  if (syncStatus === 'all') return true;

  const { syncStatus: status } = workout;
  const isSynced =
    status.garmin?.synced ||
    status.apple?.synced ||
    status.strava?.synced ||
    status.ios?.synced;

  if (syncStatus === 'synced') return !!isSynced;
  if (syncStatus === 'not-synced') return !isSynced;

  return true;
}

/**
 * Filter workouts based on all filter criteria
 */
export function filterWorkouts(
  workouts: UnifiedWorkout[],
  filters: WorkoutFilters
): UnifiedWorkout[] {
  return workouts.filter((workout) => {
    // Search filter
    if (!matchesSearch(workout, filters.search)) return false;

    // Source type filter
    if (!matchesSourceType(workout, filters.sourceTypes)) return false;

    // Device platform filter (only apply if device source is selected or no source filter)
    if (
      filters.sourceTypes.length === 0 ||
      filters.sourceTypes.includes('device')
    ) {
      if (!matchesDevicePlatform(workout, filters.devicePlatforms)) return false;
    }

    // Video platform filter (only apply if video source is selected or no source filter)
    if (
      filters.sourceTypes.length === 0 ||
      filters.sourceTypes.includes('video')
    ) {
      if (!matchesVideoPlatform(workout, filters.videoPlatforms)) return false;
    }

    // Category filter
    if (!matchesCategory(workout, filters.categories)) return false;

    // Date range filter
    if (
      !matchesDateRange(
        workout,
        filters.dateRange,
        filters.customDateStart,
        filters.customDateEnd
      )
    ) {
      return false;
    }

    // Sync status filter
    if (!matchesSyncStatus(workout, filters.syncStatus)) return false;

    return true;
  });
}

// =============================================================================
// Date Grouping
// =============================================================================

export type DateGroupKey =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'older';

export interface DateGroup {
  key: DateGroupKey;
  label: string;
  workouts: UnifiedWorkout[];
}

/**
 * Get display label for date group
 */
function getDateGroupLabel(key: DateGroupKey): string {
  switch (key) {
    case 'today':
      return 'Today';
    case 'yesterday':
      return 'Yesterday';
    case 'thisWeek':
      return 'This Week';
    case 'lastWeek':
      return 'Last Week';
    case 'thisMonth':
      return 'This Month';
    case 'older':
      return 'Older';
  }
}

/**
 * Determine which date group a workout belongs to
 */
function getDateGroupKey(workoutDate: Date): DateGroupKey {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Get start of this week (Monday)
  const thisWeekStart = new Date(today);
  const dayOfWeek = thisWeekStart.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  thisWeekStart.setDate(thisWeekStart.getDate() - diff);

  // Get start of last week
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  // Get start of this month
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Compare workout date
  const workoutDay = new Date(
    workoutDate.getFullYear(),
    workoutDate.getMonth(),
    workoutDate.getDate()
  );

  if (workoutDay.getTime() === today.getTime()) {
    return 'today';
  }
  if (workoutDay.getTime() === yesterday.getTime()) {
    return 'yesterday';
  }
  if (workoutDay >= thisWeekStart) {
    return 'thisWeek';
  }
  if (workoutDay >= lastWeekStart) {
    return 'lastWeek';
  }
  if (workoutDay >= thisMonthStart) {
    return 'thisMonth';
  }
  return 'older';
}

/**
 * Group workouts by date categories
 */
export function groupWorkoutsByDate(workouts: UnifiedWorkout[]): DateGroup[] {
  const groups: Map<DateGroupKey, UnifiedWorkout[]> = new Map();

  // Initialize groups in order
  const orderedKeys: DateGroupKey[] = [
    'today',
    'yesterday',
    'thisWeek',
    'lastWeek',
    'thisMonth',
    'older',
  ];

  for (const key of orderedKeys) {
    groups.set(key, []);
  }

  // Group workouts
  for (const workout of workouts) {
    const workoutDate = new Date(workout.createdAt);
    const groupKey = getDateGroupKey(workoutDate);
    const group = groups.get(groupKey);
    if (group) {
      group.push(workout);
    }
  }

  // Convert to array of DateGroups (only include non-empty groups)
  const result: DateGroup[] = [];

  for (const key of orderedKeys) {
    const groupWorkouts = groups.get(key) || [];
    if (groupWorkouts.length > 0) {
      result.push({
        key,
        label: getDateGroupLabel(key),
        workouts: groupWorkouts,
      });
    }
  }

  return result;
}

// =============================================================================
// Filter Utilities
// =============================================================================

/**
 * Check if any filters are active (non-default)
 */
export function hasActiveFilters(filters: WorkoutFilters): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.sourceTypes.length > 0 ||
    filters.devicePlatforms.length > 0 ||
    filters.videoPlatforms.length > 0 ||
    filters.categories.length > 0 ||
    filters.dateRange !== 'all' ||
    filters.syncStatus !== 'all'
  );
}

/**
 * Count number of active filter groups
 */
export function countActiveFilters(filters: WorkoutFilters): number {
  let count = 0;

  if (filters.search.trim() !== '') count++;
  if (filters.sourceTypes.length > 0) count++;
  if (filters.devicePlatforms.length > 0) count++;
  if (filters.videoPlatforms.length > 0) count++;
  if (filters.categories.length > 0) count++;
  if (filters.dateRange !== 'all') count++;
  if (filters.syncStatus !== 'all') count++;

  return count;
}

/**
 * Get display label for date range preset
 */
export function getDateRangeLabel(preset: DateRangePreset): string {
  switch (preset) {
    case 'today':
      return 'Today';
    case 'week':
      return 'This Week';
    case 'month':
      return 'This Month';
    case '30days':
      return 'Last 30 Days';
    case 'all':
      return 'All Time';
    case 'custom':
      return 'Custom Range';
  }
}

/**
 * Get display label for sync status filter
 */
export function getSyncStatusLabel(status: SyncStatusFilter): string {
  switch (status) {
    case 'all':
      return 'All';
    case 'synced':
      return 'Synced';
    case 'not-synced':
      return 'Not Synced';
  }
}


// =============================================================================
// Sorting (AMA-122)
// =============================================================================

export type SortOption =
  | 'recently-added'
  | 'recently-used'
  | 'alphabetical-asc'
  | 'alphabetical-desc'
  | 'shortest-duration'
  | 'longest-duration'
  | 'fewest-exercises'
  | 'most-exercises';

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recently-added', label: 'Recently Added' },
  { value: 'recently-used', label: 'Recently Used' },
  { value: 'alphabetical-asc', label: 'Alphabetical (A-Z)' },
  { value: 'alphabetical-desc', label: 'Alphabetical (Z-A)' },
  { value: 'shortest-duration', label: 'Shortest Duration' },
  { value: 'longest-duration', label: 'Longest Duration' },
  { value: 'fewest-exercises', label: 'Fewest Exercises' },
  { value: 'most-exercises', label: 'Most Exercises' },
];

/**
 * Sort workouts based on selected sort option
 */
export function sortWorkouts(
  workouts: UnifiedWorkout[],
  sortOption: SortOption
): UnifiedWorkout[] {
  const sorted = [...workouts];

  switch (sortOption) {
    case 'recently-added':
      return sorted.sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      });

    case 'recently-used':
      return sorted.sort((a, b) => {
        // Workouts with lastUsedAt come first, sorted by most recent
        // Workouts without lastUsedAt come last, sorted by createdAt
        const aUsed = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
        const bUsed = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;

        if (aUsed && bUsed) return bUsed - aUsed;
        if (aUsed) return -1;
        if (bUsed) return 1;

        // Fall back to createdAt for never-used workouts
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    case 'alphabetical-asc':
      return sorted.sort((a, b) =>
        a.title.toLowerCase().localeCompare(b.title.toLowerCase())
      );

    case 'alphabetical-desc':
      return sorted.sort((a, b) =>
        b.title.toLowerCase().localeCompare(a.title.toLowerCase())
      );

    case 'shortest-duration':
      return sorted.sort((a, b) => a.durationSec - b.durationSec);

    case 'longest-duration':
      return sorted.sort((a, b) => b.durationSec - a.durationSec);

    case 'fewest-exercises':
      return sorted.sort((a, b) => a.exerciseCount - b.exerciseCount);

    case 'most-exercises':
      return sorted.sort((a, b) => b.exerciseCount - a.exerciseCount);

    default:
      return sorted;
  }
}


// =============================================================================
// Enhanced Filters (AMA-122)
// =============================================================================

export type DurationPreset = 'any' | 'quick' | 'medium' | 'long' | 'extended';

export const DURATION_PRESETS: { value: DurationPreset; label: string; minSec?: number; maxSec?: number }[] = [
  { value: 'any', label: 'Any Duration' },
  { value: 'quick', label: 'Quick (<20 min)', maxSec: 20 * 60 },
  { value: 'medium', label: 'Medium (20-45 min)', minSec: 20 * 60, maxSec: 45 * 60 },
  { value: 'long', label: 'Long (45-60 min)', minSec: 45 * 60, maxSec: 60 * 60 },
  { value: 'extended', label: 'Extended (60+ min)', minSec: 60 * 60 },
];

/**
 * Check if workout matches duration filter
 */
export function matchesDuration(workout: UnifiedWorkout, preset: DurationPreset): boolean {
  if (preset === 'any') return true;

  const presetConfig = DURATION_PRESETS.find(p => p.value === preset);
  if (!presetConfig) return true;

  const duration = workout.durationSec;

  if (presetConfig.minSec !== undefined && duration < presetConfig.minSec) return false;
  if (presetConfig.maxSec !== undefined && duration >= presetConfig.maxSec) return false;

  return true;
}

/**
 * Check if workout matches favorites filter
 */
export function matchesFavoritesOnly(workout: UnifiedWorkout, favoritesOnly: boolean): boolean {
  if (!favoritesOnly) return true;
  return workout.isFavorite;
}

/**
 * Check if workout matches tags filter
 */
export function matchesTags(workout: UnifiedWorkout, tags: string[]): boolean {
  if (tags.length === 0) return true;
  // Workout must have at least one of the selected tags
  return tags.some(tag => workout.tags.includes(tag));
}

/**
 * Check if workout matches creator filter
 */
export function matchesCreator(workout: UnifiedWorkout, creators: string[]): boolean {
  if (creators.length === 0) return true;
  if (!workout.creator) return false;
  return creators.includes(workout.creator);
}

/**
 * Extended filter function with new AMA-122 filters
 */
export function filterWorkoutsExtended(
  workouts: UnifiedWorkout[],
  filters: WorkoutFilters & {
    durationPreset?: DurationPreset;
    favoritesOnly?: boolean;
    tags?: string[];
    creators?: string[];
  }
): UnifiedWorkout[] {
  // First apply base filters
  let filtered = filterWorkouts(workouts, filters);

  // Then apply extended filters
  if (filters.durationPreset) {
    filtered = filtered.filter(w => matchesDuration(w, filters.durationPreset!));
  }

  if (filters.favoritesOnly) {
    filtered = filtered.filter(w => matchesFavoritesOnly(w, filters.favoritesOnly!));
  }

  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter(w => matchesTags(w, filters.tags!));
  }

  if (filters.creators && filters.creators.length > 0) {
    filtered = filtered.filter(w => matchesCreator(w, filters.creators!));
  }

  return filtered;
}

/**
 * Extract unique creators from workout list
 */
export function extractCreators(workouts: UnifiedWorkout[]): string[] {
  const creators = new Set<string>();

  for (const workout of workouts) {
    if (workout.creator) {
      creators.add(workout.creator);
    }
  }

  return Array.from(creators).sort((a, b) => a.localeCompare(b));
}

/**
 * Extract unique tags from workout list
 */
export function extractTags(workouts: UnifiedWorkout[]): string[] {
  const tags = new Set<string>();

  for (const workout of workouts) {
    for (const tag of workout.tags) {
      tags.add(tag);
    }
  }

  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}
